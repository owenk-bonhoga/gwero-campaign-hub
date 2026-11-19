import { validateContract } from "./input-contract";
import { createServerFn } from "@tanstack/react-start";
import { permissionMiddleware } from "./auth.middleware";

export type VendorAttachment = {
  path: string;
  name: string;
  type: string;
  size: number;
};

type VendorInput = {
  id?: string;
  name: string;
  contactName?: string;
  email?: string;
  phone?: string;
  category?: string;
  notes?: string;
};

type QuoteInput = {
  id?: string;
  supplierId?: string;
  sourceName: string;
  quoteReference?: string;
  quoteDate?: string;
  validUntil?: string;
  currency: string;
  amount: number;
  notes?: string;
  attachment?: VendorAttachment;
};

type SerializableValue =
  string | number | boolean | null | SerializableValue[] | { [key: string]: SerializableValue };
type SerializableRecord = { [key: string]: SerializableValue };

function serial<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function rows<T = SerializableRecord>(result: unknown): T[] {
  return (result as [T[]])[0];
}

function validEmail(value: string) {
  return !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export const getVendorWorkspace = createServerFn({ method: "GET" })
  .middleware([permissionMiddleware("procurement.manage")])
  .handler(async () => {
    const { getPool } = await import("./db.server");
    const db = getPool();
    const [vendors, quotes, currencies] = await Promise.all([
      db.query("SELECT * FROM suppliers ORDER BY name"),
      db.query(
        `SELECT q.*, s.name AS supplier_name, u.full_name AS created_by_name,
                (SELECT COUNT(*) FROM cost_sheet_supplier_quotes l WHERE l.supplier_quote_id = q.id) AS linked_sheets
           FROM supplier_quotes q
           LEFT JOIN suppliers s ON s.id = q.supplier_id
           LEFT JOIN system_users u ON u.id = q.created_by
          ORDER BY COALESCE(q.quote_date, DATE(q.created_at)) DESC, q.created_at DESC`,
      ),
      db.query(
        "SELECT code, name, symbol FROM currencies WHERE is_active = TRUE ORDER BY is_default DESC, sort_order, code",
      ),
    ]);
    return serial({ vendors: rows(vendors), quotes: rows(quotes), currencies: rows(currencies) });
  });

export const saveVendor = createServerFn({ method: "POST" })
  .middleware([permissionMiddleware("procurement.manage")])
  .validator((data: VendorInput) => validateContract(data, "saveVendor"))
  .handler(async ({ data }) => {
    if (!data.name.trim()) throw new Error("Add the vendor name.");
    if (!validEmail(data.email?.trim() || "")) throw new Error("Add a valid vendor email address.");
    const { getPool } = await import("./db.server");
    const id = data.id || crypto.randomUUID();
    await getPool().execute(
      `INSERT INTO suppliers (id, name, contact_name, email, phone, category, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE name = VALUES(name), contact_name = VALUES(contact_name),
         email = VALUES(email), phone = VALUES(phone), category = VALUES(category), notes = VALUES(notes)`,
      [
        id,
        data.name.trim(),
        data.contactName?.trim() || null,
        data.email?.trim().toLowerCase() || null,
        data.phone?.trim() || null,
        data.category?.trim() || null,
        data.notes?.trim() || null,
      ],
    );
    return { id };
  });

export const deleteVendor = createServerFn({ method: "POST" })
  .middleware([permissionMiddleware("procurement.manage")])
  .validator((data: { id: string }) => validateContract(data, "deleteVendor"))
  .handler(async ({ data }) => {
    const { getPool } = await import("./db.server");
    await getPool().execute("DELETE FROM suppliers WHERE id = ?", [data.id]);
    return { ok: true };
  });

export const saveVendorQuote = createServerFn({ method: "POST" })
  .middleware([permissionMiddleware("procurement.manage")])
  .validator((data: QuoteInput) => validateContract(data, "saveVendorQuote"))
  .handler(async ({ data, context }) => {
    if (!Number.isFinite(data.amount) || data.amount < 0)
      throw new Error("Quote amount must be a valid positive number.");
    if (!data.currency.trim()) throw new Error("Choose a currency.");
    const { getPool } = await import("./db.server");
    const db = getPool();
    const id = data.id || crypto.randomUUID();
    let sourceName = data.sourceName.trim();
    if (data.supplierId) {
      const supplier = rows<{ name: string }>(
        await db.query("SELECT name FROM suppliers WHERE id = ? LIMIT 1", [data.supplierId]),
      )[0];
      if (!supplier) throw new Error("Vendor not found.");
      sourceName = supplier.name;
    }
    if (!sourceName) throw new Error("Add the person or organisation that issued the quote.");
    if (data.attachment && !data.attachment.path.startsWith(`${id}/`))
      throw new Error("Invalid quotation attachment.");
    const attachment = data.attachment;
    await db.execute(
      `INSERT INTO supplier_quotes
        (id, supplier_id, source_name, quote_reference, quote_date, valid_until, currency, amount,
         notes, attachment_path, attachment_name, attachment_type, attachment_size, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE supplier_id = VALUES(supplier_id), source_name = VALUES(source_name),
         quote_reference = VALUES(quote_reference), quote_date = VALUES(quote_date),
         valid_until = VALUES(valid_until), currency = VALUES(currency), amount = VALUES(amount),
         notes = VALUES(notes), attachment_path = COALESCE(VALUES(attachment_path), attachment_path),
         attachment_name = COALESCE(VALUES(attachment_name), attachment_name),
         attachment_type = COALESCE(VALUES(attachment_type), attachment_type),
         attachment_size = COALESCE(VALUES(attachment_size), attachment_size)`,
      [
        id,
        data.supplierId || null,
        sourceName,
        data.quoteReference?.trim() || null,
        data.quoteDate || null,
        data.validUntil || null,
        data.currency.trim().toUpperCase(),
        data.amount,
        data.notes?.trim() || null,
        attachment?.path || null,
        attachment?.name || null,
        attachment?.type || null,
        attachment?.size || null,
        context.user.id,
      ],
    );
    return { id };
  });

export const deleteVendorQuote = createServerFn({ method: "POST" })
  .middleware([permissionMiddleware("procurement.manage")])
  .validator((data: { id: string }) => validateContract(data, "deleteVendorQuote"))
  .handler(async ({ data }) => {
    const { getPool } = await import("./db.server");
    const db = getPool();
    await db.execute("DELETE FROM attachment_files WHERE owner_id = ?", [data.id]);
    await db.execute("DELETE FROM supplier_quotes WHERE id = ?", [data.id]);
    return { ok: true };
  });
