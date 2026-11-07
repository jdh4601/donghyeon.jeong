import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/content";
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      ...(process.env.NEXT_PUBLIC_SITE_URL
        ? { allow: "/", disallow: ["/api/", "/media/"] }
        : { disallow: "/" }),
    },
    sitemap: siteUrl() + "/sitemap.xml",
  };
}
