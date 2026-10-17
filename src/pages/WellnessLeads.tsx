import { PageBanner } from "@/components/PageBanner";
import { LeadsPanel } from "@/components/wellness/LeadsPanel";

export default function WellnessLeads() {
  return (
    <div className="space-y-6">
      <PageBanner
        title="Lead management"
        description="Track enquiries from trial registrations, ads and referrals."
      />
      <LeadsPanel />
    </div>
  );
}
