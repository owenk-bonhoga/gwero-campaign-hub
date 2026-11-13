import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { FinanceWorkspace } from "@/components/FinanceWorkspace";
export const Route = createFileRoute("/finance")({ component: FinancePage });
function FinancePage() {
  return (
    <AppShell
      title="Finance & Accounts"
      description="Record revenue and costs with an accounting-grade audit trail."
    >
      <FinanceWorkspace />
    </AppShell>
  );
}
