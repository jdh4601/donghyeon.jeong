import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import rehypeSanitize from "rehype-sanitize";
import { Children, isValidElement, type ReactNode } from "react";
import { compactId } from "@/lib/types";

const anchors: Record<string, string> = {
  "40b0690db3a6806ba953d52476906787": "intro",
  "40b0690db3a6804fb3acd7aab2139fb0": "about",
  "40b0690db3a680db8423f227b94cbb71": "manifesto",
  "40b0690db3a680788c24fd1222e3e3f5": "thoughts",
};
function mapLink(href: string, links: Record<string, string>) {
  try {
    const url = new URL(href, "https://app.notion.com");
    if (
      url.hostname.endsWith("notion.com") ||
      url.hostname.endsWith("notion.site") ||
      url.hostname.endsWith("notion.so")
    ) {
      const id = compactId(
        url.pathname.match(/[a-f0-9]{32}|[a-f0-9-]{36}/i)?.[0] ?? "",
      );
      if (id === "40b0690db3a68060bfdac09e21781e4f")
        return url.hash && anchors[compactId(url.hash.slice(1))]
          ? "/#" + anchors[compactId(url.hash.slice(1))]
          : "/";
      if (links[id]) return "/thoughts/" + links[id] + url.hash;
    }
  } catch {
    /* ReactMarkdown applies its own protocol allowlist. */
  }
  return href;
}
function textOf(children: ReactNode): string {
  return Children.toArray(children)
    .map((child) =>
      typeof child === "string" || typeof child === "number"
        ? String(child)
        : isValidElement<{ children?: ReactNode }>(child)
          ? textOf(child.props.children)
          : "",
    )
    .join("");
}
export function normalizeQuotes(markdown: string) {
  return markdown
    .split("\n")
    .map((line) =>
      line.startsWith("> ")
        ? line
            .replace(/^(>\s*)[“"]/, "$1")
            .replace(/[”"](?=\s*(?:[-—]\s*p\.\s*\d+)?\s*$)/, "")
        : line,
    )
    .join("\n");
}
export function Prose({
  markdown,
  links = {},
}: {
  markdown: string;
  links?: Record<string, string>;
}) {
  return (
    <div className="prose">
      <ReactMarkdown
        rehypePlugins={[rehypeRaw, rehypeSanitize]}
        components={{
          a: ({ href = "", children }) => {
            const target = mapLink(href, links);
            const video = target.match(
              /^https:\/\/(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]{11})/,
            );
            if (video)
              return (
                <span className="video-wrap">
                  <iframe
                    title="본문에 첨부된 YouTube 영상"
                    src={`https://www.youtube-nocookie.com/embed/${video[1]}`}
                    loading="lazy"
                    allowFullScreen
                  />
                </span>
              );
            return (
              <a
                href={target}
                {...(target.startsWith("http")
                  ? { target: "_blank", rel: "noreferrer" }
                  : {})}
              >
                {children}
              </a>
            );
          },
          blockquote: ({ children }) => (
            <blockquote>
              <span className="quote-mark" aria-hidden="true">
                “
              </span>
              <div>{children}</div>
            </blockquote>
          ),
          img: ({ src, alt = "" }) =>
            typeof src === "string" ? (
              <img
                className="article-image"
                src={src}
                alt={alt}
                loading="lazy"
              />
            ) : null,
          p: ({ children }) =>
            textOf(children).trim() === "" ? (
              <div className="media-paragraph">{children}</div>
            ) : (
              <p>{children}</p>
            ),
        }}
      >
        {normalizeQuotes(markdown)}
      </ReactMarkdown>
    </div>
  );
}
