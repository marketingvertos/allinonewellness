import { describe, expect, it } from "vitest";
import { getYouTubeVideoId } from "@/lib/youtube";

describe("getYouTubeVideoId", () => {
  it("accepts standard, short, Shorts and embed links", () => {
    expect(getYouTubeVideoId("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(getYouTubeVideoId("https://youtu.be/dQw4w9WgXcQ?t=2")).toBe("dQw4w9WgXcQ");
    expect(getYouTubeVideoId("https://youtube.com/shorts/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(getYouTubeVideoId("https://youtube.com/embed/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });

  it("rejects unsupported hosts and malformed video ids", () => {
    expect(getYouTubeVideoId("https://example.com/watch?v=dQw4w9WgXcQ")).toBeNull();
    expect(getYouTubeVideoId("https://youtube.com/watch?v=short")).toBeNull();
    expect(getYouTubeVideoId("not a link")).toBeNull();
  });
});