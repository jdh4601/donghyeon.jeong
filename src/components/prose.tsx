import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import rehypeSanitize from "rehype-sanitize";
import { Children, cloneElement, isValidElement, type ReactNode } from "react";
import { InlinePreview } from "./inline-preview";
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
// Match the phrase itself, leaving the surrounding Notion prose untouched.
export function previewJoker(children: ReactNode): ReactNode {
  return Children.map(children, (child) => {
    if (typeof child === "string") {
      const expression =
        /(배트맨을 향해 [“"']?Hit me![”"']?라고 외치는 조커처럼|조커가 [“"']?Hit me![”"']?라고 외치는 것처럼)/g;
      return child.split(expression).map((part, index) =>
        index % 2 ? (
          <InlinePreview key={index} kind="joker">
            {part}
          </InlinePreview>
        ) : (
          part
        ),
      );
    }
    if (
      isValidElement<{ children?: ReactNode }>(child) &&
      typeof child.type === "string" &&
      !["a", "button", "code"].includes(child.type)
    )
      return cloneElement(child, {}, previewJoker(child.props.children));
    return child;
  });
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
  leadImageWidth,
}: {
  markdown: string;
  links?: Record<string, string>;
  leadImageWidth?: number;
}) {
  const leadingImage = markdown.match(/!\[[^\]]*\]\(([^)]+)\)/)?.[1];
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
            if (/승려[의와] 수수께끼/.test(textOf(children)))
              return (
                <InlinePreview kind="book" href={target}>
                  {children}
                </InlinePreview>
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
                style={
                  leadImageWidth && src === leadingImage
                    ? {
                        width: leadImageWidth,
                        maxWidth: "100%",
                        display: "block",
                        marginInline: "auto",
                      }
                    : undefined
                }
                src={src}
                alt={alt}
                loading="lazy"
              />
            ) : null,
          p: ({ children }) =>
            textOf(children).trim() === "" ? (
              <div className="media-paragraph">{children}</div>
            ) : (
              <p>{previewJoker(children)}</p>
            ),
        }}
      >
        {normalizeQuotes(markdown)}
      </ReactMarkdown>
    </div>
  );
}
