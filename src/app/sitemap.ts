import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/site-url";

export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = getSiteUrl();
  return ["/", "/privacy", "/terms", "/contact", "/login"].map((path) => ({
    url: new URL(path, siteUrl).toString(),
    lastModified: new Date(),
  }));
}
