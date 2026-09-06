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

// 페이지를 '읽고 본다' — 스크린샷 + 본문 텍스트 + (유튜브면) 자막까지.
// 대표가 자료함에 링크만 던져도 조직이 스스로 열어보게 하기 위한 장비. (2026-09-06)
export async function watchUrl(url, outShot, { width = 1280, height = 1500, wait = 5000 } = {}) {
  let b = null;
  try {
    b = await launch();
    const pg = await b.newPage({ viewport: { width, height }, locale: "ko-KR" });
    await pg.goto(url, { waitUntil: "domcontentloaded", timeout: 35000 });
    await pg.waitForTimeout(wait);

    const meta = await pg.evaluate(() => {
      const g = (n) => document.querySelector(`meta[property="og:${n}"],meta[name="${n}"]`)?.content || "";
      return { title: document.title || g("title"), desc: g("description"), site: g("site_name"), img: g("image") };
    });

    let text = "";
    try {
      text = await pg.evaluate(() => {
        const drop = ["nav", "header", "footer", "script", "style", "noscript"];
        const root = document.querySelector("article,main") || document.body;
        const c = root.cloneNode(true);
        drop.forEach(t => c.querySelectorAll(t).forEach(e => e.remove()));
        return (c.innerText || "").replace(/\n{3,}/g, "\n\n").trim();
      });
    } catch {}

    // 유튜브면 자막을 펼쳐서 가져온다 (로그인 없이 되는 범위)
    let transcript = "";
    if (/youtube\.com|youtu\.be/.test(url)) {
      try {
        await pg.evaluate(() => {
          const b = [...document.querySelectorAll("button")]
            .find(b => /스크립트 표시|Show transcript/.test(b.getAttribute("aria-label") || b.textContent || ""));
          b?.scrollIntoView(); b?.click();
        });
        await pg.waitForTimeout(3500);
        transcript = await pg.evaluate(() => {
          const els = [...document.querySelectorAll("*")].filter(e => e.children.length === 0
            && /^\d+:\d\d$/.test(e.textContent.trim())
            && e.closest("ytd-engagement-panel-section-list-renderer"));
          const rows = els.map(e => { let p = e; for (let i = 0; i < 6; i++) { p = p.parentElement; if (p?.innerText && p.innerText.trim().length > e.textContent.trim().length + 3) break; } return (p?.innerText || "").replace(/\s+/g, " ").trim(); });
          return [...new Set(rows)].join("\n");
        });
      } catch {}
    }

    if (outShot) { try { await pg.screenshot({ path: outShot }); } catch {} }
    await b.close();
    return { url, meta, text: (text || "").slice(0, 9000), transcript: (transcript || "").slice(0, 9000),
             shot: outShot && fs.existsSync(outShot) ? outShot : null };
  } catch (e) {
    console.error("브라우저 눈(watchUrl) 실패:", e.message.slice(0, 140));
    try { await b?.close(); } catch {}
    return null;
  }
}
