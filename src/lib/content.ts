import { cache } from "react";
import snapshot from "@/content/snapshot.json";
import type { ContentSnapshot } from "./types";
import { listState, readState } from "./store";
import { compactId } from "./types";

export const getContent = cache(async (): Promise<ContentSnapshot> => {
  const stored = await readState<ContentSnapshot>("content");
  const baseline = stored ?? (snapshot as ContentSnapshot);
  // A live integration must complete its first publication review before serving content.
  if (process.env.NOTION_TOKEN && !stored)
    return {
      ...baseline,
      home: {
        ...baseline.home,
        image: "",
        intro: "",
        about: "",
        manifesto: [],
      },
      articles: [],
    };
  const restrictions = new Set(
    (await listState("restricted:")).map((k) => k.slice("restricted:".length)),
  );
  const root = compactId(
    process.env.NOTION_ROOT_PAGE_ID ?? "40b0690db3a68060bfdac09e21781e4f",
  );
  if (restrictions.has(root))
    return {
      ...baseline,
      home: {
        ...baseline.home,
        image: "",
        intro: "",
        about: "",
        manifesto: [],
      },
      articles: [],
    };
  return {
    ...baseline,
    articles: baseline.articles.filter(
      (a) => !restrictions.has(compactId(a.id)),
    ),
  };
});

export function siteUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(
    /\/$/,
    "",
  );
}
