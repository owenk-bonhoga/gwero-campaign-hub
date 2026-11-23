import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Download, Settings2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { db } from "@/lib/db";
import type { QuotationTemplateData } from "@/lib/db.types";

type Form = Record<string, string>;

const textFields = [
  ["procurementReference", "Procurement or RFQ reference"],
  ["attention", "Attention"],
  ["deliveryLocation", "Delivery location"],
] as const;
const deliveryFields = [
  ["deliveryPeriod", "Delivery period"],
  ["deliveryBasis", "Delivery basis or Incoterm"],
  ["warranty", "Warranty"],
  ["installation", "Installation"],
  ["afterSalesSupport", "After-sales support"],
] as const;
const commercialFields = [
  ["paymentTerms", "Payment terms"],
  ["priceValidity", "Price validity"],
  ["taxes", "Tax statement"],
  ["exchangeRate", "Exchange rate"],
  ["variations", "Variations"],
  ["titleAndRisk", "Title and risk"],
] as const;
const bankingFields = [
  ["bankName", "Bank"],
  ["bankAccountName", "Account name"],
  ["bankAccountNumber", "Account number"],
  ["branchAndSwift", "Branch and SWIFT"],
  ["supplierAuthorizerName", "Supplier authorizer"],
  ["supplierAuthorizerTitle", "Authorizer title"],
] as const;
const chargeFields = [
  ["internationalFreight", "International freight"],
  ["cargoInsurance", "Cargo insurance"],
  ["customsAndImportTaxes", "Customs duty and import taxes"],
  ["clearingAndLocalDelivery", "Clearing and local delivery"],
  ["ppdaLevy", "PPDA levy"],
] as const;

function initialForm(
  data: QuotationTemplateData | null | undefined,
  core: {
    issueDate?: string | null | undefined;
    validUntil?: string | null | undefined;
    taxRate?: number | undefined;
    discount?: number | undefined;
  },
) {
  const source = data || {};
  const result: Form = {
    issueDate: String(core.issueDate || "").slice(0, 10),
    validUntil: String(core.validUntil || "").slice(0, 10),
    taxRate: String(core.taxRate ?? 0),
    discount: String(core.discount ?? 0),
  };
  for (const [name] of [...textFields, ...deliveryFields, ...commercialFields, ...bankingFields])
    result[name] = String(source[name] || "");
  for (const [name] of chargeFields) result[name] = String(source[name] ?? 0);
  return result;
}

export function QuotationTemplateActions({
  quotationId,
  templateData,
  issueDate,
  validUntil,
  taxRate,
  discount,
}: {
  quotationId: string;
  templateData?: QuotationTemplateData | null;
  issueDate?: string | null;
  validUntil?: string | null;
  taxRate?: number;
  discount?: number;
}) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Form>(() =>
    initialForm(templateData, { issueDate, validUntil, taxRate, discount }),
  );
  useEffect(() => {
    setForm(initialForm(templateData, { issueDate, validUntil, taxRate, discount }));
  }, [templateData, issueDate, validUntil, taxRate, discount]);

  const update = (name: string, value: string) =>
    setForm((current) => ({ ...current, [name]: value }));
  const save = useMutation({
    mutationFn: async () => {
      const generated: Record<string, string | number> = {};
      for (const [name] of [
        ...textFields,
        ...deliveryFields,
        ...commercialFields,
        ...bankingFields,
      ])
        generated[name] = form[name]?.trim() || "";
      for (const [name] of chargeFields) generated[name] = Number(form[name] || 0);
      const { error } = await db
        .from("quotations")
        .update({
          issue_date: form["issueDate"] || null,
          valid_until: form["validUntil"] || null,
          tax_rate: Number(form["taxRate"] || 0),
          discount: Number(form["discount"] || 0),
          template_data: generated,
        })
        .eq("id", quotationId);
      if (error) throw new Error(error.message);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["quotation", quotationId] });
      setOpen(false);
      toast.success("Branded quotation details saved.");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="outline">
            <Settings2 className="size-4" /> Configure quote
          </Button>
        </DialogTrigger>
        <DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Branded quotation details</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            These fields map directly to the supplied two-page GWERO quotation template.
          </p>
          <Tabs defaultValue="summary">
            <TabsList className="grid h-auto w-full grid-cols-3">
              <TabsTrigger value="summary">Summary and pricing</TabsTrigger>
              <TabsTrigger value="delivery">Delivery and terms</TabsTrigger>
              <TabsTrigger value="banking">Banking and approval</TabsTrigger>
            </TabsList>
            <TabsContent value="summary" className="grid gap-4 pt-3 sm:grid-cols-2">
              {textFields.map(([name, label]) => (
                <Field
                  key={name}
                  label={label}
                  value={form[name] || ""}
                  onChange={(value) => update(name, value)}
                />
              ))}
              <Field
                label="Issue date"
                type="date"
                value={form["issueDate"] || ""}
                onChange={(value) => update("issueDate", value)}
              />
              <Field
                label="Valid until"
                type="date"
                value={form["validUntil"] || ""}
                onChange={(value) => update("validUntil", value)}
              />
              <Field
                label="VAT rate %"
                type="number"
                value={form["taxRate"] || ""}
                onChange={(value) => update("taxRate", value)}
              />
              <Field
                label="Discount"
                type="number"
                value={form["discount"] || ""}
                onChange={(value) => update("discount", value)}
              />
              {chargeFields.map(([name, label]) => (
                <Field
                  key={name}
                  label={label}
                  type="number"
                  value={form[name] || ""}
                  onChange={(value) => update(name, value)}
                />
              ))}
            </TabsContent>
            <TabsContent value="delivery" className="grid gap-4 pt-3 sm:grid-cols-2">
              {deliveryFields.map(([name, label]) => (
                <TextField
                  key={name}
                  label={label}
                  value={form[name] || ""}
                  onChange={(value) => update(name, value)}
                />
              ))}
              {commercialFields.map(([name, label]) => (
                <TextField
                  key={name}
                  label={label}
                  value={form[name] || ""}
                  onChange={(value) => update(name, value)}
                />
              ))}
            </TabsContent>
            <TabsContent value="banking" className="grid gap-4 pt-3 sm:grid-cols-2">
              {bankingFields.map(([name, label]) => (
                <Field
                  key={name}
                  label={label}
                  value={form[name] || ""}
                  onChange={(value) => update(name, value)}
                />
              ))}
              <p className="sm:col-span-2 text-xs leading-5 text-muted-foreground">
                Banking details are included only in the generated quotation document. Confirm them
                before sending the quote to a customer.
              </p>
            </TabsContent>
          </Tabs>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button disabled={save.isPending} onClick={() => save.mutate()}>
              {save.isPending ? "Saving…" : "Save quotation details"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Button asChild>
        <a href={`/api/quotations/${quotationId}/document`}>
          <Download className="size-4" /> Download branded quote
        </a>
      </Button>
    </>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: "text" | "number" | "date";
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input
        type={type}
        step={type === "number" ? "0.01" : undefined}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Textarea rows={3} value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}
