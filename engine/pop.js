// POP 라인 — 시 읽는 사람(관점 패널)이 카피 후보를 내고, POP 디자이너가 고르고 레이아웃을 정한 뒤
// 결정론적 HTML 템플릿으로 렌더 → office/pop/<파일>.html + index.json 갱신 → 노션 페이지(검수중) 생성.
// 규제: 제품·맛·니코틴·가격·입고·입문 표현 금지. 매장 안내·응대·기기 관리(7-1)·직영 신뢰 문구만.
import fs from "node:fs"; import path from "node:path";
import { ask, askJSON } from "./claude.js";
import * as N from "./notion.js";
import { systemPrompt, isoWeek } from "./org.js";
import * as M from "./memory.js";
import { renderPop2, MOOD_KEYS } from "./pop_render.js";
import { genImage, hasImageGen } from "./imagegen.js";
const readOpt = (cfg, f) => { try { return fs.readFileSync(path.join(cfg.dir, f), "utf8"); } catch { return ""; } };
const ROOT = path.resolve(new URL("..", import.meta.url).pathname);
const POP_DIR = path.join(ROOT, "office/pop");
const IDX = path.join(POP_DIR, "index.json");
const readIdx = () => { try { return JSON.parse(fs.readFileSync(IDX, "utf8")); } catch { return []; } };
const esc = (x) => String(x ?? "").replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));

// 스펙 JSON → A4 세로 POP HTML (사람이 보고 바로 인쇄 가능, 브랜드·제품 이미지 없음)
export function renderPop(spec) {
  const p = spec.palette || {}; const bg = p.bg || "#111827", ink = p.ink || "#f9fafb", ac = p.accent || "#f6d365";
  return `<!DOCTYPE html><html lang="ko"><head><meta charset="utf-8"><title>${esc(spec.title)}</title>
<style>@page{size:A4 portrait;margin:0}html,body{margin:0;background:#e5e7eb}
.pop{width:210mm;height:297mm;margin:0 auto;background:${bg};color:${ink};font-family:"Pretendard","Apple SD Gothic Neo","Noto Sans KR",system-ui,sans-serif;display:flex;flex-direction:column;padding:16mm 14mm;position:relative;overflow:hidden}
.pop:before{content:"";position:absolute;inset:6mm;border:1.2mm solid ${ac};border-radius:6mm;opacity:.9}
.tag{position:relative;display:inline-block;background:${ac};color:${bg};font-weight:900;font-size:5.5mm;padding:1.5mm 5mm;border-radius:999px;letter-spacing:.3mm;align-self:flex-start}
h1{position:relative;font-size:${spec.headline_size || 21}mm;line-height:1.12;margin:12mm 0 6mm;font-weight:900;letter-spacing:-.4mm;word-break:keep-all}
h2{position:relative;font-size:8mm;font-weight:600;margin:0 0 10mm;opacity:.9;line-height:1.35;word-break:keep-all}
ul{position:relative;list-style:none;padding:0;margin:auto 0;font-size:7.4mm;line-height:1.5}
li{margin:0 0 6mm;padding-left:10mm;position:relative;word-break:keep-all}
li:before{content:"";position:absolute;left:0;top:3.5mm;width:5.5mm;height:5.5mm;border-radius:50%;background:${ac}}
.foot{position:relative;border-top:.6mm solid ${ac};padding-top:5mm;font-size:4.6mm;line-height:1.5;opacity:.95}
.foot b{font-size:5.4mm}
.law{position:relative;font-size:3.6mm;opacity:.75;margin-top:3mm;line-height:1.4}
.zh{font-size:4.2mm;opacity:.85;margin-top:1mm}
@media print{html,body{background:#fff}}</style></head><body>
<div class="pop">
  <span class="tag">${esc(spec.tag || "위베이프 직영")}</span>
  <h1>${esc(spec.headline)}</h1>
  <h2>${esc(spec.sub || "")}</h2>
  <ul>${(spec.lines || []).slice(0, 5).map(l => `<li>${esc(l)}</li>`).join("")}</ul>
  <div class="foot"><b>${esc(spec.store_name)}</b><br>${esc(spec.store_addr || "")}${spec.store_phone ? ` · ☎ ${esc(spec.store_phone)}` : ""}<div class="zh">${esc(spec.zh || "本店为总公司直营门店 · 库存充足")}</div><div class="law">${esc(spec.law || "본 매장은 성인만 이용할 수 있습니다. 담배는 건강에 해롭습니다.")}</div></div>
</div></body></html>`;
}

// ── POP 디자이너 근무: 승인된 이번 주 기획안 카드(또는 지점 목록)로 POP 최대 N장
export async function pop_designer_make(cfg, maxPops = 2) {
  const w = isoWeek(new Date(), cfg.week_offset || 0);
  const kmon = new Date(Date.now() + 9 * 3600e3).getUTCMonth() + 1;
  const season = [12, 1, 2].includes(kmon) ? "겨울" : kmon <= 5 ? "봄" : kmon <= 8 ? "여름" : "가을";
  const items = await N.queryContent(undefined, [{ timestamp: "created_time", direction: "ascending" }]);
  const donePop = new Set(items.filter(i => i.line === "POP" && i.week === w).flatMap(i => i.stores));
  const plan = items.filter(i => i.type === "기획안" && i.status === "승인" && i.week === w).slice(-1)[0];
  const planT = plan ? (await N.readPageText(plan.id)).slice(0, 4000) : "(이번 주 기획안 없음 — 지점 안내 POP 기본형)";
  const trend = items.filter(i => i.type === "트렌드 보고").slice(-1)[0];
  const trendT = trend ? (await N.readPageText(trend.id)).slice(0, 1500) : "";
  let stores = [];
  try { const r = await fetch(cfg.store_master_url); const j = await r.json(); stores = (j.stores || []).map(s => ({ name: s.store, addr: s.addr, phone: s.phone })); } catch { stores = cfg.stores.map(s => ({ name: s, addr: "", phone: "" })); }
  const norm = (n) => cfg.stores.find(s => (n || "").includes(s)) || n;
  // 강제 재제작: workflow_dispatch memo에 지점명을 넣으면 이미 완료된 지점도 새 버전으로 다시 만든다 (대표 지시·디자인 교체용)
  const force = (process.env.POP_FORCE_STORE || "").trim();
  const todo = force && cfg.stores.includes(force) ? [force] : cfg.stores.filter(s => !donePop.has(s)).slice(0, maxPops);
  if (!todo.length) return `${w} 모든 지점 POP 완료`;
  const out = []; fs.mkdirSync(POP_DIR, { recursive: true }); const idx = readIdx();
  for (const store of todo) {
    const sm = stores.find(s => norm(s.name) === store) || { name: store, addr: "", phone: "" };
    // 1) 관점 패널(시): 카피 후보 5개 — 짧고, 리듬 있고, 매장·응대·기기 관리·직영 신뢰만
    const cands = await askJSON({ system: systemPrompt(cfg, "panel_poem"), model: cfg.staff.panel_poem.model, dry: { candidates: ["오늘도 같은 자리, 같은 사람", "여기 계산점, 문은 늘 열려 있습니다"] },
      user: `${store}점 매장 POP(A4, 매장 문·카운터 부착) 헤드라인 후보 5개를 JSON {"candidates":["..."]}로. 12자 이내, 리듬감, 과장·감탄사 없이. 금지: 제품명·맛·니코틴·가격·할인·입고·'처음'·'시작'·건강 표현. 허용 소재: 직영 신뢰, 재고 안정, 기기 관리 안내, 응대, 동네·위치, 외국인 손님 환영.\n이번 주 기획 맥락:\n${planT.slice(0, 1500)}` });
    // 2) POP 디자이너: 브랜드 가이드 + 후보로 v2 스펙 (무드·2줄 헤드라인·부제·히어로 워드·한글/중국어 한 줄)
    const brand = readOpt(cfg, "brand_guide.md");
    const usedMoods = items.filter(i => i.line === "POP" && i.week === w).map(i => (i.basis.match(/mood=([a-z-]+)/) || [])[1]).filter(Boolean);
    const dsys = systemPrompt(cfg, "pop_designer", await M.inject(cfg, "pop_designer", { line: "POP", stores: [store] }) + `\n\n# 브랜드 비주얼 가이드 (반드시)\n${brand}`);
    const specPrompt = `${store}점 A4 세로 POP 1장 스펙(v2)을 JSON으로:
{"title":"[${store}] 용도 요약","mood":"${MOOD_KEYS.join("|")}","accent":"#hex(무드 팔레트 안에서)","hero_image_url":"기억 카드 중 [브랜드 자산] 기기/로고 이미지 직접 URL(https, png/jpg)이 있으면 그 중 하나, 없으면 빈칸","hero_prompt":"포스터 '전체 배경'이 될 사진 프롬프트(영문 2~3문장). **브랜드 가이드 6-1의 허용 소재 표에서 장면을 먼저 고르고** 무드·조명·계절을 붙인다. 허용: 네온 간판 골목/젖은 아스팔트 반사/상가 야경/유리문 너머 조명/셔터 올린 가게 앞/유리 진열장 반사/카운터 조명/퇴근길 거리/저녁 스카이라인. 장소가 한국 도시 상가 거리임이 드러나야 한다. 지금은 ${kmon}월(${season}). **금지(하나라도 있으면 실격): 음식·음료·디저트(아이스크림/커피/케이크/과일), 동물, 꽃, 사람·손, 제품·패키지, 연기·수증기, 카페·식당으로 오인될 실내, 소재 없는 순수 추상, 글자·로고.** 스스로에게 물어라 — 이 사진이 전자담배 매장 문 앞에 붙어 있을 때 말이 되는가?","tag":"상단 배지 4~6자","headline":["1줄(2~7자, 영문 대문자 또는 한글)","2줄(2~7자)"],"sub":"부제 1줄 22자 이내(지점 위치·상황)","hero_word":"중앙 큰 아웃라인 영문 한 단어(WEVAPE/OPEN/HELLO 등)","kr":"하단 한글 안내 1줄 18자 이내(기기 관리 7-1 또는 응대 또는 직영·재고)","zh":"중국어 1줄(直营·库存充足 의미)","purpose":"부착 위치·용도","check":"기준서 10항목 자체 점검 ○×"}
헤드라인 후보(시 읽는 사람): ${JSON.stringify(cands.candidates || [])} — 후보 중 리듬 있는 것을 2줄로 쪼개거나 다듬어 쓴다. 위치명·지점명만 있는 헤드라인 금지.
이번 주 이미 쓴 무드(중복 금지): ${usedMoods.join(", ") || "없음"}
지점: ${sm.name} / ${sm.addr} / ${sm.phone}
기획 맥락:\n${planT.slice(0, 1200)}\n비주얼 트렌드 메모:\n${trendT.slice(0, 600)}
규칙: 브랜드 가이드의 무드 4종 중 하나. 제품명·맛·니코틴·가격·할인·이벤트·최상급 문구 금지. 글자 수 제한을 지키지 않으면 레이아웃이 깨진다.`;
    // 대표 자료함 이미지를 디자이너가 직접 본다 — 대표가 원하는 결은 글이 아니라 그림으로만 전달된다
    let matImgs = [];
    try {
      if (cfg.materials_page) {
        const urls = await N.pageImages(cfg.materials_page, 4);
        let mi = 0;
        for (const u of urls) { try { const rr = await fetch(u); if (rr.ok) { const pth = `/tmp/pop-material-${mi}.png`; fs.writeFileSync(pth, Buffer.from(await rr.arrayBuffer())); matImgs.push(pth); mi++; } } catch {} }
        if (mi) console.error(`대표 자료함 이미지 ${mi}장을 POP 디자이너에게 첨부`);
      }
    } catch (e) { console.error("자료함 이미지 첨부 생략:", e.message.slice(0, 80)); }
    const matNote = matImgs.length ? `\n\n# 첨부: 대표가 자료함에 직접 올린 이미지 ${matImgs.length}장 — 이것이 대표의 기준선이다\n대표가 "이 정도 결"이라고 보여준 자료다. 직접 보고 다음을 뽑아 스펙에 반영하라.\n- 무엇이 주인공인가(제품인가 공간인가), 어느 크기로 놓였는가\n- 배경 처리·조명·질감·색 대비\n- 글자와 그림의 관계, 여백, 정보 밀도\n- 우리 최근 POP과의 격차는 정확히 무엇인가\n\n**단, 그대로 베끼지 않는다.** 그 자료에는 우리 매장 POP에 쓸 수 없는 것이 섞여 있다 — 맛 이름·당도/쿨링/타격감 수치·니코틴 농도(3% 등)·과일 이미지는 가향표시 금지(국건법 9조의3)와 니코틴 함량 표시 금지에 걸린다. **가져올 것은 "완성도의 수준"이지 "금지된 소재"가 아니다.** 기기 본체·조명·질감·구도·색 대비만 가져온다.` : "";

    let spec = await askJSON({ system: dsys + matNote, images: matImgs, model: cfg.staff.pop_designer.model, max_tokens: 1500,
      dry: { title: `[${store}] 직영 매장 안내 POP`, mood: "glow-dark", accent: "#ff2fd0", tag: "본사 직영", headline: ["같은 자리", "같은 사람"], sub: "본사 대표 직영 매장입니다", hero_word: "WEVAPE", kr: "기기 단자·배터리 점검, 물어보세요", zh: "本店为总公司直营门店 · 库存充足", purpose: "매장 문 부착", check: "○" }, user: specPrompt });
    // 3) 영화 보는 사람(관점 패널·비주얼 전문가): 디자인 리뷰 → 디자이너 1회 수정
    let critique = null;
    if (cfg.staff.panel_film) {
      try {
        critique = await askJSON({ system: systemPrompt(cfg, "panel_film", await M.inject(cfg, "panel_film", { line: "POP", max: 10 }) + `\n\n# 브랜드 비주얼 가이드\n${brand}`), model: cfg.staff.panel_film.model, max_tokens: 800, dry: { verdict: "수정", notes: ["DRY"], fixes: {} },
          user: `POP 디자이너의 스펙입니다. 화면 구성·색·타이포·시선 흐름 관점에서 리뷰하세요. 규제는 보지 말고 "3m 밖에서 한 번에 읽히고 브랜드 결에 맞는가"만.\n${JSON.stringify(spec, null, 1)}\n\nJSON: {"verdict":"통과|수정","notes":["구체적 지적 2~4개(무엇이 약하고 왜)"],"fixes":{"바꿀 필드명":"바꿀 값"}}\nfixes는 스펙 필드명 그대로(headline은 배열). 글자 수 제한 유지.` });
        // 패널 지적을 무조건 반영하지 않는다 — 디자이너에게 반박권이 있고, 갈리면 편집장이 판정한다
        if (critique?.verdict === "수정" && critique.fixes && typeof critique.fixes === "object") {
          const keepHero = spec.hero_prompt;
          let accepted = critique.fixes;
          try {
            const reb = await askJSON({ system: dsys, model: cfg.staff.pop_designer.model, max_tokens: 700,
              dry: { accept: [], object: [] },
              user: `영화 보는 사람이 당신의 스펙을 이렇게 지적했습니다.\n지적: ${(critique.notes || []).join(" / ")}\n요구한 수정: ${JSON.stringify(critique.fixes)}\n\n당신의 스펙:\n${JSON.stringify(spec, null, 1)}\n\n무조건 따를 필요 없습니다. 브랜드 가이드와 이번 지점 맥락에 비추어 판단하세요.\nJSON: {"accept":["받아들일 필드명들"],"object":[{"field":"거부할 필드명","why":"왜 지금 값이 맞는지 근거 1~2줄"}]}\n근거 없이 고집부리지 말고, 근거 없이 굽히지도 마세요.` });
            const objected = (reb.object || []).filter(o => o.field && o.why);
            if (objected.length) {
              // 충돌 — 편집장 판정
              const ruling = await askJSON({ system: systemPrompt(cfg, "editor"), model: cfg.staff.editor.model, max_tokens: 600,
                dry: { winner: {}, why: "DRY" },
                user: `POP 제작 중 충돌입니다. 의장으로서 판정하세요.\n\n지점: ${store}\n영화 보는 사람(비주얼 전문가)의 지적: ${(critique.notes || []).join(" / ")}\n요구 수정: ${JSON.stringify(critique.fixes)}\n\nPOP 디자이너의 반박: ${objected.map(o => `[${o.field}] ${o.why}`).join(" / ")}\n\n판정 기준: 규제 > 브랜드 가이드 > 근거 있는 의견 > 취향. 어느 기준으로 갈랐는지 밝히세요.\nJSON: {"winner":{"필드명":"panel|designer"},"why":"판정 이유 1~2줄"}\n필드마다 누구 손을 들어줄지 정하세요. 양쪽 다 맞다는 답은 금지.` });
              const W = ruling.winner || {};
              accepted = Object.fromEntries(Object.entries(critique.fixes).filter(([k]) => W[k] !== "designer"));
              critique.notes = [...(critique.notes || []), `⚖ 편집장 판정: ${ruling.why || ""} (디자이너 인정 ${Object.values(W).filter(v => v === "designer").length}건)`];
            } else if (reb.accept?.length) {
              accepted = Object.fromEntries(Object.entries(critique.fixes).filter(([k]) => reb.accept.includes(k)));
            }
          } catch (e) { console.error("반박·판정 생략(패널 의견 반영):", e.message.slice(0, 80)); }
          spec = { ...spec, ...accepted };
          if (!spec.hero_prompt && keepHero) spec.hero_prompt = keepHero; // 브랜드 가이드 v0.2: hero_prompt 비우는 수정 금지 — 교체만 허용
        }
      } catch (e) { console.error("panel_film 리뷰 실패:", e.message); }
    }
    if (!MOOD_KEYS.includes(spec.mood)) spec.mood = MOOD_KEYS[(idx.length) % MOOD_KEYS.length];
    spec.store_name = `위베이프 ${store}점`; spec.store_addr = sm.addr; spec.store_phone = sm.phone;
    const devPath = path.join(ROOT, "office/brand/device.png");
    let heroLocal = null, imgReview = null;
    if (hasImageGen() && spec.hero_prompt) {
      // 업종 무관 소재는 코드에서도 막는다 (아이스크림 POP 사고 재발 방지)
      const BAN = ["ice cream","icecream","gelato","dessert","cake","coffee","latte","fruit","food","drink","beverage","cocktail","flower","bouquet","animal","cat","dog","bird","person","people","hand","model","portrait","smoke","vapor","vape device","package","cafe interior","restaurant","bakery"];
      const FALLBACK = `A narrow Korean city shopping street at dusk, rows of small storefront neon signs glowing, wet asphalt reflecting the colored light, low-rise commercial buildings, no signage text legible.`;
      const clean = (p) => { const low = String(p || "").toLowerCase(); const hit = BAN.filter(b => low.includes(b)); if (hit.length) { console.error("히어로 프롬프트 금지 소재 차단:", hit.join(","), "→ 매장 거리 장면으로 대체"); return { prompt: FALLBACK, blocked: hit }; } return { prompt: p, blocked: [] }; };
      const wrap = (p) => `${clean(p).prompt}. Full-bleed vertical A4 poster background photograph of a real place, ${spec.mood} mood, accent color ${spec.accent}. This is the backdrop of a poster for a neighborhood vape shop in Korea — the scene must plausibly be a street, storefront, or shop interior. Cinematic lighting, rich color, keep the upper third relatively calm for a headline overlay. No text or letters, no people, no smoke or vapor, no product packaging, no food or drink.`;
      try {
        fs.mkdirSync(path.join(ROOT, "office/pop/img"), { recursive: true });
        const imgName = `${w}-${store}-${String(idx.length + 1).padStart(2, "0")}.png`;
        const out = path.join(ROOT, "office/pop/img", imgName);
        let ok = await genImage(wrap(spec.hero_prompt), out);
        if (!ok) console.error("이미지 생성 응답에 이미지 없음(텍스트 히어로로 대체)");
        // 영화 보는 사람이 '생성된 실제 이미지'를 눈으로 보고 검수 → 미달이면 개선 프롬프트로 1회 재생성
        if (ok && cfg.staff.panel_film) {
          try {
            imgReview = await askJSON({ system: systemPrompt(cfg, "panel_film"), model: cfg.staff.panel_film.model, max_tokens: 700, images: [out],
              dry: { verdict: "통과", why: "DRY", better_prompt: "" },
              user: `방금 생성된 POP 히어로 이미지입니다(포스터 전체 배경으로 사용). 브랜드 가이드 6-1의 순서대로 보세요.\n① **업종 적합성 — 이 사진이 전자담배 매장 포스터의 배경으로 납득되는가?** 음식·디저트·동물·꽃·사람·다른 업종 실내가 보이면 다른 항목은 볼 것도 없이 재생성입니다. 거리·상가·간판·유리·매장 안 사물이어야 합니다.\n② ${spec.mood} 무드와 포인트색 ${spec.accent}에 맞는가\n③ 지금 계절(${kmon}월·${season})에 맞는가\n④ 3m 밖에서 시선을 잡는 분명한 장면이 있는가(거의 빈 배경이면 재생성)\nJSON: {"verdict":"통과|재생성","why":"한 줄 근거","better_prompt":"재생성이면 문제를 고친 영문 프롬프트 2~3문장 — 반드시 거리·상가·매장 장면으로. 통과면 빈칸"}` });
            if (imgReview?.verdict === "재생성" && imgReview.better_prompt) {
              const ok2 = await genImage(wrap(imgReview.better_prompt), out);
              if (ok2) ok = ok2;
            }
          } catch (e) { console.error("히어로 이미지 비전 검수 실패(1차 이미지 사용):", e.message); }
        }
        if (ok) heroLocal = `img/${imgName}`;
      } catch (e) { console.error("이미지 생성 실패(텍스트 히어로로 대체):", e.message); }
    }
    const deviceUrl = fs.existsSync(devPath) ? "../brand/device.png" : (/^https:\/\/\S+\.(png|jpg|jpeg|webp)(\?\S*)?$/i.test(spec.hero_image_url || "") ? spec.hero_image_url : null);
    const file = `pop/${w}-${store}-${String(idx.filter(p => p.store === store && p.week === w).length + 1).padStart(2, "0")}.html`;
    fs.writeFileSync(path.join(ROOT, "office", file), renderPop2(spec, { deviceUrl, heroFull: heroLocal }));
    // 4) 브라우저 눈: 완성본을 렌더링해 디자이너가 '직접 눈으로' 출고 전 검수 → 1회 수정 후 재렌더
    let shotLocal = null, selfCheck = null;
    try {
      const { snapFile } = await import("./eyes.js");
      fs.mkdirSync(path.join(ROOT, "office/pop/shot"), { recursive: true });
      const shotName = file.replace(/^pop\//, "").replace(/\.html$/, ".png");
      const shotPath = path.join(ROOT, "office/pop/shot", shotName);
      if (await snapFile(path.join(ROOT, "office", file), shotPath)) {
        shotLocal = `pop/shot/${shotName}`;
        selfCheck = await askJSON({ system: dsys, model: cfg.staff.pop_designer.model, max_tokens: 900, images: [shotPath],
          dry: { verdict: "통과", why: "DRY", fixes: {} },
          user: `방금 출고 직전인 ${store}점 POP '완성본 화면'입니다(당신이 만든 것). 실물 포스터를 매장 문 앞에 붙인다고 생각하고: ① **배경 사진이 전자담배 매장 포스터로 납득되는가(업종 무관 소재면 여기서 탈락)** ② 글자가 배경에 묻히지 않는가 ③ 헤드라인이 한눈에 읽히는가 ④ 레이아웃 깨짐·어색한 여백은 없는가 ⑤ 전체 인상이 실물 광고 포스터 수준인가. JSON {"verdict":"통과|수정","why":"한 줄","fixes":{"바꿀 필드":"값"}} — fixes는 스펙 필드만(headline 배열·accent·mood·sub·kr·zh·tag). 배경 이미지는 이 단계에서 못 바꾼다(글·색만).` });
        if (selfCheck?.verdict === "수정" && selfCheck.fixes && typeof selfCheck.fixes === "object") {
          const keepHero2 = spec.hero_prompt;
          spec = { ...spec, ...selfCheck.fixes };
          if (!spec.hero_prompt) spec.hero_prompt = keepHero2;
          fs.writeFileSync(path.join(ROOT, "office", file), renderPop2(spec, { deviceUrl, heroFull: heroLocal }));
          await snapFile(path.join(ROOT, "office", file), shotPath);
        }
      }
    } catch (e) { console.error("완성본 셀프 검수 생략:", e.message.slice(0, 120)); }
    const pageUrl = cfg.pages_url ? `${cfg.pages_url.replace(/\/$/, "")}/${file}` : file;
    const body = `# ${spec.title}\n\n- 용도: ${spec.purpose || ""}\n- 미리보기/인쇄: ${pageUrl}\n- 무드: ${spec.mood} · 포인트 ${spec.accent} · 히어로: ${heroLocal ? "생성 이미지(전체 배경)" : "텍스트"}${imgReview ? `\n- 히어로 이미지 검수(영화 보는 사람): ${imgReview.verdict} — ${imgReview.why || ""}${imgReview.verdict === "재생성" ? " → 개선 프롬프트로 재생성함" : ""}` : ""}${shotLocal ? `\n- 완성본 미리보기(이미지): ${cfg.pages_url ? `${cfg.pages_url.replace(/\/$/, "")}/${shotLocal}` : shotLocal}` : ""}${selfCheck ? `\n- 완성본 셀프 검수(디자이너가 눈으로): ${selfCheck.verdict} — ${selfCheck.why || ""}` : ""}\n- 헤드라인 후보(시 읽는 사람): ${(cands.candidates || []).join(" / ")}\n\n## 카피\n- 배지: ${spec.tag}\n- 헤드라인: ${[].concat(spec.headline).join(" / ")}\n- 부제: ${spec.sub}\n- 히어로 워드: ${spec.hero_word || ""}\n- 한글 안내: ${spec.kr || ""}\n- 중국어: ${spec.zh || ""}\n- 하단: ${spec.store_name} · ${sm.addr} · ${sm.phone}\n\n## 영화 보는 사람 디자인 리뷰\n${critique ? `${critique.verdict} — ${(critique.notes || []).join(" / ")}` : "(패널 미참여)"}\n\n## 디자이너 자체 점검\n${spec.check || ""}\n\n\`\`\`json\n${JSON.stringify(spec, null, 1)}\n\`\`\``;
    const p = await N.createContent({ title: `[${store}] POP — ${[].concat(spec.headline).join(" ")}`, status: "검수중", line: "POP", type: "POP", team: "작성", stores: [store], author: "POP 디자이너", week: w, basis: `${plan ? `기획안 ${w}` : "지점 안내 기본형"} · 시 후보→디자이너→영화 패널 리뷰 · mood=${spec.mood} · 엔진 자동 제작`, body });
    idx.push({ notion_id: p.id, notion_url: p.url, store, week: w, title: [].concat(spec.headline).join(" "), file, t: new Date().toISOString(), status: "검수중" });
    fs.writeFileSync(IDX, JSON.stringify(idx, null, 1));
    out.push(`${store}: ${pageUrl} → ${p.url}`);
  }
  return `POP ${out.length}장 제작 → 검수중\n${out.join("\n")}`;
}
