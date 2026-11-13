import assert from "node:assert/strict";
import test from "node:test";
import { buildAccrualJournal, calculateFinanceLines } from "../src/lib/finance-ledger.ts";

test("calculates standard tax and creates a balanced recoverable expense journal", () => {
  const calculation = calculateFinanceLines(
    [
      {
        accountId: "printing",
        description: "Tender printing",
        quantity: 2,
        unitAmount: 10_000,
        taxRate: 16.5,
      },
    ],
    "standard",
  );
  assert.equal(calculation.subtotal, 20_000);
  assert.equal(calculation.taxAmount, 3_300);
  assert.equal(calculation.totalAmount, 23_300);
  const journal = buildAccrualJournal({
    type: "expense",
    description: "Bid costs",
    lines: calculation.lines,
    taxRecoverable: true,
    receivableAccountId: "ar",
    payableAccountId: "ap",
    inputTaxAccountId: "vat-in",
    outputTaxAccountId: "vat-out",
  });
  assert.equal(
    journal.reduce((sum, line) => sum + line.debit, 0),
    23_300,
  );
  assert.equal(
    journal.reduce((sum, line) => sum + line.credit, 0),
    23_300,
  );
});

test("keeps exempt transactions tax free", () => {
  const result = calculateFinanceLines(
    [
      {
        accountId: "transport",
        description: "Transport",
        quantity: 1,
        unitAmount: 15_000,
        taxRate: 16.5,
      },
    ],
    "exempt",
  );
  assert.equal(result.taxAmount, 0);
  assert.equal(result.totalAmount, 15_000);
});
