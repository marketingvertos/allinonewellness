import { useState } from "react";
import {
  AchievementCategory,
  AchievementDefinition,
  useAchievementDefinitions,
  useDeleteAchievementDefinition,
  useRecalcAllAchievements,
  useSaveAchievementDefinition,
} from "@/hooks/useAchievements";
import { PageBanner } from "@/components/PageBanner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
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
import { Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";

const CATEGORIES: { value: AchievementCategory; label: string; unit: string }[] = [
  { value: "referral", label: "Referral titles", unit: "people" },
  { value: "weight_loss", label: "Weight loss", unit: "kg" },
  { value: "weight_gain", label: "Weight gain", unit: "kg" },
];

const ICONS = ["🏅", "🥈", "🥇", "🏆", "🎖️", "⭐", "❤️", "🟠", "💚", "💙", "💎", "👑", "🔥"];

export default function WellnessAchievements() {
  const { data: defs, isLoading } = useAchievementDefinitions(false);
  const save = useSaveAchievementDefinition();
  const remove = useDeleteAchievementDefinition();
  const recalc = useRecalcAllAchievements();

  const [editing, setEditing] = useState<{ category: AchievementCategory; def?: AchievementDefinition } | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", threshold: "", icon: "🏅", sort_order: "0", is_active: true });

  const openDialog = (category: AchievementCategory, def?: AchievementDefinition) => {
    setForm({
      name: def?.name ?? "",
      threshold: def ? String(def.threshold) : "",
      icon: def?.icon ?? "🏅",
      sort_order: String(def?.sort_order ?? ((defs ?? []).filter((d) => d.category === category).length + 1)),
      is_active: def?.is_active ?? true,
    });
    setEditing({ category, def });
  };

  const submit = async () => {
    if (!editing) return;
    const unit = CATEGORIES.find((c) => c.value === editing.category)!.unit;
    await save.mutateAsync({
      id: editing.def?.id,
      category: editing.category,
      name: form.name.trim(),
      threshold: Number(form.threshold),
      unit,
      icon: form.icon,
      sort_order: Number(form.sort_order) || 0,
      is_active: form.is_active,
    });
    setEditing(null);
  };

  const valid = form.name.trim().length > 1 && Number(form.threshold) > 0;

  return (
    <div className="space-y-6">
      <PageBanner
        title="Achievement settings"
        description="Configure ambassador titles and weight milestones. Members unlock them automatically."
      />

      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={() => recalc.mutate()} disabled={recalc.isPending}>
          <RefreshCw className="mr-2 h-4 w-4" /> Recalculate all members
        </Button>
      </div>

      <Tabs defaultValue="referral">
        <TabsList>
          {CATEGORIES.map((c) => (
            <TabsTrigger key={c.value} value={c.value}>
              {c.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {CATEGORIES.map((c) => {
          const rows = (defs ?? [])
            .filter((d) => d.category === c.value)
            .sort((a, b) => a.sort_order - b.sort_order || Number(a.threshold) - Number(b.threshold));
          return (
            <TabsContent key={c.value} value={c.value} className="pt-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0">
                  <CardTitle className="text-base">{c.label} milestones</CardTitle>
                  <Button size="sm" onClick={() => openDialog(c.value)}>
                    <Plus className="mr-2 h-4 w-4" /> Add milestone
                  </Button>
                </CardHeader>
                <CardContent className="space-y-2">
                  {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
                  {!isLoading && rows.length === 0 && (
                    <p className="text-sm text-muted-foreground">No milestones configured yet.</p>
                  )}
                  {rows.map((d) => (
                    <div key={d.id} className="flex items-center justify-between gap-3 rounded-md border px-3 py-2">
                      <div className="flex items-center gap-3">
                        <span className="text-xl">{d.icon}</span>
                        <div>
                          <p className="text-sm font-medium">{d.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {Number(d.threshold)} {d.unit} · order {d.sort_order}
                          </p>
                        </div>
                        {!d.is_active && <Badge variant="secondary">Inactive</Badge>}
                      </div>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openDialog(c.value, d)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => setConfirmId(d.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </TabsContent>
          );
        })}
      </Tabs>

      <ResponsiveDialog
        open={!!editing}
        onOpenChange={(o) => !o && setEditing(null)}
        title={editing?.def ? "Edit milestone" : "Add milestone"}
        description={<>Members unlock this milestone once they reach the threshold. Already unlocked badges are never removed.</>}
        footer={
          <>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={!valid || save.isPending}>
              Save milestone
            </Button>
          </>
        }
      >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2 space-y-2">
              <Label htmlFor="ach-name">Title</Label>
              <Input id="ach-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ach-threshold">
                Threshold ({editing ? CATEGORIES.find((c) => c.value === editing.category)!.unit : ""})
              </Label>
              <Input
                id="ach-threshold"
                inputMode="decimal"
                value={form.threshold}
                onChange={(e) => setForm({ ...form, threshold: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ach-order">Display order</Label>
              <Input
                id="ach-order"
                inputMode="numeric"
                value={form.sort_order}
                onChange={(e) => setForm({ ...form, sort_order: e.target.value })}
              />
            </div>
            <div className="sm:col-span-2 space-y-2">
              <Label>Badge</Label>
              <div className="flex flex-wrap gap-1">
                {ICONS.map((i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setForm({ ...form, icon: i })}
                    className={`rounded-md border px-2 py-1 text-lg ${form.icon === i ? "border-primary bg-primary/10" : ""}`}
                  >
                    {i}
                  </button>
                ))}
              </div>
            </div>
            <div className="sm:col-span-2 flex items-center justify-between rounded-md border px-3 py-2">
              <Label htmlFor="ach-active">Active</Label>
              <Switch
                id="ach-active"
                checked={form.is_active}
                onCheckedChange={(v) => setForm({ ...form, is_active: v })}
              />
            </div>
          </div>
          </ResponsiveDialog>

      <AlertDialog open={!!confirmId} onOpenChange={(o) => !o && setConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this milestone?</AlertDialogTitle>
            <AlertDialogDescription>
              Members who already unlocked it will lose the badge record. Deactivate it instead if you only want to hide
              it from future progress.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmId) remove.mutate(confirmId);
                setConfirmId(null);
              }}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
