// 회사 운영체계 — 스탠드업(매일) · 회고+스코어카드(매주) · 직원별 목표·계획
// 관리자 지시(2026-08-19): 직원들이 스스로 학습·회의·소통·보완하고 목표와 계획을 갖고 100점을 향해 간다.
import fs from "node:fs"; import path from "node:path";
import { ask, askJSON } from "./claude.js";
import * as N from "./notion.js";
import * as M from "./memory.js";
import { systemPrompt, isoWeek, kstNow } from "./org.js";
const ROOT = path.resolve(new URL("..", import.meta.url).pathname);
const DRY = process.env.DRY_RUN === "1";
const readOpt = (cfg, f) => { try { return fs.readFileSync(path.join(cfg.dir, f), "utf8"); } catch { return ""; } };
const NAME = (cfg, id) => cfg.staff[id]?.display || ({ editor: "주간 마케팅 편집장", blog_writer: "블로그 작가", regulation_watcher: "규제 감시자", regulation_reviewer: "규제 검수관", trend_researcher: "쇼츠 트렌드 리서처", upload_recorder: "업로드 기록원", pop_designer: "POP 디자이너", industry_reader: "업계 독서가", panel_poem: "시 읽는 사람", panel_film: "영화 보는 사람", panel_novel: "소설 읽는 사람" })[id] || id;
const staffIds = (cfg) => Object.keys(cfg.staff);

// ── 자동 지표 집계 (콘텐츠·보고 + 기억·성장)
export async function metrics(cfg) {
  const items = DRY ? [] : await N.queryContent(undefined, [{ timestamp: "created_time", direction: "ascending" }]);
  const w = isoWeek(new Date(), cfg.week_offset || 0);
  const wk = items.filter(i => i.week === w);
  const scoreOf = (i) => { const m = (i.memo || "").match(/점수\s*[:：]\s*(\d{1,3})/); return m ? Math.min(100, +m[1]) : (i.status === "승인" || i.status === "발행" ? 70 : i.status === "반려" ? 30 : null); };
  const avg = (arr) => arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : null;
  const blog = wk.filter(i => i.line === "블로그"), pop = wk.filter(i => i.line === "POP");
  const mem = DRY ? [] : await M.queryMemory(cfg, undefined, 400);
  const lessons = mem.filter(k => k.type === "교훈 카드"), knowledge = mem.filter(k => k.type === "지식 카드");
  const repeat = (() => { const t = {}; lessons.forEach(l => { const k = l.title.slice(0, 10); t[k] = (t[k] || 0) + 1; }); return Object.values(t).filter(n => n > 1).length; })();
  const approvedAll = items.filter(i => (i.status === "승인" || i.status === "발행") && (i.line === "블로그" || i.line === "POP"));
  const published = items.filter(i => i.pub_url || i.status === "발행");
  const standups = items.filter(i => i.type === "스탠드업");
  const m = {
    week: w,
    blog_quality: avg(blog.map(scoreOf).filter(x => x != null)) ?? 35,
    pop_quality: avg(pop.map(scoreOf).filter(x => x != null)) ?? 5,
    execution: approvedAll.length ? Math.round(100 * published.length / approvedAll.length) : 0,
    regulation: Math.max(0, 100 - 20 * items.filter(i => /규제|기준서/.test(i.memo || "") && i.status === "반려").length),
    learning: Math.min(100, Math.round(Math.min(60, knowledge.length) + (lessons.length ? Math.max(0, 40 - repeat * 10) : 20))),
    collaboration: Math.min(100, 15 + standups.length * 5 + mem.filter(k => k.type === "목표·계획").length * 3),
    counts: { items: items.length, week_items: wk.length, approved: approvedAll.length, published: published.length, knowledge: knowledge.length, lessons: lessons.length, repeat, standups: standups.length, waiting: items.filter(i => i.status === "승인 대기").length },
  };
  const W = { blog_quality: 25, pop_quality: 20, execution: 15, regulation: 15, learning: 15, collaboration: 10 };
  m.total = Math.round(Object.entries(W).reduce((s, [k, wgt]) => s + (m[k] || 0) * wgt / 100, 0));
  m.weights = W;
  return m;
}

// ── 매일 스탠드업: 각 직원 3줄 → 요청은 상대 직원 노트로 → 한 페이지
export async function daily_standup(cfg) {
  const today = kstNow().slice(0, 10), w = isoWeek(new Date(), cfg.week_offset || 0);
  const items = DRY ? [] : await N.queryContent(undefined, [{ timestamp: "created_time", direction: "ascending" }]);
  if (items.some(i => i.type === "스탠드업" && i.title.includes(today))) return `오늘 스탠드업 이미 있음`;
  const recent = items.slice(-25).map(i => `- [${i.status}] ${i.line}·${i.type} ${i.title} (${i.author})${i.memo ? ` 메모: ${i.memo.slice(0, 80)}` : ""}`).join("\n");
  const ids = staffIds(cfg).filter(id => cfg.staff[id].team !== "관점패널" || id === "panel_film");
  const lines = await Promise.all(ids.map(async id => {
    const me = NAME(cfg, id);
    try {
      const j = await askJSON({ system: systemPrompt(cfg, id, await M.inject(cfg, id, { max: 4 })), model: "claude-haiku-4-5", max_tokens: 500, dry: { today: "DRY", blocked: "", requests: [] },
        user: `아침 스탠드업입니다(${today}, ${w}). 최근 조직 흐름:\n${recent}\n\nJSON: {"today":"오늘 내가 할 것 1줄","blocked":"막힌 것 1줄(없으면 빈칸)","requests":[{"to":"직원 이름(정확히: ${ids.map(x => NAME(cfg, x)).join("/")})","ask":"구체적 요청 1줄"}]}\n요청은 정말 필요한 것만(0~2개).` });
      return { id, me, ...j };
    } catch (e) { return { id, me, today: `(실패 ${e.message.slice(0, 40)})`, blocked: "", requests: [] }; }
  }));
  // 요청 전달: 상대 직원 노트로
  let sent = 0;
  for (const l of lines) for (const r of (l.requests || [])) {
    if (!r.to || !r.ask) continue;
    await M.createMemory(cfg, { title: `요청 from ${l.me}: ${r.ask.slice(0, 40)}`, type: "업무 노트", staff: r.to, category: "판단 기록", week: w, summary: `${l.me}의 요청(${today}): ${r.ask}`, body: `# ${l.me} → ${r.to}\n\n${r.ask}\n\n(스탠드업 ${today})` }); sent++;
  }
  const md = `# 데일리 스탠드업 ${today}\n\n${lines.map(l => `## ${l.me}\n- 오늘: ${l.today || "-"}\n- 막힌 것: ${l.blocked || "없음"}\n${(l.requests || []).map(r => `- 요청 → ${r.to}: ${r.ask}`).join("\n")}`).join("\n\n")}\n\n---\n요청 ${sent}건은 상대 직원의 업무 노트로 전달됨.`;
  const p = await N.createContent({ title: `데일리 스탠드업 ${today}`, status: "승인", line: "보고", type: "스탠드업", team: "편집장", author: "주간 마케팅 편집장", week: w, basis: `${lines.length}명 참석 · 요청 ${sent}건 전달`, body: md });
  return `스탠드업 ${lines.length}명 · 요청 ${sent}건 ${p.url}`;
}

// ── 주간 회고 + 스코어카드 + 직원별 목표·계획
export async function weekly_retro(cfg) {
  const w = isoWeek(new Date(), cfg.week_offset || 0);
  const m = await metrics(cfg);
  const card = readOpt(cfg, "scorecard.md");
  const ids = staffIds(cfg);
  // 1) 각 직원 회고 의견 (병렬)
  const ops = await Promise.all(ids.map(async id => {
    const me = NAME(cfg, id);
    try {
      const j = await askJSON({ system: systemPrompt(cfg, id, await M.inject(cfg, id, { max: 6 })) + `\n\n# 스코어카드\n${card}`, model: cfg.staff[id].model || "claude-sonnet-4-5", max_tokens: 900, dry: { review: "DRY", blocked_by: "", goals: [{ goal: "DRY", plan: "DRY", metric: "" }] },
        user: `주간 회고입니다(${w}). 현재 회사 점수 ${m.total}/100 — 글 ${m.blog_quality} / POP ${m.pop_quality} / 발행 ${m.execution} / 규제 ${m.regulation} / 학습 ${m.learning} / 협업 ${m.collaboration}. 이번 주 집계: ${JSON.stringify(m.counts)}.\nJSON: {"review":"이번 주 내가 잘한 것·못한 것 2문장","blocked_by":"다른 직원/관리자에게 필요한 것 1줄","goals":[{"goal":"다음 주 내 목표 (점수 영역과 연결, 측정 가능하게)","plan":"어떻게(구체 행동 2~3개)","metric":"무엇으로 확인"}]}\n목표는 1~2개. 점수를 올리는 데 내가 기여할 수 있는 영역만.` });
      return { id, me, ...j };
    } catch (e) { return { id, me, review: `(실패)`, blocked_by: "", goals: [] }; }
  }));
  // 2) 목표·계획 저장 (기억·성장, 유형=목표·계획)
  for (const o of ops) for (const g of (o.goals || []).slice(0, 2)) {
    if (!g.goal) continue;
    await M.createMemory(cfg, { title: `${w} 목표: ${g.goal.slice(0, 40)}`, type: "목표·계획", staff: o.me, category: "판단 기록", week: w, summary: `${g.goal} / 계획: ${g.plan} / 확인: ${g.metric}`, body: `# ${g.goal}\n\n- 계획: ${g.plan}\n- 확인: ${g.metric}\n- 회고: ${o.review}` });
  }
  // 3) 편집장 취합 → 스코어카드 페이지
  const opText = ops.map(o => `## ${o.me}\n- 회고: ${o.review}\n- 필요한 것: ${o.blocked_by || "-"}\n${(o.goals || []).map(g => `- 목표: ${g.goal} / 계획: ${g.plan} / 확인: ${g.metric}`).join("\n")}`).join("\n\n");
  const synth = await ask({ system: systemPrompt(cfg, "editor", await M.inject(cfg, "editor", { max: 5 })) + `\n\n# 스코어카드\n${card}`, model: cfg.staff.editor.model, max_tokens: 2500,
    user: `주간 회고를 취합해 「주간 스코어카드 ${w}」를 쓰세요. 구성: 1) 점수 표(영역·점수·지난주 대비·근거) 2) 이번 주 가장 큰 병목 3개와 담당 3) 다음 주 조직 목표 3개(직원 목표를 묶어서) 4) 관리자에게 필요한 것 5) 100점까지의 거리와 다음 10점을 올릴 방법.\n현재 점수: 총 ${m.total} — 글 ${m.blog_quality} / POP ${m.pop_quality} / 발행 ${m.execution} / 규제 ${m.regulation} / 학습 ${m.learning} / 협업 ${m.collaboration}\n집계: ${JSON.stringify(m.counts)}\n\n직원 회고:\n${opText}` });
  // 인력 부족 → 채용 제안 (관리자 결재함)
  try {
    const h = await askJSON({ system: systemPrompt(cfg, "editor", "") + `\n\n# 현재 직원\n${ids.map(i => NAME(cfg, i)).join(", ")}`, model: cfg.staff.editor.model, max_tokens: 900, dry: { hires: [] },
      user: `회고 결과와 병목을 보고, 지금 조직에 없어서 점수가 안 오르는 직무가 있으면 채용 제안을 JSON으로: {"hires":[{"role":"직함(한국어)","why":"어떤 병목을 푸는가(점수 영역 연결)","does":"매일/매주 무엇을 하나 2~3줄","inputs":"무엇을 읽나","outputs":"무엇을 내나","cost":"월 예상 비용(달러, 대략)"}]}\n정말 필요한 것만 0~2명. 기존 직원 정의서 수정으로 되는 건 제안하지 않는다.\n\n${opText.slice(0, 5000)}\n점수: ${JSON.stringify(m)}` });
    for (const hr of (h.hires || []).slice(0, 2)) {
      if (!hr.role) continue;
      await N.createContent({ title: `채용 제안 ${w} — ${hr.role}`, status: "승인 대기", line: "보고", type: "채용 제안", team: "편집장", author: "주간 마케팅 편집장", week: w, basis: `주간 회고 병목 분석 · 관리자 승인 시 정의서 작성·시계 배정`, body: `# 채용 제안: ${hr.role}\n\n- 왜: ${hr.why}\n- 하는 일: ${hr.does}\n- 읽는 것: ${hr.inputs}\n- 내놓는 것: ${hr.outputs}\n- 예상 비용: ${hr.cost}\n\n승인하시면 정의서를 쓰고 근무 시계에 넣습니다. 반려면 사유를 메모에 남겨 주세요.` });
    }
  } catch (e) { console.error("채용 제안 실패:", e.message); }
  const p = await N.createContent({ title: `주간 스코어카드 ${w} — ${m.total}/100`, status: "승인", line: "보고", type: "스코어카드", team: "편집장", author: "주간 마케팅 편집장", week: w, basis: `자동 지표 + 직원 ${ops.length}명 회고 + 편집장 취합 · 총점 ${m.total}`, body: `${synth}\n\n---\n## 원자료\n\`\`\`json\n${JSON.stringify(m, null, 1)}\n\`\`\`\n\n${opText}` });
  fs.mkdirSync(path.join(ROOT, "office"), { recursive: true });
  fs.writeFileSync(path.join(ROOT, "office/score.json"), JSON.stringify({ ...m, at: kstNow().slice(0, 16), url: p.url }, null, 1));
  return `스코어카드 ${w} 총점 ${m.total}/100 · 목표 ${ops.reduce((s, o) => s + (o.goals || []).length, 0)}건 ${p.url}`;
}

// 스냅샷용: 최근 점수 (없으면 즉석 계산)
export async function currentScore(cfg) {
  try { const s = JSON.parse(fs.readFileSync(path.join(ROOT, "office/score.json"), "utf8")); if (Date.now() - new Date(s.at).getTime() < 8 * 86400e3) return s; } catch {}
  try { return { ...(await metrics(cfg)), at: kstNow().slice(0, 16) }; } catch { return null; }
}


// ── 대표실에서 보낸 채점·결재 적용 (workflow_dispatch inputs → 노션)
export async function score_apply(cfg) {
  const id = (process.env.INPUT_PAGE_ID || "").replace(/[^0-9a-f-]/gi, ""); const score = process.env.INPUT_SCORE || ""; const decision = process.env.INPUT_DECISION || ""; const memo = process.env.INPUT_MEMO || "";
  if (!id) return "page_id 없음";
  const items = DRY ? [] : await N.queryContent(undefined);
  const it = items.find(i => i.id.replace(/-/g, "") === id.replace(/-/g, ""));
  const prev = it?.memo ? it.memo + " / " : "";
  const stamp = kstNow().slice(5, 16).replace("T", " ");
  const newMemo = `${prev}${score ? `점수: ${score} ` : ""}${memo ? memo + " " : ""}(대표실 ${stamp})`.trim();
  const patch = { memo: newMemo };
  if (decision === "승인" || decision === "반려") patch.status = decision;
  await N.updateContent(id, patch);
  return `적용: ${it?.title || id} → ${decision || "점수만"} ${score ? score + "점" : ""}`;
}
