import { useState } from "react";
import { useLeads, useUpdateLeadStatus, useApproveLead } from "@/hooks/useWellness";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
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
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

const STATUS_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  new: { label: "New", variant: "default" },
  contacted: { label: "Contacted", variant: "secondary" },
  approved: { label: "Approved", variant: "outline" },
  rejected: { label: "Rejected", variant: "destructive" },
  converted: { label: "Converted", variant: "outline" },
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

const GOAL_LABELS: Record<string, string> = {
  weight_loss: "Weight Loss",
  fat_loss: "Fat Loss",
  weight_management: "Weight Management",
  weight_gain: "Weight Gain",
  general_wellness: "General Wellness",
};

type StatusFilter = "actionable" | "all" | "new" | "contacted" | "converted" | "rejected";

export function LeadsPanel() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("actionable");
  const [search, setSearch] = useState("");
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectNotes, setRejectNotes] = useState("");
  const [expandedNotes, setExpandedNotes] = useState<string | null>(null);

  const filterStatuses =
    statusFilter === "actionable"
      ? ["new", "contacted"]
      : statusFilter === "all"
        ? undefined
        : [statusFilter];

  const { data: leads = [], isLoading } = useLeads(filterStatuses);
  const updateStatus = useUpdateLeadStatus();
  const approveLead = useApproveLead();

  const filtered = search.trim()
    ? leads.filter(
        (l) =>
          l.full_name.toLowerCase().includes(search.toLowerCase()) ||
          l.mobile_number.includes(search.replace(/\D/g, "")),
      )
    : leads;

  const counts = {
    new: leads.filter((l) => l.status === "new").length,
    contacted: leads.filter((l) => l.status === "contacted").length,
  };

  const handleApprove = async (leadId: string) => {
    try {
      const result = await approveLead.mutateAsync({ leadId });
      if (result.status === "existing_member") {
        toast.info(result.message);
      } else {
        toast.success(`${result.member_name} approved — free trial started!`);
      }
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const handleContacted = async (leadId: string) => {
    try {
      await updateStatus.mutateAsync({ leadId, status: "contacted" });
      toast.success("Marked as contacted");
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const handleReject = async () => {
    if (!rejectingId) return;
    try {
      await updateStatus.mutateAsync({
        leadId: rejectingId,
        status: "rejected",
        notes: rejectNotes.trim() || undefined,
      });
      toast.success("Lead rejected");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setRejectingId(null);
      setRejectNotes("");
    }
  };

  const handleSaveNotes = async (leadId: string, notes: string) => {
    try {
      await updateStatus.mutateAsync({ leadId, status: "contacted", notes });
      toast.success("Notes saved");
      setExpandedNotes(null);
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  return (
    <div className="space-y-4">
      {/* Summary + filters */}
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={statusFilter === "actionable" ? "default" : "outline"} className="cursor-pointer" onClick={() => setStatusFilter("actionable")}>
          Action needed {counts.new + counts.contacted > 0 && `(${counts.new + counts.contacted})`}
        </Badge>
        <Badge variant={statusFilter === "new" ? "default" : "outline"} className="cursor-pointer" onClick={() => setStatusFilter("new")}>
          New {counts.new > 0 && `(${counts.new})`}
        </Badge>
        <Badge variant={statusFilter === "contacted" ? "default" : "outline"} className="cursor-pointer" onClick={() => setStatusFilter("contacted")}>
          Contacted {counts.contacted > 0 && `(${counts.contacted})`}
        </Badge>
        <Badge variant={statusFilter === "converted" ? "default" : "outline"} className="cursor-pointer" onClick={() => setStatusFilter("converted")}>
          Converted
        </Badge>
        <Badge variant={statusFilter === "rejected" ? "default" : "outline"} className="cursor-pointer" onClick={() => setStatusFilter("rejected")}>
          Rejected
        </Badge>
        <Badge variant={statusFilter === "all" ? "default" : "outline"} className="cursor-pointer" onClick={() => setStatusFilter("all")}>
          All
        </Badge>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search by name or mobile…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Lead list */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            <Sparkles className="mx-auto mb-2 h-8 w-8 opacity-40" />
            {search ? "No leads match your search." : "No leads yet. Share the /trial link to start collecting leads."}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((lead) => (
            <Card key={lead.id}>
              <CardContent className="p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  {/* Lead info */}
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{lead.full_name}</span>
                      <Badge variant={STATUS_CONFIG[lead.status]?.variant ?? "outline"}>
                        {STATUS_CONFIG[lead.status]?.label ?? lead.status}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {SOURCE_LABELS[lead.source] ?? lead.source}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Phone className="h-3.5 w-3.5" />
                        {lead.mobile_number}
                      </span>
                      {(lead.city || lead.area) && (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3.5 w-3.5" />
                          {[lead.area, lead.city].filter(Boolean).join(", ")}
                        </span>
                      )}
                      {lead.goal && (
                        <span className="flex items-center gap-1">
                          <Target className="h-3.5 w-3.5" />
                          {GOAL_LABELS[lead.goal] ?? lead.goal}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5" />
                        {formatDistanceToNow(new Date(lead.created_at), { addSuffix: true })}
                      </span>
                    </div>
                    {lead.notes && (
                      <p className="text-xs text-muted-foreground italic">
                        Notes: {lead.notes}
                      </p>
                    )}
                  </div>

                  {/* Actions */}
                  {(lead.status === "new" || lead.status === "contacted") && (
                    <div className="flex flex-wrap gap-2 sm:flex-nowrap">
                      {lead.status === "new" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleContacted(lead.id)}
                          disabled={updateStatus.isPending}
                        >
                          <MessageCircle className="mr-1.5 h-3.5 w-3.5" />
                          Contacted
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setExpandedNotes(expandedNotes === lead.id ? null : lead.id);
                        }}
                      >
                        Add note
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleApprove(lead.id)}
                        disabled={approveLead.isPending}
                      >
                        <UserCheck className="mr-1.5 h-3.5 w-3.5" />
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => setRejectingId(lead.id)}
                      >
                        <XCircle className="mr-1.5 h-3.5 w-3.5" />
                        Reject
                      </Button>
                    </div>
                  )}
                  {lead.status === "converted" && (
                    <Badge variant="outline" className="border-green-500 text-green-600">
                      <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                      Trial started
                    </Badge>
                  )}
                </div>

                {/* Expandable notes */}
                {expandedNotes === lead.id && (
                  <NotesEditor
                    initial={lead.notes ?? ""}
                    onSave={(notes) => handleSaveNotes(lead.id, notes)}
                    onCancel={() => setExpandedNotes(null)}
                    saving={updateStatus.isPending}
                  />
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Reject confirmation dialog */}
      <AlertDialog open={!!rejectingId} onOpenChange={(open) => !open && setRejectingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reject this lead?</AlertDialogTitle>
            <AlertDialogDescription>
              The lead will be marked as rejected. You can add an optional note.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            placeholder="Reason (optional)"
            value={rejectNotes}
            onChange={(e) => setRejectNotes(e.target.value)}
            rows={2}
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleReject} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Reject
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function NotesEditor({
  initial,
  onSave,
  onCancel,
  saving,
}: {
  initial: string;
  onSave: (notes: string) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [value, setValue] = useState(initial);
  return (
    <div className="mt-3 space-y-2 border-t pt-3">
      <Textarea
        rows={2}
        placeholder="Add follow-up notes…"
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
      <div className="flex gap-2">
        <Button size="sm" onClick={() => onSave(value)} disabled={saving}>
          Save notes
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
