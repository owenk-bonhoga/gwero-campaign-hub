import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Banknote,
  FileText,
  Landmark,
  Plus,
  Receipt,
  Trash2,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";
import { money } from "./AppShell";
import { ConfirmAction } from "./ConfirmAction";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { MetricValue } from "./ui/metric-value";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { Textarea } from "./ui/textarea";
import {
  deleteFinanceDraft,
  getFinanceWorkspace,
  postFinanceTransaction,
  recordFinancePayment,
  saveFinanceTransaction,
  voidFinanceTransaction,
} from "@/lib/finance.functions";
import type { FinanceTransactionType, TaxTreatment } from "@/lib/finance-ledger";

type Account = { id: string; code: string; name: string; account_type: string };
type Currency = { code: string; name: string; symbol: string; is_default: boolean };
type Source = { source_type: string; source_id: string; title: string; client_id?: string };
type TransactionAttachment = {
  id: string;
  attachment_path: string;
  file_name: string;
};
type Transaction = {
  id: string;
  transaction_date: string;
  transaction_number: string;
  description: string;
  source_title?: string | null;
  project_name?: string | null;
  client_name?: string | null;
  counterparty?: string | null;
  status: string;
  payment_status: string;
  total_amount: number;
  paid_amount: number;
  currency: string;
  attachments: TransactionAttachment[];
};
type Workspace = {
  accounts: Account[];
  currencies: Currency[];
  sources: Source[];
  transactions: Transaction[];
  metrics: {
    revenue: number;
    expenses: number;
    profit: number;
    receivable: number;
    payable: number;
  };
};
type LineForm = {
  accountId: string;
  description: string;
  quantity: string;
  unitAmount: string;
  taxRate: string;
};
type Form = {
  id: string;
  type: FinanceTransactionType;
  date: string;
  dueDate: string;
  description: string;
  counterparty: string;
  reference: string;
  currency: string;
  taxTreatment: TaxTreatment;
  taxRecoverable: boolean;
  sourceKey: string;
  notes: string;
  lines: LineForm[];
  attachments: Array<{ path: string; name: string; type: string; size: number }>;
};

const today = () => new Date().toISOString().slice(0, 10);
const blankLine = (): LineForm => ({
  accountId: "",
  description: "",
  quantity: "1",
  unitAmount: "0",
  taxRate: "16.5",
});
const blankForm = (sourceType?: string, sourceId?: string): Form => ({
  id: crypto.randomUUID(),
  type: "expense",
  date: today(),
  dueDate: "",
  description: "",
  counterparty: "",
  reference: "",
  currency: "MWK",
  taxTreatment: "none",
  taxRecoverable: false,
  sourceKey: sourceType && sourceId ? `${sourceType}:${sourceId}` : "",
  notes: "",
  lines: [blankLine()],
  attachments: [],
});
function attachmentUrl(path: string) {
  const [owner, file] = path.split("/");
  return `/api/attachments/${encodeURIComponent(owner || "")}/${encodeURIComponent(file || "")}`;
}

export function FinanceWorkspace({
  sourceType,
  sourceId,
  sourceTitle,
  compact = false,
}: {
  sourceType?: string;
  sourceId?: string;
  sourceTitle?: string;
  compact?: boolean;
}) {
  const qc = useQueryClient();
  const queryKey = ["finance-workspace", sourceType || "all", sourceId || "all"];
  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () =>
      getFinanceWorkspace({
        data: {
          ...(sourceType ? { sourceType } : {}),
          ...(sourceId ? { sourceId } : {}),
        },
      }) as unknown as Promise<Workspace>,
  });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Form>(() => blankForm(sourceType, sourceId));
  const [payment, setPayment] = useState<Transaction | null>(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const refresh = () => qc.invalidateQueries({ queryKey });
  const save = useMutation({
    mutationFn: async () => {
      const [chosenType, chosenId] = form.sourceKey.split(":");
      return saveFinanceTransaction({
        data: {
          id: form.id,
          type: form.type,
          date: form.date,
          ...(form.dueDate ? { dueDate: form.dueDate } : {}),
          description: form.description,
          counterparty: form.counterparty,
          reference: form.reference,
          currency: form.currency,
          taxTreatment: form.taxTreatment,
          taxRecoverable: form.taxRecoverable,
          ...(chosenType ? { sourceType: chosenType } : {}),
          ...(chosenId ? { sourceId: chosenId } : {}),
          ...(data?.sources.find(
            (item) => `${item.source_type}:${item.source_id}` === form.sourceKey,
          )?.client_id
            ? {
                clientId: data.sources.find(
                  (item) => `${item.source_type}:${item.source_id}` === form.sourceKey,
                )!.client_id!,
              }
            : {}),
          notes: form.notes,
          lines: form.lines.map((line) => ({
            accountId: line.accountId,
            description: line.description,
            quantity: Number(line.quantity),
            unitAmount: Number(line.unitAmount),
            taxRate: Number(line.taxRate),
          })),
          attachments: form.attachments,
        },
      });
    },
    onSuccess: async () => {
      await refresh();
      setOpen(false);
      toast.success("Transaction saved as draft.");
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Could not save transaction."),
  });
  const action = useMutation({
    mutationFn: async (input: { kind: "post" | "delete" | "void"; id: string }) =>
      input.kind === "post"
        ? postFinanceTransaction({ data: { id: input.id } })
        : input.kind === "delete"
          ? deleteFinanceDraft({ data: { id: input.id } })
          : voidFinanceTransaction({
              data: { id: input.id, reason: "Cancelled or entered in error" },
            }),
    onSuccess: async () => {
      await refresh();
      toast.success("Finance record updated.");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Action failed."),
  });
  const pay = useMutation({
    mutationFn: () =>
      recordFinancePayment({
        data: {
          id: String(payment?.id),
          date: today(),
          amount: Number(paymentAmount),
          method: "bank_or_cash",
        },
      }),
    onSuccess: async () => {
      await refresh();
      setPayment(null);
      toast.success("Payment recorded and journal posted.");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Payment failed."),
  });
  const accounts = useMemo(
    () =>
      data?.accounts.filter(
        (account) => account.account_type === (form.type === "expense" ? "expense" : "revenue"),
      ) || [],
    [data, form.type],
  );
  const defaultCurrency = data?.currencies.find((item) => item.is_default)?.code || "MWK";
  const newRecord = () => {
    setForm({ ...blankForm(sourceType, sourceId), currency: defaultCurrency });
    setOpen(true);
  };
  const upload = async (file: File) => {
    const body = new FormData();
    body.set("ownerId", form.id);
    body.set("file", file);
    const response = await fetch("/api/attachments/upload", { method: "POST", body });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Upload failed");
    setForm((current) => ({ ...current, attachments: [...current.attachments, result] }));
  };
  if (isLoading || !data)
    return (
      <Card>
        <CardContent className="py-8 text-sm text-muted-foreground">
          Loading financial activity…
        </CardContent>
      </Card>
    );
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">
            {compact ? "Financial activity" : "Accounting & finance"}
          </h2>
          <p className="text-sm text-muted-foreground">
            {sourceTitle
              ? `Income, direct costs and profitability for ${sourceTitle}.`
              : "Accrual transactions, payments, tax and a balanced audit trail."}
          </p>
        </div>
        <Button onClick={newRecord}>
          <Plus className="mr-2 size-4" />
          Record expense or revenue
        </Button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard
          label="Posted revenue"
          value={money(data.metrics.revenue, defaultCurrency)}
          icon={TrendingUp}
        />
        <MetricCard
          label="Posted expenses"
          value={money(data.metrics.expenses, defaultCurrency)}
          icon={TrendingDown}
        />
        <MetricCard
          label="Net contribution"
          value={money(data.metrics.profit, defaultCurrency)}
          icon={Landmark}
        />
        <MetricCard
          label="Receivable"
          value={money(data.metrics.receivable, defaultCurrency)}
          icon={Receipt}
        />
        <MetricCard
          label="Payable"
          value={money(data.metrics.payable, defaultCurrency)}
          icon={Banknote}
        />
      </div>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Transactions</CardTitle>
          <CardDescription>
            Drafts do not affect accounts. Posting creates balanced journal entries; posted records
            cannot be edited.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {data.transactions.length === 0 ? (
            <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
              No financial activity recorded yet.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date / reference</TableHead>
                  <TableHead>Activity</TableHead>
                  <TableHead>Counterparty</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Outstanding</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.transactions.map((transaction) => {
                  const remaining =
                    Number(transaction.total_amount) - Number(transaction.paid_amount);
                  return (
                    <TableRow key={String(transaction.id)}>
                      <TableCell>
                        <div className="font-medium">
                          {String(transaction.transaction_date).slice(0, 10)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {String(transaction.transaction_number)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="max-w-72 font-medium">
                          {String(transaction.description)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {String(
                            transaction.source_title ||
                              transaction.project_name ||
                              transaction.client_name ||
                              "Unallocated",
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{String(transaction.counterparty || "—")}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            transaction.status === "posted"
                              ? "default"
                              : transaction.status === "voided"
                                ? "destructive"
                                : "secondary"
                          }
                        >
                          {String(transaction.status)}
                        </Badge>
                        <div className="mt-1 text-xs capitalize text-muted-foreground">
                          {String(transaction.payment_status).replace("_", " ")}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {money(Number(transaction.total_amount), String(transaction.currency))}
                      </TableCell>
                      <TableCell className="text-right">
                        {money(remaining, String(transaction.currency))}
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          {transaction.status === "draft" && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  action.mutate({ kind: "post", id: String(transaction.id) })
                                }
                              >
                                Post
                              </Button>
                              <ConfirmAction
                                trigger={
                                  <Button size="icon" variant="ghost">
                                    <Trash2 className="size-4" />
                                  </Button>
                                }
                                title="Delete draft?"
                                description="This removes the unposted transaction."
                                onConfirm={() =>
                                  action.mutateAsync({ kind: "delete", id: String(transaction.id) })
                                }
                              />
                            </>
                          )}
                          {transaction.status === "posted" && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={remaining <= 0}
                                onClick={() => {
                                  setPayment(transaction);
                                  setPaymentAmount(String(remaining));
                                }}
                              >
                                Record payment
                              </Button>
                              <ConfirmAction
                                trigger={
                                  <Button size="sm" variant="ghost">
                                    Void
                                  </Button>
                                }
                                title="Void posted transaction?"
                                description="A reversing journal will preserve the audit trail. Transactions with payments cannot be voided."
                                confirmLabel="Void and reverse"
                                onConfirm={() =>
                                  action.mutateAsync({ kind: "void", id: String(transaction.id) })
                                }
                              />
                            </>
                          )}
                          {(transaction.attachments || []).map((file) => (
                            <Button key={String(file.id)} size="icon" variant="ghost" asChild>
                              <a
                                href={attachmentUrl(String(file.attachment_path))}
                                target="_blank"
                                rel="noreferrer"
                                title={String(file.file_name)}
                              >
                                <FileText className="size-4" />
                              </a>
                            </Button>
                          ))}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[92vh] max-w-5xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Record financial transaction</DialogTitle>
            <DialogDescription>
              Use one transaction with several lines for a single supplier bill or customer sale.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 md:grid-cols-4">
            <Field label="Type">
              <Select
                value={form.type}
                onValueChange={(value) =>
                  setForm((current) => ({
                    ...current,
                    type: value as FinanceTransactionType,
                    lines: current.lines.map((line) => ({ ...line, accountId: "" })),
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="expense">Expense / supplier cost</SelectItem>
                  <SelectItem value="revenue">Revenue / customer sale</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Transaction date">
              <Input
                type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
              />
            </Field>
            <Field label="Due date">
              <Input
                type="date"
                value={form.dueDate}
                onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
              />
            </Field>
            <Field label="Currency">
              <Select
                value={form.currency}
                onValueChange={(currency) => setForm({ ...form, currency })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {data.currencies.map((item) => (
                    <SelectItem key={item.code} value={item.code}>
                      {item.code} · {item.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Description">
              <Input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="e.g. Materials and transport for bid submission"
              />
            </Field>
            <Field label={form.type === "expense" ? "Supplier / payee" : "Customer / payer"}>
              <Input
                value={form.counterparty}
                onChange={(e) => setForm({ ...form, counterparty: e.target.value })}
              />
            </Field>
            <Field label="Invoice / receipt reference">
              <Input
                value={form.reference}
                onChange={(e) => setForm({ ...form, reference: e.target.value })}
              />
            </Field>
            <Field label="Related tender, project or activity">
              <Select
                value={form.sourceKey || "none"}
                onValueChange={(sourceKey) =>
                  setForm({ ...form, sourceKey: sourceKey === "none" ? "" : sourceKey })
                }
                disabled={Boolean(sourceType && sourceId)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose activity" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Unallocated / overhead</SelectItem>
                  {data.sources.map((item) => (
                    <SelectItem
                      key={`${item.source_type}:${item.source_id}`}
                      value={`${item.source_type}:${item.source_id}`}
                    >
                      {item.source_type.toUpperCase()} · {item.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <Field label="Tax treatment">
              <Select
                value={form.taxTreatment}
                onValueChange={(value) =>
                  setForm({
                    ...form,
                    taxTreatment: value as TaxTreatment,
                    taxRecoverable: value === "standard" ? form.taxRecoverable : false,
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No tax</SelectItem>
                  <SelectItem value="standard">Standard rated</SelectItem>
                  <SelectItem value="zero_rated">Zero rated</SelectItem>
                  <SelectItem value="exempt">Exempt</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            {form.type === "expense" && form.taxTreatment === "standard" && (
              <label className="mt-7 flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.taxRecoverable}
                  onChange={(e) => setForm({ ...form, taxRecoverable: e.target.checked })}
                />
                Input tax is recoverable
              </label>
            )}
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Transaction lines</Label>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setForm({ ...form, lines: [...form.lines, blankLine()] })}
              >
                <Plus className="mr-1 size-3" />
                Add line
              </Button>
            </div>
            {form.lines.map((line, index) => (
              <div
                key={index}
                className="grid gap-2 rounded-xl border bg-muted/20 p-3 md:grid-cols-[1.2fr_1.5fr_.55fr_.8fr_.6fr_auto]"
              >
                <Select
                  value={line.accountId}
                  onValueChange={(accountId) =>
                    setForm({
                      ...form,
                      lines: form.lines.map((item, i) =>
                        i === index ? { ...item, accountId } : item,
                      ),
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Account" />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.map((account) => (
                      <SelectItem key={account.id} value={account.id}>
                        {account.code} · {account.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  placeholder="Line description"
                  value={line.description}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      lines: form.lines.map((item, i) =>
                        i === index ? { ...item, description: e.target.value } : item,
                      ),
                    })
                  }
                />
                <Input
                  type="number"
                  min="0.0001"
                  step="0.01"
                  placeholder="Qty"
                  value={line.quantity}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      lines: form.lines.map((item, i) =>
                        i === index ? { ...item, quantity: e.target.value } : item,
                      ),
                    })
                  }
                />
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Unit amount"
                  value={line.unitAmount}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      lines: form.lines.map((item, i) =>
                        i === index ? { ...item, unitAmount: e.target.value } : item,
                      ),
                    })
                  }
                />
                <Input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  disabled={form.taxTreatment !== "standard"}
                  placeholder="Tax %"
                  value={line.taxRate}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      lines: form.lines.map((item, i) =>
                        i === index ? { ...item, taxRate: e.target.value } : item,
                      ),
                    })
                  }
                />
                <Button
                  size="icon"
                  variant="ghost"
                  disabled={form.lines.length === 1}
                  onClick={() =>
                    setForm({ ...form, lines: form.lines.filter((_, i) => i !== index) })
                  }
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Notes">
              <Textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </Field>
            <Field label="Receipts, invoices or evidence">
              <Input
                type="file"
                accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (file)
                    try {
                      await upload(file);
                      toast.success("Evidence attached.");
                    } catch (error) {
                      toast.error(error instanceof Error ? error.message : "Upload failed.");
                    }
                }}
              />
              {form.attachments.map((file) => (
                <p key={file.path} className="text-xs text-muted-foreground">
                  {file.name}
                </p>
              ))}
            </Field>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button disabled={save.isPending} onClick={() => save.mutate()}>
              {save.isPending ? "Saving…" : "Save draft"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={Boolean(payment)} onOpenChange={(next) => !next && setPayment(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record payment</DialogTitle>
            <DialogDescription>
              This posts the cash movement against the outstanding balance.
            </DialogDescription>
          </DialogHeader>
          <Field label="Amount">
            <Input
              type="number"
              min="0.01"
              step="0.01"
              value={paymentAmount}
              onChange={(e) => setPaymentAmount(e.target.value)}
            />
          </Field>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayment(null)}>
              Cancel
            </Button>
            <Button disabled={pay.isPending} onClick={() => pay.mutate()}>
              Post payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
function MetricCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: typeof TrendingUp;
}) {
  return (
    <Card>
      <CardContent className="flex items-start justify-between gap-2 p-4">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{label}</p>
          <MetricValue value={value} maxSize={1.35} className="mt-1" />
        </div>
        <Icon className="size-4 shrink-0 text-muted-foreground" />
      </CardContent>
    </Card>
  );
}
