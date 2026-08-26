import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useBatches, useDeleteBatch, useSaveBatch } from "@/hooks/useWellness";
import { PageBanner } from "@/components/PageBanner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDate } from "@/lib/formatters";
import { Pencil, Plus, Trash2, Users } from "lucide-react";

const empty = {
  name: "",
  program_type: "morning",
  start_date: "",
  end_date: "",
  max_capacity: "",
  status: "active",
};

type BatchRow = ReturnType<typeof useBatches>["data"] extends (infer T)[] | undefined ? T : never;

export default function WellnessBatches() {
  const { user } = useAuth();
  const { data: batches, isLoading } = useBatches();
  const saveBatch = useSaveBatch();
  const deleteBatch = useDeleteBatch();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<BatchRow | null>(null);
  const [pendingDelete, setPendingDelete] = useState<BatchRow | null>(null);
  const [form, setForm] = useState(empty);

  const openNew = () => {
    setEditing(null);
    setForm(empty);
    setOpen(true);
  };

  const openEdit = (b: BatchRow) => {
    setEditing(b);
    setForm({
      name: b.name,
      program_type: b.program_type ?? "morning",
      start_date: b.start_date ?? "",
      end_date: b.end_date ?? "",
      max_capacity: b.max_capacity ? String(b.max_capacity) : "",
      status: b.status,
    });
    setOpen(true);
  };

  const submit = async () => {
    if (!user) return;
    await saveBatch.mutateAsync({
      id: editing?.id,
      name: form.name.trim(),
      program_type: form.program_type || null,
      start_date: form.start_date || null,
      end_date: form.end_date || null,
      max_capacity: form.max_capacity ? Number(form.max_capacity) : null,
      status: form.status,
      ...(editing ? {} : { created_by: user.id }),
    });
    setOpen(false);
  };

  return (
    <div className="space-y-6">
      <PageBanner title="Batches" description="Group members into programme batches with a coach and capacity.">
        <Button className="w-full sm:w-auto" onClick={openNew}>
          <Plus className="mr-2 h-4 w-4" /> New batch
        </Button>
      </PageBanner>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-40" />
          ))}
        </div>
      ) : batches?.length ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {batches.map((b) => (
            <Card key={b.id} className={b.status === "active" ? "" : "opacity-60"}>
              <CardHeader className="flex flex-row items-start justify-between space-y-0">
                <CardTitle className="text-base">{b.name}</CardTitle>
                <Badge variant={b.status === "active" ? "secondary" : "outline"} className="capitalize">
                  {b.status}
                </Badge>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <p className="flex items-center gap-2 text-foreground">
                  <Users className="h-4 w-4" />
                  <span className="text-2xl font-bold">{b.memberCount}</span>
                  {b.max_capacity ? <span className="text-sm text-muted-foreground">/ {b.max_capacity}</span> : null}
                </p>
                <p className="capitalize">{b.program_type ?? "General"} programme</p>
                {b.start_date && (
                  <p>
                    {formatDate(b.start_date)}
                    {b.end_date ? ` → ${formatDate(b.end_date)}` : ""}
                  </p>
                )}
                <div className="flex gap-2 pt-2">
                  <Button variant="outline" size="sm" onClick={() => openEdit(b)}>
                    <Pencil className="mr-2 h-3.5 w-3.5" /> Edit
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setPendingDelete(b)}>
                    <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <p className="py-16 text-center text-muted-foreground">No batches yet — create your first one.</p>
      )}

      <ResponsiveDialog
        open={open}
        onOpenChange={setOpen}
        title={editing ? "Edit batch" : "New batch"}
        description={<>Batches help you run cohorts and track group progress.</>}
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={!form.name.trim() || saveBatch.isPending}>
              Save batch
            </Button>
          </>
        }
      >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2 space-y-2">
              <Label htmlFor="b-name">Name</Label>
              <Input id="b-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Programme</Label>
              <Select value={form.program_type} onValueChange={(v) => setForm({ ...form, program_type: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="morning">Morning</SelectItem>
                  <SelectItem value="evening">Evening</SelectItem>
                  <SelectItem value="transformation">Transformation</SelectItem>
                  <SelectItem value="corporate">Corporate</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="b-start">Start date</Label>
              <Input
                id="b-start"
                type="date"
                value={form.start_date}
                onChange={(e) => setForm({ ...form, start_date: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="b-end">End date</Label>
              <Input
                id="b-end"
                type="date"
                value={form.end_date}
                onChange={(e) => setForm({ ...form, end_date: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="b-cap">Max capacity</Label>
              <Input
                id="b-cap"
                inputMode="numeric"
                value={form.max_capacity}
                onChange={(e) => setForm({ ...form, max_capacity: e.target.value })}
              />
            </div>
          </div>
          </ResponsiveDialog>

      <AlertDialog open={!!pendingDelete} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{pendingDelete?.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete?.memberCount
                ? `${pendingDelete.memberCount} member(s) belong to this batch, so it will be archived instead of deleted.`
                : "This batch has no members, so it will be permanently deleted."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (pendingDelete) await deleteBatch.mutateAsync(pendingDelete.id);
                setPendingDelete(null);
              }}
              disabled={deleteBatch.isPending}
            >
              {pendingDelete?.memberCount ? "Archive" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
