export type Article = {
  id: string;
  slug: string;
  title: string;
  date: string | null;
  markdown: string;
  published: boolean;
};
export type HomeContent = {
  intro: string;
  about: string;
  manifesto: { en: string; ko: string }[];
  image: string;
  caption: string;
};
export type ContentSnapshot = {
  syncedAt: string;
  source: string;
  home: HomeContent;
  articles: Article[];
};
export const compactId = (id: string) => id.replaceAll("-", "").toLowerCase();
export function sortArticles(articles: Article[]) {
  return [...articles]
    .filter((a) => a.published)
    .sort(
      (a, b) =>
        (b.date ?? "").localeCompare(a.date ?? "") || a.id.localeCompare(b.id),
    );
}
