import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { readDocxPart } from "../src/lib/docx-zip.server.ts";
import { buildBrandedQuotationDocx } from "../src/lib/quotation-template.server.ts";

const template = readFileSync(resolve("public/templates/gwero-branded-quotation-template.docx"));

test("retained GWERO quotation template is the approved source file", () => {
  assert.equal(
    createHash("sha256").update(template).digest("hex").toUpperCase(),
    "C1780D303FB2EE4BD8BBFE7EA04E84E29D90C51E73A4CC175F6BD03C64BA4D02",
  );
});

test("quotation generator fills the supplied template and keeps its package furniture", () => {
  const output = buildBrandedQuotationDocx(template, {
    quoteNumber: "GW-QT-2026-017",
    title: "Supply of desktop computers",
    customer: "Example Customer Limited",
    customerAddress: "Blantyre, Malawi",
    currency: "MWK",
    issueDate: "2026-11-23",
    validUntil: "2026-12-23",
    taxRate: 16.5,
    discount: 5_000,
    templateData: {
      procurementReference: "RFQ-ICT-017",
      attention: "Procurement Manager",
      deliveryLocation: "Blantyre office",
      internationalFreight: 100_000,
      cargoInsurance: 10_000,
      customsAndImportTaxes: 25_000,
      clearingAndLocalDelivery: 15_000,
      ppdaLevy: 7_500,
      deliveryPeriod: "Four weeks from confirmed order and deposit",
      deliveryBasis: "Delivered duty paid to Blantyre",
      warranty: "Twelve months manufacturer warranty",
      installation: "Included",
      afterSalesSupport: "Business-hours support by email and telephone",
      paymentTerms: "50 percent deposit and balance on delivery",
      priceValidity: "30 calendar days from the issue date",
      taxes: "VAT and PPDA levy shown separately",
      exchangeRate: "Not applicable",
      bankName: "Example Bank",
      bankAccountName: "GWERO LIMITED",
      bankAccountNumber: "100200300",
      branchAndSwift: "Blantyre · EXAMPLEMW",
      supplierAuthorizerName: "Christian Baluti",
      supplierAuthorizerTitle: "Director",
    },
    items: [
      { description: "Desktop computer", quantity: 2, unit: "Each", unitPrice: 1_000_000 },
      { description: "On-site configuration", quantity: 1, unit: "Service", unitPrice: 200_000 },
    ],
  });
  const documentXml = readDocxPart(output, "word/document.xml").toString("utf8");
  for (const expected of [
    "GW-QT-2026-017",
    "Supply of desktop computers",
    "Example Customer Limited",
    "RFQ-ICT-017",
    "Desktop computer",
    "On-site configuration",
    "Example Bank",
    "Christian Baluti",
  ])
    assert.match(documentXml, new RegExp(expected));
  assert.doesNotMatch(documentXml, /\[Product or service description and specification\]/);
  assert.doesNotMatch(documentXml, /\[GW-QT-YYYY-NNN\]/);

  for (const part of [
    "[Content_Types].xml",
    "word/styles.xml",
    "word/stylesWithEffects.xml",
    "word/settings.xml",
    "word/numbering.xml",
    "word/theme/theme1.xml",
    "word/_rels/document.xml.rels",
    "docProps/thumbnail.jpeg",
  ])
    assert.deepEqual(readDocxPart(output, part), readDocxPart(template, part));
});
