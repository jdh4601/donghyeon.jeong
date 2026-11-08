"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

export function InlinePreview({
  kind,
  href,
  children,
}: {
  kind: "book" | "joker";
  href?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ left: 12, top: 12 });
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pinned = useRef(false);
  const id = useId();
  function cancelClose() {
    if (timer.current) clearTimeout(timer.current);
  }
  function close() {
    cancelClose();
    pinned.current = false;
    setOpen(false);
  }
  function leave() {
    cancelClose();
    if (!pinned.current) timer.current = setTimeout(() => setOpen(false), 180);
  }
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  useEffect(() => {
    if (!open) return;
    function place() {
      const anchor = trigger.current?.getBoundingClientRect();
      const box = panel.current?.getBoundingClientRect();
      if (!anchor || !box) return;
      const below = anchor.bottom + 10;
      const top =
        below + box.height <= document.documentElement.clientHeight - 12
          ? below
          : Math.max(12, anchor.top - box.height - 10);
      setPosition({
        left: Math.max(
          12,
          Math.min(
            anchor.left,
            document.documentElement.clientWidth - box.width - 12,
          ),
        ),
        top,
      });
    }
    function outside(event: PointerEvent) {
      if (
        event.target instanceof Node &&
        !trigger.current?.contains(event.target) &&
        !panel.current?.contains(event.target)
      )
        close();
    }
    function escape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        close();
        trigger.current?.focus();
      }
    }
    place();
    const observer = new ResizeObserver(place);
    if (panel.current) observer.observe(panel.current);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);
  return (
    <>
      <button
        ref={trigger}
        type="button"
        className="inline-preview-trigger"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        aria-haspopup="dialog"
        onPointerEnter={(event) => {
          if (event.pointerType === "mouse") {
            cancelClose();
            setOpen(true);
          }
        }}
        onPointerLeave={leave}
        onClick={() => {
          cancelClose();
          if (pinned.current) close();
          else {
            pinned.current = true;
            setOpen(true);
          }
        }}
      >
        {children}
      </button>
      {open &&
        createPortal(
          <div
            ref={panel}
            id={id}
            role="dialog"
            aria-label={
              kind === "book"
                ? "승려와 수수께끼 도서 소개"
                : "다크 나이트 영화 소개"
            }
            className={`inline-preview-panel inline-preview-${kind}`}
            style={position}
            onPointerEnter={cancelClose}
            onPointerLeave={leave}
            onFocusCapture={() => {
              cancelClose();
              pinned.current = true;
            }}
          >
            <button
              type="button"
              className="inline-preview-close"
              aria-label="미리보기 닫기"
              onClick={() => {
                close();
                trigger.current?.focus();
              }}
            >
              ×
            </button>
            {kind === "book" ? (
              <>
                <div className="book-preview-heading">
                  <img
                    src="/previews/monk-and-riddle.jpg"
                    alt="승려와 수수께끼 책 표지"
                    width="78"
                    height="112"
                  />
                  <div>
                    <strong>승려와 수수께끼</strong>
                    <span>랜디 코미사</span>
                    <span>이콘</span>
                    {href && <a href={href}>읽은 글 보기 ↗</a>}
                  </div>
                </div>
                <div className="book-preview-summary">
                  <p>창업가 레니와의 대화로 일과 성공의 의미를 묻는다.</p>
                  <p>
                    돈을 번 뒤 삶을 시작하려는 ‘미뤄 놓은 인생 설계’를 돌아본다.
                  </p>
                  <p>결과보다 사랑하는 일과 과정의 가치를 이야기한다.</p>
                </div>
              </>
            ) : (
              <>
                <img
                  className="joker-preview-image"
                  src="/previews/joker-hit-me.jpg"
                  alt="배트맨을 향해 Come on, hit me!라고 외치는 조커"
                  width="1954"
                  height="1170"
                />
                <div className="joker-preview-caption">
                  <strong>The Dark Knight</strong>
                  <span>2008 · Directed by Christopher Nolan</span>
                </div>
              </>
            )}
          </div>,
          document.body,
        )}
    </>
  );
}
