# Canvi Portal - 不足機能 要件定義書

## 現状の実装状況サマリー

### ✅ 実装済み（機能として動作する）
| # | 機能 | 状態 |
|---|------|------|
| 1 | 入退職関連の情報回収 | ✅ オンボーディングフォーム + トークンベース回収 |
| 2 | Google/Zoomアカウント発行・削除 | ✅ Google Workspace + Zoom API連携済み |
| 3 | 入退社・離任時の契約書作成・送付 | ✅ freeeサイン連携済み |
| 4 | シフト提出・編集・管理（Googleカレンダー同期） | ✅ シフトCRUD + 承認WF + GCal同期 |
| 5 | プロジェクトの業務・予実管理 | ✅ PJ管理 + アサイン + 報酬ルール |
| 6 | クライアントとの契約書・見積書の作成・送付 | ✅ 書類管理 + PDF生成 + freeeサイン |
| 7 | 請求書・支払通知書の自動発行 | ✅ 支払計算エンジン + PDF生成 |
| 8 | クライアント管理 | ✅ クライアントCRUD |
| 9 | 勤務報告（日報・週報・月報） | ✅ work_reports CRUD + 承認WF |
| 10 | 退職・離任管理 | ✅ 退職WF + 最終支払処理 |

### ⚠️ 部分実装（基盤はあるが拡張が必要）
| # | 機能 | 現状 | 不足 |
|---|------|------|------|
| 11 | AIアラート機能 | UIとalertsテーブルあり | AI検知ロジック未実装 |
| 12 | 有給管理 | 退職時の残有給フィールドのみ | 付与・申請・承認・残日数管理なし |
| 13 | リマインド通知 | オンボーディングのCronリマインダーのみ | 汎用リマインド + Slack通知なし |
| 14 | 業務報告のAI FB | Claude API接続済み | AI上司フィードバック機能なし |

### ❌ 未実装（新規開発が必要）
| # | 機能 |
|---|------|
| 15 | 出退勤の打刻機能（タイムカード） |
| 16 | Slack通知連携 |
| 17 | 社内報 |
| 18 | e-learning（在宅研修） |
| 19 | MENTER連携（DX人材研修） |
| 20 | シフトvs打刻の差異アラート |

---

## 不足機能 詳細要件定義

---

### Feature 1: 出退勤の打刻機能（タイムカードシステム）
**優先度: 🔴 最高（4/1リリース対象）**

#### 概要
ジョブカンやKING OF TIMEのような、リアルタイムの出退勤打刻機能。メンバーがポータル上でワンタップで出勤・退勤を記録する。

#### 機能要件
| 項目 | 内容 |
|------|------|
| 出勤打刻 | ボタン1タップで出勤記録。プロジェクト選択付き |
| 退勤打刻 | ボタン1タップで退勤記録。勤務時間自動算出 |
| 休憩開始/終了 | 休憩時間の打刻（任意） |
| 打刻修正申請 | 打刻忘れ・誤りの修正申請 → 管理者承認 |
| 勤務時間集計 | 日次・週次・月次の自動集計 |
| 打刻履歴一覧 | 個人：自分の打刻一覧 / 管理者：全員の打刻一覧 |
| 位置情報（任意） | 在宅/オフィス判定（GPS or IPベース） |
| 複数PJ対応 | 1日に複数PJの勤務を記録可能 |

#### DBテーブル設計
```sql
CREATE TABLE attendance_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID NOT NULL REFERENCES staff(id),
  project_id UUID REFERENCES projects(id),
  date DATE NOT NULL,
  clock_in TIMESTAMPTZ,           -- 出勤打刻時刻
  clock_out TIMESTAMPTZ,          -- 退勤打刻時刻
  break_start TIMESTAMPTZ,        -- 休憩開始
  break_end TIMESTAMPTZ,          -- 休憩終了
  break_minutes INTEGER DEFAULT 0,-- 休憩時間（分）
  work_minutes INTEGER,           -- 実勤務時間（分）自動計算
  overtime_minutes INTEGER DEFAULT 0, -- 残業時間（分）
  status TEXT DEFAULT 'clocked_in' CHECK (status IN (
    'clocked_in', 'clocked_out', 'modified', 'approved'
  )),
  location_type TEXT CHECK (location_type IN ('office', 'remote', 'client_site', 'other')),
  ip_address INET,
  note TEXT,
  modified_by UUID REFERENCES auth.users(id),  -- 修正者
  modification_reason TEXT,                      -- 修正理由
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_attendance_staff_date ON attendance_records(staff_id, date);
CREATE INDEX idx_attendance_project_date ON attendance_records(project_id, date);
CREATE UNIQUE INDEX idx_attendance_unique ON attendance_records(staff_id, project_id, date);
```

#### API設計
```
POST   /api/attendance/clock-in      -- 出勤打刻
POST   /api/attendance/clock-out     -- 退勤打刻
POST   /api/attendance/break-start   -- 休憩開始
POST   /api/attendance/break-end     -- 休憩終了
GET    /api/attendance               -- 打刻一覧（フィルタ: staff_id, date_from, date_to, project_id）
GET    /api/attendance/today         -- 今日の自分の打刻状態
PUT    /api/attendance/[id]          -- 打刻修正申請
POST   /api/attendance/[id]/approve  -- 修正承認
GET    /api/attendance/summary       -- 月次集計（staff_id, year_month）
```

#### UI設計
- **打刻ウィジェット**（ダッシュボード + ヘッダー常駐）
  - 大きな「出勤」「退勤」ボタン
  - 現在の勤務状態表示（未出勤 / 勤務中 / 休憩中 / 退勤済み）
  - 今日の勤務時間リアルタイム表示
  - PJ選択ドロップダウン
- **打刻一覧ページ** `/attendance`
  - カレンダービュー + リスト切替
  - 月次集計サマリー
- **管理者ビュー** `/attendance/admin`
  - 全メンバーの当日打刻状況
  - 未出勤者リスト
  - 修正申請の承認キュー

#### 支払計算エンジンとの連携
- `attendance_records` の `work_minutes` を報酬計算の入力データとして使用
- 既存の `compensation_rules` の `time_rate` ルールと直結

---

### Feature 2: 有給休暇管理
**優先度: 🟡 中（4月中旬目標）**

#### 概要
正社員の有給休暇の付与・申請・承認・残日数管理を行う。労基法準拠の自動付与ロジック含む。

#### 機能要件
| 項目 | 内容 |
|------|------|
| 有給付与 | 入社6ヶ月後に10日付与、以降毎年増加（労基法準拠） |
| 有給申請 | メンバーが日付・種別（全日/半日/時間単位）を指定して申請 |
| 申請承認 | 管理者が承認/却下 |
| 残日数表示 | リアルタイムの有給残日数表示 |
| 有効期限管理 | 付与日から2年で消滅（繰越管理） |
| 取得率表示 | 年間取得率の可視化（年5日取得義務の管理） |
| 有給種別 | 有給/特別休暇（慶弔等）/代休 |

#### DBテーブル設計
```sql
-- 有給付与レコード
CREATE TABLE leave_grants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID NOT NULL REFERENCES staff(id),
  grant_date DATE NOT NULL,          -- 付与日
  expiry_date DATE NOT NULL,         -- 有効期限（付与日+2年）
  grant_type TEXT DEFAULT 'annual' CHECK (grant_type IN (
    'annual', 'special', 'compensatory'
  )),
  total_days NUMERIC(4,1) NOT NULL,  -- 付与日数
  used_days NUMERIC(4,1) DEFAULT 0,  -- 使用済み日数
  remaining_days NUMERIC(4,1),       -- 残日数（自動計算）
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 有給申請レコード
CREATE TABLE leave_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID NOT NULL REFERENCES staff(id),
  leave_grant_id UUID REFERENCES leave_grants(id),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  leave_type TEXT NOT NULL CHECK (leave_type IN (
    'full_day', 'half_day_am', 'half_day_pm', 'hourly'
  )),
  hours NUMERIC(3,1),                -- 時間単位の場合
  days NUMERIC(4,1) NOT NULL,        -- 使用日数
  reason TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN (
    'pending', 'approved', 'rejected', 'cancelled'
  )),
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

#### API設計
```
GET    /api/leave/balance             -- 自分の有給残日数
GET    /api/leave/grants              -- 付与履歴
POST   /api/leave/grants              -- 手動付与（管理者）
GET    /api/leave/requests            -- 申請一覧
POST   /api/leave/requests            -- 申請作成
PUT    /api/leave/requests/[id]       -- 申請修正
POST   /api/leave/requests/[id]/approve  -- 承認
POST   /api/leave/requests/[id]/reject   -- 却下
DELETE /api/leave/requests/[id]       -- 申請取消
GET    /api/leave/summary             -- チーム有給取得率サマリー
```

---

### Feature 3: Slack通知連携
**優先度: 🔴 高（全アラート機能の基盤）**

#### 概要
ポータル内の各種イベントをSlackチャンネル/DMに自動通知する。

#### 対象イベント
| カテゴリ | イベント | 通知先 |
|---------|---------|--------|
| シフト | シフト提出 | PJ管理者 |
| シフト | シフト承認/却下 | 本人 |
| 打刻 | 打刻漏れ（退勤未打刻） | 本人 + 管理者 |
| 打刻 | シフトvs打刻の乖離 | 管理者 |
| 勤怠 | 勤務時間超過（例: 10h超） | 管理者 |
| 報告 | 日報未提出（当日23:59まで） | 本人 |
| 報告 | 日報提出期限超過 | 本人 + 管理者 |
| 契約 | 契約未締結リマインド | 本人 + 管理者 |
| 支払 | 支払金額の急変（前月比±30%超） | 管理者 |
| 有給 | 有給申請 | 管理者 |
| 有給 | 年5日取得義務の未消化警告 | 管理者 |
| 一般 | オンボーディング未完了 | 本人 + 管理者 |

#### 技術要件
```
Slack Incoming Webhook or Slack API (Bot Token)
- Webhook URL を環境変数で管理
- チャンネル別設定（#attendance, #reports, #alerts 等）
- メンション対応（Slack User IDとポータルuser_idのマッピング）
```

#### DBテーブル設計
```sql
-- Slack通知設定
CREATE TABLE slack_notification_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,          -- 'shift_submitted', 'clock_missing', etc.
  channel TEXT NOT NULL,             -- '#attendance' or 'DM'
  webhook_url TEXT,                  -- Incoming Webhook URL
  enabled BOOLEAN DEFAULT true,
  template TEXT,                     -- メッセージテンプレート
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ユーザーとSlack IDのマッピング
CREATE TABLE user_slack_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  slack_user_id TEXT NOT NULL,       -- Slack Member ID
  slack_workspace_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id)
);
```

#### API設計
```
POST   /api/notifications/slack/send     -- Slack通知送信（内部用）
GET    /api/settings/slack               -- Slack設定一覧
PUT    /api/settings/slack               -- Slack設定更新
POST   /api/settings/slack/test          -- テスト通知送信
```

---

### Feature 4: AI上司フィードバック・異常検知
**優先度: 🟡 中（4月中旬目標）**

#### 概要
Claude APIを使った2つのAI機能：
1. **日報へのAI上司フィードバック** — 提出された日報に対して建設的なFBを自動生成
2. **異常検知アラート** — 勤務時間・支払金額・シフト乖離等の異常を自動検出

#### 4-A: AI上司フィードバック

| 項目 | 内容 |
|------|------|
| トリガー | 日報提出時に自動実行 |
| 入力データ | 日報内容 + 過去1週間の日報 + PJ情報 + KPI |
| 出力 | 良かった点 / 改善点 / 質問 / 明日へのアドバイス |
| 表示場所 | 日報詳細ページにAI FBセクション追加 |
| 壁打ち機能 | AIとのチャット形式で相談可能 |

#### 4-B: 異常検知

| 検知項目 | ロジック | アクション |
|---------|---------|-----------|
| 勤務時間異常 | 日8h超 or 月160h超 | アラート生成 + Slack通知 |
| 打刻漏れ | シフトありだが打刻なし | アラート + 本人Slack DM |
| シフトvs打刻乖離 | 30分以上の差異 | 管理者アラート |
| 支払金額急変 | 前月比±30%超 | 管理者アラート |
| 日報未提出 | 勤務日の翌日12時まで未提出 | 本人リマインド |
| 契約期限切れ間近 | 30日/14日/7日前 | 管理者アラート |

#### API設計
```
POST   /api/ai/feedback           -- 日報FB生成
POST   /api/ai/chat               -- AI壁打ちチャット
GET    /api/ai/anomalies          -- 異常検知結果一覧
POST   /api/cron/ai-anomaly-scan  -- 異常検知バッチ（Vercel Cron）
POST   /api/cron/daily-reminder   -- 日次リマインドバッチ（Vercel Cron）
```

---

### Feature 5: 社内報
**優先度: 🟢 低（4月下旬）**

#### 概要
社内ニュースやお知らせを投稿・閲覧できるシンプルなCMS機能。

#### 機能要件
| 項目 | 内容 |
|------|------|
| 記事投稿 | タイトル + 本文（リッチテキスト） + カテゴリ + 画像 |
| カテゴリ | お知らせ / イベント / ナレッジ共有 / 福利厚生 / その他 |
| 閲覧権限 | 全員 or ロール指定 |
| 既読管理 | 誰が読んだか追跡（重要なお知らせ用） |
| ピン留め | 重要記事をトップ固定 |
| コメント | 記事へのコメント機能 |
| 通知 | 新着記事をSlack + ポータル内通知 |

#### DBテーブル設計
```sql
CREATE TABLE announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  body TEXT NOT NULL,                -- リッチテキスト（HTML or Markdown）
  category TEXT DEFAULT 'news' CHECK (category IN (
    'news', 'event', 'knowledge', 'benefit', 'other'
  )),
  is_pinned BOOLEAN DEFAULT false,
  is_important BOOLEAN DEFAULT false, -- 既読追跡対象
  visibility TEXT DEFAULT 'all',      -- 'all' or ロール指定
  visible_roles TEXT[],               -- 閲覧可能ロール
  thumbnail_url TEXT,
  author_id UUID NOT NULL REFERENCES auth.users(id),
  published_at TIMESTAMPTZ,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE announcement_reads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  announcement_id UUID NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  read_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(announcement_id, user_id)
);

CREATE TABLE announcement_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  announcement_id UUID NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

---

### Feature 6: e-learning（在宅研修プラットフォーム）
**優先度: 🟢 低（4月下旬〜5月）**

#### 概要
在宅で成果を上げるための研修コンテンツを提供。動画 + テスト形式。

#### 機能要件
| 項目 | 内容 |
|------|------|
| コース管理 | コース作成（タイトル・説明・カテゴリ・対象者） |
| レッスン | 動画URL（YouTube/Vimeo埋込） + テキスト教材 |
| 確認テスト | 選択式テスト（合格点設定あり） |
| 進捗管理 | レッスン完了率 + テスト合格状況 |
| 受講対象 | 全員受講可能（一部は在籍6ヶ月以上） |
| 修了証 | コース完了時に修了証PDF発行 |
| 管理者ダッシュボード | メンバー別受講状況一覧 |

#### DBテーブル設計
```sql
CREATE TABLE courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  category TEXT,
  thumbnail_url TEXT,
  is_required BOOLEAN DEFAULT false,  -- 必須受講
  min_tenure_months INTEGER DEFAULT 0, -- 最低在籍月数（0=全員）
  sort_order INTEGER DEFAULT 0,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE lessons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content_type TEXT CHECK (content_type IN ('video', 'text', 'quiz')),
  video_url TEXT,
  text_content TEXT,
  sort_order INTEGER DEFAULT 0,
  duration_minutes INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE quiz_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id UUID NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  options JSONB NOT NULL,            -- [{"text": "...", "is_correct": true}, ...]
  sort_order INTEGER DEFAULT 0
);

CREATE TABLE course_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES courses(id),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  status TEXT DEFAULT 'enrolled' CHECK (status IN (
    'enrolled', 'in_progress', 'completed'
  )),
  progress_percent INTEGER DEFAULT 0,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(course_id, user_id)
);

CREATE TABLE lesson_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id UUID NOT NULL REFERENCES lessons(id),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  quiz_score INTEGER,                -- テストの場合のスコア
  quiz_passed BOOLEAN,
  completed_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(lesson_id, user_id)
);
```

---

### Feature 7: MENTER連携（DX人材研修）
**優先度: 🟢 低（4月下旬〜5月）**

#### 概要
WHITE社のMENTERプラットフォームとの連携。在籍6ヶ月以上のメンバーに対して、DX研修コースへのアクセスを提供。

#### 機能要件
| 項目 | 内容 |
|------|------|
| 受講資格チェック | staff.start_date から6ヶ月経過を自動判定 |
| SSO連携 | MENTER側のSSO or OAuth連携（API仕様依存） |
| 進捗取得 | MENTER APIから受講進捗を取得して表示 |
| リンク誘導 | 資格のあるメンバーにMENTERへのリンク表示 |

#### 実装方針
- MENTER側のAPI仕様を確認してから詳細設計
- 最低限はリンク誘導 + 受講資格チェックで初期リリース可能
- API連携は後追い

---

## 実装優先度とスケジュール

### Phase A: 4月1週目（4/1〜4/7）🔴 最優先
| 機能 | 工数目安 |
|------|---------|
| **打刻機能（出退勤）** | 3〜4日 |
| 打刻ウィジェット（ダッシュボード + ヘッダー） | |
| 打刻API（clock-in/out/break） | |
| 打刻一覧 + 管理者ビュー | |
| 打刻と支払計算エンジンの連携 | |

### Phase B: 4月2週目（4/8〜4/14）🟡 高
| 機能 | 工数目安 |
|------|---------|
| **Slack通知連携** | 2日 |
| **打刻アラート（打刻漏れ・シフト乖離）** | 1日 |
| **日報リマインド（Slack + ポータル）** | 1日 |
| **有給管理（基本機能）** | 2日 |

### Phase C: 4月3週目（4/15〜4/21）🟡 中
| 機能 | 工数目安 |
|------|---------|
| **AI上司フィードバック** | 2日 |
| **AI異常検知バッチ** | 2日 |
| **各種リマインド・アラートの拡充** | 1日 |

### Phase D: 4月4週目（4/22〜4/30）🟢 低
| 機能 | 工数目安 |
|------|---------|
| **社内報** | 2日 |
| **e-learning基盤** | 3日 |
| **MENTER連携（リンク誘導のみ）** | 0.5日 |

---

## 補足：既存機能の改善ポイント

| 対象 | 改善内容 |
|------|---------|
| ダッシュボード | 打刻ウィジェット追加 + KPIの実データ表示 |
| シフト管理 | 打刻データとの照合ビュー追加 |
| 支払計算 | attendance_records からの自動データ取り込み |
| アラート | AI検知結果 + Slack通知の統合表示 |
| 日報 | AI FBセクション + 壁打ちチャットUI追加 |
| Cronジョブ | 日次リマインド + 異常検知スキャンの追加 |
