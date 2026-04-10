-- Google Token 定期再認証サポート
ALTER TABLE users ADD COLUMN IF NOT EXISTS google_last_auth_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS google_token_status TEXT DEFAULT 'active';

-- google_last_auth_at: ユーザーがGoogle OAuthで最後にログインした日時
-- google_token_status: 'active' | 'needs_reauth' | 'disconnected'
-- active: トークンが有効
-- needs_reauth: リフレッシュトークンが無効になり再ログインが必要
-- disconnected: Google連携が切断されている

COMMENT ON COLUMN users.google_last_auth_at IS 'Last Google OAuth authentication timestamp';
COMMENT ON COLUMN users.google_token_status IS 'Google token status: active, needs_reauth, disconnected';
