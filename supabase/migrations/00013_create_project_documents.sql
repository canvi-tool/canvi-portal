-- PJ向け見積書
CREATE TABLE project_estimates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  estimate_number TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  client_name TEXT NOT NULL,
  client_address TEXT,
  client_contact_person TEXT,
  client_email TEXT,
  description TEXT,
  items JSONB NOT NULL DEFAULT '[]', -- [{name, description, quantity, unit, unit_price, amount}]
  subtotal NUMERIC(12,0) NOT NULL DEFAULT 0,
  tax_rate NUMERIC(5,2) NOT NULL DEFAULT 10.00,
  tax_amount NUMERIC(12,0) NOT NULL DEFAULT 0,
  total_amount NUMERIC(12,0) NOT NULL DEFAULT 0,
  valid_until DATE,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','sent','accepted','rejected','expired')),
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- PJ向け契約書（スタッフ契約とは別）
CREATE TABLE project_contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  estimate_id UUID REFERENCES project_estimates(id),
  contract_number TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  client_name TEXT NOT NULL,
  client_address TEXT,
  client_contact_person TEXT,
  client_email TEXT,
  content TEXT, -- 契約本文
  items JSONB NOT NULL DEFAULT '[]',
  subtotal NUMERIC(12,0) NOT NULL DEFAULT 0,
  tax_rate NUMERIC(5,2) NOT NULL DEFAULT 10.00,
  tax_amount NUMERIC(12,0) NOT NULL DEFAULT 0,
  total_amount NUMERIC(12,0) NOT NULL DEFAULT 0,
  start_date DATE,
  end_date DATE,
  payment_terms TEXT, -- 支払条件
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','pending_signature','signed','active','expired','terminated')),
  external_sign_id TEXT, -- freee Sign document ID
  signed_at TIMESTAMPTZ,
  signed_document_url TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- PJ向け請求書
CREATE TABLE project_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  contract_id UUID REFERENCES project_contracts(id),
  invoice_number TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  client_name TEXT NOT NULL,
  client_address TEXT,
  client_contact_person TEXT,
  client_email TEXT,
  description TEXT,
  items JSONB NOT NULL DEFAULT '[]',
  subtotal NUMERIC(12,0) NOT NULL DEFAULT 0,
  tax_rate NUMERIC(5,2) NOT NULL DEFAULT 10.00,
  tax_amount NUMERIC(12,0) NOT NULL DEFAULT 0,
  total_amount NUMERIC(12,0) NOT NULL DEFAULT 0,
  issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE,
  payment_method TEXT, -- 振込先情報
  bank_info TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','sent','paid','overdue','cancelled')),
  sent_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_project_estimates_project ON project_estimates(project_id);
CREATE INDEX idx_project_contracts_project ON project_contracts(project_id);
CREATE INDEX idx_project_invoices_project ON project_invoices(project_id);
