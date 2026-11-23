import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/quotations/$id/document")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const { currentUser } = await import("@/lib/auth.server");
        const user = await currentUser();
        if (!user) return new Response("Authentication required", { status: 401 });
        if (!user.permissions.includes("opportunities.manage"))
          return new Response("Permission denied", { status: 403 });

        try {
          const [{ getPool }, { buildBrandedQuotationDocx, readBrandedQuotationTemplate }] =
            await Promise.all([
              import("@/lib/db.server"),
              import("@/lib/quotation-template.server"),
            ]);
          const db = getPool();
          const [quotationRows] = await db.execute(
            `SELECT q.*, COALESCE(c.company, c.name) AS customer_name, c.address AS customer_address
               FROM quotations q LEFT JOIN clients c ON c.id = q.client_id
              WHERE q.id = ? LIMIT 1`,
            [params.id],
          );
          const quote = (quotationRows as Array<Record<string, unknown>>)[0];
          if (!quote) return new Response("Quotation not found", { status: 404 });
          const [itemRows] = await db.execute(
            `SELECT description, quantity, unit, unit_price FROM quotation_items
              WHERE quotation_id = ? ORDER BY created_at, id`,
            [params.id],
          );
          const rawTemplateData = quote["template_data"];
          const templateData =
            typeof rawTemplateData === "string"
              ? JSON.parse(rawTemplateData)
              : rawTemplateData && typeof rawTemplateData === "object"
                ? rawTemplateData
                : {};
          const template = await readBrandedQuotationTemplate();
          const output = buildBrandedQuotationDocx(template, {
            quoteNumber: String(quote["quote_number"] || "Quotation"),
            title: String(quote["title"] || "Quotation"),
            customer: String(quote["customer_name"] || "Customer not specified"),
            customerAddress: quote["customer_address"] ? String(quote["customer_address"]) : null,
            currency: String(quote["currency"] || "MWK"),
            issueDate: quote["issue_date"] ? String(quote["issue_date"]) : null,
            validUntil: quote["valid_until"] ? String(quote["valid_until"]) : null,
            taxRate: Number(quote["tax_rate"] || 0),
            discount: Number(quote["discount"] || 0),
            templateData,
            items: (itemRows as Array<Record<string, unknown>>).map((item) => ({
              description: String(item["description"] || ""),
              quantity: Number(item["quantity"] || 0),
              unit: String(item["unit"] || "Each"),
              unitPrice: Number(item["unit_price"] || 0),
            })),
          });
          const safeNumber = String(quote["quote_number"] || "quotation")
            .replace(/[^a-z0-9._-]+/gi, "-")
            .replace(/^-+|-+$/g, "");
          return new Response(
            output.buffer.slice(output.byteOffset, output.byteOffset + output.byteLength),
            {
              headers: {
                "content-type":
                  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                "content-length": String(output.byteLength),
                "content-disposition": `attachment; filename="${safeNumber || "quotation"}.docx"`,
                "cache-control": "private, no-store",
                "x-content-type-options": "nosniff",
              },
            },
          );
        } catch (error) {
          console.error("Quotation document generation failed", error);
          return new Response("Could not generate the quotation document", { status: 500 });
        }
      },
    },
  },
});
