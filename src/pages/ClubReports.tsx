import { useMemo, useState } from "react";
import { PageBanner } from "@/components/PageBanner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Download, Printer } from "lucide-react";
import { toast } from "sonner";
import {
  DailyRow, MonthlyManual, useClubDailyReport, useClubMonthlyReport, useMonthlyOps, useSaveDailyOps, useSaveMonthlyOps,
} from "@/hooks/useClubReports";
import { EditableCell } from "@/components/wellness/reports/EditableCell";
import { downloadXlsx, printReport } from "@/lib/reportExport";

const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;
const currentMonth = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }).slice(0, 7);
const fmtDate = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
const monthLabel = (m: string) => new Date(m + "-01T00:00:00").toLocaleDateString("en-IN", { month: "long", year: "numeric" });

type Col = { key: keyof DailyRow; label: string; money?: boolean; editable?: "milk_amount" | "product_retail_amount" };
const COLS: Col[] = [
  { key: "total_shake", label: "Total Shake" },
  { key: "new_guest", label: "New Guest" },
  { key: "total_shake", label: "Daily Shake" },
  { key: "tp_new", label: "3D TP - N" },
  { key: "tp_repeat", label: "3D TP - R" },
  { key: "ums15_new", label: "15 UMS - N" },
  { key: "ums15_renew", label: "15 UMS - R" },
  { key: "ums30_cust_new", label: "30 UMS Cust - N" },
  { key: "ums30_cust_renew", label: "30 UMS Cust - R" },
  { key: "ums30_coach", label: "30 UMS Coach" },
  { key: "total_amount", label: "Total Amount", money: true },
  { key: "cash", label: "Cash", money: true },
  { key: "swipe", label: "Swipe", money: true },
  { key: "upi", label: "PhonePe/Paytm/GPay", money: true },
  { key: "online", label: "Online", money: true },
  { key: "milk", label: "Milk", money: true, editable: "milk_amount" },
  { key: "product_retail", label: "Product Retail", money: true, editable: "product_retail_amount" },
];

function sumRows(rows: DailyRow[]) {
  const t: any = {};
  for (const c of COLS) t[c.key] = rows.reduce((s, r) => s + Number(r[c.key] || 0), 0);
  return t as DailyRow;
}

function RegisterTable({ rows, labels, total, month, editable }: { rows: DailyRow[]; labels: string[]; total: DailyRow; month: string; editable: boolean }) {
  const save = useSaveDailyOps(month);
  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full text-xs">
        <thead className="bg-muted/60">
          <tr>
            <th className="px-2 py-2 text-left">S.No</th>
            <th className="px-2 py-2 text-left">{editable ? "Date" : "Week"}</th>
            {COLS.map((c, i) => <th key={i} className="px-2 py-2 text-right whitespace-nowrap">{c.label}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t">
              <td className="px-2 py-1">{i + 1}</td>
              <td className="px-2 py-1 whitespace-nowrap">{labels[i]}</td>
              {COLS.map((c, j) => (
                <td key={j} className="px-2 py-1 text-right tabular-nums">
                  {editable && c.editable ? (
                    <EditableCell value={Number(r[c.key])} format={inr}
                      onSave={(v) => save.mutate({ log_date: r.day, [c.editable!]: v }, {
                        onSuccess: () => toast.success("Saved"), onError: (e: any) => toast.error(e.message),
                      })} />
                  ) : c.money ? inr(Number(r[c.key])) : r[c.key]}
                </td>
              ))}
            </tr>
          ))}
          <tr className="border-t bg-muted/60 font-semibold">
            <td className="px-2 py-2" colSpan={2}>Total</td>
            {COLS.map((c, j) => <td key={j} className="px-2 py-2 text-right tabular-nums">{c.money ? inr(Number(total[c.key])) : total[c.key]}</td>)}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function exportRegister(name: string, rows: DailyRow[], labels: string[], total: DailyRow) {
  const head = ["S.No", "Date", ...COLS.map((c) => c.label)];
  const body = rows.map((r, i) => [i + 1, labels[i], ...COLS.map((c) => Number(r[c.key]))]);
  downloadXlsx(name, "Register", [head, ...body, ["", "Total", ...COLS.map((c) => Number(total[c.key]))]]);
}

function weeksOf(rows: DailyRow[]) {
  const groups: { label: string; rows: DailyRow[] }[] = [];
  for (const r of rows) {
    const dow = new Date(r.day + "T00:00:00").getDay();
    if (!groups.length || dow === 1) groups.push({ label: "", rows: [] });
    groups[groups.length - 1].rows.push(r);
  }
  return groups.map((g) => ({ ...g, label: `${fmtDate(g.rows[0].day)} – ${fmtDate(g.rows[g.rows.length - 1].day)}` }));
}

function MonthlyRecord({ month }: { month: string }) {
  const { data: auto } = useClubMonthlyReport(month);
  const { data: manual } = useMonthlyOps(month);
  const save = useSaveMonthlyOps(month);
  const a = auto ?? ({} as any);
  const m = manual ?? ({} as any);
  const lead = m.lead_generation_count ?? a.lead_generation_auto ?? 0;
  const lines: { sr: number; subject: string; value: number; field?: keyof MonthlyManual; money?: boolean }[] = [
    { sr: 1, subject: "Total Shake", value: a.total_shake ?? 0 },
    { sr: 2, subject: "Total Volume Points", value: m.volume_points ?? 0, field: "volume_points" },
    { sr: 3, subject: "Total New Guest", value: a.new_guest ?? 0 },
    { sr: 4, subject: "Total No. of 3 Day's Trial", value: a.trials_3day ?? 0 },
    { sr: 5, subject: "Total No. of 15 Day's UMS", value: a.ums15 ?? 0 },
    { sr: 6, subject: "Total No. of 30 Day's UMS", value: a.ums30 ?? 0 },
    { sr: 7, subject: "AE (Ambassador Evening) Cust. Qualify", value: m.ae_qualify_count ?? 0, field: "ae_qualify_count" },
    { sr: 8, subject: "Total No. of Afresh Party from Club", value: m.afresh_party_count ?? 0, field: "afresh_party_count" },
    { sr: 9, subject: "Total Lead Generation by Coach", value: lead, field: "lead_generation_count" },
    { sr: 10, subject: "New 30 Days UMS This Month (Only Cust.)", value: a.ums30_new_cust ?? 0 },
    { sr: 11, subject: "New 15 Days UMS This Month (Only Cust.)", value: a.ums15_new_cust ?? 0 },
    { sr: 12, subject: "Total LSD Ticket Qualify from Club", value: m.lsd_ticket_count ?? 0, field: "lsd_ticket_count" },
    { sr: 13, subject: "Total Customer in Club (New + Old)", value: a.total_customers ?? 0 },
    { sr: 14, subject: "Total No. of Coach in Club", value: a.total_coaches ?? 0 },
    { sr: 15, subject: "Total Amount", value: Number(a.total_amount ?? 0), money: true },
    { sr: 16, subject: "Capital Amount (Club + LSD Ticket)", value: Number(m.capital_amount ?? 0), field: "capital_amount", money: true },
    { sr: 17, subject: "Profit", value: Number(a.total_amount ?? 0) - Number(m.capital_amount ?? 0), money: true },
    { sr: 18, subject: "Total Retail of All Coach", value: Number(m.total_retail_by_coaches ?? 0), field: "total_retail_by_coaches", money: true },
  ];
  return (
    <div className="space-y-3">
      <div className="flex justify-end gap-2 print:hidden">
        <Button variant="outline" size="sm" onClick={() => downloadXlsx(`club-monthly-${month}.xlsx`, "Monthly Record",
          [["Sr", "Subject", "Value"], ...lines.map((l) => [l.sr, l.subject, l.value])])}>
          <Download className="mr-1 h-4 w-4" />Excel</Button>
        <Button variant="outline" size="sm" onClick={printReport}><Printer className="mr-1 h-4 w-4" />PDF</Button>
      </div>
      <div className="overflow-hidden rounded-md border">
        <table className="w-full text-sm">
          <thead className="bg-muted/60"><tr><th className="w-12 px-3 py-2 text-left">Sr.</th><th className="px-3 py-2 text-left">Subject</th><th className="w-40 px-3 py-2 text-right">{monthLabel(month)}</th></tr></thead>
          <tbody>
            {lines.map((l) => (
              <tr key={l.sr} className="border-t">
                <td className="px-3 py-2">{l.sr}</td>
                <td className="px-3 py-2">{l.subject}{l.field && <span className="ml-2 text-xs text-muted-foreground print:hidden">(enter)</span>}</td>
                <td className="px-3 py-2 text-right tabular-nums font-medium">
                  {l.field ? (
                    <EditableCell value={l.value} format={l.money ? inr : undefined}
                      onSave={(v) => save.mutate({ [l.field!]: v } as any, { onSuccess: () => toast.success("Saved"), onError: (e: any) => toast.error(e.message) })} />
                  ) : l.money ? inr(l.value) : l.value}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground print:hidden">Tap an underlined value to type it in. Lead generation is pre-filled from members referred by coaches this month.</p>
    </div>
  );
}

export default function ClubReports() {
  const [month, setMonth] = useState(currentMonth());
  const { data: rows = [], isLoading } = useClubDailyReport(month);
  const total = useMemo(() => sumRows(rows), [rows]);
  const weeks = useMemo(() => weeksOf(rows), [rows]);
  const weekRows = useMemo(() => weeks.map((w) => sumRows(w.rows)), [weeks]);

  return (
    <div className="space-y-6">
      <div className="print:hidden"><PageBanner title="Club Reports" description="Daily register, weekly summary and monthly owner record." /></div>
      <h2 className="hidden text-lg font-bold print:block">All In One Wellness — {monthLabel(month)}</h2>
      <Card className="print:hidden"><CardContent className="flex flex-wrap items-center gap-3 pt-6">
        <span className="text-sm font-medium">Month</span>
        <Input type="month" value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} className="w-44" />
      </CardContent></Card>
      <Tabs defaultValue="daily">
        <TabsList className="print:hidden">
          <TabsTrigger value="daily">Daily</TabsTrigger>
          <TabsTrigger value="weekly">Weekly</TabsTrigger>
          <TabsTrigger value="monthly">Monthly</TabsTrigger>
        </TabsList>
        <TabsContent value="daily" className="space-y-3">
          <div className="flex justify-end gap-2 print:hidden">
            <Button variant="outline" size="sm" onClick={() => exportRegister(`club-daily-${month}.xlsx`, rows, rows.map((r) => fmtDate(r.day)), total)}><Download className="mr-1 h-4 w-4" />Excel</Button>
            <Button variant="outline" size="sm" onClick={printReport}><Printer className="mr-1 h-4 w-4" />PDF</Button>
          </div>
          {isLoading ? <p className="text-sm text-muted-foreground">Loading…</p> :
            <RegisterTable rows={rows} labels={rows.map((r) => fmtDate(r.day))} total={total} month={month} editable />}
          <p className="text-xs text-muted-foreground print:hidden">Tap Milk or Product Retail to type in the day's amount.</p>
        </TabsContent>
        <TabsContent value="weekly" className="space-y-3">
          <div className="flex justify-end gap-2 print:hidden">
            <Button variant="outline" size="sm" onClick={() => exportRegister(`club-weekly-${month}.xlsx`, weekRows, weeks.map((w) => w.label), total)}><Download className="mr-1 h-4 w-4" />Excel</Button>
            <Button variant="outline" size="sm" onClick={printReport}><Printer className="mr-1 h-4 w-4" />PDF</Button>
          </div>
          <RegisterTable rows={weekRows} labels={weeks.map((w) => w.label)} total={total} month={month} editable={false} />
        </TabsContent>
        <TabsContent value="monthly"><MonthlyRecord month={month} /></TabsContent>
      </Tabs>
    </div>
  );
}
