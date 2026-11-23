import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell, money } from "@/components/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { LineItems, sum } from "@/components/LineItems";
import { db } from "@/lib/db";
import { QuotationTemplateActions } from "@/components/QuotationTemplateActions";
import type { QuotationTemplateData } from "@/lib/db.types";

export const Route = createFileRoute("/quotations/$id")({
  component: QuotationDetail,
  head: () => ({
    meta: [
      { title: "Quotation | Gwero OS" },
      { name: "description", content: "Quotation line items and totals." },
      { property: "og:title", content: "Quotation | Gwero OS" },
      { property: "og:description", content: "Quotation line items and totals." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function QuotationDetail() {
  const { id } = Route.useParams();
  const { data: quote } = useQuery({
    queryKey: ["quotation", id],
    queryFn: async () => {
      const { data, error } = await db
        .from("quotations")
        .select("*, clients(name, company, address)")
        .eq("id", id)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data;
    },
  });

  const currency = quote?.currency ?? "USD";

  return (
    <AppShell
      title={quote?.title ?? "Quotation"}
      description={`${quote?.quote_number ?? ""} · ${
        (quote?.clients as { name?: string; company?: string } | null)?.company ??
        (quote?.clients as { name?: string } | null)?.name ??
        "No client"
      }`}
      actions={
        quote ? (
          <QuotationTemplateActions
            quotationId={id}
            templateData={quote.template_data as QuotationTemplateData | null}
            issueDate={quote.issue_date}
            validUntil={quote.valid_until}
            taxRate={Number(quote.tax_rate || 0)}
            discount={Number(quote.discount || 0)}
          />
        ) : null
      }
    >
      <div className="space-y-4">
        <Card>
          <CardContent className="grid gap-3 pt-4 sm:grid-cols-4">
            <Info label="Status" value={quote?.status ?? "—"} />
            <Info label="Issue date" value={quote?.issue_date ?? "—"} />
            <Info label="Valid until" value={quote?.valid_until ?? "—"} />
            <Info label="Tax rate" value={`${quote?.tax_rate ?? 0}%`} />
          </CardContent>
        </Card>
        <LineItems
          table="quotation_items"
          parentKey="quotation_id"
          parentId={id}
          fields={[
            { name: "description", label: "Description", className: "min-w-64 flex-1" },
            { name: "quantity", label: "Qty", type: "number", defaultValue: "1" },
            { name: "unit", label: "Unit", defaultValue: "Each" },
            { name: "unit_price", label: "Unit price", type: "number", defaultValue: "0" },
          ]}
          total={(rows) => {
            const net = sum(rows, (r) => Number(r["quantity"]) * Number(r["unit_price"]));
            const tax = (net * Number(quote?.tax_rate ?? 0)) / 100;
            return money(net + tax - Number(quote?.discount ?? 0), currency);
          }}
        />
      </div>
    </AppShell>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-medium capitalize">{value}</p>
    </div>
  );
}
