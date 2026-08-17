// POP 라인 — 시 읽는 사람(관점 패널)이 카피 후보를 내고, POP 디자이너가 고르고 레이아웃을 정한 뒤
// 결정론적 HTML 템플릿으로 렌더 → office/pop/<파일>.html + index.json 갱신 → 노션 페이지(검수중) 생성.
// 규제: 제품·맛·니코틴·가격·입고·입문 표현 금지. 매장 안내·응대·기기 관리(7-1)·직영 신뢰 문구만.
import fs from "node:fs"; import path from "node:path";
import { ask, askJSON } from "./claude.js";
import * as N from "./notion.js";
import { systemPrompt, isoWeek } from "./org.js";
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
  const items = await N.queryContent(undefined, [{ timestamp: "created_time", direction: "ascending" }]);
  const donePop = new Set(items.filter(i => i.line === "POP" && i.week === w).flatMap(i => i.stores));
  const plan = items.filter(i => i.type === "기획안" && i.status === "승인" && i.week === w).slice(-1)[0];
  const planT = plan ? (await N.readPageText(plan.id)).slice(0, 4000) : "(이번 주 기획안 없음 — 지점 안내 POP 기본형)";
  const trend = items.filter(i => i.type === "트렌드 보고").slice(-1)[0];
  const trendT = trend ? (await N.readPageText(trend.id)).slice(0, 1500) : "";
  let stores = [];
  try { const r = await fetch(cfg.store_master_url); const j = await r.json(); stores = (j.stores || []).map(s => ({ name: s.store, addr: s.addr, phone: s.phone })); } catch { stores = cfg.stores.map(s => ({ name: s, addr: "", phone: "" })); }
  const norm = (n) => cfg.stores.find(s => (n || "").includes(s)) || n;
  const todo = cfg.stores.filter(s => !donePop.has(s)).slice(0, maxPops);
  if (!todo.length) return `${w} 모든 지점 POP 완료`;
  const out = []; fs.mkdirSync(POP_DIR, { recursive: true }); const idx = readIdx();
  for (const store of todo) {
    const sm = stores.find(s => norm(s.name) === store) || { name: store, addr: "", phone: "" };
    // 1) 관점 패널(시): 카피 후보 5개 — 짧고, 리듬 있고, 매장·응대·기기 관리·직영 신뢰만
    const cands = await askJSON({ system: systemPrompt(cfg, "panel_poem"), model: cfg.staff.panel_poem.model, dry: { candidates: ["오늘도 같은 자리, 같은 사람", "여기 계산점, 문은 늘 열려 있습니다"] },
      user: `${store}점 매장 POP(A4, 매장 문·카운터 부착) 헤드라인 후보 5개를 JSON {"candidates":["..."]}로. 12자 이내, 리듬감, 과장·감탄사 없이. 금지: 제품명·맛·니코틴·가격·할인·입고·'처음'·'시작'·건강 표현. 허용 소재: 직영 신뢰, 재고 안정, 기기 관리 안내, 응대, 동네·위치, 외국인 손님 환영.\n이번 주 기획 맥락:\n${planT.slice(0, 1500)}` });
    // 2) POP 디자이너: 후보 중 선택 + 전체 스펙
    const spec = await askJSON({ system: systemPrompt(cfg, "pop_designer"), model: cfg.staff.pop_designer.model, max_tokens: 1800,
      dry: { title: `[${store}] 직영 매장 안내 POP`, tag: "위베이프 직영", headline: "같은 자리, 같은 사람", sub: "본사 대표 직영 매장입니다", lines: ["기기 관리 무료 점검", "재고 안정 · 취급 폭 넓음", "외국인 손님 환영"], palette: { bg: "#111827", ink: "#f9fafb", accent: "#f6d365" }, zh: "本店为总公司直营门店 · 库存充足", purpose: "매장 문 부착", check: "○" },
      user: `${store}점 A4 세로 POP 1장 스펙을 JSON으로:
{"title":"[${store}] 용도 요약","tag":"상단 작은 배지(6자)","headline":"후보 중 선택 또는 다듬기(12자 이내)","sub":"부제 1줄(22자 이내)","lines":["본문 3~5줄, 각 18자 이내"],"palette":{"bg":"#hex","ink":"#hex","accent":"#hex"},"zh":"중국어 1줄(직영·재고 안정 의미)","purpose":"부착 위치·용도","check":"기준서 10항목 자체 점검 ○×"}
헤드라인 후보: ${JSON.stringify(cands.candidates || [])}
지점: ${sm.name} / ${sm.addr} / ${sm.phone}
기획 맥락:\n${planT.slice(0, 1200)}\n비주얼 트렌드 메모:\n${trendT.slice(0, 600)}
규칙: 색은 매장 조명에서 읽히는 고대비 2색+포인트 1색. 브랜드 로고·제품 이미지 없음(텍스트 POP). 금지어 절대 사용 금지. 필수: 직영 신뢰 문구 1줄, 기기 관리(7-1 범위) 또는 응대 안내 1줄.` });
    spec.store_name = `위베이프 ${store}점`; spec.store_addr = sm.addr; spec.store_phone = sm.phone;
    const file = `pop/${w}-${store}-${String(idx.filter(p => p.store === store && p.week === w).length + 1).padStart(2, "0")}.html`;
    fs.writeFileSync(path.join(ROOT, "office", file), renderPop(spec));
    const pageUrl = cfg.pages_url ? `${cfg.pages_url.replace(/\/$/, "")}/${file}` : file;
    const body = `# ${spec.title}\n\n- 용도: ${spec.purpose || ""}\n- 미리보기/인쇄: ${pageUrl}\n- 헤드라인 후보(시 읽는 사람): ${(cands.candidates || []).join(" / ")}\n\n## 카피\n- 배지: ${spec.tag}\n- 헤드라인: ${spec.headline}\n- 부제: ${spec.sub}\n${(spec.lines || []).map(l => `- ${l}`).join("\n")}\n- 중국어: ${spec.zh || ""}\n- 하단: ${spec.store_name} · ${sm.addr} · ${sm.phone}\n\n## 색\n- 배경 ${spec.palette?.bg} / 글자 ${spec.palette?.ink} / 포인트 ${spec.palette?.accent}\n\n## 디자이너 자체 점검\n${spec.check || ""}\n\n\`\`\`json\n${JSON.stringify(spec, null, 1)}\n\`\`\``;
    const p = await N.createContent({ title: `[${store}] POP — ${spec.headline}`, status: "검수중", line: "POP", type: "POP", team: "작성", stores: [store], author: "POP 디자이너", week: w, basis: `${plan ? `기획안 ${w}` : "지점 안내 기본형"} · 시 읽는 사람 카피 후보 → POP 디자이너 · 엔진 자동 제작`, body });
    idx.push({ notion_id: p.id, notion_url: p.url, store, week: w, title: spec.headline, file, t: new Date().toISOString(), status: "검수중" });
    fs.writeFileSync(IDX, JSON.stringify(idx, null, 1));
    out.push(`${store}: ${pageUrl} → ${p.url}`);
  }
  return `POP ${out.length}장 제작 → 검수중\n${out.join("\n")}`;
}
