import { useState } from "react";
import { PageBanner } from "@/components/PageBanner";
import { CheckInReports } from "@/components/wellness/CheckInReports";
import { MemberSheetById } from "@/components/wellness/MemberSheetById";

export default function CheckInReportPage() {
  const [memberId, setMemberId] = useState<string | null>(null);
  return (
    <div className="space-y-6">
      <PageBanner title="Check-in Reports" description="Attendance summaries, weight changes and milestone watch." />
      <CheckInReports onSelectMember={setMemberId} />
      <MemberSheetById memberId={memberId} onClose={() => setMemberId(null)} />
    </div>
  );
}
