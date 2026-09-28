import { useEffect, useState } from "react";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { METRIC_LABEL, OFFER_TYPE_LABEL, OfferType, Promotion, TargetMetric, useSavePromotion } from "@/hooks/usePromotions";
import { todayIst } from "@/lib/formatters";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  promotion?: Promotion | null;
}

const blank = () => ({
  offer_type: "referral_challenge" as OfferType,
  title: "",
  description: "",
  reward_description: "",
  banner_message: "",
  icon: "🎯",
  target_metric: "new_referrals" as TargetMetric,
  target_count: "5",
  start_date: todayIst(),
  end_date: todayIst(),
  visibility: "all" as Promotion["visibility"],
});

export function CreatePromotionDialog({ open, onOpenChange, promotion }: Props) {
  const [f, setF] = useState(blank());
  const save = useSavePromotion();
  const { toast } = useToast();

  useEffect(() => {
    if (!open) return;
    setF(
      promotion
        ? {
            offer_type: promotion.offer_type,
            title: promotion.title,
            description: promotion.description ?? "",
            reward_description: promotion.reward_description,
            banner_message: promotion.banner_message ?? "",
            icon: promotion.icon,
            target_metric: promotion.target_metric === "none" ? "new_referrals" : promotion.target_metric,
            target_count: String(promotion.target_count ?? 5),
            start_date: promotion.start_date,
            end_date: promotion.end_date,
            visibility: promotion.visibility,
          }
        : blank(),
    );
  }, [open, promotion]);

  const set = (k: keyof ReturnType<typeof blank>, v: string) => setF((p) => ({ ...p, [k]: v }));
  const isAnn = f.offer_type === "announcement";

  const submit = async () => {
    if (!f.title.trim()) return toast({ title: "Title is required", variant: "destructive" });
    try {
      await save.mutateAsync({
        id: promotion?.id,
        values: {
          offer_type: f.offer_type,
          title: f.title.trim(),
          description: f.description.trim() || null,
          reward_description: f.reward_description.trim(),
          banner_message: f.banner_message.trim() || null,
          icon: f.icon.trim() || "🎯",
          target_metric: isAnn ? "none" : f.target_metric,
          target_count: isAnn ? null : Number(f.target_count) || null,
          start_date: f.start_date,
          end_date: f.end_date,
          visibility: f.visibility,
        },
      });
      toast({ title: promotion ? "Offer updated" : "Offer created" });
      onOpenChange(false);
    } catch (e) {
      toast({ title: "Could not save", description: (e as Error).message, variant: "destructive" });
    }
  };

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title={promotion ? "Edit offer" : "New offer"}
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={save.isPending}>{promotion ? "Save" : "Create offer"}</Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label>Offer type</Label>
          <Select value={f.offer_type} onValueChange={(v) => set("offer_type", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {(Object.keys(OFFER_TYPE_LABEL) as OfferType[]).map((k) => (
                <SelectItem key={k} value={k}>{OFFER_TYPE_LABEL[k]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-[4rem_1fr] gap-2">
          <div className="space-y-1.5">
            <Label>Icon</Label>
            <Input value={f.icon} onChange={(e) => set("icon", e.target.value)} className="text-center" />
          </div>
          <div className="space-y-1.5">
            <Label>Title</Label>
            <Input value={f.title} onChange={(e) => set("title", e.target.value)} placeholder="Get your membership FREE!" />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Description</Label>
          <Textarea value={f.description} onChange={(e) => set("description", e.target.value)} rows={2} />
        </div>
        <div className="space-y-1.5">
          <Label>Reward</Label>
          <Input value={f.reward_description} onChange={(e) => set("reward_description", e.target.value)} placeholder="Free membership for 1 month" />
        </div>
        <div className="space-y-1.5">
          <Label>Banner line (optional)</Label>
          <Input value={f.banner_message} onChange={(e) => set("banner_message", e.target.value)} />
        </div>
        {!isAnn && (
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label>What counts</Label>
              <Select value={f.target_metric} onValueChange={(v) => set("target_metric", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(["new_referrals", "new_memberships", "attendance_days"] as TargetMetric[]).map((k) => (
                    <SelectItem key={k} value={k}>{METRIC_LABEL[k]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Target</Label>
              <Input type="number" min={1} value={f.target_count} onChange={(e) => set("target_count", e.target.value)} />
            </div>
          </div>
        )}
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1.5">
            <Label>Start date</Label>
            <Input type="date" value={f.start_date} onChange={(e) => set("start_date", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>End date</Label>
            <Input type="date" value={f.end_date} onChange={(e) => set("end_date", e.target.value)} />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Show to</Label>
          <Select value={f.visibility} onValueChange={(v) => set("visibility", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All members</SelectItem>
              <SelectItem value="physical">Physical members</SelectItem>
              <SelectItem value="virtual">Virtual members</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </ResponsiveDialog>
  );
}
