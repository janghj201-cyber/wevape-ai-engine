// 브라우저 눈 — 헤드리스 크롬으로 '사람이 보는 화면'을 직접 본다 (조직의 장비)
// 용도 ① 네이버 등 검색 결과 화면 스크린샷 → 패널이 실물 사례를 눈으로 관찰
//     ② 완성된 POP HTML을 렌더링해 스크린샷 → 디자이너가 출고 전 자기 결과물을 눈으로 검수
// playwright 미설치 환경(대부분의 poll 잡)에서는 조용히 null 반환 — 워크플로가 필요한 잡에서만 설치한다.
import fs from "node:fs";

async function launch() {
  const { chromium } = await import("playwright");
  return chromium.launch({ args: ["--no-sandbox", "--disable-dev-shm-usage"] });
}

// 웹 페이지 화면 스크린샷 (검색 결과 등)
export async function snapUrl(url, out, { width = 1280, height = 1700, wait = 4500 } = {}) {
  let b = null;
  try {
    b = await launch();
    const pg = await b.newPage({ viewport: { width, height }, locale: "ko-KR" });
    await pg.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
    await pg.waitForTimeout(wait);
    await pg.screenshot({ path: out });
    await b.close();
    return fs.existsSync(out) ? out : null;
  } catch (e) { console.error("브라우저 눈(snapUrl) 실패:", e.message.slice(0, 140)); try { await b?.close(); } catch {} return null; }
}

// 로컬 HTML(완성 POP) 렌더링 스크린샷 — .pop 요소만 정확히 담는다
export async function snapFile(htmlPath, out, { width = 900, height = 1273 } = {}) {
  let b = null;
  try {
    b = await launch();
    const pg = await b.newPage({ viewport: { width, height }, deviceScaleFactor: 1.2 });
    await pg.goto("file://" + htmlPath, { waitUntil: "load", timeout: 20000 });
    await pg.waitForTimeout(3000); // 웹폰트·이미지 로드
    const el = await pg.$(".pop");
    await (el || pg).screenshot({ path: out });
    await b.close();
    return fs.existsSync(out) ? out : null;
  } catch (e) { console.error("브라우저 눈(snapFile) 실패:", e.message.slice(0, 140)); try { await b?.close(); } catch {} return null; }
}
