import { PageBanner } from "@/components/PageBanner";
import { RevenueTab } from "./WellnessReports";

export default function RevenueReport() {
  return (
    <div className="space-y-6">
      <PageBanner title="Revenue" description="Sales and payment modes for any period." />
      <RevenueTab />
    </div>
  );
}
