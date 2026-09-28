import { useEffect, useState } from "react";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { METRIC_LABEL, OFFER_TYPE_LABEL, OfferType, Promotion, TargetMetric, useSavePromotion } from "@/hooks/usePromotions";
import { todayIst } from "@/lib/formatters";
import { getOfferColors, offerColorClasses, offerPalette, type OfferColor } from "@/lib/offerColors";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  promotion?: Promotion | null;
}

const blank = () => ({
  offer_type: "referral_challenge" as OfferType,
  title: "",
  card_color: "teal" as OfferColor,
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
  const [descriptionLines, setDescriptionLines] = useState<string[]>([""]);
  const save = useSavePromotion();
  const { toast } = useToast();

  useEffect(() => {
    if (!open) return;
    setDescriptionLines(promotion?.description ? promotion.description.split(/\r?\n/) : [""]);
    setF(
      promotion
        ? {
            offer_type: promotion.offer_type,
            title: promotion.title,
            card_color: promotion.card_color ?? getOfferColors([promotion]).get(promotion.id) ?? "teal",
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
  const changeLine = (index: number, value: string) => setDescriptionLines((lines) => lines.map((line, i) => i === index ? value : line));
  const moveLine = (index: number, direction: -1 | 1) => setDescriptionLines((lines) => {
    const next = [...lines];
    [next[index], next[index + direction]] = [next[index + direction], next[index]];
    return next;
  });

  const submit = async () => {
    if (!f.title.trim()) return toast({ title: "Title is required", variant: "destructive" });
    try {
      await save.mutateAsync({
        id: promotion?.id,
        values: {
          offer_type: f.offer_type,
          title: f.title.trim(),
          description: descriptionLines.map((line) => line.trim()).filter(Boolean).join("\n") || null,
          card_color: f.card_color,
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
        <div className="space-y-2">
          <Label>Card color</Label>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6" role="group" aria-label="Card color">
            {offerPalette.map((option) => (
              <Button key={option} type="button" variant="outline" size="sm"
                aria-label={`${option} card color`} aria-pressed={f.card_color === option}
                onClick={() => set("card_color", option)}
                className={cn("h-12 flex-col gap-1 capitalize", f.card_color === option && "ring-2 ring-ring")}>
                <span className={cn("h-4 w-4 rounded-full", offerColorClasses[option].icon)} aria-hidden="true" />
                {option}
              </Button>
            ))}
          </div>
          <div className={cn("rounded-md border border-l-8 px-3 py-2", offerColorClasses[f.card_color].card)}>
            <span className={cn("font-semibold", offerColorClasses[f.card_color].title)}>{f.icon || "🎯"} {f.title || "Offer preview"}</span>
          </div>
        </div>
        <div className="space-y-2">
          <Label>Description</Label>
          {descriptionLines.map((line, index) => (
            <div key={index} className="flex items-start gap-1">
              <Textarea aria-label={`Description line ${index + 1}`} value={line} rows={2} className="min-w-0 flex-1"
                onChange={(e) => changeLine(index, e.target.value)} />
              <div className="flex shrink-0 flex-col">
                <Button type="button" size="icon" variant="ghost" aria-label={`Move line ${index + 1} up`} title="Move up" disabled={index === 0}
                  onClick={() => moveLine(index, -1)}><ArrowUp className="h-4 w-4" /></Button>
                <Button type="button" size="icon" variant="ghost" aria-label={`Move line ${index + 1} down`} title="Move down" disabled={index === descriptionLines.length - 1}
                  onClick={() => moveLine(index, 1)}><ArrowDown className="h-4 w-4" /></Button>
                <Button type="button" size="icon" variant="ghost" aria-label={`Remove line ${index + 1}`} title="Remove line"
                  onClick={() => setDescriptionLines((lines) => lines.length === 1 ? [""] : lines.filter((_, i) => i !== index))}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" onClick={() => setDescriptionLines((lines) => [...lines, ""])}>
            <Plus className="mr-1 h-4 w-4" /> Add line
          </Button>
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
