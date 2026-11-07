import Link from "next/link";
export default function NotFound() {
  return (
    <main id="main" className="content-column not-found">
      <p className="eyebrow">404</p>
      <h1>이 페이지는 여기 없네요.</h1>
      <p>주소가 바뀌었거나, 아직 공개되지 않은 글일 수 있습니다.</p>
      <Link href="/">처음으로 돌아가기 ←</Link>
    </main>
  );
}
