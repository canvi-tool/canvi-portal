-- 日程調整リンク
CREATE TABLE IF NOT EXISTS scheduling_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL DEFAULT '日程調整',
  created_by UUID NOT NULL REFERENCES auth.users(id),
  member_ids TEXT[] NOT NULL,
  mode TEXT NOT NULL DEFAULT 'all_free' CHECK (mode IN ('all_free', 'any_free')),
  date_range_start DATE NOT NULL,
  date_range_end DATE NOT NULL,
  time_range_start TIME NOT NULL DEFAULT '09:00',
  time_range_end TIME NOT NULL DEFAULT '18:00',
  duration_minutes INTEGER NOT NULL DEFAULT 60,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'booked', 'expired', 'cancelled')),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 日程調整の予約
CREATE TABLE IF NOT EXISTS scheduling_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  link_id UUID NOT NULL REFERENCES scheduling_links(id) ON DELETE CASCADE,
  guest_name TEXT NOT NULL,
  guest_email TEXT,
  guest_company TEXT,
  selected_start TIMESTAMPTZ NOT NULL,
  selected_end TIMESTAMPTZ NOT NULL,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'cancelled')),
  google_calendar_event_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_scheduling_links_slug ON scheduling_links(slug);
CREATE INDEX IF NOT EXISTS idx_scheduling_links_created_by ON scheduling_links(created_by);
CREATE INDEX IF NOT EXISTS idx_scheduling_links_status ON scheduling_links(status) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_scheduling_bookings_link_id ON scheduling_bookings(link_id);

-- RLS
ALTER TABLE scheduling_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduling_bookings ENABLE ROW LEVEL SECURITY;

-- scheduling_links: 認証ユーザーは自分が作ったリンクを管理可能
CREATE POLICY "scheduling_links_select" ON scheduling_links
  FOR SELECT USING (auth.uid() = created_by);
CREATE POLICY "scheduling_links_insert" ON scheduling_links
  FOR INSERT WITH CHECK (auth.uid() = created_by);
CREATE POLICY "scheduling_links_update" ON scheduling_links
  FOR UPDATE USING (auth.uid() = created_by);

-- scheduling_bookings: リンク作成者が閲覧可能
CREATE POLICY "scheduling_bookings_select" ON scheduling_bookings
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM scheduling_links WHERE id = link_id AND created_by = auth.uid())
  );

-- 公開APIはservice_role keyで操作するためRLSバイパス
