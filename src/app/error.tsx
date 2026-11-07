"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main id="main" className="content-column not-found">
      <h1>잠시 읽어오지 못했습니다.</h1>
      <p>잠시 후 다시 방문해 주세요.</p>
      <button onClick={reset}>다시 불러오기</button>
    </main>
  );
}
