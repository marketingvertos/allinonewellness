import { useState } from "react";
import { PageBanner } from "@/components/PageBanner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Gift, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useIsWellnessManager } from "@/hooks/useWellness";
import { METRIC_LABEL, OFFER_TYPE_LABEL, Promotion, usePromotions, usePromotionStats, useSavePromotion } from "@/hooks/usePromotions";
import { CreatePromotionDialog } from "@/components/wellness/CreatePromotionDialog";
import { PromotionProgressSheet } from "@/components/wellness/PromotionProgressSheet";
import { formatDate, todayIst } from "@/lib/formatters";

export default function WellnessPromotions() {
  const [tab, setTab] = useState<"active" | "expired" | "all">("active");
  const { data: promos, isLoading } = usePromotions(tab);
  const { data: stats } = usePromotionStats();
  const isManager = useIsWellnessManager();
  const save = useSavePromotion();
  const { toast } = useToast();
  const [editing, setEditing] = useState<Promotion | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [viewing, setViewing] = useState<Promotion | null>(null);
  const today = todayIst();

  const toggle = async (p: Promotion) => {
    try {
      await save.mutateAsync({ id: p.id, values: { is_active: !p.is_active } });
      toast({ title: p.is_active ? "Offer deactivated" : "Offer activated" });
    } catch (e) {
      toast({ title: "Could not update", description: (e as Error).message, variant: "destructive" });
    }
  };

  return (
    <div>
      <PageBanner title="Offers & Qualifications" description="Create and manage member promotions.">
        {isManager && (
          <Button onClick={() => { setEditing(null); setCreateOpen(true); }}>
            <Plus className="mr-1 h-4 w-4" /> New offer
          </Button>
        )}
      </PageBanner>

      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)} className="mb-4">
        <TabsList>
          <TabsTrigger value="active">Active</TabsTrigger>
          <TabsTrigger value="expired">Expired</TabsTrigger>
          <TabsTrigger value="all">All</TabsTrigger>
        </TabsList>
      </Tabs>

      {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {!isLoading && !promos?.length && (
        <Card><CardContent className="flex flex-col items-center gap-2 py-10 text-center text-muted-foreground">
          <Gift className="h-8 w-8" /> No offers here yet.
        </CardContent></Card>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        {(promos ?? []).map((p) => {
          const s = stats?.[p.id];
          const tracked = p.offer_type !== "announcement";
          const live = p.is_active && p.end_date >= today;
          const upcoming = live && p.start_date > today;
          return (
            <Card key={p.id} className={`border-l-4 ${tracked ? "border-l-amber-500" : "border-l-accent"}`}>
              <CardContent className="space-y-2 pt-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2">
                    <span className="text-2xl leading-none">{p.icon}</span>
                    <div>
                      <h3 className="font-semibold">{p.title}</h3>
                      <p className="text-xs text-muted-foreground">
                        {OFFER_TYPE_LABEL[p.offer_type]} · {formatDate(p.start_date)} – {formatDate(p.end_date)}
                      </p>
                    </div>
                  </div>
                  <Badge variant={live ? "default" : "secondary"}>
                    {!p.is_active ? "Inactive" : p.end_date < today ? "Ended" : upcoming ? "Upcoming" : "Live"}
                  </Badge>
                </div>
                {p.banner_message && <p className="text-sm font-medium">{p.banner_message}</p>}
                {tracked && <p className="text-sm">Target: {p.target_count} {METRIC_LABEL[p.target_metric].toLowerCase()}</p>}
                {p.reward_description && <p className="text-sm">Reward: {p.reward_description}</p>}
                {p.visibility !== "all" && <p className="text-xs text-muted-foreground">Only {p.visibility} members</p>}
                {tracked && (
                  <p className="text-sm text-muted-foreground">
                    {s?.participating ?? 0} participating · {s?.qualified ?? 0} qualified
                  </p>
                )}
                <div className="flex flex-wrap gap-2 pt-1">
                  {tracked && <Button size="sm" onClick={() => setViewing(p)}>View progress</Button>}
                  {isManager && (
                    <>
                      <Button size="sm" variant="outline" onClick={() => { setEditing(p); setCreateOpen(true); }}>Edit</Button>
                      <Button size="sm" variant="ghost" onClick={() => toggle(p)}>{p.is_active ? "Deactivate" : "Activate"}</Button>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <CreatePromotionDialog open={createOpen} onOpenChange={setCreateOpen} promotion={editing} />
      <PromotionProgressSheet promotion={viewing} onClose={() => setViewing(null)} />
    </div>
  );
}
