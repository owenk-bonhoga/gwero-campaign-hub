import { clientDirectory } from "@/lib/directory.functions";
import { useDebounced } from "@/lib/use-debounced";
import { QueryState } from "@/components/QueryState";
import { createFileRoute, Link, Outlet, useLocation } from "@tanstack/react-router";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, Mail, Plus, Search, UsersRound } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
  const term = useDebounced(search);
  const listing = useQuery({
    queryKey: ["clients", "directory", term, offset],
    queryFn: () => clientDirectory({ data: { search: term, offset } }),
    placeholderData: keepPreviousData,
  });
  const filtered = listing.data?.rows || [];
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
      toast.success("Client added.");
      void qc.invalidateQueries({ queryKey: ["clients"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <AppShell
      title="Clients"
      description="Every account, relationship and piece of work in one place."
    >
      <Card className="mb-6 overflow-hidden border-primary/15 bg-gradient-to-br from-card via-card to-primary/5">
        <CardContent className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div>
            <p className="font-display text-lg font-semibold">Client directory</p>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Open an account to see its opportunities, commercial history, delivery work and
              contacts.
            </p>
            <div className="relative mt-4 max-w-xl">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="h-11 bg-background pl-10"
                aria-label="Search clients"
                placeholder="Search clients, companies, email or industry"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setOffset(0);
                }}
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Input
              className="w-48 bg-background"
              aria-label="Client name"
              placeholder="Client name"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
            <Input
              className="w-56 bg-background"
              type="email"
              aria-label="Client email"
              placeholder="Email address"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
            <Button onClick={() => create.mutate()} disabled={create.isPending}>
              <Plus className="size-4" /> {create.isPending ? "Adding…" : "Add client"}
            </Button>
          </div>
        </CardContent>
      </Card>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">{listing.data?.total ?? "…"}</span>{" "}
          {listing.data?.total === 1 ? "client" : "clients"}
        </p>
      </div>
      <QueryState
        loading={listing.isPending}
        error={listing.error}
        retry={() => void listing.refetch()}
      />
      {filtered.length ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((client) => {
            const displayName = client.company || client.name;
            return (
              <Link
                key={client.id}
                to="/clients/$id"
                params={{ id: client.id }}
                className="group block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Card className="h-full overflow-hidden transition duration-200 group-hover:-translate-y-0.5 group-hover:border-primary/30 group-hover:shadow-raised">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <Avatar className="size-14 rounded-xl border bg-white shadow-sm">
                        <AvatarImage
                          src={client.logo_path || undefined}
                          alt={`${displayName} logo`}
                          className="object-contain p-2"
                        />
                        <AvatarFallback className="rounded-2xl bg-primary/10 font-display text-lg font-semibold text-primary">
                          {initials(displayName) || <Building2 className="size-6" />}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <h2 className="truncate font-display font-semibold">{displayName}</h2>
                            {client.company && client.name !== client.company ? (
                              <p className="truncate text-sm text-muted-foreground">
                                {client.name}
                              </p>
                            ) : null}
                          </div>
                          <Badge
                            variant={client.status === "active" ? "default" : "secondary"}
                            className="capitalize"
                          >
                            {client.status}
                          </Badge>
                        </div>
                        <p className="mt-3 truncate text-sm text-muted-foreground">
                          {client.industry || "Industry not set"}
                        </p>
                      </div>
                    </div>
                    <div className="mt-4 flex items-center justify-between border-t pt-3 text-sm">
                      <span className="flex min-w-0 items-center gap-2 text-muted-foreground">
                        <Mail className="size-4 shrink-0" />
                        <span className="truncate">{client.email || "No email address"}</span>
                      </span>
                      <span className="ml-3 shrink-0 font-medium text-primary">Open →</span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      ) : !listing.isPending && !listing.error ? (
        <Card className="border-dashed">
          <CardContent className="grid min-h-40 place-items-center p-5 text-center">
            <div>
              <UsersRound className="mx-auto size-10 text-muted-foreground" />
              <h2 className="mt-4 font-display text-lg font-semibold">
                {search ? "No matching clients" : "No clients yet"}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {search
                  ? "Try a different search term."
                  : "Convert a prospect or add a client above."}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : null}
      <div className="mt-4 flex gap-3">
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
    </AppShell>
  );
}
