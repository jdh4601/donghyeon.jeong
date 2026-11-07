import type { Metadata } from "next";
import { Header } from "@/components/header";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "동현정 — Donghyeon Jeong", template: "%s · 동현정" },
  description: "자신에게 진실하게, 좋아하는 일에 깊이. 동현정의 생각과 기록.",
  robots: process.env.NEXT_PUBLIC_SITE_URL
    ? { index: true, follow: true }
    : { index: false, follow: false },
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko" data-scroll-behavior="smooth">
      <body>
        <a href="#main" className="skip-link">
          본문으로 건너뛰기
        </a>
        <Header />
        {children}
      </body>
    </html>
  );
}
