CREATE TABLE IF NOT EXISTS schema_migrations (
  id VARCHAR(191) PRIMARY KEY,
  checksum CHAR(64) NOT NULL,
  applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS prospects (
  id CHAR(36) PRIMARY KEY, email VARCHAR(320) NOT NULL, first_name VARCHAR(255), last_name VARCHAR(255),
  company VARCHAR(255), job_title VARCHAR(255), phone VARCHAR(100), status VARCHAR(40) NOT NULL DEFAULT 'new',
  notes TEXT, extra LONGTEXT NOT NULL, source_file VARCHAR(255),
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY prospects_email_key (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS clients (
  id CHAR(36) PRIMARY KEY, name VARCHAR(255) NOT NULL, company VARCHAR(255), email VARCHAR(320), phone VARCHAR(100),
  website VARCHAR(500), industry VARCHAR(255), status VARCHAR(40) NOT NULL DEFAULT 'active', address TEXT, notes TEXT,
  prospect_id CHAR(36), created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  KEY clients_prospect_idx (prospect_id), CONSTRAINT clients_prospect_fk FOREIGN KEY (prospect_id) REFERENCES prospects(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS mailboxes (
  id CHAR(36) PRIMARY KEY, name VARCHAR(255) NOT NULL, from_email VARCHAR(320) NOT NULL, from_name VARCHAR(255),
  provider VARCHAR(40) NOT NULL DEFAULT 'smtp', smtp_host VARCHAR(255), smtp_port INT DEFAULT 587, smtp_secure BOOLEAN NOT NULL DEFAULT FALSE,
  smtp_username VARCHAR(255), imap_host VARCHAR(255), imap_port INT DEFAULT 993, imap_username VARCHAR(255),
  is_default BOOLEAN NOT NULL DEFAULT FALSE, last_sync_at DATETIME(3), last_status VARCHAR(500),
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), UNIQUE KEY mailboxes_from_email_key (from_email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

ALTER TABLE mailboxes ADD COLUMN IF NOT EXISTS created_by CHAR(36) NULL;

CREATE TABLE IF NOT EXISTS mailbox_secrets (
  mailbox_id CHAR(36) PRIMARY KEY, smtp_password TEXT, imap_password TEXT, oauth_access_token TEXT,
  oauth_refresh_token TEXT, oauth_expires_at DATETIME(3), updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  CONSTRAINT mailbox_secrets_mailbox_fk FOREIGN KEY (mailbox_id) REFERENCES mailboxes(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS campaigns (
  id CHAR(36) PRIMARY KEY, name VARCHAR(255) NOT NULL, subject TEXT NOT NULL, body_html LONGTEXT NOT NULL,
  mailbox_id CHAR(36), cc LONGTEXT NOT NULL, bcc LONGTEXT NOT NULL, attachments LONGTEXT NOT NULL,
  track_opens BOOLEAN NOT NULL DEFAULT TRUE, track_clicks BOOLEAN NOT NULL DEFAULT TRUE,
  status VARCHAR(40) NOT NULL DEFAULT 'draft', sent_at DATETIME(3),
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  CONSTRAINT campaigns_mailbox_fk FOREIGN KEY (mailbox_id) REFERENCES mailboxes(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS campaign_recipients (
  id CHAR(36) PRIMARY KEY, campaign_id CHAR(36) NOT NULL, prospect_id CHAR(36) NOT NULL,
  status VARCHAR(40) NOT NULL DEFAULT 'pending', error VARCHAR(500), message_id VARCHAR(500),
  sent_at DATETIME(3), opened_at DATETIME(3), open_count INT NOT NULL DEFAULT 0,
  clicked_at DATETIME(3), click_count INT NOT NULL DEFAULT 0, replied_at DATETIME(3),
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY recipients_campaign_prospect_key (campaign_id, prospect_id), KEY recipients_prospect_idx (prospect_id),
  CONSTRAINT recipients_campaign_fk FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE,
  CONSTRAINT recipients_prospect_fk FOREIGN KEY (prospect_id) REFERENCES prospects(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS campaign_type VARCHAR(40) NOT NULL DEFAULT 'outreach';
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS objective TEXT NULL;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS owner_id CHAR(36) NULL;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS approval_required BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS approved_by CHAR(36) NULL;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS approved_at DATETIME(3) NULL;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS scheduled_at DATETIME(3) NULL;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS completed_at DATETIME(3) NULL;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS timezone VARCHAR(80) NOT NULL DEFAULT 'Africa/Blantyre';
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS daily_limit INT NOT NULL DEFAULT 100;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS stop_on_reply BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS stop_on_bounce BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS audience_rules LONGTEXT NULL;

ALTER TABLE campaign_recipients ADD COLUMN IF NOT EXISTS contact_id CHAR(36) NULL;
ALTER TABLE campaign_recipients ADD COLUMN IF NOT EXISTS current_step INT NOT NULL DEFAULT 1;
ALTER TABLE campaign_recipients ADD COLUMN IF NOT EXISTS next_action_at DATETIME(3) NULL;
ALTER TABLE campaign_recipients ADD COLUMN IF NOT EXISTS stopped_reason VARCHAR(255) NULL;
ALTER TABLE campaign_recipients ADD COLUMN IF NOT EXISTS last_activity_at DATETIME(3) NULL;
ALTER TABLE campaign_recipients ADD COLUMN IF NOT EXISTS converted_at DATETIME(3) NULL;
ALTER TABLE campaign_recipients ADD COLUMN IF NOT EXISTS attempt_count INT NOT NULL DEFAULT 0;
ALTER TABLE campaign_recipients ADD INDEX IF NOT EXISTS recipients_campaign_idx (campaign_id);
ALTER TABLE campaign_recipients DROP INDEX IF EXISTS recipients_campaign_prospect_key;
ALTER TABLE campaign_recipients ADD UNIQUE INDEX IF NOT EXISTS recipients_campaign_contact_key (campaign_id, contact_id);
ALTER TABLE campaign_recipients ADD INDEX IF NOT EXISTS recipients_campaign_due_idx (campaign_id, status, next_action_at);

CREATE TABLE IF NOT EXISTS campaign_steps (
  id CHAR(36) PRIMARY KEY, campaign_id CHAR(36) NOT NULL, step_order INT NOT NULL,
  step_type VARCHAR(40) NOT NULL DEFAULT 'email', name VARCHAR(255) NOT NULL,
  delay_amount INT NOT NULL DEFAULT 0, delay_unit VARCHAR(20) NOT NULL DEFAULT 'days',
  subject TEXT, body_html LONGTEXT, task_instructions TEXT, is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY campaign_steps_order (campaign_id, step_order),
  CONSTRAINT campaign_steps_campaign_fk FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

ALTER TABLE campaign_steps ADD COLUMN IF NOT EXISTS attachments LONGTEXT NULL;

CREATE TABLE IF NOT EXISTS campaign_events (
  id CHAR(36) PRIMARY KEY, campaign_id CHAR(36) NOT NULL, recipient_id CHAR(36),
  event_type VARCHAR(80) NOT NULL, detail TEXT, actor_id CHAR(36),
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  KEY campaign_events_campaign_created (campaign_id, created_at),
  CONSTRAINT campaign_events_campaign_fk FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE,
  CONSTRAINT campaign_events_recipient_fk FOREIGN KEY (recipient_id) REFERENCES campaign_recipients(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS email_suppressions (
  id CHAR(36) PRIMARY KEY, email VARCHAR(320) NOT NULL, reason VARCHAR(80) NOT NULL,
  source VARCHAR(80) NOT NULL DEFAULT 'manual', campaign_id CHAR(36), notes TEXT,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY email_suppressions_email (email),
  CONSTRAINT email_suppressions_campaign_fk FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS deals (
  id CHAR(36) PRIMARY KEY, title VARCHAR(255) NOT NULL, client_id CHAR(36), prospect_id CHAR(36),
  value DECIMAL(15,2) NOT NULL DEFAULT 0, currency VARCHAR(8) NOT NULL DEFAULT 'USD', stage VARCHAR(40) NOT NULL DEFAULT 'new',
  probability INT NOT NULL DEFAULT 20, expected_close_date DATE, owner VARCHAR(255), notes TEXT,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  KEY deals_client_idx (client_id), KEY deals_prospect_idx (prospect_id),
  CONSTRAINT deals_client_fk FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  CONSTRAINT deals_prospect_fk FOREIGN KEY (prospect_id) REFERENCES prospects(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS agreements (
  id CHAR(36) PRIMARY KEY, client_id CHAR(36) NOT NULL, deal_id CHAR(36), title VARCHAR(255) NOT NULL,
  agreement_type VARCHAR(40) NOT NULL DEFAULT 'contract', status VARCHAR(40) NOT NULL DEFAULT 'active',
  start_date DATE, end_date DATE, value DECIMAL(15,2) NOT NULL DEFAULT 0, currency VARCHAR(8) NOT NULL DEFAULT 'USD',
  billing_cycle VARCHAR(40) NOT NULL DEFAULT 'monthly', response_time_hours INT, resolution_time_hours INT,
  coverage_hours VARCHAR(255), auto_renew BOOLEAN NOT NULL DEFAULT FALSE, notes TEXT,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  KEY agreements_client_idx (client_id), KEY agreements_deal_idx (deal_id),
  CONSTRAINT agreements_client_fk FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  CONSTRAINT agreements_deal_fk FOREIGN KEY (deal_id) REFERENCES deals(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS agreement_items (
  id CHAR(36) PRIMARY KEY, agreement_id CHAR(36) NOT NULL, description TEXT NOT NULL,
  quantity DECIMAL(12,2) NOT NULL DEFAULT 1, unit_price DECIMAL(15,2) NOT NULL DEFAULT 0,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  KEY items_agreement_idx (agreement_id), CONSTRAINT items_agreement_fk FOREIGN KEY (agreement_id) REFERENCES agreements(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS activities (
  id CHAR(36) PRIMARY KEY, entity_type VARCHAR(40) NOT NULL, entity_id CHAR(36) NOT NULL,
  activity_type VARCHAR(40) NOT NULL DEFAULT 'note', body TEXT NOT NULL,
  occurred_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3), KEY activities_entity_idx (entity_type, entity_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS replies (
  id CHAR(36) PRIMARY KEY, mailbox_id CHAR(36), prospect_id CHAR(36), campaign_id CHAR(36),
  from_email VARCHAR(320) NOT NULL, subject TEXT, snippet TEXT,
  received_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), external_id VARCHAR(500),
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), UNIQUE KEY replies_external_id_key (external_id),
  KEY replies_prospect_idx (prospect_id),
  CONSTRAINT replies_mailbox_fk FOREIGN KEY (mailbox_id) REFERENCES mailboxes(id) ON DELETE SET NULL,
  CONSTRAINT replies_prospect_fk FOREIGN KEY (prospect_id) REFERENCES prospects(id) ON DELETE SET NULL,
  CONSTRAINT replies_campaign_fk FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
ALTER TABLE replies ADD COLUMN IF NOT EXISTS contact_id CHAR(36) NULL;
ALTER TABLE replies ADD COLUMN IF NOT EXISTS body LONGTEXT NULL;
ALTER TABLE replies ADD COLUMN IF NOT EXISTS opportunity_type VARCHAR(20) NULL;
ALTER TABLE replies ADD COLUMN IF NOT EXISTS opportunity_id CHAR(36) NULL;
ALTER TABLE replies ADD INDEX IF NOT EXISTS replies_opportunity_idx (opportunity_type, opportunity_id, received_at);

CREATE TABLE IF NOT EXISTS quotations (
  id CHAR(36) PRIMARY KEY, quote_number VARCHAR(60) NOT NULL, title VARCHAR(255) NOT NULL,
  client_id CHAR(36), deal_id CHAR(36), status VARCHAR(40) NOT NULL DEFAULT 'draft',
  currency VARCHAR(10) NOT NULL DEFAULT 'USD', issue_date DATE, valid_until DATE,
  tax_rate DECIMAL(6,2) NOT NULL DEFAULT 0, discount DECIMAL(15,2) NOT NULL DEFAULT 0, notes TEXT,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  KEY quotations_client_idx (client_id),
  CONSTRAINT quotations_client_fk FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS quotation_items (
  id CHAR(36) PRIMARY KEY, quotation_id CHAR(36) NOT NULL, description TEXT NOT NULL,
  quantity DECIMAL(12,2) NOT NULL DEFAULT 1, unit_price DECIMAL(15,2) NOT NULL DEFAULT 0,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  KEY quotation_items_idx (quotation_id),
  CONSTRAINT quotation_items_fk FOREIGN KEY (quotation_id) REFERENCES quotations(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS projects (
  id CHAR(36) PRIMARY KEY, name VARCHAR(255) NOT NULL, code VARCHAR(60), client_id CHAR(36),
  manager VARCHAR(255), status VARCHAR(40) NOT NULL DEFAULT 'planned', start_date DATE, end_date DATE,
  budget DECIMAL(15,2) NOT NULL DEFAULT 0, currency VARCHAR(10) NOT NULL DEFAULT 'USD',
  progress INT NOT NULL DEFAULT 0, description TEXT,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  KEY projects_client_idx (client_id),
  CONSTRAINT projects_client_fk FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS bids (
  id CHAR(36) PRIMARY KEY, reference VARCHAR(80), title VARCHAR(255) NOT NULL, buyer VARCHAR(255),
  client_id CHAR(36), status VARCHAR(40) NOT NULL DEFAULT 'identified', closing_date DATE, submission_date DATE,
  value DECIMAL(15,2) NOT NULL DEFAULT 0, currency VARCHAR(10) NOT NULL DEFAULT 'USD',
  bond_amount DECIMAL(15,2) NOT NULL DEFAULT 0, notes TEXT,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  KEY bids_client_idx (client_id),
  CONSTRAINT bids_client_fk FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS cost_sheets (
  id CHAR(36) PRIMARY KEY, name VARCHAR(255) NOT NULL, client_id CHAR(36), quotation_id CHAR(36),
  bid_id CHAR(36), project_id CHAR(36), status VARCHAR(40) NOT NULL DEFAULT 'draft',
  currency VARCHAR(10) NOT NULL DEFAULT 'USD', notes TEXT,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  KEY cost_sheets_client_idx (client_id),
  CONSTRAINT cost_sheets_client_fk FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

ALTER TABLE cost_sheets ADD COLUMN IF NOT EXISTS column_rules LONGTEXT NULL;
ALTER TABLE cost_sheets ADD COLUMN IF NOT EXISTS bid_id CHAR(36) NULL;

CREATE TABLE IF NOT EXISTS cost_sheet_items (
  id CHAR(36) PRIMARY KEY, cost_sheet_id CHAR(36) NOT NULL, category VARCHAR(60) NOT NULL DEFAULT 'labour',
  description TEXT NOT NULL, quantity DECIMAL(12,2) NOT NULL DEFAULT 1,
  unit_cost DECIMAL(15,2) NOT NULL DEFAULT 0, markup_percent DECIMAL(6,2) NOT NULL DEFAULT 0,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  KEY cost_sheet_items_idx (cost_sheet_id),
  CONSTRAINT cost_sheet_items_fk FOREIGN KEY (cost_sheet_id) REFERENCES cost_sheets(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

ALTER TABLE cost_sheet_items ADD COLUMN IF NOT EXISTS custom_values LONGTEXT NULL;
ALTER TABLE cost_sheet_items ADD COLUMN IF NOT EXISTS attachments LONGTEXT NULL;

CREATE TABLE IF NOT EXISTS cost_sheet_columns (
  id CHAR(36) PRIMARY KEY,
  cost_sheet_id CHAR(36) NOT NULL,
  name VARCHAR(160) NOT NULL,
  column_key VARCHAR(80) NOT NULL,
  data_type VARCHAR(20) NOT NULL DEFAULT 'text',
  default_value VARCHAR(255) NULL,
  formula_expression TEXT NULL,
  display_order INT NOT NULL DEFAULT 0,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY cost_sheet_columns_key (cost_sheet_id, column_key),
  KEY cost_sheet_columns_sheet (cost_sheet_id, display_order),
  CONSTRAINT cost_sheet_columns_sheet_fk FOREIGN KEY (cost_sheet_id) REFERENCES cost_sheets(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS cost_sheet_templates (
  id CHAR(36) PRIMARY KEY,
  name VARCHAR(180) NOT NULL,
  description TEXT NULL,
  currency VARCHAR(10) NOT NULL DEFAULT 'MWK',
  column_rules LONGTEXT NULL,
  columns_json LONGTEXT NULL,
  created_by CHAR(36) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  KEY cost_sheet_templates_name_idx (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS jobs (
  id CHAR(36) PRIMARY KEY, title VARCHAR(255) NOT NULL, client_id CHAR(36), project_id CHAR(36),
  job_type VARCHAR(60) NOT NULL DEFAULT 'once-off', assignee VARCHAR(255),
  priority VARCHAR(20) NOT NULL DEFAULT 'medium', status VARCHAR(40) NOT NULL DEFAULT 'scheduled',
  scheduled_date DATE, completed_at DATETIME(3), notes TEXT,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  KEY jobs_client_idx (client_id),
  CONSTRAINT jobs_client_fk FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL,
  CONSTRAINT jobs_project_fk FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS tasks (
  id CHAR(36) PRIMARY KEY, title VARCHAR(255) NOT NULL, entity_type VARCHAR(40) NOT NULL DEFAULT 'general',
  entity_id CHAR(36), assignee VARCHAR(255), priority VARCHAR(20) NOT NULL DEFAULT 'medium',
  status VARCHAR(40) NOT NULL DEFAULT 'open', due_date DATE, notes TEXT,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  KEY tasks_entity_idx (entity_type, entity_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS suppliers (
  id CHAR(36) PRIMARY KEY, name VARCHAR(255) NOT NULL, contact_name VARCHAR(255), email VARCHAR(320),
  phone VARCHAR(100), category VARCHAR(120), notes TEXT,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS supplier_quotes (
  id CHAR(36) PRIMARY KEY,
  supplier_id CHAR(36) NULL,
  source_name VARCHAR(255) NOT NULL,
  quote_reference VARCHAR(120) NULL,
  quote_date DATE NULL,
  valid_until DATE NULL,
  currency VARCHAR(10) NOT NULL DEFAULT 'MWK',
  amount DECIMAL(15,2) NOT NULL DEFAULT 0,
  notes TEXT NULL,
  attachment_path VARCHAR(1000) NULL,
  attachment_name VARCHAR(500) NULL,
  attachment_type VARCHAR(255) NULL,
  attachment_size INT UNSIGNED NULL,
  created_by CHAR(36) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  KEY supplier_quotes_supplier_idx (supplier_id, quote_date),
  CONSTRAINT supplier_quotes_supplier_fk FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS cost_sheet_supplier_quotes (
  cost_sheet_id CHAR(36) NOT NULL,
  supplier_quote_id CHAR(36) NOT NULL,
  created_by CHAR(36) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (cost_sheet_id, supplier_quote_id),
  KEY cost_sheet_supplier_quotes_quote_idx (supplier_quote_id),
  CONSTRAINT cost_sheet_supplier_quotes_sheet_fk FOREIGN KEY (cost_sheet_id) REFERENCES cost_sheets(id) ON DELETE CASCADE,
  CONSTRAINT cost_sheet_supplier_quotes_quote_fk FOREIGN KEY (supplier_quote_id) REFERENCES supplier_quotes(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS purchase_orders (
  id CHAR(36) PRIMARY KEY, po_number VARCHAR(60) NOT NULL, supplier_id CHAR(36), project_id CHAR(36),
  status VARCHAR(40) NOT NULL DEFAULT 'requested', order_date DATE, expected_date DATE,
  currency VARCHAR(10) NOT NULL DEFAULT 'USD', notes TEXT,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  KEY purchase_orders_supplier_idx (supplier_id),
  CONSTRAINT purchase_orders_supplier_fk FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE SET NULL,
  CONSTRAINT purchase_orders_project_fk FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS purchase_order_items (
  id CHAR(36) PRIMARY KEY, purchase_order_id CHAR(36) NOT NULL, description TEXT NOT NULL,
  quantity DECIMAL(12,2) NOT NULL DEFAULT 1, unit_price DECIMAL(15,2) NOT NULL DEFAULT 0,
  received_quantity DECIMAL(12,2) NOT NULL DEFAULT 0,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  KEY purchase_order_items_idx (purchase_order_id),
  CONSTRAINT purchase_order_items_fk FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS prequalifications (
  id CHAR(36) PRIMARY KEY, reference VARCHAR(80), buyer VARCHAR(255) NOT NULL, category VARCHAR(255),
  submission_type VARCHAR(40) NOT NULL DEFAULT 'eoi', status VARCHAR(40) NOT NULL DEFAULT 'preparing',
  submitted_date DATE, valid_until DATE, outcome VARCHAR(120), notes TEXT,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

ALTER TABLE prequalifications ADD COLUMN IF NOT EXISTS title VARCHAR(255) NULL;
ALTER TABLE prequalifications ADD COLUMN IF NOT EXISTS client_id CHAR(36) NULL;
ALTER TABLE prequalifications ADD COLUMN IF NOT EXISTS due_date DATE NULL;
ALTER TABLE prequalifications ADD COLUMN IF NOT EXISTS value DECIMAL(15,2) NOT NULL DEFAULT 0;
ALTER TABLE prequalifications ADD COLUMN IF NOT EXISTS currency VARCHAR(10) NOT NULL DEFAULT 'MWK';
ALTER TABLE prequalifications ADD COLUMN IF NOT EXISTS response_channel VARCHAR(30) NOT NULL DEFAULT 'email';
ALTER TABLE prequalifications ADD COLUMN IF NOT EXISTS submission_email VARCHAR(320) NULL;
ALTER TABLE prequalifications ADD COLUMN IF NOT EXISTS submission_cc LONGTEXT NULL;
ALTER TABLE prequalifications ADD COLUMN IF NOT EXISTS delivery_location TEXT NULL;
ALTER TABLE prequalifications ADD COLUMN IF NOT EXISTS portal_url VARCHAR(1000) NULL;
ALTER TABLE prequalifications ADD COLUMN IF NOT EXISTS portal_username VARCHAR(320) NULL;
ALTER TABLE prequalifications ADD COLUMN IF NOT EXISTS submission_instructions TEXT NULL;
ALTER TABLE prequalifications ADD COLUMN IF NOT EXISTS submission_time TIME NULL;
ALTER TABLE prequalifications ADD COLUMN IF NOT EXISTS cost_sheet_id CHAR(36) NULL;
ALTER TABLE prequalifications ADD COLUMN IF NOT EXISTS submitted_at DATETIME(3) NULL;
ALTER TABLE prequalifications ADD COLUMN IF NOT EXISTS archived_at DATETIME(3) NULL;
ALTER TABLE prequalifications ADD COLUMN IF NOT EXISTS status_before_archive VARCHAR(40) NULL;

CREATE TABLE IF NOT EXISTS requests (
  id CHAR(36) PRIMARY KEY, reference VARCHAR(80), title VARCHAR(255) NOT NULL, issuer VARCHAR(255),
  client_id CHAR(36), request_type VARCHAR(10) NOT NULL DEFAULT 'rfp',
  status VARCHAR(40) NOT NULL DEFAULT 'received', received_date DATE, due_date DATE,
  value DECIMAL(15,2) NOT NULL DEFAULT 0, currency VARCHAR(10) NOT NULL DEFAULT 'USD', scope TEXT,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  KEY requests_type_idx (request_type),
  CONSTRAINT requests_client_fk FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

ALTER TABLE requests ADD COLUMN IF NOT EXISTS notes TEXT NULL;
ALTER TABLE requests ADD COLUMN IF NOT EXISTS submission_type VARCHAR(30) NOT NULL DEFAULT 'email';
ALTER TABLE requests ADD COLUMN IF NOT EXISTS submission_email VARCHAR(320) NULL;
ALTER TABLE requests ADD COLUMN IF NOT EXISTS submission_cc LONGTEXT NULL;
ALTER TABLE requests ADD COLUMN IF NOT EXISTS delivery_location TEXT NULL;
ALTER TABLE requests ADD COLUMN IF NOT EXISTS portal_url VARCHAR(1000) NULL;
ALTER TABLE requests ADD COLUMN IF NOT EXISTS portal_username VARCHAR(320) NULL;
ALTER TABLE requests ADD COLUMN IF NOT EXISTS submission_instructions TEXT NULL;
ALTER TABLE requests ADD COLUMN IF NOT EXISTS submission_time TIME NULL;
ALTER TABLE requests ADD COLUMN IF NOT EXISTS cost_sheet_id CHAR(36) NULL;
ALTER TABLE requests ADD COLUMN IF NOT EXISTS submitted_at DATETIME(3) NULL;
ALTER TABLE requests ADD COLUMN IF NOT EXISTS archived_at DATETIME(3) NULL;
ALTER TABLE requests ADD COLUMN IF NOT EXISTS status_before_archive VARCHAR(40) NULL;

ALTER TABLE bids ADD COLUMN IF NOT EXISTS submission_type VARCHAR(30) NOT NULL DEFAULT 'email';
ALTER TABLE bids ADD COLUMN IF NOT EXISTS submission_email VARCHAR(320) NULL;
ALTER TABLE bids ADD COLUMN IF NOT EXISTS submission_cc LONGTEXT NULL;
ALTER TABLE bids ADD COLUMN IF NOT EXISTS delivery_location TEXT NULL;
ALTER TABLE bids ADD COLUMN IF NOT EXISTS portal_url VARCHAR(1000) NULL;
ALTER TABLE bids ADD COLUMN IF NOT EXISTS portal_username VARCHAR(320) NULL;
ALTER TABLE bids ADD COLUMN IF NOT EXISTS submission_instructions TEXT NULL;
ALTER TABLE bids ADD COLUMN IF NOT EXISTS submission_time TIME NULL;
ALTER TABLE bids ADD COLUMN IF NOT EXISTS cost_sheet_id CHAR(36) NULL;
ALTER TABLE bids ADD COLUMN IF NOT EXISTS submitted_at DATETIME(3) NULL;
ALTER TABLE bids ADD COLUMN IF NOT EXISTS archived_at DATETIME(3) NULL;
ALTER TABLE bids ADD COLUMN IF NOT EXISTS status_before_archive VARCHAR(40) NULL;

CREATE TABLE IF NOT EXISTS bidaf_sync_state (
  id VARCHAR(80) PRIMARY KEY,
  status VARCHAR(30) NOT NULL DEFAULT 'idle',
  last_started_at DATETIME(3) NULL,
  last_completed_at DATETIME(3) NULL,
  lease_until DATETIME(3) NULL,
  last_error TEXT NULL,
  records_seen INT NOT NULL DEFAULT 0,
  records_created INT NOT NULL DEFAULT 0,
  records_updated INT NOT NULL DEFAULT 0,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS bidaf_buyer_links (
  external_buyer_id VARCHAR(120) PRIMARY KEY,
  client_id CHAR(36) NOT NULL,
  buyer_name VARCHAR(255) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  KEY bidaf_buyer_links_client_idx (client_id),
  CONSTRAINT bidaf_buyer_links_client_fk FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS bidaf_opportunity_links (
  external_opportunity_id VARCHAR(120) PRIMARY KEY,
  local_kind VARCHAR(20) NOT NULL,
  local_opportunity_id CHAR(36) NOT NULL,
  external_version VARCHAR(128) NULL,
  lifecycle VARCHAR(40) NULL,
  source_url VARCHAR(1000) NULL,
  source_payload LONGTEXT NULL,
  first_seen_at DATETIME(3) NULL,
  last_seen_at DATETIME(3) NULL,
  last_synced_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY bidaf_opportunity_links_local_key (local_kind, local_opportunity_id),
  KEY bidaf_opportunity_links_synced_idx (last_synced_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

ALTER TABLE bidaf_opportunity_links ADD COLUMN IF NOT EXISTS is_suppressed BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS currencies (
  id CHAR(36) PRIMARY KEY, code VARCHAR(10) NOT NULL, name VARCHAR(120) NOT NULL,
  symbol VARCHAR(12) NOT NULL, is_default BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE, sort_order INT NOT NULL DEFAULT 0,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY currencies_code_key (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT IGNORE INTO currencies (id, code, name, symbol, is_default, sort_order) VALUES
  (UUID(), 'MWK', 'Malawian Kwacha', 'MK', TRUE, 10),
  (UUID(), 'USD', 'US Dollar', '$', FALSE, 20),
  (UUID(), 'EUR', 'Euro', '€', FALSE, 30),
  (UUID(), 'GBP', 'British Pound', '£', FALSE, 40),
  (UUID(), 'ZAR', 'South African Rand', 'R', FALSE, 50);

CREATE TABLE IF NOT EXISTS opportunity_checklist_items (
  id CHAR(36) PRIMARY KEY, opportunity_type VARCHAR(20) NOT NULL, opportunity_id CHAR(36) NOT NULL,
  title VARCHAR(500) NOT NULL, notes TEXT, assignee_id CHAR(36), due_at DATETIME(3),
  status VARCHAR(30) NOT NULL DEFAULT 'pending', document_required BOOLEAN NOT NULL DEFAULT TRUE,
  completed_by CHAR(36), completed_at DATETIME(3), position INT NOT NULL DEFAULT 0,
  created_by CHAR(36), created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  KEY opportunity_checklist_parent_idx (opportunity_type, opportunity_id, position)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS opportunity_documents (
  id CHAR(36) PRIMARY KEY, opportunity_type VARCHAR(20) NOT NULL, opportunity_id CHAR(36) NOT NULL,
  checklist_item_id CHAR(36), document_id CHAR(36), attachment_path VARCHAR(1000),
  display_name VARCHAR(500) NOT NULL, content_type VARCHAR(255), file_size INT UNSIGNED,
  document_role VARCHAR(30) NOT NULL DEFAULT 'response', include_in_submission BOOLEAN NOT NULL DEFAULT TRUE,
  outgoing_name VARCHAR(500), created_by CHAR(36), created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  KEY opportunity_documents_parent_idx (opportunity_type, opportunity_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS opportunity_comments (
  id CHAR(36) PRIMARY KEY, opportunity_type VARCHAR(20) NOT NULL, opportunity_id CHAR(36) NOT NULL,
  body TEXT NOT NULL, author_id CHAR(36), created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  KEY opportunity_comments_parent_idx (opportunity_type, opportunity_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS opportunity_comment_mentions (
  comment_id CHAR(36) NOT NULL, user_id CHAR(36) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (comment_id, user_id),
  KEY opportunity_comment_mentions_user (user_id, created_at),
  CONSTRAINT opportunity_comment_mentions_comment_fk FOREIGN KEY (comment_id) REFERENCES opportunity_comments(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS opportunity_submissions (
  id CHAR(36) PRIMARY KEY, opportunity_type VARCHAR(20) NOT NULL, opportunity_id CHAR(36) NOT NULL,
  channel VARCHAR(30) NOT NULL, status VARCHAR(30) NOT NULL DEFAULT 'draft', mailbox_id CHAR(36),
  recipient_email VARCHAR(320), cc LONGTEXT, subject TEXT, body_html LONGTEXT,
  file_mode VARCHAR(30) NOT NULL DEFAULT 'separate', detail TEXT, external_message_id VARCHAR(500),
  submitted_by CHAR(36), submitted_at DATETIME(3), error TEXT,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  KEY opportunity_submissions_parent_idx (opportunity_type, opportunity_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS marketing_activities (
  id CHAR(36) PRIMARY KEY, name VARCHAR(255) NOT NULL, channel VARCHAR(60) NOT NULL DEFAULT 'email',
  status VARCHAR(40) NOT NULL DEFAULT 'planned', start_date DATE, end_date DATE,
  budget DECIMAL(15,2) NOT NULL DEFAULT 0, spend DECIMAL(15,2) NOT NULL DEFAULT 0,
  leads INT NOT NULL DEFAULT 0, currency VARCHAR(10) NOT NULL DEFAULT 'USD', notes TEXT,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS documents (
  id CHAR(36) PRIMARY KEY, title VARCHAR(255) NOT NULL, category VARCHAR(60) NOT NULL DEFAULT 'general',
  entity_type VARCHAR(40) NOT NULL DEFAULT 'general', entity_id CHAR(36), owner VARCHAR(255),
  version VARCHAR(40), file_url TEXT, issue_date DATE, expiry_date DATE, notes TEXT,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  KEY documents_entity_idx (entity_type, entity_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS vacancies (
  id CHAR(36) PRIMARY KEY, title VARCHAR(255) NOT NULL, department VARCHAR(120),
  employment_type VARCHAR(40) NOT NULL DEFAULT 'full-time', status VARCHAR(40) NOT NULL DEFAULT 'open',
  openings INT NOT NULL DEFAULT 1, location VARCHAR(255), closing_date DATE, description TEXT,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS applicants (
  id CHAR(36) PRIMARY KEY, vacancy_id CHAR(36), full_name VARCHAR(255) NOT NULL, email VARCHAR(320),
  phone VARCHAR(100), stage VARCHAR(40) NOT NULL DEFAULT 'applied', rating INT NOT NULL DEFAULT 0,
  resume_url TEXT, notes TEXT,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  KEY applicants_vacancy_idx (vacancy_id),
  CONSTRAINT applicants_vacancy_fk FOREIGN KEY (vacancy_id) REFERENCES vacancies(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS employees (
  id CHAR(36) PRIMARY KEY, employee_number VARCHAR(60), full_name VARCHAR(255) NOT NULL,
  email VARCHAR(320), phone VARCHAR(100), job_title VARCHAR(255), department VARCHAR(120),
  employment_type VARCHAR(40) NOT NULL DEFAULT 'full-time', status VARCHAR(40) NOT NULL DEFAULT 'active',
  start_date DATE, end_date DATE, base_salary DECIMAL(15,2) NOT NULL DEFAULT 0,
  currency VARCHAR(10) NOT NULL DEFAULT 'USD', notes TEXT,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS leave_requests (
  id CHAR(36) PRIMARY KEY, employee_id CHAR(36), leave_type VARCHAR(40) NOT NULL DEFAULT 'annual',
  start_date DATE, end_date DATE, days DECIMAL(6,2) NOT NULL DEFAULT 0,
  status VARCHAR(40) NOT NULL DEFAULT 'pending', reason TEXT,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  KEY leave_employee_idx (employee_id),
  CONSTRAINT leave_employee_fk FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS payroll_runs (
  id CHAR(36) PRIMARY KEY, period VARCHAR(40) NOT NULL, pay_date DATE,
  status VARCHAR(40) NOT NULL DEFAULT 'draft', currency VARCHAR(10) NOT NULL DEFAULT 'USD', notes TEXT,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS payroll_items (
  id CHAR(36) PRIMARY KEY, payroll_run_id CHAR(36) NOT NULL, employee_id CHAR(36),
  gross DECIMAL(15,2) NOT NULL DEFAULT 0, allowances DECIMAL(15,2) NOT NULL DEFAULT 0,
  deductions DECIMAL(15,2) NOT NULL DEFAULT 0, tax DECIMAL(15,2) NOT NULL DEFAULT 0,
  net DECIMAL(15,2) NOT NULL DEFAULT 0,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  KEY payroll_items_run_idx (payroll_run_id),
  CONSTRAINT payroll_items_run_fk FOREIGN KEY (payroll_run_id) REFERENCES payroll_runs(id) ON DELETE CASCADE,
  CONSTRAINT payroll_items_employee_fk FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS invoices (
  id CHAR(36) PRIMARY KEY, invoice_number VARCHAR(60) NOT NULL, client_id CHAR(36),
  quotation_id CHAR(36), project_id CHAR(36), status VARCHAR(40) NOT NULL DEFAULT 'draft',
  issue_date DATE, due_date DATE, amount DECIMAL(15,2) NOT NULL DEFAULT 0,
  tax DECIMAL(15,2) NOT NULL DEFAULT 0, paid_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
  currency VARCHAR(10) NOT NULL DEFAULT 'USD', notes TEXT,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  KEY invoices_client_idx (client_id),
  CONSTRAINT invoices_client_fk FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS expenses (
  id CHAR(36) PRIMARY KEY, description VARCHAR(255) NOT NULL, category VARCHAR(60) NOT NULL DEFAULT 'general',
  vendor VARCHAR(255), amount DECIMAL(15,2) NOT NULL DEFAULT 0, currency VARCHAR(10) NOT NULL DEFAULT 'USD',
  expense_date DATE, project_id CHAR(36), status VARCHAR(40) NOT NULL DEFAULT 'recorded', notes TEXT,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  CONSTRAINT expenses_project_fk FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS payments (
  id CHAR(36) PRIMARY KEY, invoice_id CHAR(36), amount DECIMAL(15,2) NOT NULL DEFAULT 0,
  currency VARCHAR(10) NOT NULL DEFAULT 'USD', paid_at DATE, method VARCHAR(60), reference VARCHAR(120),
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  KEY payments_invoice_idx (invoice_id),
  CONSTRAINT payments_invoice_fk FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS system_settings (
  id CHAR(36) PRIMARY KEY, setting_key VARCHAR(120) NOT NULL, setting_group VARCHAR(60) NOT NULL,
  setting_value LONGTEXT, created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY system_settings_key (setting_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS app_secrets (
  id CHAR(36) PRIMARY KEY, secret_key VARCHAR(120) NOT NULL, encrypted_value LONGTEXT NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY app_secrets_key (secret_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS email_templates (
  id CHAR(36) PRIMARY KEY, name VARCHAR(160) NOT NULL, event_key VARCHAR(120) NOT NULL,
  subject TEXT NOT NULL, body_html LONGTEXT NOT NULL, is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY email_templates_event (event_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS roles (
  id CHAR(36) PRIMARY KEY, name VARCHAR(120) NOT NULL, description TEXT,
  is_system BOOLEAN NOT NULL DEFAULT FALSE, created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY roles_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS permissions (
  id CHAR(36) PRIMARY KEY, permission_key VARCHAR(160) NOT NULL, name VARCHAR(160) NOT NULL,
  module VARCHAR(80) NOT NULL, created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY permissions_key (permission_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS role_permissions (
  id CHAR(36) PRIMARY KEY, role_id CHAR(36) NOT NULL, permission_id CHAR(36) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY role_permission_unique (role_id, permission_id),
  CONSTRAINT role_permissions_role_fk FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
  CONSTRAINT role_permissions_permission_fk FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS system_users (
  id CHAR(36) PRIMARY KEY, full_name VARCHAR(255) NOT NULL, email VARCHAR(320) NOT NULL,
  role_id CHAR(36), status VARCHAR(40) NOT NULL DEFAULT 'invited',
  last_login_at DATETIME(3), created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY system_users_email (email),
  CONSTRAINT system_users_role_fk FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

ALTER TABLE system_users ADD COLUMN IF NOT EXISTS password_hash TEXT NULL;

CREATE TABLE IF NOT EXISTS email_signatures (
  id CHAR(36) PRIMARY KEY, mailbox_id CHAR(36) NOT NULL, owner_id CHAR(36) NOT NULL,
  name VARCHAR(160) NOT NULL, signature_type VARCHAR(30) NOT NULL DEFAULT 'html',
  content_html LONGTEXT NULL, content_text LONGTEXT NULL, image_url VARCHAR(1000) NULL,
  created_by CHAR(36) NULL, created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  KEY email_signatures_owner (owner_id, mailbox_id),
  CONSTRAINT email_signatures_mailbox_fk FOREIGN KEY (mailbox_id) REFERENCES mailboxes(id) ON DELETE CASCADE,
  CONSTRAINT email_signatures_owner_fk FOREIGN KEY (owner_id) REFERENCES system_users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS mailbox_access (
  mailbox_id CHAR(36) NOT NULL, user_id CHAR(36) NOT NULL,
  can_send BOOLEAN NOT NULL DEFAULT TRUE, can_manage BOOLEAN NOT NULL DEFAULT FALSE,
  is_default BOOLEAN NOT NULL DEFAULT FALSE, active_signature_id CHAR(36) NULL,
  granted_by CHAR(36) NULL, created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (mailbox_id, user_id), KEY mailbox_access_user (user_id, can_send),
  CONSTRAINT mailbox_access_mailbox_fk FOREIGN KEY (mailbox_id) REFERENCES mailboxes(id) ON DELETE CASCADE,
  CONSTRAINT mailbox_access_user_fk FOREIGN KEY (user_id) REFERENCES system_users(id) ON DELETE CASCADE,
  CONSTRAINT mailbox_access_signature_fk FOREIGN KEY (active_signature_id) REFERENCES email_signatures(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS meetings (
  id CHAR(36) PRIMARY KEY, title VARCHAR(255) NOT NULL, description LONGTEXT NULL,
  starts_at DATETIME(3) NOT NULL, ends_at DATETIME(3) NOT NULL,
  timezone VARCHAR(80) NOT NULL DEFAULT 'Africa/Blantyre', provider VARCHAR(40) NOT NULL DEFAULT 'gwero',
  join_url VARCHAR(1500) NOT NULL, embed_url VARCHAR(1500) NULL, location VARCHAR(500) NULL,
  attendee_emails LONGTEXT NOT NULL, status VARCHAR(30) NOT NULL DEFAULT 'scheduled',
  created_by CHAR(36) NOT NULL, created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  KEY meetings_starts (starts_at, status), KEY meetings_creator (created_by, starts_at),
  CONSTRAINT meetings_creator_fk FOREIGN KEY (created_by) REFERENCES system_users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS meeting_attendees (
  meeting_id CHAR(36) NOT NULL, user_id CHAR(36) NOT NULL,
  response_status VARCHAR(30) NOT NULL DEFAULT 'accepted',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (meeting_id, user_id), KEY meeting_attendees_user (user_id, response_status),
  CONSTRAINT meeting_attendees_meeting_fk FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE,
  CONSTRAINT meeting_attendees_user_fk FOREIGN KEY (user_id) REFERENCES system_users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS portal_accounts (
  id CHAR(36) PRIMARY KEY, portal_name VARCHAR(200) NOT NULL,
  category VARCHAR(80) NOT NULL DEFAULT 'Other', portal_url VARCHAR(1000),
  website_url VARCHAR(1000), notes TEXT, status VARCHAR(30) NOT NULL DEFAULT 'active',
  created_by CHAR(36), updated_by CHAR(36),
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  KEY portal_accounts_name (portal_name), KEY portal_accounts_category (category, status),
  CONSTRAINT portal_accounts_creator_fk FOREIGN KEY (created_by) REFERENCES system_users(id) ON DELETE SET NULL,
  CONSTRAINT portal_accounts_updater_fk FOREIGN KEY (updated_by) REFERENCES system_users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS document_categories (
  id CHAR(36) PRIMARY KEY, name VARCHAR(160) NOT NULL, description TEXT,
  color VARCHAR(30) NOT NULL DEFAULT 'violet', created_by CHAR(36),
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY document_categories_name (name),
  CONSTRAINT document_categories_creator_fk FOREIGN KEY (created_by) REFERENCES system_users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

ALTER TABLE documents ADD COLUMN IF NOT EXISTS category_id CHAR(36) NULL;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS owner_id CHAR(36) NULL;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS status VARCHAR(30) NOT NULL DEFAULT 'active';
ALTER TABLE documents ADD INDEX IF NOT EXISTS documents_category_idx (category_id);
ALTER TABLE documents ADD INDEX IF NOT EXISTS documents_owner_idx (owner_id);

CREATE TABLE IF NOT EXISTS document_versions (
  id CHAR(36) PRIMARY KEY, document_id CHAR(36) NOT NULL, version_number INT UNSIGNED NOT NULL,
  attachment_path VARCHAR(1000) NOT NULL, file_name VARCHAR(500) NOT NULL,
  content_type VARCHAR(255) NOT NULL, file_size INT UNSIGNED NOT NULL,
  notes TEXT, created_by CHAR(36), created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY document_versions_number (document_id, version_number),
  KEY document_versions_document_created (document_id, created_at),
  CONSTRAINT document_versions_document_fk FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
  CONSTRAINT document_versions_creator_fk FOREIGN KEY (created_by) REFERENCES system_users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS document_access (
  document_id CHAR(36) NOT NULL, user_id CHAR(36) NOT NULL,
  access_level VARCHAR(20) NOT NULL DEFAULT 'view', granted_by CHAR(36),
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (document_id, user_id), KEY document_access_user (user_id, access_level),
  CONSTRAINT document_access_document_fk FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
  CONSTRAINT document_access_user_fk FOREIGN KEY (user_id) REFERENCES system_users(id) ON DELETE CASCADE,
  CONSTRAINT document_access_granter_fk FOREIGN KEY (granted_by) REFERENCES system_users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS document_marks (
  id CHAR(36) PRIMARY KEY, name VARCHAR(160) NOT NULL,
  mark_type VARCHAR(20) NOT NULL, design_json LONGTEXT,
  image_attachment_path VARCHAR(1000), status VARCHAR(30) NOT NULL DEFAULT 'active',
  created_by CHAR(36), updated_by CHAR(36),
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  KEY document_marks_type_status (mark_type, status),
  CONSTRAINT document_marks_creator_fk FOREIGN KEY (created_by) REFERENCES system_users(id) ON DELETE SET NULL,
  CONSTRAINT document_marks_updater_fk FOREIGN KEY (updated_by) REFERENCES system_users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS document_mark_applications (
  id CHAR(36) PRIMARY KEY, source_attachment_path VARCHAR(1000) NOT NULL,
  output_attachment_path VARCHAR(1000) NOT NULL, source_name VARCHAR(500) NOT NULL,
  output_name VARCHAR(500) NOT NULL, mark_id CHAR(36) NOT NULL, mark_type VARCHAR(20) NOT NULL,
  page_number INT UNSIGNED NOT NULL, x_ratio DECIMAL(8,6) NOT NULL,
  y_ratio DECIMAL(8,6) NOT NULL, width_ratio DECIMAL(8,6) NOT NULL,
  rotation DECIMAL(6,2) NOT NULL DEFAULT 0, applied_date DATE, applied_by CHAR(36),
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  KEY document_mark_applications_created (created_at),
  CONSTRAINT document_mark_applications_mark_fk FOREIGN KEY (mark_id) REFERENCES document_marks(id),
  CONSTRAINT document_mark_applications_user_fk FOREIGN KEY (applied_by) REFERENCES system_users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT IGNORE INTO document_categories (id, name, description, color)
VALUES (UUID(), 'General', 'General business documents', 'slate');

CREATE TABLE IF NOT EXISTS auth_sessions (
  id CHAR(36) PRIMARY KEY, user_id CHAR(36) NOT NULL, token_hash CHAR(64) NOT NULL,
  expires_at DATETIME(3) NOT NULL, created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY auth_sessions_token (token_hash), KEY auth_sessions_user (user_id),
  CONSTRAINT auth_sessions_user_fk FOREIGN KEY (user_id) REFERENCES system_users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS prospect_categories (
  id CHAR(36) PRIMARY KEY, name VARCHAR(160) NOT NULL, description TEXT, offerings TEXT,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY prospect_categories_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

ALTER TABLE prospects ADD COLUMN IF NOT EXISTS category_id CHAR(36) NULL;
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS website VARCHAR(500) NULL;
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS linkedin_url VARCHAR(500) NULL;
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS fit_score INT NULL;
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS fit_reason TEXT NULL;
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS last_contact_at DATETIME(3) NULL;
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS logo_path VARCHAR(500) NULL;
ALTER TABLE prospects MODIFY COLUMN logo_path LONGTEXT NULL;
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS canonical_key VARCHAR(255) NULL;
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS industry VARCHAR(255) NULL;
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS address TEXT NULL;
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS city VARCHAR(160) NULL;
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS country VARCHAR(160) NULL;
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS registration_number VARCHAR(160) NULL;
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS employee_count INT NULL;

CREATE TABLE IF NOT EXISTS prospect_contacts (
  id CHAR(36) PRIMARY KEY, prospect_id CHAR(36) NOT NULL,
  first_name VARCHAR(255), last_name VARCHAR(255), email VARCHAR(320), phone VARCHAR(40),
  gender VARCHAR(40), job_title VARCHAR(255), is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY prospect_contacts_email (email),
  KEY prospect_contacts_prospect (prospect_id),
  CONSTRAINT prospect_contacts_prospect_fk FOREIGN KEY (prospect_id) REFERENCES prospects(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
ALTER TABLE prospect_contacts ADD COLUMN IF NOT EXISTS raw_phone VARCHAR(120) NULL;
ALTER TABLE prospect_contacts ADD COLUMN IF NOT EXISTS avatar_url LONGTEXT NULL;
ALTER TABLE prospect_contacts ADD COLUMN IF NOT EXISTS location VARCHAR(500) NULL;
ALTER TABLE prospect_contacts ADD COLUMN IF NOT EXISTS location_source_url VARCHAR(1000) NULL;
ALTER TABLE prospect_contacts ADD COLUMN IF NOT EXISTS location_is_inferred BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE clients ADD COLUMN IF NOT EXISTS logo_path VARCHAR(500) NULL;

CREATE TABLE IF NOT EXISTS client_contacts (
  id CHAR(36) PRIMARY KEY, client_id CHAR(36) NOT NULL,
  first_name VARCHAR(255), last_name VARCHAR(255), email VARCHAR(320), phone VARCHAR(40),
  gender VARCHAR(40), job_title VARCHAR(255), is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY client_contacts_email (email),
  KEY client_contacts_client (client_id),
  CONSTRAINT client_contacts_client_fk FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
ALTER TABLE client_contacts ADD COLUMN IF NOT EXISTS raw_phone VARCHAR(120) NULL;
ALTER TABLE client_contacts ADD COLUMN IF NOT EXISTS avatar_url LONGTEXT NULL;
ALTER TABLE client_contacts ADD COLUMN IF NOT EXISTS location VARCHAR(500) NULL;
ALTER TABLE client_contacts ADD COLUMN IF NOT EXISTS location_source_url VARCHAR(1000) NULL;
ALTER TABLE client_contacts ADD COLUMN IF NOT EXISTS location_is_inferred BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS organization_locations (
  id CHAR(36) PRIMARY KEY,
  entity_type VARCHAR(20) NOT NULL,
  entity_id CHAR(36) NOT NULL,
  name VARCHAR(160) NOT NULL DEFAULT 'Main office',
  address_line TEXT,
  city VARCHAR(160),
  region VARCHAR(160),
  country VARCHAR(160),
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  source_url VARCHAR(1000),
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  KEY organization_locations_entity (entity_type, entity_id),
  KEY organization_locations_primary (entity_type, entity_id, is_primary)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO organization_locations
  (id, entity_type, entity_id, name, address_line, city, country, is_primary)
SELECT UUID(), 'prospect', p.id, 'Main office', p.address, p.city, p.country, TRUE
  FROM prospects p
 WHERE (NULLIF(TRIM(p.address), '') IS NOT NULL OR NULLIF(TRIM(p.city), '') IS NOT NULL OR NULLIF(TRIM(p.country), '') IS NOT NULL)
   AND NOT EXISTS (
     SELECT 1 FROM organization_locations l
      WHERE l.entity_type = 'prospect' AND l.entity_id = p.id
   );

INSERT INTO organization_locations
  (id, entity_type, entity_id, name, address_line, is_primary)
SELECT UUID(), 'client', c.id, 'Main office', c.address, TRUE
  FROM clients c
 WHERE NULLIF(TRIM(c.address), '') IS NOT NULL
   AND NOT EXISTS (
     SELECT 1 FROM organization_locations l
      WHERE l.entity_type = 'client' AND l.entity_id = c.id
   );

CREATE TABLE IF NOT EXISTS prospect_interactions (
  id CHAR(36) PRIMARY KEY, prospect_id CHAR(36) NOT NULL,
  interaction_type VARCHAR(60) NOT NULL DEFAULT 'note', direction VARCHAR(20) NOT NULL DEFAULT 'internal',
  subject VARCHAR(255), body LONGTEXT NOT NULL, occurred_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  KEY prospect_interactions_prospect (prospect_id),
  CONSTRAINT prospect_interactions_prospect_fk FOREIGN KEY (prospect_id) REFERENCES prospects(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

ALTER TABLE prospect_interactions ADD COLUMN IF NOT EXISTS contact_id CHAR(36) NULL;
ALTER TABLE prospect_interactions ADD COLUMN IF NOT EXISTS body_html LONGTEXT NULL;
ALTER TABLE prospect_interactions ADD COLUMN IF NOT EXISTS attachments LONGTEXT NULL;
ALTER TABLE prospect_interactions ADD COLUMN IF NOT EXISTS message_id VARCHAR(500) NULL;
ALTER TABLE replies ADD COLUMN IF NOT EXISTS contact_id CHAR(36) NULL;
ALTER TABLE replies ADD COLUMN IF NOT EXISTS body_html LONGTEXT NULL;
ALTER TABLE replies ADD COLUMN IF NOT EXISTS attachments LONGTEXT NULL;

CREATE TABLE IF NOT EXISTS notifications (
  id CHAR(36) PRIMARY KEY, user_id CHAR(36) NOT NULL, notification_type VARCHAR(80) NOT NULL,
  title VARCHAR(255) NOT NULL, body TEXT NOT NULL, action_url VARCHAR(1000), entity_type VARCHAR(80),
  entity_id CHAR(36), read_at DATETIME(3), email_sent_at DATETIME(3),
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  KEY notifications_user_created (user_id, created_at), KEY notifications_unread (user_id, read_at),
  CONSTRAINT notifications_user_fk FOREIGN KEY (user_id) REFERENCES system_users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS notification_preferences (
  user_id CHAR(36) PRIMARY KEY, in_app_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  email_enabled BOOLEAN NOT NULL DEFAULT TRUE, email_delay_minutes INT NOT NULL DEFAULT 60,
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  CONSTRAINT notification_preferences_user_fk FOREIGN KEY (user_id) REFERENCES system_users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS page_notes (
  id CHAR(36) PRIMARY KEY, page_key VARCHAR(1000) NOT NULL, title VARCHAR(255), body TEXT NOT NULL,
  color VARCHAR(30) NOT NULL DEFAULT 'yellow', is_pinned BOOLEAN NOT NULL DEFAULT TRUE,
  is_open BOOLEAN NOT NULL DEFAULT TRUE, position_x INT NOT NULL DEFAULT 300,
  position_y INT NOT NULL DEFAULT 120, width INT NOT NULL DEFAULT 280,
  height INT NOT NULL DEFAULT 260, z_index INT NOT NULL DEFAULT 1,
  created_by CHAR(36) NOT NULL, updated_by CHAR(36) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  KEY page_notes_page_updated (page_key(255), updated_at),
  CONSTRAINT page_notes_creator_fk FOREIGN KEY (created_by) REFERENCES system_users(id) ON DELETE CASCADE,
  CONSTRAINT page_notes_updater_fk FOREIGN KEY (updated_by) REFERENCES system_users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

ALTER TABLE page_notes ADD COLUMN IF NOT EXISTS is_open BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE page_notes ADD COLUMN IF NOT EXISTS position_x INT NOT NULL DEFAULT 300;
ALTER TABLE page_notes ADD COLUMN IF NOT EXISTS position_y INT NOT NULL DEFAULT 120;
ALTER TABLE page_notes ADD COLUMN IF NOT EXISTS width INT NOT NULL DEFAULT 280;
ALTER TABLE page_notes ADD COLUMN IF NOT EXISTS height INT NOT NULL DEFAULT 260;
ALTER TABLE page_notes ADD COLUMN IF NOT EXISTS z_index INT NOT NULL DEFAULT 1;

CREATE TABLE IF NOT EXISTS page_note_mentions (
  note_id CHAR(36) NOT NULL, user_id CHAR(36) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (note_id, user_id),
  KEY page_note_mentions_user (user_id, created_at),
  CONSTRAINT page_note_mentions_note_fk FOREIGN KEY (note_id) REFERENCES page_notes(id) ON DELETE CASCADE,
  CONSTRAINT page_note_mentions_user_fk FOREIGN KEY (user_id) REFERENCES system_users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS attachment_files (
  id CHAR(36) PRIMARY KEY, owner_id CHAR(36) NOT NULL, file_name VARCHAR(500) NOT NULL,
  content_type VARCHAR(255) NOT NULL, file_size INT UNSIGNED NOT NULL, content LONGBLOB NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  KEY attachment_files_owner (owner_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT IGNORE INTO document_versions
  (id, document_id, version_number, attachment_path, file_name, content_type, file_size, created_at)
SELECT UUID(), d.id, 1, CONCAT(af.owner_id, '/', af.id), af.file_name, af.content_type, af.file_size, af.created_at
  FROM documents d
  JOIN attachment_files af
    ON d.file_url = CONCAT('/api/attachments/', af.owner_id, '/', af.id)
 WHERE NOT EXISTS (SELECT 1 FROM document_versions v WHERE v.document_id = d.id);

CREATE TABLE IF NOT EXISTS ai_prospect_searches (
  id CHAR(36) PRIMARY KEY, prompt LONGTEXT NOT NULL, search_context LONGTEXT,
  results_json LONGTEXT NOT NULL, status VARCHAR(40) NOT NULL DEFAULT 'completed',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT IGNORE INTO roles (id, name, description, is_system) VALUES
  (UUID(), 'Administrator', 'Full system administration', TRUE),
  (UUID(), 'Sales Manager', 'Manage prospects, clients, campaigns and deals', TRUE),
  (UUID(), 'Team Member', 'Standard operational access', TRUE);

INSERT IGNORE INTO permissions (id, permission_key, name, module) VALUES
  (UUID(), 'settings.manage', 'Manage settings', 'Settings'),
  (UUID(), 'accounts.manage', 'Manage portal accounts', 'Accounts'),
  (UUID(), 'users.manage', 'Manage users and roles', 'Settings'),
  (UUID(), 'prospects.view', 'View prospects', 'Prospects'),
  (UUID(), 'prospects.manage', 'Create and update prospects', 'Prospects'),
  (UUID(), 'prospects.convert', 'Convert prospects to clients', 'Prospects'),
  (UUID(), 'campaigns.manage', 'Manage campaigns', 'Campaigns'),
  (UUID(), 'campaigns.approve', 'Approve campaigns for launch', 'Campaigns'),
  (UUID(), 'clients.manage', 'Manage clients', 'Clients');

INSERT IGNORE INTO role_permissions (id, role_id, permission_id)
SELECT UUID(), r.id, p.id FROM roles r CROSS JOIN permissions p WHERE r.name = 'Administrator';
