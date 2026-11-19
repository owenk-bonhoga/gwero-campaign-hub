import { clientDirectory } from "@/lib/directory.functions";
import { useDebounced } from "@/lib/use-debounced";
import { QueryState } from "@/components/QueryState";
import { createFileRoute, Link, Outlet, useLocation } from "@tanstack/react-router";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, Plus, Search, UsersRound } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { db } from "@/lib/db";

export const Route = createFileRoute("/clients")({ component: ClientsRoute });

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function ClientsRoute() {
  const location = useLocation();
  return location.pathname !== "/clients" && location.pathname !== "/clients/" ? (
    <Outlet />
  ) : (
    <ClientsPage />
  );
}

function ClientsPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [offset, setOffset] = useState(0);
  const [createOpen, setCreateOpen] = useState(false);
  const term = useDebounced(search);
  const listing = useQuery({
    queryKey: ["clients", "directory", term, offset],
    queryFn: () => clientDirectory({ data: { search: term, offset } }),
    placeholderData: keepPreviousData,
  });
  const clients = listing.data?.rows || [];
  const create = useMutation({
    mutationFn: async () => {
      if (!name.trim()) throw new Error("Client name is required.");
      const { error } = await db
        .from("clients")
        .insert({ name: name.trim(), email: email.trim() || null });
      if (error) throw error;
    },
    onSuccess: () => {
      setName("");
      setEmail("");
      setCreateOpen(false);
      toast.success("Client added.");
      void qc.invalidateQueries({ queryKey: ["clients"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <AppShell
      title="Clients"
      description="The organisations and people behind your work."
      actions={
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="size-4" /> Add client
        </Button>
      }
    >
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add client</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="client-name">Client name</Label>
              <Input
                id="client-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Organisation or client name"
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="client-email">Email address</Label>
              <Input
                id="client-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="contact@example.com"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => create.mutate()} disabled={create.isPending}>
              {create.isPending ? "Adding…" : "Add client"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <section className="gwero-panel p-5 md:p-6">
        <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex w-max max-w-full gap-1 rounded-[11px] bg-[#f0f4f6] p-1">
            <span className="rounded-lg bg-white px-3 py-2 text-xs font-semibold text-[#1b3547] shadow-sm">
              Clients
            </span>
            <Link
              to="/prospects"
              className="rounded-lg px-3 py-2 text-xs font-semibold text-[#8a99a5] hover:text-[#1b3547]"
            >
              Prospects
            </Link>
          </div>
          <label className="relative w-full md:max-w-[350px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#99aab5]" />
            <Input
              className="pl-10"
              aria-label="Search clients"
              placeholder="Find a client"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setOffset(0);
              }}
            />
          </label>
        </div>

        <QueryState
          loading={listing.isPending}
          error={listing.error}
          retry={() => void listing.refetch()}
        />

        {clients.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] border-collapse">
              <thead>
                <tr className="border-b text-left text-[10px] font-bold uppercase tracking-[0.07em] text-[#9baab5]">
                  <th className="px-3 py-3.5">Company</th>
                  <th className="px-3 py-3.5">Industry</th>
                  <th className="px-3 py-3.5">Relationship</th>
                  <th className="px-3 py-3.5">Email</th>
                </tr>
              </thead>
              <tbody>
                {clients.map((client) => {
                  const displayName = client.company || client.name;
                  return (
                    <tr key={client.id} className="group border-b last:border-0 hover:bg-[#f7fbfc]">
                      <td className="px-3 py-3.5">
                        <Link
                          to="/clients/$id"
                          params={{ id: client.id }}
                          className="flex items-center gap-3 font-semibold text-[#26374d]"
                        >
                          <Avatar className="size-9 rounded-[10px] border bg-white">
                            <AvatarImage
                              src={client.logo_path || undefined}
                              alt={`${displayName} logo`}
                              className="object-contain p-1.5"
                            />
                            <AvatarFallback className="rounded-[9px] bg-[#eaf7f8] text-[10px] font-semibold text-[#197c8e]">
                              {initials(displayName) || <Building2 className="size-4" />}
                            </AvatarFallback>
                          </Avatar>
                          <span className="max-w-[260px] truncate">{displayName}</span>
                        </Link>
                      </td>
                      <td className="px-3 py-3.5 text-xs text-[#697b8b]">
                        {client.industry || "Not set"}
                      </td>
                      <td className="px-3 py-3.5">
                        <Badge variant={client.status === "active" ? "default" : "secondary"}>
                          {client.status === "active" ? "Client" : client.status}
                        </Badge>
                      </td>
                      <td className="max-w-[240px] truncate px-3 py-3.5 text-xs text-[#697b8b]">
                        {client.email || "No email address"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : !listing.isPending && !listing.error ? (
          <div className="grid min-h-48 place-items-center border-t text-center">
            <div>
              <UsersRound className="mx-auto size-9 text-[#9baab5]" />
              <h2 className="mt-4 text-base font-semibold">
                {search ? "No matching clients" : "No clients yet"}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {search ? "Try a different search term." : "Add a client to begin."}
              </p>
            </div>
          </div>
        ) : null}
      </section>

      <div className="mt-4 flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          {listing.data?.total == null
            ? "Updating…"
            : listing.data.total === 0
              ? "0 of 0"
              : `${offset + 1}–${Math.min(offset + clients.length, listing.data.total)} of ${listing.data.total}`}
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            disabled={!offset || listing.isFetching}
            onClick={() => setOffset(Math.max(0, offset - 30))}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            disabled={listing.data?.nextOffset == null || listing.isFetching}
            onClick={() => setOffset(listing.data?.nextOffset ?? offset)}
          >
            Next
          </Button>
        </div>
      </div>
    </AppShell>
  );
}
