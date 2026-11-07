import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getContent } from "@/lib/content";
import { Prose } from "@/components/prose";
import { siteUrl } from "@/lib/content";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ slug: string }> };
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const { articles } = await getContent();
  const a = articles.find((a) => a.slug === slug && a.published);
  if (!a) return { title: "글을 찾을 수 없습니다", robots: { index: false } };
  const description = a.markdown
    .replace(/<[^>]+>|[>#*\[\]()`]/g, "")
    .slice(0, 150);
  return {
    title: a.title,
    description,
    alternates: { canonical: `${siteUrl()}/thoughts/${a.slug}` },
    openGraph: {
      title: a.title,
      description,
      type: "article",
      ...(a.date ? { publishedTime: a.date } : {}),
    },
  };
}
export default async function ArticlePage({ params }: Props) {
  const { slug } = await params;
  const { articles } = await getContent();
  const a = articles.find((a) => a.slug === slug && a.published);
  if (!a) notFound();
  const links = Object.fromEntries(
    articles
      .filter((a) => a.published)
      .map((a) => [a.id.replaceAll("-", ""), a.slug]),
  );
  return (
    <main id="main" className="article-page content-column">
      <article>
        <header className="article-header">
          <Link className="back-link" href="/#thoughts">
            ← Thoughts
          </Link>
          <h1>{a.title}</h1>
          {a.date && (
            <time dateTime={a.date}>{a.date.replaceAll("-", ". ")}</time>
          )}
        </header>
        <Prose markdown={a.markdown} links={links} />
      </article>
      <footer className="article-footer">
        <Link href="/#thoughts">← 모든 생각으로 돌아가기</Link>
        <a href="#main">위로 ↑</a>
      </footer>
    </main>
  );
}
