import Link from "next/link";
import { getContent } from "@/lib/content";
import { sortArticles } from "@/lib/types";
import { Prose } from "@/components/prose";
import { Socials } from "@/components/socials";
import { Artwork } from "@/components/artwork";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";
export default async function Home() {
  const data = await getContent();
  if (!data.home.image) notFound();
  const articles = sortArticles(data.articles);
  const links = Object.fromEntries(
    articles.map((a) => [a.id.replaceAll("-", ""), a.slug]),
  );
  return (
    <main id="main" className="home content-column">
      <section id="top" aria-label="바닷가의 수도승" className="hero">
        <Artwork src={data.home.image} />
      </section>
      <section
        id="intro"
        className="text-section intro-section"
        aria-label="소개"
      >
        <h1 className="sr-only">Donghyeon Jeong</h1>
        <Prose markdown={data.home.intro} links={links} />
      </section>
      <section id="about" className="text-section">
        <h2>About</h2>
        <Prose markdown={data.home.about} links={links} />
        <Socials />
      </section>
      <section id="manifesto" className="text-section">
        <h2>Manifesto</h2>
        <ol className="principles">
          {data.home.manifesto.map((p, i) => (
            <li key={p.en}>
              <span className="principle-number" aria-hidden="true">
                {String(i + 1).padStart(2, "0")}
              </span>
              <div>
                <p lang="en" className="principle-en">
                  {p.en}
                </p>
                <p className="principle-ko">{p.ko}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>
      <section id="thoughts" className="text-section thoughts">
        <h2>Thoughts</h2>
        <ul className="article-list">
          {articles.map((a) => (
            <li key={a.id}>
              <Link href={"/thoughts/" + a.slug}>
                <span>{a.title}</span>
                {a.date && (
                  <time dateTime={a.date}>{a.date.replaceAll("-", ". ")}</time>
                )}
              </Link>
            </li>
          ))}
        </ul>
      </section>
      <footer className="site-footer">
        <form
          className="newsletter-form"
          action="https://hynfinity.substack.com/api/v1/free?nojs=true"
          method="post"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="뉴스레터 구독"
        >
          <input type="hidden" name="source" value="embed" />
          <label className="sr-only" htmlFor="newsletter-email">
            이메일 주소
          </label>
          <input
            id="newsletter-email"
            name="email"
            type="email"
            placeholder="Your email"
            autoComplete="email"
            inputMode="email"
            required
          />
          <button type="submit" title="Substack에서 구독 계속하기">
            Subscribe
          </button>
        </form>
      </footer>
    </main>
  );
}
