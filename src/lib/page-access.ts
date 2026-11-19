export const pagePermissions: Readonly<Record<string, string>> = {
  clients: "clients.manage",
  prospects: "prospects.view",
  campaigns: "campaigns.manage",
  inbox: "campaigns.manage",
  bids: "opportunities.manage",
  prequalifications: "opportunities.manage",
  rfps: "opportunities.manage",
  rfqs: "opportunities.manage",
  quotations: "opportunities.manage",
  "cost-sheets": "opportunities.manage",
  vendors: "procurement.manage",
  procurement: "procurement.manage",
  projects: "operations.manage",
  jobs: "operations.manage",
  tasks: "operations.manage",
  deals: "operations.manage",
  agreements: "operations.manage",
  marketing: "operations.manage",
  hr: "hr.manage",
  recruitment: "hr.manage",
  payroll: "finance.manage",
  finance: "finance.manage",
  documents: "documents.manage",
  "secure-shares": "documents.manage",
  "document-tools": "documents.manage",
  accounts: "accounts.manage",
  meetings: "meetings.manage",
};
export function mayAccessPage(path: string, permissions: readonly string[]): boolean {
  const root = path.split("?")[0]!.split("/").filter(Boolean)[0] || "";
  if (root === "" || root === "settings") return true;
  const permission = pagePermissions[root];
  return Boolean(permission && permissions.includes(permission));
}
