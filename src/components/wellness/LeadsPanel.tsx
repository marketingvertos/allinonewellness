import { useState, useMemo } from "react";
import {
  useLeads,
  useUpdateLeadStatus,
  useApproveLead,
  useDeleteLead,
  useBulkDeleteLeads,
  type WellnessLead,
} from "@/hooks/useWellness";
import { goalLabel } from "@/lib/goals";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { toast } from "sonner";
import {
  Search,
  Phone,
  MapPin,
  Calendar,
  CheckCircle2,
  XCircle,
  MessageCircle,
  UserCheck,
  Loader2,
  Target,
  Sparkles,
  Trash2,
  ChevronDown,
  MoreHorizontal,
  User,
  Ruler,
  Weight,
  HeartPulse,
  Clock,
  Tag,
  StickyNote,
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";

const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; dotColor: string }
> = {
  new: { label: "New", color: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800", dotColor: "bg-blue-500" },
  contacted: { label: "Contacted", color: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800", dotColor: "bg-amber-500" },
  approved: { label: "Approved", color: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800", dotColor: "bg-emerald-500" },
  rejected: { label: "Rejected", color: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-800", dotColor: "bg-red-500" },
  converted: { label: "Converted", color: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800", dotColor: "bg-emerald-500" },
};

const SOURCE_LABELS: Record<string, string> = {
  public_form: "Trial Form",
  meta_ads: "Meta Ads",
  website: "Website",
  landing_page: "Landing Page",
  manual: "Manual",
  referral: "Referral",
  other: "Other",
};

type StatusFilter = "actionable" | "all" | "new" | "contacted" | "converted" | "rejected";

const FILTERS: { key: StatusFilter; label: string }[] = [
  { key: "actionable", label: "Action needed" },
  { key: "new", label: "New" },
  { key: "contacted", label: "Contacted" },
  { key: "converted", label: "Converted" },
  { key: "rejected", label: "Rejected" },
  { key: "all", label: "All" },
];

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.new;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${cfg.color}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${cfg.dotColor}`} />
      {cfg.label}
    </span>
  );
}

function LeadDetailSheet({
  lead,
  open,
  onOpenChange,
  onStatusChange,
  onApprove,
  onDelete,
  onSaveNotes,
  isPending,
}: {
  lead: WellnessLead | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStatusChange: (status: string) => void;
  onApprove: () => void;
  onDelete: () => void;
  onSaveNotes: (notes: string) => void;
  isPending: boolean;
}) {
  const [notes, setNotes] = useState("");
  const [editingNotes, setEditingNotes] = useState(false);

  if (!lead) return null;

  const isActionable = lead.status === "new" || lead.status === "contacted";

  const detailRows: { icon: React.ElementType; label: string; value: string | null }[] = [
    { icon: Phone, label: "WhatsApp", value: lead.mobile_number },
    { icon: User, label: "Gender", value: lead.gender ? lead.gender.charAt(0).toUpperCase() + lead.gender.slice(1) : null },
    { icon: Calendar, label: "Date of birth", value: lead.date_of_birth || null },
    { icon: MapPin, label: "Location", value: [lead.area, lead.city].filter(Boolean).join(", ") || null },
    { icon: Target, label: "Goal", value: lead.goal ? goalLabel(lead.goal) : null },
    { icon: Ruler, label: "Height", value: lead.height ? `${lead.height} cm` : null },
    { icon: Weight, label: "Weight", value: lead.joining_weight ? `${lead.joining_weight} kg` : null },
    { icon: HeartPulse, label: "Health issues", value: lead.health_issues || null },
    { icon: Tag, label: "Source", value: SOURCE_LABELS[lead.source] ?? lead.source },
    { icon: Clock, label: "Submitted", value: format(new Date(lead.created_at), "dd MMM yyyy, h:mm a") },
  ];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex flex-col overflow-y-auto sm:max-w-lg">
        <SheetHeader className="space-y-3 pb-2">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <SheetTitle className="text-xl">{lead.full_name}</SheetTitle>
              <SheetDescription className="flex items-center gap-2 pt-1">
                <Phone className="h-3.5 w-3.5" /> {lead.mobile_number}
              </SheetDescription>
            </div>
            <StatusBadge status={lead.status} />
          </div>
        </SheetHeader>

        <Separator />

        <div className="flex-1 space-y-5 py-4">
          <div className="grid gap-3">
            {detailRows.map((row) => {
              if (!row.value) return null;
              const Icon = row.icon;
              return (
                <div key={row.label} className="flex items-start gap-3">
                  <div className="mt-0.5 rounded-md bg-muted p-1.5">
                    <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">{row.label}</p>
                    <p className="text-sm font-medium">{row.value}</p>
                  </div>
                </div>
              );
            })}
          </div>

          <Separator />

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="flex items-center gap-1.5 text-sm font-medium">
                <StickyNote className="h-3.5 w-3.5" /> Notes
              </p>
              {!editingNotes && isActionable && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => {
                    setNotes(lead.notes ?? "");
                    setEditingNotes(true);
                  }}
                >
                  {lead.notes ? "Edit" : "Add note"}
                </Button>
              )}
            </div>
            {editingNotes ? (
              <div className="space-y-2">
                <Textarea
                  rows={3}
                  placeholder="Follow-up notes..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => {
                      onSaveNotes(notes);
                      setEditingNotes(false);
                    }}
                    disabled={isPending}
                  >
                    Save
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditingNotes(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                {lead.notes || "No notes yet."}
              </p>
            )}
          </div>
        </div>

        {isActionable && (
          <>
            <Separator />
            <div className="flex flex-wrap gap-2 pt-4">
              {lead.status === "new" && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onStatusChange("contacted")}
                  disabled={isPending}
                >
                  <MessageCircle className="mr-1.5 h-3.5 w-3.5" /> Mark contacted
                </Button>
              )}
              <Button size="sm" onClick={onApprove} disabled={isPending}>
                <UserCheck className="mr-1.5 h-3.5 w-3.5" /> Approve trial
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-destructive hover:bg-destructive/10"
                onClick={() => onStatusChange("rejected")}
                disabled={isPending}
              >
                <XCircle className="mr-1.5 h-3.5 w-3.5" /> Reject
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:bg-destructive/10"
                onClick={onDelete}
                disabled={isPending}
              >
                <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Delete
              </Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

export function LeadsPanel() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("actionable");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [detailLead, setDetailLead] = useState<WellnessLead | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ ids: string[]; name: string } | null>(null);

  const filterStatuses =
    statusFilter === "actionable"
      ? ["new", "contacted"]
      : statusFilter === "all"
        ? undefined
        : [statusFilter];

  const { data: leads = [], isLoading } = useLeads(filterStatuses);
  const updateStatus = useUpdateLeadStatus();
  const approveLead = useApproveLead();
  const deleteLead = useDeleteLead();
  const bulkDelete = useBulkDeleteLeads();

  const filtered = useMemo(() => {
    if (!search.trim()) return leads;
    const q = search.toLowerCase();
    const digits = search.replace(/\D/g, "");
    return leads.filter(
      (l) =>
        l.full_name.toLowerCase().includes(q) ||
        (digits && l.mobile_number.includes(digits)),
    );
  }, [leads, search]);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const l of leads) c[l.status] = (c[l.status] ?? 0) + 1;
    return c;
  }, [leads]);

  const allSelected = filtered.length > 0 && filtered.every((l) => selected.has(l.id));
  const someSelected = selected.size > 0;

  const toggleAll = () => {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map((l) => l.id)));
    }
  };

  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleApprove = async (leadId: string) => {
    try {
      const result = await approveLead.mutateAsync({ leadId });
      if (result.status === "existing_member") {
        toast.info(result.message);
      } else {
        toast.success(`${result.member_name} approved — free trial started!`);
      }
      setDetailLead(null);
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const handleStatusChange = async (leadId: string, status: string, notes?: string) => {
    try {
      await updateStatus.mutateAsync({ leadId, status, notes });
      toast.success(status === "contacted" ? "Marked as contacted" : status === "rejected" ? "Lead rejected" : "Status updated");
      setDetailLead(null);
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const handleBulkStatusChange = async (status: string) => {
    const ids = Array.from(selected);
    try {
      await Promise.all(ids.map((id) => updateStatus.mutateAsync({ leadId: id, status })));
      toast.success(`${ids.length} lead${ids.length > 1 ? "s" : ""} updated`);
      setSelected(new Set());
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      if (deleteTarget.ids.length === 1) {
        await deleteLead.mutateAsync(deleteTarget.ids[0]);
      } else {
        await bulkDelete.mutateAsync(deleteTarget.ids);
      }
      toast.success(
        deleteTarget.ids.length === 1
          ? `${deleteTarget.name} deleted`
          : `${deleteTarget.ids.length} leads deleted`,
      );
      setSelected((prev) => {
        const next = new Set(prev);
        deleteTarget.ids.forEach((id) => next.delete(id));
        return next;
      });
      setDetailLead(null);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setDeleteTarget(null);
    }
  };

  const handleSaveNotes = async (leadId: string, notes: string) => {
    try {
      await updateStatus.mutateAsync({ leadId, status: "contacted", notes });
      toast.success("Notes saved");
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const actionableCount = (counts.new ?? 0) + (counts.contacted ?? 0);

  return (
    <div className="space-y-4">
      {/* Stats row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {[
          { label: "New", count: counts.new ?? 0, color: "text-blue-600 dark:text-blue-400" },
          { label: "Contacted", count: counts.contacted ?? 0, color: "text-amber-600 dark:text-amber-400" },
          { label: "Approved", count: counts.approved ?? 0, color: "text-emerald-600 dark:text-emerald-400" },
          { label: "Converted", count: counts.converted ?? 0, color: "text-emerald-600 dark:text-emerald-400" },
          { label: "Rejected", count: counts.rejected ?? 0, color: "text-red-600 dark:text-red-400" },
        ].map((s) => (
          <div key={s.label} className="rounded-lg border bg-card p-3 text-center">
            <p className={`text-2xl font-bold tabular-nums ${s.color}`}>{s.count}</p>
            <p className="text-xs text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filter tabs + search */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((f) => {
            const active = statusFilter === f.key;
            return (
              <button
                key={f.key}
                onClick={() => {
                  setStatusFilter(f.key);
                  setSelected(new Set());
                }}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                  active
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background text-muted-foreground hover:bg-muted"
                }`}
              >
                {f.label}
                {f.key === "actionable" && actionableCount > 0 && (
                  <span className="ml-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary-foreground/20 px-1 text-[10px] font-semibold">
                    {actionableCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search name or mobile..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Bulk actions bar */}
      {someSelected && (
        <div className="flex items-center gap-3 rounded-lg border border-primary/20 bg-primary/5 px-4 py-2.5">
          <span className="text-sm font-medium">
            {selected.size} selected
          </span>
          <div className="flex gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  Change stage <ChevronDown className="ml-1 h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => handleBulkStatusChange("contacted")}>
                  <MessageCircle className="mr-2 h-4 w-4" /> Contacted
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleBulkStatusChange("rejected")}>
                  <XCircle className="mr-2 h-4 w-4" /> Rejected
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              variant="outline"
              size="sm"
              className="text-destructive hover:bg-destructive/10"
              onClick={() =>
                setDeleteTarget({
                  ids: Array.from(selected),
                  name: `${selected.size} lead${selected.size > 1 ? "s" : ""}`,
                })
              }
            >
              <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Delete
            </Button>
          </div>
          <Button variant="ghost" size="sm" className="ml-auto" onClick={() => setSelected(new Set())}>
            Clear
          </Button>
        </div>
      )}

      {/* Lead list */}
      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed py-16">
          <Sparkles className="mb-3 h-10 w-10 text-muted-foreground/30" />
          <p className="text-sm font-medium text-muted-foreground">
            {search ? "No leads match your search" : "No leads yet"}
          </p>
          {!search && (
            <p className="mt-1 text-xs text-muted-foreground/70">
              Share the <code className="rounded bg-muted px-1 py-0.5">/trial</code> link to start collecting leads
            </p>
          )}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border">
          {/* Table header */}
          <div className="hidden items-center gap-3 border-b bg-muted/40 px-4 py-2.5 text-xs font-medium text-muted-foreground sm:flex">
            <Checkbox
              checked={allSelected}
              onCheckedChange={toggleAll}
              aria-label="Select all"
              className="mr-1"
            />
            <span className="flex-1">Name</span>
            <span className="w-28">Mobile</span>
            <span className="w-28">Location</span>
            <span className="w-24">Status</span>
            <span className="w-24">Source</span>
            <span className="w-24 text-right">Time</span>
            <span className="w-8" />
          </div>

          {/* Rows */}
          {filtered.map((lead) => {
            const isChecked = selected.has(lead.id);
            return (
              <div
                key={lead.id}
                className={`group flex flex-col gap-2 border-b px-4 py-3 transition-colors last:border-b-0 hover:bg-muted/30 sm:flex-row sm:items-center sm:gap-3 ${
                  isChecked ? "bg-primary/5" : ""
                }`}
              >
                <Checkbox
                  checked={isChecked}
                  onCheckedChange={() => toggleOne(lead.id)}
                  aria-label={`Select ${lead.full_name}`}
                  className="mr-1 mt-0.5 sm:mt-0"
                />

                {/* Name — clickable to open detail */}
                <button
                  onClick={() => setDetailLead(lead)}
                  className="flex flex-1 items-center gap-2 text-left"
                >
                  <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                    {lead.full_name
                      .split(" ")
                      .map((w) => w[0])
                      .slice(0, 2)
                      .join("")
                      .toUpperCase()}
                  </div>
                  <span className="truncate text-sm font-medium hover:underline">
                    {lead.full_name}
                  </span>
                </button>

                {/* Mobile */}
                <span className="w-28 text-sm text-muted-foreground sm:block hidden">{lead.mobile_number}</span>

                {/* Location */}
                <span className="w-28 truncate text-sm text-muted-foreground sm:block hidden">
                  {[lead.area, lead.city].filter(Boolean).join(", ") || "—"}
                </span>

                {/* Status */}
                <span className="w-24">
                  <StatusBadge status={lead.status} />
                </span>

                {/* Source */}
                <span className="w-24 text-xs text-muted-foreground sm:block hidden">
                  {SOURCE_LABELS[lead.source] ?? lead.source}
                </span>

                {/* Time */}
                <span className="w-24 text-right text-xs text-muted-foreground sm:block hidden">
                  {formatDistanceToNow(new Date(lead.created_at), { addSuffix: true })}
                </span>

                {/* Mobile: inline details */}
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground sm:hidden">
                  <span className="flex items-center gap-1">
                    <Phone className="h-3 w-3" /> {lead.mobile_number}
                  </span>
                  {(lead.city || lead.area) && (
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" /> {[lead.area, lead.city].filter(Boolean).join(", ")}
                    </span>
                  )}
                  <span>{formatDistanceToNow(new Date(lead.created_at), { addSuffix: true })}</span>
                </div>

                {/* Actions dropdown */}
                <div className="w-8 flex-shrink-0">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 opacity-0 group-hover:opacity-100 data-[state=open]:opacity-100"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setDetailLead(lead)}>
                        <User className="mr-2 h-4 w-4" /> View details
                      </DropdownMenuItem>
                      {(lead.status === "new" || lead.status === "contacted") && (
                        <>
                          {lead.status === "new" && (
                            <DropdownMenuItem onClick={() => handleStatusChange(lead.id, "contacted")}>
                              <MessageCircle className="mr-2 h-4 w-4" /> Mark contacted
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem onClick={() => handleApprove(lead.id)}>
                            <UserCheck className="mr-2 h-4 w-4" /> Approve trial
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleStatusChange(lead.id, "rejected")}>
                            <XCircle className="mr-2 h-4 w-4" /> Reject
                          </DropdownMenuItem>
                        </>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() =>
                          setDeleteTarget({ ids: [lead.id], name: lead.full_name })
                        }
                      >
                        <Trash2 className="mr-2 h-4 w-4" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Lead detail sheet */}
      <LeadDetailSheet
        lead={detailLead}
        open={!!detailLead}
        onOpenChange={(open) => !open && setDetailLead(null)}
        onStatusChange={(status) => detailLead && handleStatusChange(detailLead.id, status)}
        onApprove={() => detailLead && handleApprove(detailLead.id)}
        onDelete={() =>
          detailLead &&
          setDeleteTarget({ ids: [detailLead.id], name: detailLead.full_name })
        }
        onSaveNotes={(notes) => detailLead && handleSaveNotes(detailLead.id, notes)}
        isPending={updateStatus.isPending || approveLead.isPending}
      />

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleteTarget?.ids.length === 1 ? "this lead" : `${deleteTarget?.ids.length} leads`}?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.ids.length === 1
                ? `"${deleteTarget.name}" will be permanently removed. This cannot be undone.`
                : `${deleteTarget?.ids.length} selected leads will be permanently removed. This cannot be undone.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              <Trash2 className="mr-1.5 h-3.5 w-3.5" />
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
