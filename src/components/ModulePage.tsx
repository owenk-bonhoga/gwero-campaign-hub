import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { db } from "@/lib/db";
import { useDebounced } from "@/lib/use-debounced";
import { QueryState } from "./QueryState";
import { Button } from "./ui/button";
import { AppShell } from "@/components/AppShell";
import { RecordsTable, type ColumnDef, type FieldDef } from "@/components/RecordsPage";
import type { TableName } from "@/lib/db.types";

export function ModulePage({
  title,
  description,
  table,
  select = "*",
  columns,
  fields,
  searchKeys,
  createLabel,
  detailTo,
}: {
  title: string;
  description: string;
  table: TableName;
  select?: string;
  columns: ColumnDef[];
  fields: FieldDef[];
  searchKeys?: string[];
  createLabel?: string;
  detailTo?: (row: Record<string, unknown>) => string;
}) {
  const [search, setSearch] = useState("");
  const term = useDebounced(search);
  const [page, setPage] = useState(0);
  const listing = useQuery({
    queryKey: ["rows", table, select, "page", page, term],
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const result = await db
        .from(table)
        .select(select)
        .order("created_at" as never, { ascending: false })
        .search(term, searchKeys || [])
        .range(page * 50, page * 50 + 49);
      if (result.error) throw new Error(result.error.message);
      return {
        rows: result.data as unknown as Record<string, unknown>[],
        count: result.count || 0,
      };
    },
  });
  const rows = listing.data?.rows || [];
  const isLoading = listing.isPending;
  return (
    <AppShell title={title} description={description}>
      <QueryState error={listing.error} retry={() => void listing.refetch()} />
      <RecordsTable
        serverSearch={search}
        onSearch={(value) => {
          setSearch(value);
          setPage(0);
        }}
        table={table}
        select={select}
        rows={rows}
        isLoading={isLoading}
        columns={columns}
        fields={fields}
        {...(createLabel ? { createLabel } : {})}
        {...(detailTo ? { detailTo } : {})}
        {...(searchKeys ? { searchKeys } : {})}
      />
      <div className="mt-4 flex items-center gap-3">
        <Button
          variant="outline"
          disabled={!page || listing.isFetching}
          onClick={() => setPage(page - 1)}
        >
          Previous
        </Button>
        <span className="text-sm text-muted-foreground">{listing.data?.count ?? "…"} records</span>
        <Button
          variant="outline"
          disabled={(page + 1) * 50 >= (listing.data?.count || 0) || listing.isFetching}
          onClick={() => setPage(page + 1)}
        >
          Next
        </Button>
      </div>
    </AppShell>
  );
}
