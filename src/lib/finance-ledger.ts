export type FinanceTransactionType = "expense" | "revenue";
export type TaxTreatment = "none" | "standard" | "zero_rated" | "exempt";

export type FinanceLineInput = {
  accountId: string;
  description: string;
  quantity: number;
  unitAmount: number;
  taxRate?: number;
};

export type CalculatedFinanceLine = Omit<FinanceLineInput, "taxRate"> & {
  taxRate: number;
  netAmount: number;
  taxAmount: number;
  totalAmount: number;
};

export type JournalLine = {
  accountId: string;
  description: string;
  debit: number;
  credit: number;
};

export const roundMoney = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

export function calculateFinanceLines(lines: FinanceLineInput[], treatment: TaxTreatment) {
  const calculated: CalculatedFinanceLine[] = lines.map((line) => {
    const quantity = Number(line.quantity);
    const unitAmount = Number(line.unitAmount);
    const rate = treatment === "standard" ? Number(line.taxRate || 0) : 0;
    if (!line.accountId || !line.description.trim())
      throw new Error("Every line needs an account and description.");
    if (
      !Number.isFinite(quantity) ||
      quantity <= 0 ||
      !Number.isFinite(unitAmount) ||
      unitAmount < 0
    )
      throw new Error("Line quantities must be positive and amounts cannot be negative.");
    if (!Number.isFinite(rate) || rate < 0 || rate > 100)
      throw new Error("Tax rates must be between 0 and 100.");
    const netAmount = roundMoney(quantity * unitAmount);
    const taxAmount = roundMoney(netAmount * (rate / 100));
    return {
      ...line,
      quantity,
      unitAmount,
      taxRate: rate,
      netAmount,
      taxAmount,
      totalAmount: roundMoney(netAmount + taxAmount),
    };
  });
  return {
    lines: calculated,
    subtotal: roundMoney(calculated.reduce((sum, line) => sum + line.netAmount, 0)),
    taxAmount: roundMoney(calculated.reduce((sum, line) => sum + line.taxAmount, 0)),
    totalAmount: roundMoney(calculated.reduce((sum, line) => sum + line.totalAmount, 0)),
  };
}

export function buildAccrualJournal(input: {
  type: FinanceTransactionType;
  description: string;
  lines: CalculatedFinanceLine[];
  taxRecoverable: boolean;
  receivableAccountId: string;
  payableAccountId: string;
  inputTaxAccountId: string;
  outputTaxAccountId: string;
}): JournalLine[] {
  const total = roundMoney(input.lines.reduce((sum, line) => sum + line.totalAmount, 0));
  const journal: JournalLine[] = [];
  if (input.type === "revenue") {
    journal.push({
      accountId: input.receivableAccountId,
      description: input.description,
      debit: total,
      credit: 0,
    });
    for (const line of input.lines) {
      journal.push({
        accountId: line.accountId,
        description: line.description,
        debit: 0,
        credit: line.netAmount,
      });
      if (line.taxAmount)
        journal.push({
          accountId: input.outputTaxAccountId,
          description: `Output tax · ${line.description}`,
          debit: 0,
          credit: line.taxAmount,
        });
    }
  } else {
    for (const line of input.lines) {
      journal.push({
        accountId: line.accountId,
        description: line.description,
        debit: input.taxRecoverable ? line.netAmount : line.totalAmount,
        credit: 0,
      });
      if (input.taxRecoverable && line.taxAmount)
        journal.push({
          accountId: input.inputTaxAccountId,
          description: `Recoverable input tax · ${line.description}`,
          debit: line.taxAmount,
          credit: 0,
        });
    }
    journal.push({
      accountId: input.payableAccountId,
      description: input.description,
      debit: 0,
      credit: total,
    });
  }
  const debit = roundMoney(journal.reduce((sum, line) => sum + line.debit, 0));
  const credit = roundMoney(journal.reduce((sum, line) => sum + line.credit, 0));
  if (debit !== credit)
    throw new Error(`Journal is out of balance (${debit.toFixed(2)} / ${credit.toFixed(2)}).`);
  return journal;
}
