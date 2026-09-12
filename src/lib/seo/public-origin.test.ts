import { describe, expect, it } from "vitest";

import { publicAppOrigin } from "@/lib/seo/public-origin";

describe("publicAppOrigin", () => {
  it("strips a trailing slash", () => {
    expect(publicAppOrigin({ NEXT_PUBLIC_APP_URL: "https://gmailpilot.example/" })).toBe(
      "https://gmailpilot.example",
    );
  });

  it("returns undefined when unset", () => {
    expect(publicAppOrigin({})).toBeUndefined();
  });
});
