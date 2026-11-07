import type { MetadataRoute } from "next";
import { getContent, siteUrl } from "@/lib/content";
export const dynamic = "force-dynamic";
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const data = await getContent();
  return [
    { url: siteUrl(), lastModified: data.syncedAt },
    ...data.articles
      .filter((a) => a.published)
      .map((a) => ({
        url: `${siteUrl()}/thoughts/${a.slug}`,
        lastModified: data.syncedAt,
      })),
  ];
}
