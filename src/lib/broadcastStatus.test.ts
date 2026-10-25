import { describe, expect, it } from "vitest";
import { failureReason, funnel, groupFailures, recipientStage } from "./broadcastStatus";

describe("broadcast tracking", () => {
  it("rates are measured against sent messages", () => {
    const f = funnel({ total_count: 120, sent_count: 100, failed_count: 15, skipped_count: 5, delivered_count: 80, read_count: 50, replied_count: 4 });
    expect(f.deliveryRate).toBe(80);
    expect(f.readRate).toBe(50);
    expect(f.replyRate).toBe(4);
    expect(f.pending).toBe(0);
  });

  it("a read receipt wins over a later failed status (forward only)", () => {
    expect(recipientStage({ status: "failed", delivered_at: "x", read_at: "y" })).toBe("read");
    expect(recipientStage({ status: "sent", delivered_at: "x", read_at: "y", replied_at: "z" })).toBe("replied");
    expect(recipientStage({ status: "failed" })).toBe("failed");
  });

  it("groups Meta marketing-limit failures together", () => {
    expect(failureReason("(#131049) ecosystem engagement")).toBe("Meta marketing limit (try after 24h)");
    const g = groupFailures([{ error: "131049" }, { error: "ecosystem" }, { error: "Duplicate number" }]);
    expect(g[0]).toEqual({ reason: "Meta marketing limit (try after 24h)", count: 2 });
  });
});
