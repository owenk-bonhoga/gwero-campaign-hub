export type Json = string | number | boolean | null | Json[] | { [key: string]: Json | undefined };

export interface Prospect {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  company: string | null;
  job_title: string | null;
  phone: string | null;
  status: string;
  notes: string | null;
  extra: Record<string, unknown>;
  source_file: string | null;
  category_id: string | null;
  website: string | null;
  linkedin_url: string | null;
  fit_score: number | null;
  fit_reason: string | null;
  last_contact_at: string | null;
  logo_path: string | null;
  canonical_key: string | null;
  industry: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
  registration_number: string | null;
  employee_count: number | null;
  created_at: string;
  updated_at: string;
}
export interface Client {
  id: string;
  name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  industry: string | null;
  status: string;
  address: string | null;
  notes: string | null;
  prospect_id: string | null;
  logo_path: string | null;
  created_at: string;
  updated_at: string;
}
export interface Mailbox {
  id: string;
  name: string;
  from_email: string;
  from_name: string | null;
  provider: string;
  smtp_host: string | null;
  smtp_port: number | null;
  smtp_secure: boolean;
  smtp_username: string | null;
  imap_host: string | null;
  imap_port: number | null;
  imap_username: string | null;
  is_default: boolean;
  last_sync_at: string | null;
  last_status: string | null;
  created_by: string | null;
  created_at: string;
}
export interface MailboxSecret {
  mailbox_id: string;
  smtp_password: string | null;
  imap_password: string | null;
  oauth_access_token: string | null;
  oauth_refresh_token: string | null;
  oauth_expires_at: string | null;
  updated_at: string;
}
export interface Campaign {
  id: string;
  name: string;
  subject: string;
  body_html: string;
  mailbox_id: string | null;
  cc: string[];
  bcc: string[];
  attachments: Json;
  track_opens: boolean;
  track_clicks: boolean;
  status: string;
  campaign_type: string;
  objective: string | null;
  owner_id: string | null;
  approval_required: boolean;
  approved_by: string | null;
  approved_at: string | null;
  scheduled_at: string | null;
  completed_at: string | null;
  timezone: string;
  daily_limit: number;
  stop_on_reply: boolean;
  stop_on_bounce: boolean;
  audience_rules: Json;
  sent_at: string | null;
  created_at: string;
  updated_at: string;
}
export interface CampaignRecipient {
  id: string;
  campaign_id: string;
  prospect_id: string;
  contact_id: string | null;
  status: string;
  error: string | null;
  message_id: string | null;
  sent_at: string | null;
  opened_at: string | null;
  open_count: number;
  clicked_at: string | null;
  click_count: number;
  replied_at: string | null;
  current_step: number;
  next_action_at: string | null;
  stopped_reason: string | null;
  last_activity_at: string | null;
  converted_at: string | null;
  attempt_count: number;
  created_at: string;
}
export interface CampaignStep {
  id: string;
  campaign_id: string;
  step_order: number;
  step_type: string;
  name: string;
  delay_amount: number;
  delay_unit: string;
  subject: string | null;
  body_html: string | null;
  attachments: Json;
  task_instructions: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}
export interface CampaignEvent {
  id: string;
  campaign_id: string;
  recipient_id: string | null;
  event_type: string;
  detail: string | null;
  actor_id: string | null;
  created_at: string;
}
export interface EmailSuppression {
  id: string;
  email: string;
  reason: string;
  source: string;
  campaign_id: string | null;
  notes: string | null;
  created_at: string;
}
export interface Deal {
  id: string;
  title: string;
  client_id: string | null;
  prospect_id: string | null;
  value: number;
  currency: string;
  stage: string;
  probability: number;
  expected_close_date: string | null;
  owner: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}
export interface Agreement {
  id: string;
  client_id: string;
  deal_id: string | null;
  title: string;
  agreement_type: string;
  status: string;
  start_date: string | null;
  end_date: string | null;
  value: number;
  currency: string;
  billing_cycle: string;
  response_time_hours: number | null;
  resolution_time_hours: number | null;
  coverage_hours: string | null;
  auto_renew: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}
export interface AgreementItem {
  id: string;
  agreement_id: string;
  description: string;
  quantity: number;
  unit_price: number;
  created_at: string;
  updated_at: string;
}
export interface Activity {
  id: string;
  entity_type: string;
  entity_id: string;
  activity_type: string;
  body: string;
  occurred_at: string;
  created_at: string;
  updated_at: string;
}
export interface Reply {
  id: string;
  mailbox_id: string | null;
  prospect_id: string | null;
  contact_id: string | null;
  campaign_id: string | null;
  opportunity_type: string | null;
  opportunity_id: string | null;
  from_email: string;
  subject: string | null;
  snippet: string | null;
  body: string | null;
  body_html: string | null;
  attachments: Json;
  received_at: string;
  external_id: string | null;
  created_at: string;
}

export interface Quotation {
  id: string;
  quote_number: string;
  title: string;
  client_id: string | null;
  deal_id: string | null;
  status: string;
  currency: string;
  issue_date: string | null;
  valid_until: string | null;
  tax_rate: number;
  discount: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}
export interface QuotationItem {
  id: string;
  quotation_id: string;
  description: string;
  quantity: number;
  unit_price: number;
  created_at: string;
  updated_at: string;
}
export interface Project {
  id: string;
  name: string;
  code: string | null;
  client_id: string | null;
  manager: string | null;
  status: string;
  start_date: string | null;
  end_date: string | null;
  budget: number;
  currency: string;
  progress: number;
  description: string | null;
  created_at: string;
  updated_at: string;
}
export interface Bid {
  id: string;
  reference: string | null;
  title: string;
  buyer: string | null;
  client_id: string | null;
  status: string;
  closing_date: string | null;
  submission_date: string | null;
  value: number;
  currency: string;
  bond_amount: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}
export interface CostSheet {
  id: string;
  name: string;
  client_id: string | null;
  quotation_id: string | null;
  bid_id: string | null;
  project_id: string | null;
  status: string;
  currency: string;
  notes: string | null;
  column_rules: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}
export interface CostSheetItem {
  id: string;
  cost_sheet_id: string;
  category: string;
  description: string;
  quantity: number;
  unit_cost: number;
  markup_percent: number;
  custom_values: Record<string, string | number>;
  attachments: Array<{ path: string; name: string; type: string; size: number }>;
  created_at: string;
  updated_at: string;
}
export interface CostSheetColumn {
  id: string;
  cost_sheet_id: string;
  name: string;
  column_key: string;
  data_type: "text" | "number" | "formula";
  default_value: string | null;
  formula_expression: string | null;
  display_order: number;
  created_at: string;
  updated_at: string;
}
export interface CostSheetTemplate {
  id: string;
  name: string;
  description: string | null;
  currency: string;
  column_rules: Record<string, unknown> | null;
  columns_json: Array<Record<string, unknown>>;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}
export interface Job {
  id: string;
  title: string;
  client_id: string | null;
  project_id: string | null;
  job_type: string;
  assignee: string | null;
  priority: string;
  status: string;
  scheduled_date: string | null;
  completed_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}
export interface Task {
  id: string;
  title: string;
  entity_type: string;
  entity_id: string | null;
  assignee: string | null;
  priority: string;
  status: string;
  due_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}
export interface Supplier {
  id: string;
  name: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  category: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}
export interface SupplierQuote {
  id: string;
  supplier_id: string | null;
  source_name: string;
  quote_reference: string | null;
  quote_date: string | null;
  valid_until: string | null;
  currency: string;
  amount: number;
  notes: string | null;
  attachment_path: string | null;
  attachment_name: string | null;
  attachment_type: string | null;
  attachment_size: number | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}
export interface CostSheetSupplierQuote {
  cost_sheet_id: string;
  supplier_quote_id: string;
  created_by: string | null;
  created_at: string;
}
export interface PurchaseOrder {
  id: string;
  po_number: string;
  supplier_id: string | null;
  project_id: string | null;
  status: string;
  order_date: string | null;
  expected_date: string | null;
  currency: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}
export interface PurchaseOrderItem {
  id: string;
  purchase_order_id: string;
  description: string;
  quantity: number;
  unit_price: number;
  received_quantity: number;
  created_at: string;
  updated_at: string;
}
export interface Prequalification {
  id: string;
  reference: string | null;
  title: string | null;
  buyer: string;
  client_id: string | null;
  category: string | null;
  submission_type: string;
  status: string;
  submitted_date: string | null;
  valid_until: string | null;
  due_date: string | null;
  value: number;
  currency: string;
  response_channel: string;
  submission_email: string | null;
  submission_cc: string | null;
  delivery_location: string | null;
  portal_url: string | null;
  portal_username: string | null;
  submission_instructions: string | null;
  submission_time: string | null;
  cost_sheet_id: string | null;
  submitted_at: string | null;
  outcome: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}
export interface Request {
  id: string;
  reference: string | null;
  title: string;
  issuer: string | null;
  client_id: string | null;
  request_type: string;
  status: string;
  received_date: string | null;
  due_date: string | null;
  value: number;
  currency: string;
  scope: string | null;
  created_at: string;
  updated_at: string;
}
export interface MarketingActivity {
  id: string;
  name: string;
  channel: string;
  status: string;
  start_date: string | null;
  end_date: string | null;
  budget: number;
  spend: number;
  leads: number;
  currency: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}
export interface Document {
  id: string;
  title: string;
  category: string;
  entity_type: string;
  entity_id: string | null;
  owner: string | null;
  owner_id: string | null;
  version: string | null;
  file_url: string | null;
  category_id: string | null;
  status: string;
  issue_date: string | null;
  expiry_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}
export interface DocumentCategory {
  id: string;
  name: string;
  description: string | null;
  color: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}
export interface DocumentVersion {
  id: string;
  document_id: string;
  version_number: number;
  attachment_path: string;
  file_name: string;
  content_type: string;
  file_size: number;
  notes: string | null;
  created_by: string | null;
  created_at: string;
}
export interface DocumentAccess {
  document_id: string;
  user_id: string;
  access_level: "view" | "edit" | "manage";
  granted_by: string | null;
  created_at: string;
  updated_at: string;
}
export interface DocumentMark {
  id: string;
  name: string;
  mark_type: "stamp" | "signature";
  design_json: Json | null;
  image_attachment_path: string | null;
  status: string;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}
export interface DocumentMarkApplication {
  id: string;
  source_attachment_path: string;
  output_attachment_path: string;
  source_name: string;
  output_name: string;
  mark_id: string;
  mark_type: "stamp" | "signature";
  page_number: number;
  x_ratio: number;
  y_ratio: number;
  width_ratio: number;
  rotation: number;
  applied_date: string | null;
  applied_by: string | null;
  created_at: string;
}
export interface PortalAccount {
  id: string;
  portal_name: string;
  category: string;
  portal_url: string | null;
  website_url: string | null;
  notes: string | null;
  status: string;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}
export interface Vacancy {
  id: string;
  title: string;
  department: string | null;
  employment_type: string;
  status: string;
  openings: number;
  location: string | null;
  closing_date: string | null;
  description: string | null;
  created_at: string;
  updated_at: string;
}
export interface Applicant {
  id: string;
  vacancy_id: string | null;
  full_name: string;
  email: string | null;
  phone: string | null;
  stage: string;
  rating: number;
  resume_url: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}
export interface Employee {
  id: string;
  employee_number: string | null;
  full_name: string;
  email: string | null;
  phone: string | null;
  job_title: string | null;
  department: string | null;
  employment_type: string;
  status: string;
  start_date: string | null;
  end_date: string | null;
  base_salary: number;
  currency: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}
export interface LeaveRequest {
  id: string;
  employee_id: string | null;
  leave_type: string;
  start_date: string | null;
  end_date: string | null;
  days: number;
  status: string;
  reason: string | null;
  created_at: string;
  updated_at: string;
}
export interface PayrollRun {
  id: string;
  period: string;
  pay_date: string | null;
  status: string;
  currency: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}
export interface PayrollItem {
  id: string;
  payroll_run_id: string;
  employee_id: string | null;
  gross: number;
  allowances: number;
  deductions: number;
  tax: number;
  net: number;
  created_at: string;
  updated_at: string;
}
export interface Invoice {
  id: string;
  invoice_number: string;
  client_id: string | null;
  quotation_id: string | null;
  project_id: string | null;
  status: string;
  issue_date: string | null;
  due_date: string | null;
  amount: number;
  tax: number;
  paid_amount: number;
  currency: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}
export interface Expense {
  id: string;
  description: string;
  category: string;
  vendor: string | null;
  amount: number;
  currency: string;
  expense_date: string | null;
  project_id: string | null;
  status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}
export interface Payment {
  id: string;
  invoice_id: string | null;
  amount: number;
  currency: string;
  paid_at: string | null;
  method: string | null;
  reference: string | null;
  created_at: string;
  updated_at: string;
}

export interface SystemSetting {
  id: string;
  setting_key: string;
  setting_group: string;
  setting_value: Json;
  created_at: string;
  updated_at: string;
}
export interface AppSecret {
  id: string;
  secret_key: string;
  encrypted_value: string;
  created_at: string;
  updated_at: string;
}
export interface EmailTemplate {
  id: string;
  name: string;
  event_key: string;
  subject: string;
  body_html: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}
export interface Role {
  id: string;
  name: string;
  description: string | null;
  is_system: boolean;
  created_at: string;
  updated_at: string;
}
export interface Permission {
  id: string;
  permission_key: string;
  name: string;
  module: string;
  created_at: string;
}
export interface RolePermission {
  id: string;
  role_id: string;
  permission_id: string;
  created_at: string;
}
export interface SystemUser {
  id: string;
  full_name: string;
  email: string;
  role_id: string | null;
  status: string;
  last_login_at: string | null;
  password_hash: string | null;
  created_at: string;
  updated_at: string;
}
export interface AuthSession {
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: string;
  created_at: string;
}
export interface ProspectContact {
  id: string;
  prospect_id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  raw_phone: string | null;
  gender: string | null;
  job_title: string | null;
  avatar_url: string | null;
  location: string | null;
  location_source_url: string | null;
  location_is_inferred: boolean;
  is_primary: boolean;
  created_at: string;
  updated_at: string;
}
export interface ClientContact {
  id: string;
  client_id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  raw_phone: string | null;
  gender: string | null;
  job_title: string | null;
  avatar_url: string | null;
  location: string | null;
  location_source_url: string | null;
  location_is_inferred: boolean;
  is_primary: boolean;
  created_at: string;
  updated_at: string;
}
export interface ProspectCategory {
  id: string;
  name: string;
  description: string | null;
  offerings: string | null;
  created_at: string;
  updated_at: string;
}
export interface ProspectInteraction {
  id: string;
  prospect_id: string;
  contact_id: string | null;
  interaction_type: string;
  direction: string;
  subject: string | null;
  body: string;
  body_html: string | null;
  attachments: Json;
  message_id: string | null;
  occurred_at: string;
  created_at: string;
}
export interface Notification {
  id: string;
  user_id: string;
  notification_type: string;
  title: string;
  body: string;
  action_url: string | null;
  entity_type: string | null;
  entity_id: string | null;
  read_at: string | null;
  email_sent_at: string | null;
  created_at: string;
}
export interface NotificationPreference {
  user_id: string;
  in_app_enabled: boolean;
  email_enabled: boolean;
  email_delay_minutes: number;
  updated_at: string;
}
export interface PageNote {
  id: string;
  page_key: string;
  title: string | null;
  body: string;
  color: string;
  is_pinned: boolean;
  is_open: boolean;
  position_x: number;
  position_y: number;
  width: number;
  height: number;
  z_index: number;
  created_by: string;
  updated_by: string;
  created_at: string;
  updated_at: string;
}
export interface PageNoteMention {
  note_id: string;
  user_id: string;
  created_at: string;
}
export interface AiProspectSearch {
  id: string;
  prompt: string;
  search_context: string | null;
  results_json: Json;
  status: string;
  created_at: string;
}

export interface Tables {
  prospects: Prospect;
  notifications: Notification;
  notification_preferences: NotificationPreference;
  page_notes: PageNote;
  page_note_mentions: PageNoteMention;
  clients: Client;
  mailboxes: Mailbox;
  mailbox_secrets: MailboxSecret;
  campaigns: Campaign;
  campaign_recipients: CampaignRecipient;
  campaign_steps: CampaignStep;
  campaign_events: CampaignEvent;
  email_suppressions: EmailSuppression;
  deals: Deal;
  agreements: Agreement;
  agreement_items: AgreementItem;
  activities: Activity;
  replies: Reply;
  quotations: Quotation;
  quotation_items: QuotationItem;
  projects: Project;
  bids: Bid;
  cost_sheets: CostSheet;
  cost_sheet_items: CostSheetItem;
  cost_sheet_columns: CostSheetColumn;
  cost_sheet_templates: CostSheetTemplate;
  jobs: Job;
  tasks: Task;
  suppliers: Supplier;
  supplier_quotes: SupplierQuote;
  cost_sheet_supplier_quotes: CostSheetSupplierQuote;
  purchase_orders: PurchaseOrder;
  purchase_order_items: PurchaseOrderItem;
  prequalifications: Prequalification;
  requests: Request;
  marketing_activities: MarketingActivity;
  documents: Document;
  document_categories: DocumentCategory;
  document_versions: DocumentVersion;
  document_access: DocumentAccess;
  document_marks: DocumentMark;
  document_mark_applications: DocumentMarkApplication;
  portal_accounts: PortalAccount;
  vacancies: Vacancy;
  applicants: Applicant;
  employees: Employee;
  leave_requests: LeaveRequest;
  payroll_runs: PayrollRun;
  payroll_items: PayrollItem;
  invoices: Invoice;
  expenses: Expense;
  payments: Payment;
  system_settings: SystemSetting;
  app_secrets: AppSecret;
  email_templates: EmailTemplate;
  roles: Role;
  permissions: Permission;
  role_permissions: RolePermission;
  system_users: SystemUser;
  auth_sessions: AuthSession;
  prospect_contacts: ProspectContact;
  client_contacts: ClientContact;
  prospect_categories: ProspectCategory;
  prospect_interactions: ProspectInteraction;
  ai_prospect_searches: AiProspectSearch;
}
export type TableName = keyof Tables;
export type AppRow<K extends TableName> = Tables[K] & {
  prospects?: Prospect | null;
  clients?: Client | null;
  campaigns?: Campaign | null;
  campaign_recipients?: CampaignRecipient[];
  campaign_steps?: CampaignStep[];
  projects?: Project | null;
  suppliers?: Supplier | null;
  employees?: Employee | null;
  vacancies?: Vacancy | null;
  invoices?: Invoice | null;
};
