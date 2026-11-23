import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { QuotationTemplateData } from "./db.types";
import { readDocxPart, replaceDocxPart } from "./docx-zip.server";

export type BrandedQuotationItem = {
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
};

export type BrandedQuotationInput = {
  quoteNumber: string;
  title: string;
  customer: string;
  customerAddress?: string | null;
  currency: string;
  issueDate?: string | null;
  validUntil?: string | null;
  taxRate: number;
  discount: number;
  templateData?: QuotationTemplateData | null;
  items: BrandedQuotationItem[];
};

const templateName = "gwero-branded-quotation-template.docx";

function xml(value: unknown) {
  return Array.from(String(value ?? ""))
    .filter((character) => {
      const code = character.codePointAt(0) || 0;
      return code === 9 || code === 10 || code === 13 || code >= 32;
    })
    .join("")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function replaceFirst(source: string, marker: string, value: unknown) {
  const index = source.indexOf(marker);
  if (index < 0) throw new Error(`Quotation template slot ${marker} was not found.`);
  return source.slice(0, index) + xml(value) + source.slice(index + marker.length);
}

function money(value: number) {
  return Number(value || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function quantity(value: number) {
  return Number(value || 0).toLocaleString("en-US", { maximumFractionDigits: 2 });
}

function date(value?: string | null) {
  if (!value) return "Not specified";
  const parsed = new Date(`${String(value).slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return String(value);
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(parsed);
}

function defaultValidity(issue?: string | null, validUntil?: string | null) {
  if (!issue || !validUntil) return "As stated in the validity date above";
  const start = new Date(`${String(issue).slice(0, 10)}T00:00:00Z`).getTime();
  const end = new Date(`${String(validUntil).slice(0, 10)}T00:00:00Z`).getTime();
  const days = Math.round((end - start) / 86_400_000);
  return days > 0 ? `${days} calendar days from the issue date` : "As stated above";
}

function replaceItems(documentXml: string, items: BrandedQuotationItem[]) {
  const marker = "[Product or service description and specification]";
  const markerIndex = documentXml.indexOf(marker);
  if (markerIndex < 0) throw new Error("Quotation item table was not found in the template.");
  const tableStart = documentXml.lastIndexOf("<w:tbl>", markerIndex);
  const tableEnd = documentXml.indexOf("</w:tbl>", markerIndex);
  if (tableStart < 0 || tableEnd < 0) throw new Error("Quotation item table is malformed.");
  const table = documentXml.slice(tableStart, tableEnd + 8);
  const rows = table.match(/<w:tr\b[\s\S]*?<\/w:tr>/g) || [];
  if (rows.length < 2) throw new Error("Quotation item row pattern was not found.");
  const firstRowStart = table.indexOf(rows[0]!);
  const bodyStart = firstRowStart + rows[0]!.length;
  const bodyEnd = table.lastIndexOf("</w:tbl>");
  const prototype = rows[1]!;
  const outputRows = Array.from({ length: Math.max(5, items.length) }, (_, index) => {
    const item = items[index];
    let row = prototype;
    row = row.replace(/(<w:t[^>]*>)1(<\/w:t>)/, `$1${item ? index + 1 : ""}$2`);
    row = replaceFirst(row, marker, item?.description || "");
    row = replaceFirst(row, "[0]", item ? quantity(item.quantity) : "");
    row = replaceFirst(row, "Each", item?.unit || "");
    row = replaceFirst(row, "[0.00]", item ? money(item.unitPrice) : "");
    row = replaceFirst(
      row,
      "[0.00]",
      item ? money(Number(item.quantity || 0) * Number(item.unitPrice || 0)) : "",
    );
    return row;
  }).join("");
  const populatedTable = table.slice(0, bodyStart) + outputRows + table.slice(bodyEnd);
  return documentXml.slice(0, tableStart) + populatedTable + documentXml.slice(tableEnd + 8);
}

export async function readBrandedQuotationTemplate() {
  const candidates = [
    resolve("public", "templates", templateName),
    resolve("dist", "public", "templates", templateName),
    resolve("dist", "client", "templates", templateName),
  ];
  for (const candidate of candidates) {
    try {
      return await readFile(candidate);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
  throw new Error("The branded quotation template is not available on this deployment.");
}

export function buildBrandedQuotationDocx(template: Uint8Array, input: BrandedQuotationInput) {
  const details = input.templateData || {};
  let documentXml = readDocxPart(template, "word/document.xml").toString("utf8");
  documentXml = replaceItems(documentXml, input.items);

  const goodsSubtotal =
    input.items.reduce(
      (total, item) => total + Number(item.quantity || 0) * Number(item.unitPrice || 0),
      0,
    ) - Number(input.discount || 0);
  const freight = Number(details.internationalFreight || 0);
  const insurance = Number(details.cargoInsurance || 0);
  const customs = Number(details.customsAndImportTaxes || 0);
  const clearing = Number(details.clearingAndLocalDelivery || 0);
  const beforeLevies = goodsSubtotal + freight + insurance + customs + clearing;
  const ppda = Number(details.ppdaLevy || 0);
  const vat = ((beforeLevies + ppda) * Number(input.taxRate || 0)) / 100;
  const grandTotal = beforeLevies + ppda + vat;

  const replacements: Array<[string, unknown]> = [
    ["[Procurement title or customer requirement]", input.title],
    ["[GW-QT-YYYY-NNN]", input.quoteNumber],
    ["[Day Month Year]", date(input.issueDate)],
    ["[Customer organisation]", input.customer],
    ["[Day Month Year]", date(input.validUntil)],
    ["[Tender or RFQ reference]", details.procurementReference || "Not specified"],
    ["[USD or MWK]", input.currency],
    ["[Contact person and title]", details.attention || "Not specified"],
    ["[City or site]", details.deliveryLocation || input.customerAddress || "Not specified"],
    ["[Currency]", input.currency],
    ["[0.00]", money(goodsSubtotal)],
    ["[0.00]", money(freight)],
    ["[0.00]", money(insurance)],
    ["[0.00]", money(customs)],
    ["[0.00]", money(clearing)],
    ["[0.00]", money(beforeLevies)],
    ["[0.00]", money(ppda)],
    ["[0.00]", money(vat)],
    ["[0.00]", money(grandTotal)],
    [
      "[Number of days or weeks from confirmed order and deposit]",
      details.deliveryPeriod || "Not specified",
    ],
    [
      "[Delivered duty paid or other agreed Incoterm and destination]",
      details.deliveryBasis || "Not specified",
    ],
    [
      "[Warranty period and manufacturer or supplier coverage]",
      details.warranty || "Not specified",
    ],
    ["[Included or excluded with scope details]", details.installation || "Not specified"],
    ["[Support response time and contact channel]", details.afterSalesSupport || "Not specified"],
    [
      "[For example 50 percent deposit and balance on delivery]",
      details.paymentTerms || "Not specified",
    ],
    [
      "[Number of calendar days from issue date]",
      details.priceValidity || defaultValidity(input.issueDate, input.validUntil),
    ],
    [
      "[State whether VAT and statutory levies are included or excluded]",
      details.taxes || `VAT at ${Number(input.taxRate || 0)}% and PPDA levy are shown separately`,
    ],
    [
      "[Applicable only when conversion to MWK is required]",
      details.exchangeRate || "Not applicable unless agreed in writing",
    ],
    [
      "Written customer approval is required before any change in scope or price",
      details.variations ||
        "Written customer approval is required before any change in scope or price",
    ],
    [
      "[State when ownership and risk transfer to the customer]",
      details.titleAndRisk || "On full payment and confirmed delivery",
    ],
    ["[Bank name]", details.bankName || "To be confirmed"],
    ["[Account name]", details.bankAccountName || "GWERO LIMITED"],
    ["[Account number]", details.bankAccountNumber || "To be confirmed"],
    ["[Branch and SWIFT code]", details.branchAndSwift || "To be confirmed"],
    ["Mwayi Shalome Kampesi", details.supplierAuthorizerName || "Mwayi Shalome Kampesi"],
    ["Managing Director", details.supplierAuthorizerTitle || "Managing Director"],
  ];
  for (const replacement of replacements)
    documentXml = replaceFirst(documentXml, replacement[0], replacement[1]);

  return replaceDocxPart(template, "word/document.xml", Buffer.from(documentXml, "utf8"));
}
