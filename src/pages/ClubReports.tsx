import { useMemo, useState } from "react";
import { PageBanner } from "@/components/PageBanner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Download, FileDown, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  DailyRow, MonthlyManual, useClubDailyReport, useClubMonthlyReport, useMonthlyOps, useSaveDailyOps, useSaveMonthlyOps,
} from "@/hooks/useClubReports";
import { EditableCell } from "@/components/wellness/reports/EditableCell";
import { downloadXlsx } from "@/lib/reportExport";
import { downloadBrandedPdf } from "@/lib/reportPdf";

const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;
const currentMonth = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }).slice(0, 7);
const fmtDate = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
const monthLabel = (m: string) => new Date(m + "-01T00:00:00").toLocaleDateString("en-IN", { month: "long", year: "numeric" });
const fileMonth = (m: string) => monthLabel(m).replace(/\s+/g, "-");
const pdfNum = (n: number, money?: boolean) => (!Number(n) ? "–" : money ? `Rs. ${Math.round(Number(n)).toLocaleString("en-IN")}` : String(n));
const Dash = () => <span className="text-muted-foreground/60">–</span>;
const cell = (n: number, money?: boolean) => (!Number(n) ? <Dash /> : money ? inr(Number(n)) : n);

function PdfButton({ onClick }: { onClick: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  return (
    <Button size="sm" disabled={busy} onClick={async () => {
      setBusy(true);
      try { await onClick(); toast.success("PDF downloaded"); } catch (e: any) { toast.error(e?.message ?? "Could not create PDF"); } finally { setBusy(false); }
    }}>
      {busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <FileDown className="mr-1 h-4 w-4" />}
      {busy ? "Preparing PDF…" : "Download PDF"}
    </Button>
  );
}

function registerPdf(kind: "Daily" | "Weekly", month: string, rows: DailyRow[], labels: string[], total: DailyRow) {
  return downloadBrandedPdf({
    filename: `AIOW-${kind === "Daily" ? "Daily-Register" : "Weekly-Summary"}-${fileMonth(month)}.pdf`,
    title: kind === "Daily" ? "Daily Club Register" : "Weekly Club Summary",
    period: monthLabel(month),
    orientation: "landscape",
    sections: [{
      head: ["S.No", kind === "Daily" ? "Date" : "Week", ...COLS.map((c) => c.label)],
      body: rows.map((r, i) => [i + 1, labels[i], ...COLS.map((c) => pdfNum(Number(r[c.key]), c.money))]),
      foot: ["", "Total", ...COLS.map((c) => pdfNum(Number(total[c.key]), c.money))],
      rightAlignFrom: 2,
    }],
  });
}

function KpiCards({ total }: { total: DailyRow }) {
  const items = [
    { label: "Total Shakes", value: String(total.total_shake ?? 0) },
    { label: "New Guests", value: String(total.new_guest ?? 0) },
    { label: "30D UMS", value: String(Number(total.ums30_cust_new || 0) + Number(total.ums30_cust_renew || 0) + Number(total.ums30_coach || 0)) },
    { label: "Collected", value: inr(Number(total.total_amount || 0)) },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {items.map((k) => (
        <Card key={k.label}><CardContent className="p-4">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{k.label}</p>
          <p className="text-2xl font-bold tabular-nums text-primary">{k.value}</p>
        </CardContent></Card>
      ))}
    </div>
  );
}

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
        <thead className="bg-sidebar text-sidebar-foreground">
          <tr>
            <th className="px-2 py-2 text-left text-[11px] uppercase tracking-wide">S.No</th>
            <th className="sticky left-0 bg-sidebar px-2 py-2 text-left text-[11px] uppercase tracking-wide">{editable ? "Date" : "Week"}</th>
            {COLS.map((c, i) => <th key={i} className="px-2 py-2 text-right text-[11px] uppercase tracking-wide whitespace-nowrap">{c.label}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t odd:bg-background even:bg-muted/40">
              <td className="px-2 py-1">{i + 1}</td>
              <td className="sticky left-0 bg-inherit px-2 py-1 font-medium whitespace-nowrap">{labels[i]}</td>
              {COLS.map((c, j) => (
                <td key={j} className="px-2 py-1 text-right tabular-nums">
                  {editable && c.editable ? (
                    <EditableCell value={Number(r[c.key])} format={inr}
                      onSave={(v) => save.mutate({ log_date: r.day, [c.editable!]: v }, {
                        onSuccess: () => toast.success("Saved"), onError: (e: any) => toast.error(e.message),
                      })} />
                  ) : cell(Number(r[c.key]), c.money)}
                </td>
              ))}
            </tr>
          ))}
          <tr className="border-t bg-sidebar font-semibold text-sidebar-primary">
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
        <Button variant="outline" size="sm" onClick={() => downloadXlsx(`AIOW-Monthly-Record-${fileMonth(month)}.xlsx`, "Monthly Record",
          [["Sr", "Subject", "Value"], ...lines.map((l) => [l.sr, l.subject, l.value])])}>
          <Download className="mr-1 h-4 w-4" />Excel</Button>
        <PdfButton onClick={() => {
          const sec = (title: string, from: number, to: number) => ({
            title, head: ["Sr.", "Subject", monthLabel(month)], rightAlignFrom: 2,
            body: lines.slice(from, to).map((l) => [l.sr, l.subject, l.money ? pdfNum(l.value, true) : String(l.value ?? 0)]),
          });
          return downloadBrandedPdf({
            filename: `AIOW-Monthly-Record-${fileMonth(month)}.pdf`, title: "Monthly Club Record", period: monthLabel(month), orientation: "portrait",
            sections: [sec("Operations", 0, 14), sec("Finance", 14, 18)],
          });
        }} />
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
            <Button variant="outline" size="sm" onClick={() => exportRegister(`AIOW-Daily-Register-${fileMonth(month)}.xlsx`, rows, rows.map((r) => fmtDate(r.day)), total)}><Download className="mr-1 h-4 w-4" />Excel</Button>
            <PdfButton onClick={() => registerPdf("Daily", month, rows, rows.map((r) => fmtDate(r.day)), total)} />
          </div>
          <KpiCards total={total} />
          {isLoading ? <p className="text-sm text-muted-foreground">Loading…</p> :
            <RegisterTable rows={rows} labels={rows.map((r) => fmtDate(r.day))} total={total} month={month} editable />}
          <p className="text-xs text-muted-foreground print:hidden">Tap Milk or Product Retail to type in the day's amount.</p>
        </TabsContent>
        <TabsContent value="weekly" className="space-y-3">
          <div className="flex justify-end gap-2 print:hidden">
            <Button variant="outline" size="sm" onClick={() => exportRegister(`AIOW-Weekly-Summary-${fileMonth(month)}.xlsx`, weekRows, weeks.map((w) => w.label), total)}><Download className="mr-1 h-4 w-4" />Excel</Button>
            <PdfButton onClick={() => registerPdf("Weekly", month, weekRows, weeks.map((w) => w.label), total)} />
          </div>
          <KpiCards total={total} />
          <RegisterTable rows={weekRows} labels={weeks.map((w) => w.label)} total={total} month={month} editable={false} />
        </TabsContent>
        <TabsContent value="monthly"><MonthlyRecord month={month} /></TabsContent>
      </Tabs>
    </div>
  );
}
