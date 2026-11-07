"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

const items = [
  { id: "top", label: "Donghyeon Jeong" },
  { id: "about", label: "About" },
  { id: "manifesto", label: "Manifesto" },
  { id: "thoughts", label: "Thoughts" },
];
export function Header() {
  const pathname = usePathname();
  const home = pathname === "/";
  const [active, setActive] = useState("top");
  useEffect(() => {
    if (!home) return;
    let ticking = false;
    const update = () => {
      let current = "top";
      for (const { id } of items) {
        const el = document.getElementById(id);
        if (
          el &&
          el.getBoundingClientRect().top <=
            Math.min(window.innerHeight * 0.33, 220)
        )
          current = id;
      }
      setActive(current);
      ticking = false;
    };
    const scroll = () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(update);
      }
    };
    window.addEventListener("scroll", scroll, { passive: true });
    window.addEventListener("resize", scroll);
    update();
    return () => {
      window.removeEventListener("scroll", scroll);
      window.removeEventListener("resize", scroll);
    };
  }, [home]);
  return (
    <header className="site-header">
      <nav aria-label="주요 섹션">
        {items.map(({ id, label }) => (
          <Link
            key={id}
            href={home ? `#${id}` : `/#${id}`}
            className={home && active === id ? "is-active" : ""}
            aria-current={home && active === id ? "location" : undefined}
            onClick={() => {
              if (home) setActive(id);
            }}
          >
            {label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
