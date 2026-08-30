// 기억·성장 — 모든 직원의 기억 장치 (노션 「기억·성장」 DB)
//   지식 카드: 업계 독서가가 6시간마다 채움 (모두가 꺼내 씀)
//   업무 노트: 각 직원이 근무 후 3줄 (다음 출근 때 먼저 읽음)
//   교훈 카드: 관리자 반려·메모를 10분 안에 감지해 해당 직원 노트로
//   개정 제안: 금요일 각 직원이 자기 정의서에서 바꿀 문장 제안 → 대표실 결재함
// env: NOTION_MEMORY_DB (없으면 department.json 의 memory_db)
import fs from "node:fs"; import path from "node:path";
import { ask, askJSON } from "./claude.js";
import * as N from "./notion.js";
import { isoWeek, kstNow } from "./org.js";
const ROOT = path.resolve(new URL("..", import.meta.url).pathname);

const DRY = process.env.DRY_RUN === "1";
const dbId = (cfg) => process.env.NOTION_MEMORY_DB || cfg.memory_db;
const NAME = (cfg, id) => cfg.staff[id]?.display || ({ editor: "주간 마케팅 편집장", blog_writer: "블로그 작가", regulation_watcher: "규제 감시자", regulation_reviewer: "규제 검수관", trend_researcher: "쇼츠 트렌드 리서처", upload_recorder: "업로드 기록원", pop_designer: "POP 디자이너", industry_reader: "업계 독서가", panel_poem: "시 읽는 사람", panel_film: "영화 보는 사람", panel_novel: "소설 읽는 사람", quality_editor: "품질 편집자", risk_watch: "리스크 관리자" })[id] || id;
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
    let r; try { r = await N.req("POST", `/databases/${dbId(cfg)}/query`, body); }
    catch (e) { console.error("기억 조회 실패(빈 기억으로 진행):", String(e.message).slice(0, 120)); return out.slice(0, limit); }
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
  const blocks = N.mdToBlocks(body, 100000);
  const page = await N.req("POST", "/pages", { parent: { database_id: dbId(cfg) }, properties: props, children: blocks.slice(0, 95) });
  for (let i = 95; i < blocks.length; i += 95) { try { await N.req("PATCH", `/blocks/${page.id}/children`, { children: blocks.slice(i, i + 95) }); } catch { break; } }
  return page;
}

// ── 출근 직전 주입: 자기 노트 최근 5 + 자기 교훈 전부 + 관련 지식 카드 ≤15
export async function inject(cfg, staffId, ctx = {}) {
  if (!dbId(cfg) || DRY) return "";
  const me = NAME(cfg, staffId);
  const [notes, lessons, knowledge, goals] = await Promise.all([
    queryMemory(cfg, { and: [{ property: "유형", select: { equals: "업무 노트" } }, { property: "직원", select: { equals: me } }] }, 5),
    queryMemory(cfg, { and: [{ property: "유형", select: { equals: "교훈 카드" } }, { property: "상태", select: { equals: "활성" } }, { or: [{ property: "직원", select: { equals: me } }, { property: "직원", select: { equals: "공용" } }] }] }, 30),
    queryMemory(cfg, { and: [{ property: "유형", select: { equals: "지식 카드" } }, { property: "상태", select: { equals: "활성" } }] }, 120),
    queryMemory(cfg, { and: [{ property: "유형", select: { equals: "목표·계획" } }, { property: "직원", select: { equals: me } }] }, 2),
  ]);
  const line = ctx.line, stores = ctx.stores || [], topic = (ctx.topic || "").toLowerCase();
  const score = (k) => (line && k.lines.includes(line) ? 3 : 0) + (k.lines.includes("공통") ? 1 : 0) + (stores.some(s => k.stores.includes(s)) ? 3 : 0) + (k.stores.includes("공통") ? 1 : 0)
    + (k.confidence === "높음" ? 2 : k.confidence === "보통" ? 1 : 0) + (topic && (k.title + k.summary).toLowerCase().split(/\s+/).some(w => w.length > 1 && topic.includes(w)) ? 2 : 0) + (k.category === "금지 사례" || k.category === "규제·정책" ? 1 : 0);
  const ranked = knowledge.map(k => [score(k), k]).sort((a, b) => b[0] - a[0]);
  const picked = ranked.slice(0, ctx.max || 15).map(x => x[1]);
  // 가장 관련 높은 3장은 본문까지 읽는다 — 요약 한 줄로는 배운 것이 전달되지 않는다 (2026-08-30)
  let deep = "";
  try {
    const top = picked.slice(0, ctx.deep ?? 3);
    const texts = await Promise.all(top.map(async k => { try { return [k, (await N.readPageText(k.id)).slice(0, 1800)]; } catch { return [k, ""]; } }));
    const body = texts.filter(([, t]) => t.trim().length > 60);
    if (body.length) deep = `\n\n## 그중 가장 가까운 ${body.length}장은 원문 그대로 (요약이 아니라 실제로 적어둔 것)\n` +
      body.map(([k, t]) => `### ${k.title}\n${t}`).join("\n\n");
  } catch (e) { console.error("카드 본문 주입 생략:", e.message.slice(0, 60)); }
  let materials = "";
  try { if (cfg.materials_page) { const t = await N.readPageText(cfg.materials_page); if (t.trim().length > 40) materials = t.slice(0, 1500); } } catch {}
  const fmt = (arr, f) => arr.length ? arr.map(f).join("\n") : "(없음)";
  return (materials ? `# 대표 자료함 (대표가 직접 던진 재료 — 교훈 다음으로 무겁게 반영)\n${materials}\n\n` : "") + [
    `# 기억 (출근 전에 먼저 읽는다)`,
    `## 나의 이번 주 목표·계획 (스스로 세운 것 — 오늘 근무가 이 목표에 기여하는지 확인)\n${fmt(goals, g => `- ${g.title} — ${g.summary}`)}`,
    `## 나의 최근 업무 노트\n${fmt(notes, n => `- [${n.created.slice(0, 10)}] ${n.title} — ${n.summary}`)}`,
    `## 나에게 온 교훈 (관리자 반려·메모에서 나온 것 — 최우선 반영)\n${fmt(lessons, l => `- ${l.title} — ${l.summary}`)}`,
    `## 지식 창고에서 고른 카드 (업계 독서가) ${picked.length}장\n${fmt(picked, k => `- (${k.category}${k.confidence ? "·" + k.confidence : ""}) ${k.title} — ${k.summary}${k.source ? ` [출처: ${k.source}]` : ""}`)}${deep}`,
    `규칙: 관리자(대표) 교훈은 규칙보다 우선한다. 같은 지적을 두 번 받으면 조직의 실패다. 지식 카드는 참고이며 기준서 금지 표현을 정당화하지 못한다. 카드 내용을 그대로 베끼지 말고 우리 매장 문장으로 바꿔 쓴다.`,
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
  const targets = items.filter(i => (i.status === "반려" || (i.memo && i.memo.trim())) && !existing.has(i.url)).slice(-12);
  const out = [];
  for (const it of targets) {
    const author = it.author || "공용";
    const j = await askJSON({ system: "당신은 위베이프 AI 조직의 코치입니다. 관리자(장현진)의 반려·메모를 해당 직원이 다음부터 지킬 수 있는 교훈 한 장으로 바꿉니다. 짧고 구체적으로.", model: "claude-sonnet-4-5", max_tokens: 700, dry: {},
      user: `항목: ${it.title}\n작성자: ${author} · 라인 ${it.line} · 유형 ${it.type} · 상태 ${it.status}\n검수 결과: ${it.review || "-"}\n관리자 메모: ${it.memo || "-"}\n\nJSON: {"title":"교훈 한 줄(25자). 관리자가 점수를 매겼으면 제목 앞에 「N점」을 붙인다","summary":"① 관리자가 실제로 쓴 문장을 큰따옴표로 그대로 인용 ② 그 지적이 이 결과물의 어느 대목을 가리키는지 ③ 다음부터 구체적으로 어떻게 할지. 3~4문장(300자). 두루뭉술한 다짐 금지 — '더 잘하겠다' 같은 문장은 쓰지 않는다","for_reviewer":"검수관이 앞으로 걸러야 할 기준 1문장(없으면 빈칸)","tags":["해당 태그"]}\n\n관리자 메모에 점수가 있으면 반드시 살립니다. 이 조직에서 관리자 점수는 유일한 합격선이고, 같은 지적을 두 번 받는 것은 실패로 기록됩니다.` });
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
  ["매장 글 문장·톤", "국내 매장(전자담배·소상공인) 블로그에서 사람 말처럼 읽히는 글 — 첫 문장·문단 호흡·구어체 어미·사람이 나오는 장면·마무리 문장을 실제 발췌로. 딱딱한 안내문과 대비되는 예를 반드시 포함."],
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
  const sysR = (await import("./org.js")).systemPrompt(cfg, "industry_reader", await inject(cfg, "industry_reader", { max: 5 }));
  const 자료 = await gather(cfg, "industry_reader", sysR, `지금 ${kstNow().slice(0, 16)}, 주차 ${w}. 이번 근무 초점: 「${focusName}」 — ${focus}`);
  const j = await askJSON({ system: sysR, model: cfg.staff.industry_reader.model, max_tokens: 5000,
    dry: { cards: [{ title: "DRY 카드", category: "고객 언어", summary: "테스트", lines: ["블로그"], stores: ["공통"], tags: ["검색어"], confidence: "보통", source: "https://example.com" }] },
    user: `방금 당신이 읽고 적어온 자료입니다.\n\n${String(자료).slice(0, 14000)}\n\n초점: 「${focusName}」 — ${focus}\n이미 있는 카드 제목(중복 금지):\n${known || "(없음)"}\n\n위 자료만 근거로 지식 카드 8~12장을 만드세요.\n\nJSON: {"cards":[{"title":"카드 한 줄(30자, 구체적)","category":"고객 언어|글 구조·첫 문장|소재·상황|반응 사례|금지 사례|규제·정책","summary":"다른 직원이 바로 쓸 수 있게 2~4문장(250자). 자료에 있던 문장·수치를 인용","lines":["블로그","POP","SNS","영상","공통"],"stores":["해당 지점 또는 공통"],"tags":["기기관리|찾아오는길|응대|직영신뢰|외국인|지역행사|사진|해시태그|검색어"],"confidence":"높음|보통|낮음","source":"위 자료의 주소를 그대로 복사"}]}\n\n**절대 규칙**: source는 위 자료에 실제로 적힌 주소만 씁니다. 자료에 없는 주소를 기억으로 지어내면 그 카드는 폐기되고 근무는 실패로 기록됩니다. 자료가 「검색 실패」뿐이면 cards를 빈 배열로 두세요 — 빈손이 거짓말보다 낫습니다.\n제품·맛·니코틴 정보는 카드로 만들지 않습니다(금지 사례로만). 매 근무 「글 구조·첫 문장」 카드 2장 이상을 실제 문장 발췌(20~60자 인용)와 함께.` });
  const cards = (j.cards || []).slice(0, 12); const out = []; let dropped = 0;
  for (const c of cards) {
    if (!c.title || !c.source) continue;
    if (!(await sourceAlive(c.source))) { dropped++; console.error(`출처 확인 실패로 카드 폐기: ${c.title} / ${c.source}`); continue; }
    const p = await createMemory(cfg, { title: c.title, type: "지식 카드", staff: "업계 독서가", category: c.category, lines: c.lines?.length ? c.lines : ["공통"], stores: c.stores?.length ? c.stores : ["공통"], tags: (c.tags || []).slice(0, 4), confidence: c.confidence || "보통", source: c.source, week: w, summary: c.summary || "", body: `# ${c.title}\n\n${c.summary}\n\n- 출처: ${c.source}\n- 초점: ${focusName}\n- 읽은 시각: ${kstNow().slice(0, 16)}` });
    out.push(`${c.title} → ${p.url || ""}`);
  }
  return `독서 근무(${focusName}) 카드 ${out.length}장${dropped ? ` (출처 확인 실패 ${dropped}장 폐기)` : ""}\n${out.join("\n")}`;
}



// ── 학습 2단계 — 2026-08-30 관리자 지적으로 신설
// 문제: 한 번의 호출에서 "웹 검색해라 + JSON만 출력해라"를 동시에 시키면, JSON 요구가 검색을 눌러
//       모델이 검색을 건너뛰고 아는 것으로 카드를 쓴다. 거기에 "출처 없는 카드 금지"까지 붙으면
//       출처를 지어낸다. 실제로 존재하지 않는 도메인이 지식 카드 출처로 다수 저장돼 있었다.
// 해결: ① 검색만 하는 호출(평문, JSON 요구 없음) → ② 그 결과 '자료'만 근거로 카드를 만드는 호출(도구 없음).
//       2단계에는 도구를 주지 않으므로 1단계에서 안 읽은 것은 쓸 재료가 없다.
async function gather(cfg, staffId, sys, brief) {
  if (DRY) return "[DRY 자료]";
  const raw = await ask({ system: sys, tools: ["web_search"], model: cfg.staff[staffId].model, max_tokens: 6000,
    user: `${brief}

지금은 **읽기만 하는 시간**입니다. 카드를 만들지 마세요. JSON도 쓰지 마세요.
웹 검색을 실제로 6회 이상 수행하고, 읽은 자료를 아래 형식의 평문으로 그대로 옮기세요.

[자료 N]
- 제목:
- 주소: (검색 결과에 뜬 실제 URL 그대로. 기억으로 URL을 만들어 쓰지 마세요)
- 읽은 내용: 원문에 실제로 적혀 있던 사실·수치·문장을 3~6줄. 인용은 따옴표로.

검색이 안 되거나 결과가 부실하면 "[검색 실패]"라고 그대로 쓰세요. 지어내지 마세요 — 빈손으로 돌아오는 편이 낫습니다.` });
  return raw;
}

// 카드에 붙은 출처가 실제로 열리는지 확인한다. 안 열리면 그 카드는 버린다.
const BAD_HOST = /hugedomains|afternic|sedo|dan\.com|godaddy.*(?:auction|broker)|buy.?this.?domain|domain.?for.?sale/i;
// 출처 확인 결과를 세 가지로 나눈다. "확인 불가"와 "가짜"는 완전히 다른 것이다.
//   ok      — 실제로 열렸다
//   dead    — 도메인이 없거나(DNS) 404이거나 매물 페이지다 → 지어낸 출처일 가능성
//   unknown — 차단·타임아웃·403 등. 우리가 못 읽은 것이지 가짜라는 뜻이 아니다 → 절대 카드를 내리지 않는다
async function checkSource(url) {
  if (!/^https?:\/\//i.test(String(url || ""))) return { v: "ok", why: "내부 출처" };
  try {
    const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 12000);
    const r = await fetch(url, { redirect: "follow", signal: ctrl.signal,
      headers: { "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36", "accept-language": "ko,en;q=0.8" } });
    clearTimeout(t);
    if (BAD_HOST.test(r.url)) return { v: "dead", why: `매물 도메인으로 이동: ${r.url.slice(0, 80)}` };
    if (r.status === 404 || r.status === 410) return { v: "dead", why: `HTTP ${r.status}` };
    if (!r.ok) return { v: "unknown", why: `HTTP ${r.status}` };   // 403·429·503 등은 차단일 뿐
    const body = (await r.text()).slice(0, 4000);
    if (BAD_HOST.test(body)) return { v: "dead", why: "매물 안내 페이지" };
    return { v: "ok", why: "" };
  } catch (e) {
    const m = String(e.message || e);
    if (/ENOTFOUND|getaddrinfo|Name or service not known|EAI_AGAIN/i.test(m)) return { v: "dead", why: `도메인 없음 (${m.slice(0, 40)})` };
    return { v: "unknown", why: m.slice(0, 60) };                  // 타임아웃·네트워크 차단
  }
}
async function sourceAlive(url) { return (await checkSource(url)).v !== "dead"; }

// ── 관점 패널 자습: 각자 관점의 전문가로서 매일 읽고 카드로 남긴다 (관리자 지시: 시키지 않아도 스스로 공부)
const PANEL_STUDY = {
  panel_film:  ["디자인·비주얼", "① 최근 포스터·키비주얼·매장 POP·타이포·컬러·레이아웃 사례(국내외) — 특히 '전자담배 매장'·'베이프샵' 오프라인 포스터·간판·매장 사진이 실제로 어떻게 생겼는지 ② 우리 브랜드 자산 찾기: 위베이프(wevape)·버블몬(bubblemon) 공식 사이트·네이버 플레이스·인스타그램 주소와 공식 이미지·로고·기기 사진 URL을 웹에서 찾아 카드로(제목 앞에 [브랜드 자산], summary에 주소·이미지 직접 URL) — 관리자가 주지 않아도 스스로 확보 ③ 우리 무드 4종(glow-dark/pop-purple/holo-pastel/sky-pastel)에 어떻게 붙는지 ④ 첨부로 받은 이미지는 반드시 직접 보고 관찰을 기록."],
  panel_novel: ["이야기·장면", "사람이 나와서 좋았던 동네 가게·브랜드 콘텐츠, 쇼츠 내러티브 구조, 손님 인물 유형과 실제 상황·표현. 장면 예문 인용."],
  panel_poem:  ["카피·리듬", "짧고 리듬 있는 헤드라인·간판·POP 문구 사례(국내외), 대구·반복·여백이 살아 있는 한 줄들. 예문 인용, 왜 읽히는지."],
};
export async function panel_study(cfg) {
  const w = isoWeek(new Date(), cfg.week_offset || 0); const out = [];
  for (const [id, [cat, focus]] of Object.entries(PANEL_STUDY)) {
    if (!cfg.staff[id]) continue;
    const me = NAME(cfg, id);
    const mine = DRY ? [] : await queryMemory(cfg, { and: [{ property: "유형", select: { equals: "지식 카드" } }, { property: "직원", select: { equals: me } }] }, 120);
    const known = mine.map(k => k.title).join(" / ").slice(0, 2500);
    const seenSources = new Set(mine.map(k => (k.source || "").split("?")[0]).filter(Boolean));
    // 영화 보는 사람은 '직접 눈으로' 본다: 브랜드 참고 포스터 2장(교대) + 우리가 만든 최신 히어로 이미지
    let imgs = [], imgNote = "";
    if (id === "panel_film") {
      try {
        const refDir = path.join(ROOT, "office/brand/ref");
        const refs = fs.readdirSync(refDir).filter(f => /\.(jpe?g|png|webp)$/i.test(f)).sort();
        const day = Math.floor(Date.now() / 86400e3);
        const pick = refs.length ? [refs[day % refs.length], refs[(day + 5) % refs.length]].filter((v, i, a) => a.indexOf(v) === i) : [];
        imgs = pick.map(f => path.join(refDir, f));
        const heroDir = path.join(ROOT, "office/pop/img");
        const heroes = fs.existsSync(heroDir) ? fs.readdirSync(heroDir).filter(f => f.endsWith(".png")).sort() : [];
        if (heroes.length) imgs.push(path.join(heroDir, heroes[heroes.length - 1]));
        imgNote = `\n첨부 이미지: 브랜드 참고 포스터 ${pick.join(", ")}${heroes.length ? ` + 우리 엔진이 최근 생성한 히어로 이미지(${heroes[heroes.length - 1]})` : ""}. 첨부를 직접 보고 — 참고 포스터에서 색·타이포·구도·피사체 처리의 구체 관찰 카드를, 그리고 우리 생성 이미지가 참고 대비 무엇이 부족한지(피사체 유무·밀도·계절감·조명) 비교 카드를 최소 2장 만든다. 이런 카드의 source는 "repo:office/brand/ref/파일명" 형식으로 쓴다.`;
        // 자료함: 대표가 직접 올린 이미지를 최우선으로 본다
        try {
          if (cfg.materials_page) {
            const urls = await N.pageImages(cfg.materials_page, 5);
            let mi = 0;
            for (const u of urls) { try { imgs.unshift(await N.saveImage(u, `/tmp/material-${mi}`)); mi++; } catch (e) { console.error("자료 이미지 건너뜀:", e.message.slice(0, 60)); } }
            if (mi) imgNote += `\n최우선 첨부: 대표가 자료함에 직접 올린 이미지 ${mi}장 — 대표가 "이 정도 결"이라고 보여준 기준선이다. 가장 무겁게 관찰해 카드로 남긴다(source는 "자료함"). 관찰 항목: 무엇이 주인공이고 어느 크기인가 / 배경·조명·질감 / 글자와 그림의 관계 / 정보 밀도 / **우리 최근 결과물과의 격차가 정확히 무엇인가**. 단, 그 자료에 있는 맛 이름·당도·쿨링·타격감 수치·니코틴 농도·과일 이미지는 우리 POP에 쓸 수 없다(가향표시 금지). 가져올 것은 완성도의 수준이지 금지된 소재가 아니다 — 이 구분을 카드에 명시한다.`;
          }
        } catch (e) { console.error("자료함 이미지 생략:", e.message.slice(0, 80)); }
        // 자료함 링크: 대표가 URL만 던져도 조직이 스스로 열어보고 분석한다 (이미 카드로 남긴 주소는 건너뜀)
        try {
          if (cfg.materials_page) {
            const mt = await N.readPageText(cfg.materials_page);
            const urls = [...new Set((mt.match(/https?:\/\/[^\s)\]]+/g) || []).map(u => u.replace(/[.,)\]]+$/, "")))]
              .filter(u => !seenSources.has(u.split("?")[0])).slice(0, 2);
            const { snapUrl } = await import("./eyes.js");
            let li = 0;
            for (const u of urls) {
              const out = `/tmp/material-link-${li}.png`;
              if (await snapUrl(u, out)) { imgs.push(out); imgNote += `\n자료함 링크 ${li + 1}: ${u} — 화면을 직접 보고, 화면에 찍힌 제목·문구·반응 수치를 그대로 읽어 관찰 카드로 남기세요. 이 카드의 source는 "${u}" 로 적습니다(같은 주소를 다시 분석하지 않기 위함).`; li++; }
            }
          }
        } catch (e) { console.error("자료함 링크 눈 생략:", e.message.slice(0, 80)); }
        // 브라우저 눈: 네이버 이미지 검색 화면을 통째로 찍어 실물 사례를 직접 보게 (playwright 설치된 잡에서만)
        try {
          const { snapUrl } = await import("./eyes.js");
          const QUERIES = ["전자담배 매장 포스터", "베이프샵 매장 디자인", "매장 POP 디자인 사례", "네온 포스터 디자인"];
          const q = QUERIES[day % QUERIES.length];
          const naverShot = "/tmp/naver-eyes.png";
          if (await snapUrl(`https://search.naver.com/search.naver?where=image&query=${encodeURIComponent(q)}`, naverShot)) {
            imgs.push(naverShot);
            imgNote += `\n추가 첨부: 네이버 이미지 검색 「${q}」 결과 화면 — 지금 실제로 유통되는 사례들을 눈으로 관찰하고, 규제 안에서 우리 POP에 가져올 형식·색·구도만 카드로 만든다(제품·맛·가격 표현은 금지 사례로만). 이런 카드의 source는 "naver-image:${q}"로 쓴다.`;
          }
        } catch (e) { console.error("네이버 눈 생략:", e.message.slice(0, 100)); }
      } catch (e) { console.error("panel_film 이미지 첨부 실패:", e.message); }
    }
    try {
      const sysP = (await import("./org.js")).systemPrompt(cfg, id, await inject(cfg, id, { max: 5 }));
      const 자료 = await gather(cfg, id, sysP, `지금 ${kstNow().slice(0, 16)}, 주차 ${w}. 자습 시간입니다. 초점: ${focus}`);
      const j = await askJSON({ system: sysP, model: cfg.staff[id].model, max_tokens: 4500, images: imgs,
        dry: { cards: [{ title: `DRY ${me}`, summary: "t", lines: ["공통"], tags: [], confidence: "보통", source: "https://example.com" }] },
        user: `방금 당신이 읽고 적어온 자료입니다.\n\n${String(자료).slice(0, 12000)}\n\n초점: ${focus}${imgNote}\n이미 있는 카드 제목(중복 금지):\n${known || "(없음)"}\n\n위 자료와 첨부 이미지만 근거로 지식 카드 6~10장을 만드세요.\n\nJSON: {"cards":[{"title":"카드 한 줄(30자, 구체적)","summary":"다른 직원이 바로 쓸 수 있게 2~4문장(250자). 자료의 예문·수치·색값을 인용","lines":["블로그","POP","SNS","영상","공통"],"tags":["해당 태그"],"confidence":"높음|보통|낮음","source":"위 자료의 주소를 그대로 복사, 또는 첨부를 본 카드면 repo:경로·자료함·naver-image:질의"}]}\n\n**절대 규칙**: source는 위 자료에 실제로 적힌 주소이거나, 첨부 이미지를 직접 본 카드의 내부 출처만 씁니다. 기억으로 주소를 지어내면 그 카드는 폐기됩니다. 자료가 「검색 실패」뿐이고 첨부도 없으면 cards를 빈 배열로 두세요.\n제품·맛·니코틴·연기·인물 사진 소재 금지. 카드는 관찰과 근거이지 우리 초안이 아닙니다.` });
      let n = 0;
      let dropped = 0;
      for (const c of (j.cards || []).slice(0, 10)) { if (!c.title || !c.source) continue;
        if (!(await sourceAlive(c.source))) { dropped++; console.error(`출처 확인 실패로 카드 폐기: ${c.title} / ${c.source}`); continue; }
        await createMemory(cfg, { title: c.title, type: "지식 카드", staff: me, category: cat, lines: c.lines?.length ? c.lines : ["공통"], tags: (c.tags || []).slice(0, 4), confidence: c.confidence || "보통", source: c.source, week: w, summary: c.summary || "", body: `# ${c.title}\n\n${c.summary}\n\n- 출처: ${c.source}\n- 자습 초점: ${cat}\n- ${kstNow().slice(0, 16)}` }); n++; }
      out.push(`${me}: 카드 ${n}장${dropped ? ` (출처 확인 실패 ${dropped}장 폐기)` : ""}`);
    } catch (e) { out.push(`${me}: 실패 ${e.message.slice(0, 80)}`); }
  }
  return `관점 패널 자습\n${out.join("\n")}`;
}

// ── 기억 감사 (memory:audit) — 2026-08-30 신설
// 이미 쌓인 지식 카드의 출처를 실제로 열어보고, 안 열리는 카드는 상태를 「출처 불명」으로 내린다.
// inject()는 상태=활성인 카드만 주입하므로, 내려간 카드는 그 즉시 직원들 눈에서 사라진다.
// 지우지는 않는다 — 나중에 출처가 되살아나면 되돌릴 수 있어야 하고, 무엇이 왜 걸렸는지 대표가 봐야 한다.
export async function memory_audit(cfg, maxCheck = 80) {
  if (!dbId(cfg) || DRY) return "기억 DB 미설정";

  // 0) 먼저 우리 자신을 검사한다. 확실히 살아 있는 주소 3개가 다 안 열리면
  //    그것은 카드가 가짜인 게 아니라 이 실행 환경이 밖으로 못 나가는 것이다. 그때는 아무것도 건드리지 않는다.
  const CONTROL = ["https://www.shopify.com/blog/retail-signage", "https://namu.wiki", "https://www.naver.com"];
  const ctrl = await Promise.all(CONTROL.map(u => checkSource(u)));
  if (!ctrl.some(c => c.v === "ok")) {
    console.error("기억 감사 중단 — 대조군이 전부 실패:", ctrl.map((c, i) => `${CONTROL[i]} → ${c.v}(${c.why})`).join(" / "));
    return "기억 감사 중단 — 이 실행 환경에서 외부 주소를 열 수 없습니다(카드 문제 아님). 아무 카드도 건드리지 않았습니다.";
  }

  // 1) 되돌리기 — 이전 감사에서 잘못 내려간 카드가 있으면 먼저 되살린다
  const held = await queryMemory(cfg, { and: [{ property: "유형", select: { equals: "지식 카드" } }, { property: "상태", select: { equals: "출처 불명" } }] }, 400);
  let restored = 0;
  for (const k of held) {
    const c = await checkSource(k.source);
    if (c.v === "dead") continue;                                  // 진짜 죽은 것만 그대로 둔다
    try { await N.req("PATCH", `/pages/${k.id}`, { properties: { "상태": { select: { name: "활성" } } } }); restored++; }
    catch (e) { console.error("복구 실패:", k.title, e.message.slice(0, 50)); }
  }

  // 2) 활성 카드 검사 — "확인 불가"는 절대 내리지 않는다
  const all = await queryMemory(cfg, { and: [{ property: "유형", select: { equals: "지식 카드" } }, { property: "상태", select: { equals: "활성" } }] }, 800);
  const todo = all.filter(k => /^https?:\/\//i.test(k.source || "")).slice(0, maxCheck);
  const dead = [], seen = new Map(); let unknown = 0;
  for (const k of todo) {
    const key = k.source.split("?")[0];
    if (!seen.has(key)) seen.set(key, await checkSource(k.source));
    const c = seen.get(key);
    if (c.v === "dead") dead.push([k, c.why]);
    else if (c.v === "unknown") unknown++;
  }
  for (const [k, why] of dead) {
    try { await N.req("PATCH", `/pages/${k.id}`, { properties: { "상태": { select: { name: "출처 불명" } }, "요약": { rich_text: rich(`[출처 확인 실패: ${why}] ${k.summary}`) } } }); }
    catch (e) { console.error("카드 상태 변경 실패:", k.title, e.message.slice(0, 60)); }
  }
  const byStaff = {}; for (const [k] of dead) byStaff[k.staff] = (byStaff[k.staff] || 0) + 1;
  const line = Object.entries(byStaff).map(([st, n]) => `${st} ${n}장`).join(" · ") || "없음";
  const msg = `기억 감사: ${todo.length}장 확인 · 출처 불명 ${dead.length}장 내림 (${line}) · 확인 불가 ${unknown}장은 그대로 둠${restored ? ` · 이전에 잘못 내려간 ${restored}장 복구` : ""}`;
  console.error(msg);
  if (dead.length || restored) {
    const w = isoWeek(new Date(), cfg.week_offset || 0);
    await N.createContent({
      title: `기억 감사 ${kstNow().slice(0, 10)} — 불명 ${dead.length}장 / 복구 ${restored}장`,
      status: "승인 대기", line: "보고", type: "보고서", team: "편집장", author: "관리자", week: w,
      basis: `지식 카드 ${todo.length}장 출처 확인 · ${kstNow()}`, review: msg.slice(0, 200),
      body: `# 기억 감사\n\n${msg}\n\n판정 기준은 셋입니다. **도메인이 없거나 404이거나 매물 페이지로 넘어가면** 「출처 불명」으로 내립니다. **차단·타임아웃(403·429·연결 실패)은 우리가 못 읽은 것이지 가짜라는 뜻이 아니므로** 그대로 둡니다.\n\n${dead.length ? `## 내려간 카드\n${dead.map(([k, why]) => `- (${k.staff}) ${k.title}\n  - 출처: ${k.source}\n  - 사유: ${why}`).join("\n")}` : "## 내려간 카드\n없음"}\n\n${restored ? `## 복구한 카드 ${restored}장\n이전 감사에서 차단·타임아웃을 가짜로 잘못 판정해 내렸던 카드들입니다. 다시 활성으로 되돌렸습니다.` : ""}\n\n(${kstNow().slice(0, 16)})`,
    });
  }
  return msg;
}

