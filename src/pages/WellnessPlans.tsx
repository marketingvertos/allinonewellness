import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  useDeleteWellnessPlan,
  usePlanUsage,
  useSaveWellnessPlan,
  useWellnessPlans,
  WellnessPlan,
} from "@/hooks/useWellness";
import { PageBanner } from "@/components/PageBanner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCurrency } from "@/lib/formatters";
import { Pencil, Plus, Trash2 } from "lucide-react";

const empty = {
  name: "",
  plan_type: "membership",
  duration_days: "30",
  total_servings: "30",
  servings_per_day: "1",
  price: "",
  description: "",
  active: true,
};

export default function WellnessPlans() {
  const { user } = useAuth();
  const { data: plans, isLoading } = useWellnessPlans(false);
  const { data: usage } = usePlanUsage();
  const savePlan = useSaveWellnessPlan();
  const deletePlan = useDeleteWellnessPlan();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<WellnessPlan | null>(null);
  const [pendingDelete, setPendingDelete] = useState<WellnessPlan | null>(null);
  const [form, setForm] = useState(empty);

  const openNew = () => {
    setEditing(null);
    setForm(empty);
    setOpen(true);
  };

  const openEdit = (plan: WellnessPlan) => {
    setEditing(plan);
    setForm({
      name: plan.name,
      plan_type: plan.plan_type,
      duration_days: String(plan.duration_days),
      total_servings: String(plan.total_servings),
      servings_per_day: String(plan.servings_per_day),
      price: String(plan.price),
      description: plan.description ?? "",
      active: plan.active,
    });
    setOpen(true);
  };

  const submit = async () => {
    if (!user) return;
    await savePlan.mutateAsync({
      id: editing?.id,
      name: form.name.trim(),
      plan_type: form.plan_type,
      duration_days: Number(form.duration_days),
      total_servings: Number(form.total_servings),
      servings_per_day: Number(form.servings_per_day),
      price: Number(form.price || 0),
      description: form.description.trim() || null,
      active: form.active,
      ...(editing ? {} : { created_by: user.id }),
    });
    setOpen(false);
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    await deletePlan.mutateAsync(pendingDelete.id);
    setPendingDelete(null);
  };

  const usedBy = pendingDelete ? usage?.[pendingDelete.id] ?? 0 : 0;

  return (
    <div className="space-y-6">
      <PageBanner title="Plans" description="Trial and membership packages offered at the centre.">
        <Button className="w-full sm:w-auto" onClick={openNew}>
          <Plus className="mr-2 h-4 w-4" /> New plan
        </Button>
      </PageBanner>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading plans…</p>
      ) : plans?.length ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {plans.map((p) => (
            <Card key={p.id} className={p.active ? "" : "opacity-60"}>
              <CardHeader className="flex flex-row items-start justify-between space-y-0">
                <CardTitle className="text-base">{p.name}</CardTitle>
                <div className="flex items-center gap-1">
                  <Badge variant={p.active ? "secondary" : "outline"} className="capitalize">
                    {p.active ? p.plan_type : "inactive"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <p className="text-2xl font-bold text-foreground">{formatCurrency(Number(p.price))}</p>
                <p>
                  {p.duration_days} days · {p.total_servings} servings
                </p>
                {p.description && <p>{p.description}</p>}
                <p className="text-xs">
                  {usage?.[p.id] ? `Sold to ${usage[p.id]} member(s)` : "Not sold yet"}
                </p>
                <div className="flex gap-2 pt-2">
                  <Button variant="outline" size="sm" onClick={() => openEdit(p)}>
                    <Pencil className="mr-2 h-3.5 w-3.5" /> Edit
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setPendingDelete(p)}>
                    <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <p className="py-16 text-center text-muted-foreground">No plans yet — create your first one.</p>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit plan" : "New plan"}</DialogTitle>
            <DialogDescription>Servings are deducted one per check-in day.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2 space-y-2">
              <Label htmlFor="p-name">Name</Label>
              <Input id="p-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={form.plan_type} onValueChange={(v) => setForm({ ...form, plan_type: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="trial">Trial</SelectItem>
                  <SelectItem value="membership">Membership</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="p-price">Price (₹)</Label>
              <Input
                id="p-price"
                inputMode="numeric"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="p-days">Duration (days)</Label>
              <Input
                id="p-days"
                inputMode="numeric"
                value={form.duration_days}
                onChange={(e) => setForm({ ...form, duration_days: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="p-servings">Total servings</Label>
              <Input
                id="p-servings"
                inputMode="numeric"
                value={form.total_servings}
                onChange={(e) => setForm({ ...form, total_servings: e.target.value })}
              />
            </div>
            <div className="sm:col-span-2 space-y-2">
              <Label htmlFor="p-desc">Description</Label>
              <Input
                id="p-desc"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
            <div className="sm:col-span-2 flex items-center justify-between rounded-md border px-3 py-2">
              <div>
                <p className="text-sm font-medium">Available for sale</p>
                <p className="text-xs text-muted-foreground">Inactive plans stay in reports but cannot be sold.</p>
              </div>
              <Switch checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={!form.name.trim() || savePlan.isPending}>
              Save plan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!pendingDelete} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{pendingDelete?.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              {usedBy > 0
                ? `This plan is used by ${usedBy} membership or trial record. It will be deactivated instead of deleted so member history stays intact.`
                : "This plan has never been sold, so it will be permanently deleted."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} disabled={deletePlan.isPending}>
              {usedBy > 0 ? "Deactivate" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
