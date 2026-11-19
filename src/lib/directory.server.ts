import { executeRead } from "./db.server";
import type { ProspectContact } from "./db.types";

export type DirectoryRow = {
  id: string;
  name: string;
  company: string | null;
  email: string;
  industry: string | null;
  logo_path: string | null;
  status: string;
  created_at: string;
};
export type DirectoryInput = { search?: string; category?: string; sort?: string; offset?: number };
export async function directoryPage(kind: "clients" | "prospects", input: DirectoryInput) {
  const offset = Math.max(0, Math.floor(input.offset || 0));
  if (offset > 1_000_000) throw new Error("Page is out of range.");
  const size = 30;
  const params: unknown[] = [];
  const filters: string[] = [];
  if (input.search?.trim()) {
    const columns =
      kind === "clients"
        ? ["name", "company", "email", "industry"]
        : ["company", "email", "first_name", "last_name"];
    filters.push(`(${columns.map((column) => `p.${column} LIKE ?`).join(" OR ")})`);
    const term = `%${input.search.trim().slice(0, 200)}%`;
    params.push(...columns.map(() => term));
  }
  if (kind === "prospects" && input.category && input.category !== "all") {
    filters.push("p.category_id=?");
    params.push(input.category);
  }
  const where = filters.length ? ` WHERE ${filters.join(" AND ")}` : "";
  const orders: Record<string, string> = {
    name_asc: "COALESCE(p.company,p.email) ASC,p.id",
    name_desc: "COALESCE(p.company,p.email) DESC,p.id",
    newest: "p.created_at DESC,p.id",
    oldest: "p.created_at ASC,p.id",
    contacts_desc:
      "(SELECT COUNT(*) FROM prospect_contacts c WHERE c.prospect_id=p.id) DESC,COALESCE(p.company,p.email),p.id",
  };
  const order =
    kind === "clients"
      ? "p.created_at DESC,p.id"
      : orders[input.sort || "name_asc"] || orders["name_asc"];
  const [[records], [counts]] = await Promise.all([
    executeRead(
      `SELECT p.id,${kind === "clients" ? "p.name" : "COALESCE(p.company,p.email)"} AS name,p.company,p.email,p.industry,p.logo_path,p.status,p.created_at FROM ${kind} p${where} ORDER BY ${order} LIMIT ${size} OFFSET ${offset}`,
      params,
    ),
    executeRead(`SELECT COUNT(*) total FROM ${kind} p${where}`, params),
  ]);
  const rows = records as DirectoryRow[];
  const total = Number((counts as Array<{ total: number }>)[0]?.total || 0);
  const ids = rows.map((row) => row.id);
  const contacts =
    kind === "prospects" && ids.length
      ? ((
          await executeRead(
            `SELECT id,prospect_id,first_name,last_name,email,job_title,avatar_url FROM prospect_contacts WHERE prospect_id IN (${ids.map(() => "?").join(",")}) ORDER BY first_name,id`,
            ids,
          )
        )[0] as Array<
          Pick<
            ProspectContact,
            "id" | "prospect_id" | "first_name" | "last_name" | "email" | "job_title" | "avatar_url"
          >
        >)
      : [];
  return { rows, contacts, total, nextOffset: offset + size < total ? offset + size : null };
}
