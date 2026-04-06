# シフト × Googleカレンダー × 予実管理 統合要件定義書

作成日: 2026-04-06
ステータス: ドラフト / 実装フェーズ着手中

---

## 1. 目的

Googleカレンダー上で管理されている業務予定を Canvi の `shifts` と同格に扱い、以下を実現する:

- シフト通知 / 未打刻アラート / シフトGAP検出
- 月次・PJ別・事業別・PM別・スタッフ別の予実管理（売上/コスト/粗利/消化率）
- 月給制 / 時給 / 日給 / 件数単価 / 歩合 / コミッション等、複合報酬モデルに対応
- 実打刻を丸めた「業務時間」と生打刻の二層管理

---

## 2. 決定事項サマリー

| # | 項目 | 決定 |
|---|---|---|
| 1 | 取込カレンダー | 各スタッフの primary のみ。Canvi発の予定は二重取込しない (`extendedProperties.private.canviShiftId` で識別) |
| 2 | PJ外予定（業務外） | 全件取り込む。Canviカレンダー側で「PJを選択」ボタンを押すと業務シフト化される。完全手動、ルール学習なし |
| 3 | 招待予定 | 主催者問わず全て取り込む。出欠ステータスも問わない |
| 4 | 単価モデル | `users.compensation_type` (MONTHLY_FIXED / PER_PROJECT) + `project_member_compensations` テーブルで複合報酬（時給/日給/月額/件数単価/歩合/コミッション/固定ボーナス） |
| 5 | 月給按分 | 時間単価 = 月給 ÷ 当月の総稼働時間（丸め後）→ PJ別稼働時間で按分。残業10h超分は給与計算側の話で予実管理対象外 |
| 6 | 予実管理の切り口 | 売上 / コスト / 粗利 / 消化率 を 全体 / 事業別 / PJ別 / PM別 / スタッフ別 でそれぞれ可視化 |
| 7 | 打刻丸め + 通知 | シフト時刻 ±10分以内の打刻は shift時刻に丸めて記録。生打刻は `time_clocks.clock_in/clock_out` に保持。丸め後1分でもズレがあれば20:00日次バッチで通知 |

---

## 3. データモデル設計

### 3.1 `shifts` テーブル拡張

```sql
ALTER TABLE shifts ADD COLUMN source TEXT NOT NULL DEFAULT 'manual';
  -- 'manual' | 'google_calendar' | 'import'
ALTER TABLE shifts ADD COLUMN external_event_id TEXT;          -- Google event id
ALTER TABLE shifts ADD COLUMN external_calendar_id TEXT;
ALTER TABLE shifts ADD COLUMN external_updated_at TIMESTAMPTZ; -- GCal側 updated
ALTER TABLE shifts ADD COLUMN needs_project_assignment BOOLEAN DEFAULT FALSE;
  -- GCal取込でPJ未割当のシフト → カレンダー上で「PJ選択」ボタンを表示
CREATE UNIQUE INDEX shifts_external_event_uq
  ON shifts(staff_id, external_event_id)
  WHERE external_event_id IS NOT NULL;
```

- **`source='google_calendar'`** で取り込まれた shift は `project_id=NULL, needs_project_assignment=true` で挿入される
- カレンダー上でクリック → 「このPJに割当」ボタン → `project_id` セット & `needs_project_assignment=false`
- 集計対象は `needs_project_assignment=false` のシフトのみ（未割当は予実から除外、警告表示）

### 3.2 報酬モデル

```sql
-- スタッフ管理画面: 報酬体系
ALTER TABLE users ADD COLUMN compensation_type TEXT DEFAULT 'PER_PROJECT';
  -- 'MONTHLY_FIXED' | 'PER_PROJECT'
ALTER TABLE users ADD COLUMN monthly_salary INTEGER;
  -- MONTHLY_FIXED 時の月額（円）

-- PJメンバー報酬（複数レコード可 = 複合報酬）
CREATE TABLE project_member_compensations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  component_type TEXT NOT NULL,
    -- 'HOURLY' 時給 | 'DAILY' 日給 | 'MONTHLY_FIXED' PJ月額
    -- | 'PER_UNIT' 件数単価 | 'REVENUE_SHARE' 売上%
    -- | 'COMMISSION' 成果報酬 | 'BONUS_FIXED' 固定ボーナス
  amount INTEGER,             -- 単価 or 固定額（円）
  unit_name TEXT,             -- PER_UNIT時の単位名（架電/アポ/成約）
  rate_percent NUMERIC(5,2),  -- REVENUE_SHARE/COMMISSION時の%
  condition_json JSONB,       -- ボーナス発動条件等
  active_from DATE,
  active_to DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX ON project_member_compensations(project_id, staff_id);
```

### 3.3 PJの売上モデル

```sql
ALTER TABLE projects ADD COLUMN revenue_model TEXT DEFAULT 'FIXED';
  -- 'FIXED' 固定契約 | 'PERFORMANCE' 成果報酬 | 'HYBRID'
ALTER TABLE projects ADD COLUMN contract_amount INTEGER;
  -- 契約金額（円）
ALTER TABLE projects ADD COLUMN performance_unit TEXT;
  -- '架電件数' | 'アポ獲得' | '成約' 等
ALTER TABLE projects ADD COLUMN performance_unit_price INTEGER;
  -- 売上側: 1件あたり単価

ALTER TABLE projects ADD COLUMN business_id UUID REFERENCES businesses(id);
ALTER TABLE projects ADD COLUMN pm_user_id UUID REFERENCES users(id);
```

`businesses` テーブル未存在の場合は別途作成:

```sql
CREATE TABLE IF NOT EXISTS businesses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 3.4 月次予算

```sql
CREATE TABLE project_budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  year_month TEXT NOT NULL,           -- 'YYYY-MM'
  budget_revenue INTEGER,             -- 目標売上（円）
  budget_cost INTEGER,                -- 目標コスト（円）
  budget_hours NUMERIC(8,2),          -- 目標稼働時間
  budget_performance_count INTEGER,   -- 目標件数
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_id, year_month)
);
```

### 3.5 実績件数

```sql
CREATE TABLE project_performance_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id),
  staff_id UUID REFERENCES staff(id),
  log_date DATE NOT NULL,
  unit_type TEXT NOT NULL,
  count INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX ON project_performance_logs(project_id, log_date);
```

### 3.6 打刻丸め

```sql
ALTER TABLE time_clocks ADD COLUMN clock_in_rounded TIMESTAMPTZ;
ALTER TABLE time_clocks ADD COLUMN clock_out_rounded TIMESTAMPTZ;
ALTER TABLE time_clocks ADD COLUMN rounding_applied BOOLEAN DEFAULT FALSE;
```

- `clock_in` / `clock_out` = 生打刻（監査・証跡）
- `clock_in_rounded` / `clock_out_rounded` = シフト時刻に丸めた値（計算・表示・GAP判定）
- 丸め幅: シフト時刻 **±10分**
- 範囲外の場合は生打刻をそのままコピー

---

## 4. 同期エンジン

### 4.1 取得パイプライン

```
GCal primary カレンダー
  │ events.list?updatedMin=<lastSync>
  ▼
[取込フィルタ]
  ├─ extendedProperties.private.canviShiftId が存在 → スキップ（Canvi発のため）
  └─ それ以外 → 取込候補
  │
  ▼
[既存判定] shifts WHERE staff_id=? AND external_event_id=?
  ├─ 存在 → 時刻/タイトル差分があれば UPDATE
  └─ 新規 → INSERT (source='google_calendar', project_id=NULL, needs_project_assignment=TRUE)
  │
  ▼
[削除検知] DB上のshiftがGCal側で消えた → shifts.deleted_at セット
```

### 4.2 実行トリガー

- **Tier 1**: Canviカレンダー画面表示時にオンデマンド差分同期（即時性）
- **Tier 2**: 15分Cron (`/api/cron/sync-google-calendar`) で定期差分同期（保険）
- **Tier 3**: `calendar.events.watch` Webhook（将来拡張）

### 4.3 双方向同期ルール

- GCal → Canvi: 常時（時刻・タイトルはGCalが正）
- Canvi → GCal: `source='manual'` のシフトのみ、既存 `syncShiftToCalendar` 継続
- 取込シフトを Canvi で編集時: `project_id` / `shift_type` のみ編集可。時刻はGCal追従

---

## 5. 予実計算ロジック

### 5.1 コスト計算

```
for 各 shift (shift_type='WORK', needs_project_assignment=false, 丸め後の時刻):
  if staff.compensation_type == 'MONTHLY_FIXED':
    # 月給按分
    total_hours_of_month = sum(当月の全シフト稼働時間 for this staff)
    hourly = staff.monthly_salary / total_hours_of_month
    cost = hourly * (shift end - shift start, 丸め後)
  else:
    # PER_PROJECT: project_member_compensations を全要素足し算
    cost = 0
    for comp in project_member_compensations(project_id, staff_id):
      if comp.component_type == 'HOURLY':
        cost += comp.amount * hours
      elif comp.component_type == 'DAILY':
        cost += comp.amount  # 日に1回加算
      elif comp.component_type == 'MONTHLY_FIXED':
        cost += comp.amount / 稼働日数
      elif comp.component_type == 'PER_UNIT':
        cost += comp.amount * performance_count_of_day
      elif comp.component_type == 'REVENUE_SHARE':
        cost += revenue_of_day * comp.rate_percent / 100
      elif comp.component_type == 'COMMISSION':
        cost += performance_revenue * comp.rate_percent / 100
      elif comp.component_type == 'BONUS_FIXED':
        cost += comp.amount if condition_met(comp.condition_json)
```

### 5.2 売上計算

```
if project.revenue_model == 'FIXED':
  revenue = project.contract_amount
elif project.revenue_model == 'PERFORMANCE':
  revenue = sum(project_performance_logs.count) * project.performance_unit_price
elif project.revenue_model == 'HYBRID':
  revenue = project.contract_amount + sum(logs.count) * project.performance_unit_price
```

### 5.3 集計ビュー

予実管理ページで表示する指標:

| 切り口 | 売上 | コスト | 粗利 | 消化率 |
|---|---|---|---|---|
| 全体 | ○ | ○ | ○ | ○ |
| 事業別 | ○ | ○ | ○ | ○ |
| PJ別 | ○ | ○ | ○ | ○ |
| PM別 | ○ | ○ | ○ | ○ |
| スタッフ別 | - | ○ | - | - |

- 消化率 = 実績 / 予算 (時間・金額 両方)
- 月中は「暫定値」として表示。月締め後に確定

---

## 6. 通知・アラート

### 6.1 シフトvs打刻GAP通知

- トリガー: 毎日 **20:00** 日次バッチ (`/api/cron/attendance-gap-check`)
- 条件: 丸め後1分でもズレがあれば通知対象
- 通知先: 既存Slack通知基盤（スタッフ本人 + PJの管理者チャンネル）
- 現行22:00 → 20:00 に変更

### 6.2 未打刻アラート

既存の `/api/cron/attendance-check` を `source` 横断化:
- `source='google_calendar'` の shift も未打刻チェック対象
- 打刻が必要かどうかは `needs_project_assignment=false` でフィルタ（未割当は対象外）

### 6.3 未割当シフト通知

- GCal取込後、`needs_project_assignment=true` のシフト件数が一定以上 → 本人にSlack DM
- 「X件のGoogleカレンダー予定のPJ割当が未完了です」

---

## 7. UI変更

### 7.1 Canviカレンダー（shifts page）

- GCal取込シフトは通常シフトと同じく表示（`source` でアイコン区別）
- 未割当 (`needs_project_assignment=true`) のシフトは **グレー+点線枠** で表示
- クリック → 編集ダイアログに「PJを選択」セクションを追加
- PJ選択ボタンで即座に割当、カレンダーが再読込される

### 7.2 スタッフ管理画面

- 「報酬体系」タブを追加
- `compensation_type` 選択: 「月額固定」 or 「PJ個別設定」
- 月額固定を選んだ場合: 月額入力フィールド

### 7.3 PJ管理画面 > メンバー報酬タブ

- メンバー単位で「報酬要素」を複数追加可能
- 要素タイプ: 時給 / 日給 / 月額 / 件数単価 / 歩合 / コミッション / ボーナス
- 有効期間 (active_from / active_to) を指定可

### 7.4 予実管理ページ（新規）

- `/finance/actuals`
- フィルタ: 月 / 事業 / PJ / PM / スタッフ
- タブ: 全体 / 事業別 / PJ別 / PM別 / スタッフ別
- チャート: 売上vs予算、コストvs予算、粗利推移

---

## 8. 実装フェーズ

| Phase | 内容 | 主要成果物 |
|---|---|---|
| **Phase 1** | データモデル & オンデマンド同期 | マイグレーション + `syncFromGoogleCalendarForStaff()` + 「PJ選択」UI |
| **Phase 2** | Cron同期 & 未割当通知 | 15分Cron + Slack DM |
| **Phase 3** | 報酬モデル + UI | users/projects テーブル拡張 + スタッフ画面/PJ報酬画面 |
| **Phase 4** | 打刻丸め + GAP通知 20:00化 | time_clocks拡張 + cron時刻変更 |
| **Phase 5** | 予実管理ページ | `/finance/actuals` + 集計API + チャート |

本ドキュメント時点で **Phase 1 着手中**。

---

## 9. 未確定・将来論点

- [ ] 終日予定・private 予定の扱い（現状: 全取込）
- [ ] 休憩時間の丸めルール
- [ ] 月中の「暫定値」表示での総稼働時間の分母（前月実績 or シフト予定？）
- [ ] `businesses` テーブルが既存か要確認
- [ ] `staff` と `users` の関係性（現状の設計ポイント）
- [ ] RLS ポリシーの更新範囲
