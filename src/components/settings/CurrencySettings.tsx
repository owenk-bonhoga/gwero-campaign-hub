import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ConfirmAction } from "@/components/ConfirmAction";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  deleteCurrency,
  listOpportunityDependencies,
  saveCurrency,
} from "@/lib/opportunities.functions";

type Currency = {
  id: string;
  code: string;
  name: string;
  symbol: string;
  is_default: boolean;
  is_active: boolean;
};

export function CurrencySettings() {
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ code: "", name: "", symbol: "", isDefault: false });
  const { data } = useQuery({
    queryKey: ["opportunity-dependencies"],
    queryFn: () => listOpportunityDependencies() as unknown as Promise<{ currencies: Currency[] }>,
  });
  const refresh = () => void qc.invalidateQueries({ queryKey: ["opportunity-dependencies"] });
  const save = useMutation({
    mutationFn: () => saveCurrency({ data: form }),
    onSuccess: () => {
      toast.success("Currency saved.");
      setCreating(false);
      setForm({ code: "", name: "", symbol: "", isDefault: false });
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: (id: string) => deleteCurrency({ data: { id } }),
    onSuccess: () => {
      toast.success("Currency deleted.");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const makeDefault = useMutation({
    mutationFn: (currency: Currency) =>
      saveCurrency({ data: { ...currency, isDefault: true, isActive: currency.is_active } }),
    onSuccess: refresh,
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setCreating((value) => !value)}>
          <Plus className="mr-2 size-4" />
          {creating ? "Cancel" : "Add currency"}
        </Button>
      </div>
      {creating ? (
        <Card>
          <CardHeader>
            <CardTitle>Add currency</CardTitle>
            <CardDescription>
              These currencies become the dropdown choices throughout commercial modules.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Field
              label="Code"
              value={form.code}
              onChange={(code) => setForm((v) => ({ ...v, code }))}
              placeholder="MWK"
            />
            <Field
              label="Name"
              value={form.name}
              onChange={(name) => setForm((v) => ({ ...v, name }))}
              placeholder="Malawian Kwacha"
            />
            <Field
              label="Symbol"
              value={form.symbol}
              onChange={(symbol) => setForm((v) => ({ ...v, symbol }))}
              placeholder="MK"
            />
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={form.isDefault}
                onCheckedChange={(checked) =>
                  setForm((v) => ({ ...v, isDefault: checked === true }))
                }
              />
              Use as default currency
            </label>
            <Button onClick={() => save.mutate()} disabled={save.isPending}>
              <Plus className="mr-2 size-4" />
              Add currency
            </Button>
          </CardContent>
        </Card>
      ) : null}
      <Card>
        <CardHeader>
          <CardTitle>Configured currencies</CardTitle>
          <CardDescription>
            Only active currencies are offered when creating or editing records.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {(data?.currencies || []).map((currency) => (
            <div key={currency.id} className="flex items-center gap-3 rounded-xl border p-4">
              <div className="grid size-10 place-items-center rounded-lg bg-muted font-semibold">
                {currency.symbol}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-medium">
                    {currency.code} — {currency.name}
                  </p>
                  {currency.is_default ? <Badge>Default</Badge> : null}
                </div>
              </div>
              {!currency.is_default ? (
                <Button variant="outline" size="sm" onClick={() => makeDefault.mutate(currency)}>
                  Make default
                </Button>
              ) : null}
              <ConfirmAction
                title={`Delete ${currency.code}?`}
                description="Existing records keep their currency code, but it will no longer be available for new records."
                onConfirm={async () => {
                  await remove.mutateAsync(currency.id);
                }}
                trigger={
                  <Button variant="ghost" size="icon" disabled={currency.is_default}>
                    <Trash2 className="size-4" />
                  </Button>
                }
              />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </div>
  );
}
