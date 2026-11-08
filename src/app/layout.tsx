import type { Metadata } from "next";
import { Header } from "@/components/header";
import "./globals.css";

const description = "무엇을 중요하게 여기고, 어디에 시간을 쓰는지 기록합니다.";

export const metadata: Metadata = {
  title: { default: "Donghyeon Jeong", template: "%s · Donghyeon Jeong" },
  description,
  openGraph: {
    title: "Donghyeon Jeong",
    siteName: "Donghyeon Jeong",
    description,
  },
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
