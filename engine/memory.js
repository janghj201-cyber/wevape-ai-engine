// 기억·성장 — 모든 직원의 기억 장치 (노션 「기억·성장」 DB)
//   지식 카드: 업계 독서가가 6시간마다 채움 (모두가 꺼내 씀)
//   업무 노트: 각 직원이 근무 후 3줄 (다음 출근 때 먼저 읽음)
//   교훈 카드: 관리자 반려·메모를 10분 안에 감지해 해당 직원 노트로
//   개정 제안: 금요일 각 직원이 자기 정의서에서 바꿀 문장 제안 → 대표실 결재함
// env: NOTION_MEMORY_DB (없으면 department.json 의 memory_db)
import { ask, askJSON } from "./claude.js";
import * as N from "./notion.js";
import { isoWeek, kstNow } from "./org.js";

const DRY = process.env.DRY_RUN === "1";
const dbId = (cfg) => process.env.NOTION_MEMORY_DB || cfg.memory_db;
const NAME = (cfg, id) => cfg.staff[id]?.display || ({ editor: "주간 마케팅 편집장", blog_writer: "블로그 작가", regulation_watcher: "규제 감시자", regulation_reviewer: "규제 검수관", trend_researcher: "쇼츠 트렌드 리서처", upload_recorder: "업로드 기록원", pop_designer: "POP 디자이너", industry_reader: "업계 독서가", panel_poem: "시 읽는 사람" })[id] || id;
const plain = (p) => (p?.rich_text || p?.title || []).map(x => x.plain_text).join("");
const rich = (t) => [{ type: "text", text: { content: String(t ?? "").slice(0, 1900) } }];

function toCard(p) {
  const P = p.properties;
  return { id: p.id, url: p.url, created: p.created_time, title: plain(P["제목"]), type: P["유형"]?.select?.name || "", staff: P["직원"]?.select?.name || "", category: P["분류"]?.select?.name || "",
    lines: (P["라인"]?.multi_select || []).map(x => x.name), stores: (P["지점"]?.multi_select || []).map(x => x.name), tags: (P["태그"]?.multi_select || []).map(x => x.name),
    confidence: P["신뢰도"]?.select?.name || "", status: P["상태"]?.select?.name || "", source: P["출처"]?.url || "", related: P["관련 항목"]?.url || "", week: plain(P["주차"]), summary: plain(P["요약"]) };
}

export async function queryMemory(cfg, filter, limit = 100) {
  if (!dbId(cfg) || DRY) return [];
  const out = []; let cursor;
  do {
    const body = { page_size: 100, sorts: [{ timestamp: "created_time", direction: "descending" }] };
    if (filter) body.filter = filter; if (cursor) body.start_cursor = cursor;
    const r = await N.req("POST", `/databases/${dbId(cfg)}/query`, body);
    out.push(...r.results.map(toCard)); cursor = r.has_more && out.length < limit ? r.next_cursor : null;
  } while (cursor);
  return out.slice(0, limit);
}

export async function createMemory(cfg, { title, type, staff = "공용", category, lines = ["공통"], stores = ["공통"], tags = [], confidence = "보통", status = "활성", source, related, week, summary = "", body = "" }) {
  if (!dbId(cfg)) return { url: "(memory_db 미설정)" };
  const props = { "제목": { title: rich(title) }, "유형": { select: { name: type } }, "직원": { select: { name: staff } }, "라인": { multi_select: lines.map(name => ({ name })) }, "지점": { multi_select: stores.map(name => ({ name })) }, "신뢰도": { select: { name: confidence } }, "상태": { select: { name: status } }, "요약": { rich_text: rich(summary) } };
  if (category) props["분류"] = { select: { name: category } };
  if (tags.length) props["태그"] = { multi_select: tags.map(name => ({ name })) };
  if (source) props["출처"] = { url: source }; if (related) props["관련 항목"] = { url: related }; if (week) props["주차"] = { rich_text: rich(week) };
  return N.req("POST", "/pages", { parent: { database_id: dbId(cfg) }, properties: props, children: N.mdToBlocks(body).slice(0, 95) });
}

// ── 출근 직전 주입: 자기 노트 최근 5 + 자기 교훈 전부 + 관련 지식 카드 ≤15
export async function inject(cfg, staffId, ctx = {}) {
  if (!dbId(cfg) || DRY) return "";
  const me = NAME(cfg, staffId);
  const [notes, lessons, knowledge] = await Promise.all([
    queryMemory(cfg, { and: [{ property: "유형", select: { equals: "업무 노트" } }, { property: "직원", select: { equals: me } }] }, 5),
    queryMemory(cfg, { and: [{ property: "유형", select: { equals: "교훈 카드" } }, { property: "상태", select: { equals: "활성" } }, { or: [{ property: "직원", select: { equals: me } }, { property: "직원", select: { equals: "공용" } }] }] }, 30),
    queryMemory(cfg, { and: [{ property: "유형", select: { equals: "지식 카드" } }, { property: "상태", select: { equals: "활성" } }] }, 120),
  ]);
  const line = ctx.line, stores = ctx.stores || [], topic = (ctx.topic || "").toLowerCase();
  const score = (k) => (line && k.lines.includes(line) ? 3 : 0) + (k.lines.includes("공통") ? 1 : 0) + (stores.some(s => k.stores.includes(s)) ? 3 : 0) + (k.stores.includes("공통") ? 1 : 0)
    + (k.confidence === "높음" ? 2 : k.confidence === "보통" ? 1 : 0) + (topic && (k.title + k.summary).toLowerCase().split(/\s+/).some(w => w.length > 1 && topic.includes(w)) ? 2 : 0) + (k.category === "금지 사례" || k.category === "규제·정책" ? 1 : 0);
  const picked = knowledge.map(k => [score(k), k]).sort((a, b) => b[0] - a[0]).slice(0, ctx.max || 15).map(x => x[1]);
  const fmt = (arr, f) => arr.length ? arr.map(f).join("\n") : "(없음)";
  return [
    `# 기억 (출근 전에 먼저 읽는다)`,
    `## 나의 최근 업무 노트\n${fmt(notes, n => `- [${n.created.slice(0, 10)}] ${n.title} — ${n.summary}`)}`,
    `## 나에게 온 교훈 (관리자 반려·메모에서 나온 것 — 최우선 반영)\n${fmt(lessons, l => `- ${l.title} — ${l.summary}`)}`,
    `## 지식 창고에서 고른 카드 (업계 독서가) ${picked.length}장\n${fmt(picked, k => `- (${k.category}${k.confidence ? "·" + k.confidence : ""}) ${k.title} — ${k.summary}${k.source ? ` [출처: ${k.source}]` : ""}`)}`,
    `규칙: 교훈은 규칙보다 우선한다. 지식 카드는 참고이며 기준서 금지 표현을 정당화하지 못한다. 카드 내용을 그대로 베끼지 말고 우리 매장 문장으로 바꿔 쓴다.`,
  ].join("\n\n");
}

// ── 근무 후 업무 노트 3줄 (무엇을 근거로 / 어떤 판단 / 다음엔 다르게)
export async function note(cfg, staffId, task, result) {
  if (!dbId(cfg) || DRY) return;
  if (!/https?:\/\//.test(result)) return; // 아무것도 만들지 않은 근무는 기록하지 않음
  const me = NAME(cfg, staffId), w = isoWeek(new Date(), cfg.week_offset || 0);
  const j = await askJSON({ system: `당신은 위베이프 AI 조직의 「${me}」입니다. 방금 근무를 마쳤습니다. 다음 출근하는 자신에게 남기는 업무 노트를 씁니다.`, model: "claude-haiku-4-5", max_tokens: 500, dry: {},
    user: `작업: ${task}\n결과 요약:\n${String(result).slice(0, 2500)}\n\nJSON으로: {"title":"한 줄 제목(20자)","summary":"3줄: ①무엇을 근거로 ②어떤 판단을 했고 ③다음엔 무엇을 다르게 (총 200자 이내)","tags":["기기관리|찾아오는길|응대|직영신뢰|외국인|지역행사|사진|해시태그|검색어 중 해당"]}` });
  if (!j.title) return;
  await createMemory(cfg, { title: j.title, type: "업무 노트", staff: me, category: "판단 기록", lines: ["공통"], tags: (j.tags || []).slice(0, 4), week: w, summary: j.summary || "", body: `# ${j.title}\n\n${j.summary}\n\n---\n작업: ${task} · ${kstNow().slice(0, 16)}\n\n\`\`\`\n${String(result).slice(0, 1500)}\n\`\`\`` });
}

// ── 관리자 반려·메모 감지 → 교훈 카드 (해당 직원 + 검수관에게)
export async function detectLessons(cfg) {
  if (!dbId(cfg) || DRY) return "기억 DB 미설정/DRY";
  const items = await N.queryContent(undefined, [{ timestamp: "created_time", direction: "ascending" }]);
  const existing = new Set((await queryMemory(cfg, { property: "유형", select: { equals: "교훈 카드" } }, 300)).map(l => l.related).filter(Boolean));
  const targets = items.filter(i => (i.status === "반려" || (i.memo && i.memo.trim())) && !existing.has(i.url)).slice(-8);
  const out = [];
  for (const it of targets) {
    const author = it.author || "공용";
    const j = await askJSON({ system: "당신은 위베이프 AI 조직의 코치입니다. 관리자(장현진)의 반려·메모를 해당 직원이 다음부터 지킬 수 있는 교훈 한 장으로 바꿉니다. 짧고 구체적으로.", model: "claude-sonnet-4-5", max_tokens: 700, dry: {},
      user: `항목: ${it.title}\n작성자: ${author} · 라인 ${it.line} · 유형 ${it.type} · 상태 ${it.status}\n검수 결과: ${it.review || "-"}\n관리자 메모: ${it.memo || "-"}\n\nJSON: {"title":"교훈 한 줄(25자)","summary":"무엇이 문제였고 다음부터 어떻게 할지 2~3문장(200자)","for_reviewer":"검수관이 앞으로 걸러야 할 기준 1문장(없으면 빈칸)","tags":["해당 태그"]}` });
    if (!j.title) continue;
    await createMemory(cfg, { title: j.title, type: "교훈 카드", staff: author, category: "관리자 교훈", lines: [it.line || "공통"], stores: it.stores?.length ? it.stores : ["공통"], tags: (j.tags || []).slice(0, 4), confidence: "높음", related: it.url, week: it.week, summary: j.summary, body: `# ${j.title}\n\n${j.summary}\n\n- 원문: ${it.title} (${it.status})\n- 관리자 메모: ${it.memo || "-"}\n- 검수 결과: ${it.review || "-"}` });
    if (j.for_reviewer) await createMemory(cfg, { title: `검수 기준 추가: ${j.title}`, type: "교훈 카드", staff: "규제 검수관", category: "관리자 교훈", lines: [it.line || "공통"], confidence: "높음", related: it.url, week: it.week, summary: j.for_reviewer });
    out.push(`${author} ← ${j.title}`);
  }
  return out.length ? `교훈 카드 ${out.length}건\n${out.join("\n")}` : "새 반려·메모 없음";
}

// ── 금요일 자가 점검: 직원별 정의서 개정 제안 → 대표실 결재함(콘텐츠·보고, 승인 대기)
export async function selfReview(cfg) {
  if (!dbId(cfg) || DRY) return "기억 DB 미설정/DRY";
  const w = isoWeek(new Date(), cfg.week_offset || 0); const out = [];
  for (const [id, s] of Object.entries(cfg.staff)) {
    if (s.team === "관점패널") continue;
    const me = NAME(cfg, id);
    const [notes, lessons] = await Promise.all([
      queryMemory(cfg, { and: [{ property: "유형", select: { equals: "업무 노트" } }, { property: "직원", select: { equals: me } }] }, 12),
      queryMemory(cfg, { and: [{ property: "유형", select: { equals: "교훈 카드" } }, { property: "직원", select: { equals: me } }] }, 20),
    ]);
    if (!notes.length && !lessons.length) continue;
    const j = await askJSON({ system: `당신은 위베이프 AI 조직의 「${me}」입니다. 한 주를 돌아보고 자기 정의서에서 고칠 문장을 제안합니다. 정의서:\n${s.text}`, model: s.model || "claude-sonnet-4-5", max_tokens: 900, dry: {},
      user: `이번 주 노트:\n${notes.map(n => `- ${n.title}: ${n.summary}`).join("\n") || "(없음)"}\n\n교훈:\n${lessons.map(l => `- ${l.title}: ${l.summary}`).join("\n") || "(없음)"}\n\nJSON: {"changes":[{"section":"정의서의 어느 항목","before":"현재 문장(그대로 인용, 없으면 '신설')","after":"바꿀 문장","why":"근거(노트·교훈 인용)"}],"skip":false}\n바꿀 게 없으면 {"changes":[],"skip":true}. 최대 2개. 규제를 느슨하게 하는 제안 금지.` });
    if (!j.changes?.length) continue;
    const md = `# 정의서 개정 제안 ${w} — ${me}\n\n${j.changes.map((c, i) => `## ${i + 1}. ${c.section}\n- 현재: ${c.before}\n- 제안: ${c.after}\n- 근거: ${c.why}`).join("\n\n")}\n\n---\n승인되면 관리자가 org/marketing/staff/${s.file.split("/").pop()} 의 해당 문장을 바꿉니다(또는 다음 업데이트 때 반영). 반려면 사유를 관리자 메모에 남겨 주세요 — 교훈 카드로 돌아갑니다.`;
    const p = await N.createContent({ title: `정의서 개정 제안 ${w} — ${me}`, status: "승인 대기", line: "보고", type: "개정 제안", team: s.team, author: me, week: w, basis: `업무 노트 ${notes.length}건 · 교훈 ${lessons.length}건 자가 점검`, body: md });
    await createMemory(cfg, { title: `개정 제안 ${w}: ${j.changes[0].section}`, type: "개정 제안", staff: me, category: "정의서 개정", status: "승인 대기", related: p.url, week: w, summary: j.changes.map(c => c.after).join(" / ").slice(0, 300), body: md });
    out.push(`${me}: ${p.url}`);
  }
  return out.length ? `개정 제안 ${out.length}건 → 결재함\n${out.join("\n")}` : "개정 제안 없음";
}

// ── 업계 독서가: 6시간마다 읽고 지식 카드로 쪼개 넣기
const FOCUS = [
  ["매장 블로그·검색", "네이버 블로그·카페에서 전자담배 매장(직영·오프라인) 글이 어떻게 쓰이는지 — 제목·첫 문장·구조·해시태그·사진 구성. 손님이 실제로 검색하는 표현."],
  ["고객 언어·커뮤니티", "커뮤니티(디시·에펨·클리앙 등)·유튜브 댓글에서 성인 흡연자가 매장·기기 관리·응대에 대해 실제로 쓰는 말과 질문."],
  ["규제·금지 사례", "최근 전자담배 광고·표시 규제 뉴스와, 다른 매장 글에서 규제에 걸릴 표현(제품·맛·니코틴·가격·입문·건강)을 쓴 사례 — 우리가 피할 것으로 기록."],
  ["해외·비주얼·POP", "해외 베이프샵 SNS/유튜브의 매장 소개·POP·카드뉴스 형식, 국내 소상공인 POP 트렌드 — 규제 안에서 가져올 형식만."],
];
export async function industry_reader_read(cfg) {
  const w = isoWeek(new Date(), cfg.week_offset || 0);
  const slot = Math.floor(new Date(Date.now() + 9 * 3600e3).getUTCHours() / 6);
  const day = Math.floor(Date.now() / 86400e3);
  const [focusName, focus] = FOCUS[(day * 4 + slot) % FOCUS.length];
  const recent = DRY ? [] : await queryMemory(cfg, { property: "유형", select: { equals: "지식 카드" } }, 200);
  const known = recent.map(k => k.title).join(" / ").slice(0, 3000);
  const j = await askJSON({ system: (await import("./org.js")).systemPrompt(cfg, "industry_reader", await inject(cfg, "industry_reader", { max: 5 })), tools: ["web_search"], model: cfg.staff.industry_reader.model, max_tokens: 5000,
    dry: { cards: [{ title: "DRY 카드", category: "고객 언어", summary: "테스트", lines: ["블로그"], stores: ["공통"], tags: ["검색어"], confidence: "보통", source: "https://example.com" }] },
    user: `지금 ${kstNow().slice(0, 16)}, 주차 ${w}. 이번 근무 초점: 「${focusName}」 — ${focus}\n웹 검색으로 최근 자료를 최소 6개 이상 읽고, 읽은 것을 지식 카드 8~12장으로 쪼개세요. 이미 있는 카드 제목(중복 금지):\n${known || "(없음)"}\n\nJSON: {"cards":[{"title":"카드 한 줄(30자, 구체적)","category":"고객 언어|글 구조·첫 문장|소재·상황|반응 사례|금지 사례|규제·정책","summary":"다른 직원이 바로 쓸 수 있게 2~4문장(250자). 예문이 있으면 인용","lines":["블로그","POP","SNS","영상","공통"],"stores":["해당 지점 또는 공통"],"tags":["기기관리|찾아오는길|응대|직영신뢰|외국인|지역행사|사진|해시태그|검색어"],"confidence":"높음|보통|낮음","source":"URL"}]}\n규칙: 출처 없는 카드 금지. 제품·맛·니코틴 정보는 카드로 만들지 않는다(금지 사례로만 기록). 카드는 사실과 관찰이지 우리 글 초안이 아니다.` });
  const cards = (j.cards || []).slice(0, 12); const out = [];
  for (const c of cards) {
    if (!c.title || !c.source) continue;
    const p = await createMemory(cfg, { title: c.title, type: "지식 카드", staff: "업계 독서가", category: c.category, lines: c.lines?.length ? c.lines : ["공통"], stores: c.stores?.length ? c.stores : ["공통"], tags: (c.tags || []).slice(0, 4), confidence: c.confidence || "보통", source: c.source, week: w, summary: c.summary || "", body: `# ${c.title}\n\n${c.summary}\n\n- 출처: ${c.source}\n- 초점: ${focusName}\n- 읽은 시각: ${kstNow().slice(0, 16)}` });
    out.push(`${c.title} → ${p.url || ""}`);
  }
  return `독서 근무(${focusName}) 카드 ${out.length}장\n${out.join("\n")}`;
}
