"use client";

import Image from "next/image";
import { useRef, useState } from "react";

export function Artwork({ src }: { src: string }) {
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);

  return (
    <figure className="artwork" lang="en">
      <div
        className="artwork-stage"
        onPointerEnter={(event) => {
          if (event.pointerType === "mouse") {
            setDismissed(false);
            setOpen(true);
          }
        }}
        onPointerLeave={(event) => {
          if (event.pointerType === "mouse") {
            setOpen(false);
            setDismissed(false);
          }
        }}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget))
            setOpen(false);
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            trigger.current?.focus();
            setOpen(false);
            setDismissed(true);
          }
        }}
      >
        <button
          ref={trigger}
          className="artwork-trigger"
          aria-label="About Monk by the Sea by Caspar David Friedrich"
          aria-expanded={open && !dismissed}
          aria-controls="artwork-label"
          onFocus={(event) => {
            if (event.currentTarget.matches(":focus-visible")) {
              setDismissed(false);
              setOpen(true);
            }
          }}
          onClick={() => {
            setDismissed(false);
            setOpen(true);
          }}
        >
          <Image
            src={src}
            unoptimized={src.startsWith("/media/")}
            alt="A solitary monk on a pale shore beneath a vast, clouded sky and a dark sea."
            width={1555}
            height={1000}
            priority
            sizes="(max-width: 767px) calc(100vw - 48px), 720px"
          />
        </button>
        <div
          id="artwork-label"
          className="artwork-label"
          hidden={!open || dismissed}
        >
          <button
            className="artwork-close"
            aria-label="Close artwork details"
            onClick={() => {
              trigger.current?.focus();
              setOpen(false);
              setDismissed(true);
            }}
          >
            ×
          </button>
          <p className="artwork-artist">Caspar David Friedrich</p>
          <p className="artwork-dates">1774–1840</p>
          <p className="artwork-title">
            <cite>Monk by the Sea</cite>, 1808–1810
          </p>
          <p className="artwork-material">Oil on canvas · 110 × 171.5 cm</p>
          <p className="artwork-description">
            A solitary monk faces the open sea. Friedrich reduces the landscape
            to shore, water and sky, leaving the figure dwarfed by their
            vastness. First exhibited in Berlin in 1810, the painting challenged
            the conventions of landscape painting with its radical simplicity.
          </p>
          <a
            href="https://id.smb.museum/object/965511"
            target="_blank"
            rel="noopener noreferrer"
          >
            Alte Nationalgalerie, Staatliche Museen zu Berlin ↗
          </a>
          <span className="artwork-inventory">NG 9/85</span>
        </div>
      </div>
      <figcaption>
        Caspar David Friedrich, <cite>Monk by the Sea</cite>, 1808–1810
      </figcaption>
    </figure>
  );
}
