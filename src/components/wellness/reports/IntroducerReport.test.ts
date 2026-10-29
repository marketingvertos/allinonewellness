import { describe, it, expect } from "vitest";
import { planBucket } from "./IntroducerReport";
describe("introducer Gold UMS split", () => {
  it("new Gold UMS", () => expect(planBucket("Gold Card UMS 30", "new")).toBe("gold_new"));
  it("renewal Gold UMS", () => expect(planBucket("Gold Card UMS 30", "renewal")).toBe("gold_renewal"));
});
