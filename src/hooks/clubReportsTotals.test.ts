import { describe, it, expect, vi } from "vitest";
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
import { withWlpTotal } from "./useClubReports";

describe("club report totals", () => {
  it("Total Shake includes WLP servings", () => {
    expect(withWlpTotal(40, 7)).toEqual({ daily_shake: 40, wlp: 7, total_shake: 47 });
  });
});
