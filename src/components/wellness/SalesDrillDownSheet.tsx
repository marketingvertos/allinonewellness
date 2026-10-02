import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Banknote, CreditCard, Download, IndianRupee, RefreshCw, Smartphone, Globe } from "lucide-react";
import { MemberModeFilter, periodRange, useSalesDrillDown } from "@/hooks/useWellness";
import { formatCurrency, formatDate } from "@/lib/formatters";

const MODE_ICONS: Record<string, typeof Banknote> = {
  cash: Banknote,
  upi: Smartphone,
  online: Globe,
  card: CreditCard,
};

const MODE_LABELS: Record<string, string> = {
  cash: "Cash",
  upi: "UPI",
  online: "Online",
  card: "Card",
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  period: "today" | "week" | "month" | "last_month";
  periodLabel: string;
  memberMode: MemberModeFilter;
  onSelectMember?: (memberId: string) => void;
}

export function SalesDrillDownSheet({ open, onOpenChange, period, periodLabel, memberMode, onSelectMember }: Props) {
  const range = periodRange(period);
  const { data, isLoading } = useSalesDrillDown(range.from, range.to, memberMode, open);

  const exportCsv = () => {
    if (!data) return;
    const header = ["Member", "Mobile", "Plan", "Amount (₹)", "Payment Mode", "Type", "Date"];
    const csvRows = data.rows.map((r) => [
      r.memberName,
      r.mobile,
      r.planName,
      r.pricePaid,
      r.payments.length > 0
        ? r.payments.map((p) => `${MODE_LABELS[p.mode] ?? p.mode} ₹${p.amount}`).join(" + ")
        : (MODE_LABELS[r.paymentMode] ?? r.paymentMode),
      r.isRenewal ? "Renewal" : "New",
      new Date(r.createdAt).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        timeZone: "Asia/Kolkata",
      }),
    ]);
    const csv = [header.join(","), ...csvRows.map((row) => row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))].join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sales-${period}-${range.from}-to-${range.to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col p-0 sm:max-w-lg">
        <SheetHeader className="border-b px-6 pb-4 pt-6">
          <div className="flex items-center justify-between gap-2">
            <div>
              <SheetTitle className="flex items-center gap-2 text-lg">
                <IndianRupee className="h-5 w-5" />
                Sales — {periodLabel}
              </SheetTitle>
              <SheetDescription>
                {formatDate(range.from)} → {formatDate(range.to)}
              </SheetDescription>
            </div>
            <Button variant="outline" size="sm" onClick={exportCsv} disabled={!data?.rows.length}>
              <Download className="mr-1.5 h-3.5 w-3.5" /> Export
            </Button>
          </div>
        </SheetHeader>

        {isLoading ? (
          <div className="space-y-3 p-6">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : !data ? null : (
          <>
            <div className="grid grid-cols-2 gap-2 border-b px-6 py-4">
              <MiniTile label="Revenue" value={formatCurrency(data.totalRevenue)} />
              <MiniTile label="Plans sold" value={data.totalMemberships} />
              <MiniTile label="Servings" value={data.totalServings} />
              <MiniTile
                label="By mode"
                value=""
                detail={
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {data.byCash > 0 && (
                      <Badge variant="outline" className="gap-1 text-[10px]">
                        <Banknote className="h-2.5 w-2.5" /> {formatCurrency(data.byCash)}
                      </Badge>
                    )}
                    {data.byUpi > 0 && (
                      <Badge variant="outline" className="gap-1 text-[10px]">
                        <Smartphone className="h-2.5 w-2.5" /> {formatCurrency(data.byUpi)}
                      </Badge>
                    )}
                    {data.byOnline > 0 && (
                      <Badge variant="outline" className="gap-1 text-[10px]">
                        <Globe className="h-2.5 w-2.5" /> {formatCurrency(data.byOnline)}
                      </Badge>
                    )}
                    {data.byCard > 0 && (
                      <Badge variant="outline" className="gap-1 text-[10px]">
                        <CreditCard className="h-2.5 w-2.5" /> {formatCurrency(data.byCard)}
                      </Badge>
                    )}
                    {data.totalRevenue === 0 && <span className="text-xs text-muted-foreground">No payments</span>}
                  </div>
                }
              />
            </div>

            <ScrollArea className="flex-1">
              <div className="space-y-2 px-6 py-3">
                {data.rows.length === 0 ? (
                  <p className="py-12 text-center text-sm text-muted-foreground">No memberships sold in this period.</p>
                ) : (
                  data.rows.map((r) => {
                    const ModeIcon = MODE_ICONS[r.paymentMode] ?? Banknote;
                    const hasSplitPayments = r.payments.length > 1;
                    return (
                      <button
                        key={r.id}
                        onClick={() => {
                          onSelectMember?.(r.memberId);
                          onOpenChange(false);
                        }}
                        className="w-full rounded-lg border p-3 text-left transition-colors hover:bg-muted/50"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold">{r.memberName}</p>
                            <p className="text-xs text-muted-foreground">{r.mobile}</p>
                          </div>
                          <p className="shrink-0 text-sm font-bold">{formatCurrency(r.pricePaid)}</p>
                        </div>

                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                          <Badge variant="secondary" className="text-[10px]">
                            {r.planName}
                          </Badge>
                          <Badge variant="outline" className="text-[10px]">
                            {r.totalServings} servings
                          </Badge>
                          <Badge variant={r.isRenewal ? "default" : "secondary"} className="gap-1 text-[10px]">
                            {r.isRenewal ? (
                              <>
                                <RefreshCw className="h-2.5 w-2.5" /> Renewal
                              </>
                            ) : (
                              "New"
                            )}
                          </Badge>
                        </div>

                        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                          {hasSplitPayments ? (
                            r.payments.map((p, i) => {
                              const PIcon = MODE_ICONS[p.mode] ?? Banknote;
                              return (
                                <span key={i} className="inline-flex items-center gap-1">
                                  <PIcon className="h-3 w-3" />
                                  {MODE_LABELS[p.mode] ?? p.mode} {formatCurrency(p.amount)}
                                  {i < r.payments.length - 1 && <span className="mx-0.5 text-muted-foreground">+</span>}
                                </span>
                              );
                            })
                          ) : (
                            <span className="inline-flex items-center gap-1">
                              <ModeIcon className="h-3 w-3" />
                              {MODE_LABELS[r.paymentMode] ?? r.paymentMode}
                            </span>
                          )}
                          <span className="ml-auto">
                            {new Date(r.createdAt).toLocaleDateString("en-IN", {
                              day: "2-digit",
                              month: "short",
                              hour: "2-digit",
                              minute: "2-digit",
                              timeZone: "Asia/Kolkata",
                            })}
                          </span>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </ScrollArea>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function MiniTile({ label, value, detail }: { label: string; value: string | number; detail?: React.ReactNode }) {
  return (
    <div className="rounded-lg border p-2.5">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      {value !== "" && <p className="mt-0.5 text-lg font-bold leading-tight">{value}</p>}
      {detail}
    </div>
  );
}
