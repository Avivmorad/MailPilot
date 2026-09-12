import type { MetadataRoute } from "next";

import { publicAppOrigin } from "@/lib/seo/public-origin";

const PUBLIC_PATHS = ["/", "/privacy", "/terms", "/login"] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  const origin = publicAppOrigin();
  if (!origin) {
    return [];
  }
  return PUBLIC_PATHS.map((path) => ({
    url: path === "/" ? origin : `${origin}${path}`,
    changeFrequency: "monthly" as const,
    priority: path === "/" ? 1 : 0.6,
  }));
}
