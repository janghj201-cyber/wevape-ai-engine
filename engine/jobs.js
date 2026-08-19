// 직원별 작업 — 정의서를 system 프롬프트로, 노션을 기억으로 사용
import { ask, askJSON } from "./claude.js";
import * as N from "./notion.js";
import { systemPrompt, isoWeek, kstNow } from "./org.js";
import { pop_designer_make } from "./pop.js";
import * as M from "./memory.js";
import * as C from "./company.js";

let WEEK_OFFSET = 0; const week = () => isoWeek(new Date(), WEEK_OFFSET);
const byWeek = (items, w) => items.filter(i => i.week === w);
const latest = (items, pred) => items.filter(pred).sort((a, b) => b.created.localeCompare(a.created))[0];

import fs from "node:fs"; import path from "node:path";
const readOpt = (cfg, f) => { try { return fs.readFileSync(path.join(cfg.dir, f), "utf8"); } catch { return ""; } };
async function ctx() {  const items = await N.queryContent(undefined, [{ timestamp: "created_time", direction: "ascending" }]); return { items, w: week() }; }
async function storeMaster(cfg) {
  try { const r = await fetch(cfg.store_master_url); const j = await r.json(); return (j.stores || []).map(s => `${s.store} · ${s.addr} · ${s.phone}`).join("\n"); }
  catch { return "(허브 지점 정보 조회 실패 — 카드의 주소를 그대로 사용)"; }
}
const summarize = (items, n = 12) => items.slice(-n).map(i => `- [${i.status}] ${i.type} · ${i.title} · ${i.author} · ${i.week}${i.memo ? ` · 관리자메모: ${i.memo.slice(0, 120)}` : ""}${i.review ? ` · 검수: ${i.review.slice(0, 100)}` : ""}`).join("\n");

// ── 이슈조사: 주간 이슈 브리핑
export async function regulation_watcher_brief(cfg) {
  const { items, w } = await ctx();
  if (byWeek(items, w).some(i => i.type === "이슈 브리핑")) return `이미 ${w} 브리핑 있음 — 건너뜀`;
  const prev = latest(items, i => i.type === "이슈 브리핑");
  const prevText = prev ? await N.readPageText(prev.id) : "(없음)";
  const body = await ask({ system: systemPrompt(cfg, "regulation_watcher", await M.inject(cfg, "regulation_watcher")), tools: ["web_search"], model: cfg.staff.regulation_watcher.model,
    user: `오늘 ${kstNow()}, 주차 ${w}. 지난 7일간 (a) 담배사업법·국민건강증진법·전자담배 규제/단속 뉴스 (b) 네이버·메타·유튜브 담배 정책 변경 (c) '위베이프' 매장 언급을 웹 검색으로 조사하고, 이슈 모니터 https://znsl132-lang.github.io/BIGLUCKY/feeds.json 도 확인 시도하세요.\n지난주 브리핑:\n${prevText.slice(0, 3000)}\n\n출력(마크다운): # 주간 이슈 브리핑 ${w}\n## ① 새로 생긴 금지·주의 사항 (무엇/언제부터/블로그 영향/확신도: 확정·회색지대)\n## ② 시행 예정 D-day\n## ③ 매장 언급 중 대응 필요\n## ④ 기준서 갱신 제안\n## ⑤ 출처 URL\n긴급(발행 중단 필요)이면 첫 줄에 [긴급].` });
  const urgent = /^\s*\[긴급\]/.test(body);
  const p = await N.createContent({ title: `${urgent ? "[긴급] " : ""}주간 이슈 브리핑 ${w}`, status: "승인 대기", line: "기획", type: "이슈 브리핑", team: "이슈조사", author: "규제 감시자", week: w, basis: "엔진 자동 실행 · 웹 조사 + 이슈 모니터", body });
  return `이슈 브리핑 ${w} 생성 ${p.url}`;
}

// ── 트렌드조사: 주간 트렌드 보고
export async function trend_researcher_report(cfg) {
  const { items, w } = await ctx();
  if (byWeek(items, w).some(i => i.type === "트렌드 보고")) return `이미 ${w} 트렌드 보고 있음 — 건너뜀`;
  const pub = items.filter(i => i.status === "발행").slice(-10).map(i => `- ${i.title} (${i.pub_url || "URL 미기입"})`).join("\n") || "(발행 기록 없음)";
  const body = await ask({ system: systemPrompt(cfg, "trend_researcher", await M.inject(cfg, "trend_researcher")), tools: ["web_search"], model: cfg.staff.trend_researcher.model,
    user: `오늘 ${kstNow()}, 주차 ${w}. 지난 7~14일 반응 좋은 (a) 동네 가게·소상공인 콘텐츠 (b) 매장 일상·직원 브이로그 형식 (c) 인천·부천 지역 콘텐츠·행사 (d) 카드뉴스·POP 비주얼 흐름을 조사. 제품·맛·니코틴 트렌드 금지.\n최근 발행:\n${pub}\n\n출력(마크다운): # 주간 트렌드 보고 ${w}\n## 소재 10개 (각: 제목 / ①무엇이 통했나 / ②우리 매장 버전 / ③잘 붙는 라인 / ④규제 위험 메모 / ⑤출처)\n## 편집장에게 한 줄` });
  const p = await N.createContent({ title: `주간 트렌드 보고 ${w}`, status: "승인 대기", line: "기획", type: "트렌드 보고", team: "트렌드조사", author: "쇼츠 트렌드 리서처", week: w, basis: "엔진 자동 실행 · 웹 조사", body });
  return `트렌드 보고 ${w} 생성 ${p.url}`;
}

// ── 편집장: 기획 회의 (병렬 의견 → 취합) + 회의록
export async function editor_meeting(cfg) {
  const { items, w } = await ctx();
  if (byWeek(items, w).some(i => i.title.startsWith("기획 회의록"))) return `이미 ${w} 회의록 있음`;
  const brief = latest(items, i => i.type === "이슈 브리핑"), trend = latest(items, i => i.type === "트렌드 보고");
  const briefT = brief ? await N.readPageText(brief.id) : "(없음)", trendT = trend ? await N.readPageText(trend.id) : "(없음)";
  const lastPlan = latest(items, i => i.type === "기획안");
  const context = `주차 ${w}. 이슈 브리핑:\n${briefT.slice(0, 2500)}\n\n트렌드 보고:\n${trendT.slice(0, 2500)}\n\n지난 기획안: ${lastPlan ? `${lastPlan.title} [${lastPlan.status}] 관리자 메모: ${lastPlan.memo || "없음"}` : "없음"}\n최근 결과물:\n${summarize(items)}\n지점: ${cfg.stores.join("·")}`;
  const roles = [
    ["regulation_watcher", "이번 주 블로그에서 반드시 피할 표현·주제 3개(이유), 권장 준법 문장 1개, 지시문 규칙 1개. 300자."],
    ["trend_researcher", "이번 주 블로그 소재·형식 3개(어느 지점), 지역 행사와 잘 붙는 지점 3개, 사진 형식 1개. 350자."],
    ["blog_writer", `9지점(${cfg.stores.join("·")}) 각 주제·각도·유형(리뷰형/후기형) 1안을 표로. 지난주와 다른 각도. 지시문에 넣을 규칙 1개.`],
    ["regulation_reviewer", "지난주 반려·수정 사유 중 이번 주 지시문에 넣을 규칙 3개, 자동 반려 단어, 작가 주의 1개. 300자."],
  ];
  const opinions = await Promise.all(roles.map(async ([id, task]) => [id, await ask({ system: systemPrompt(cfg, id, await M.inject(cfg, id)), model: cfg.staff[id].model, user: `기획 회의 참석 의견을 내세요.\n${context}\n\n요청: ${task}` })]));
  const opText = opinions.map(([id, t]) => `## ${id} 의견\n${t}`).join("\n\n");
  const minutes = await ask({ system: systemPrompt(cfg, "editor", await M.inject(cfg, "editor")), model: cfg.staff.editor.model,
    user: `월요일 기획 회의를 진행했습니다. 아래 의견을 취합 규칙(규제 > 브랜드 > 의견 > 취향)으로 정리해 「기획 회의록 ${w}」를 마크다운으로 쓰세요: 참석, 각자 의견 요약, 채택/기각과 이유, 결정 사항. 관리자 지난 반려 사유는 최우선 반영.\n${context}\n\n${opText}` });
  const p = await N.createContent({ title: `기획 회의록 ${w} (월 09:00 자동 회의)`, status: "승인", line: "보고", type: "보고서", team: "편집장", author: "주간 마케팅 편집장", week: w, basis: `참석: ${roles.map(r => r[0]).join(", ")} 병렬 의견 → 편집장 취합`, body: minutes });
  return `회의록 ${w} 생성 ${p.url}`;
}

// ── 편집장: 주간 기획안 (회의록 기반)
export async function editor_plan(cfg) {
  const { items, w } = await ctx();
  if (byWeek(items, w).some(i => i.type === "기획안")) return `이미 ${w} 기획안 있음`;
  const minutes = latest(items, i => i.title.startsWith("기획 회의록") && i.week === w);
  const mT = minutes ? await N.readPageText(minutes.id) : "(회의록 없음 — 단독 기획)";
  const lastPlan = latest(items, i => i.type === "기획안");
  const body = await ask({ system: systemPrompt(cfg, "editor", await M.inject(cfg, "editor")), model: cfg.staff.editor.model,
    user: `「주간 기획안 ${w}」를 마크다운으로 작성. 구성: 1 공통 방침(근거 인용) / 2 금지·주의 표현 / 3 지점 카드 9장 — 각 카드를 "- [우선순위] 지점 | 주제 | 각도 | 유형(리뷰형/후기형) | 넣을 것 | 넣지 말 것" 한 줄 형식으로(파싱용) / 4 작성팀 지시문(코드블록) / 5 밀린 항목 / 6 관리자 확인 필요. 지난 기획안 반려 사유가 있으면 맨 위에 반영 명시.\n회의록:\n${mT.slice(0, 5000)}\n지난 기획안: ${lastPlan ? `${lastPlan.title} [${lastPlan.status}] 메모: ${lastPlan.memo || "없음"}` : "없음"}\n지점: ${cfg.stores.join("·")}` });
  const p = await N.createContent({ title: `주간 기획안 ${w}`, status: "승인 대기", line: "기획", type: "기획안", team: "편집장", author: "주간 마케팅 편집장", week: w, basis: `기획 회의록 ${w} / 이슈 브리핑 / 트렌드 보고`, body });
  return `기획안 ${w} 생성(승인 대기) ${p.url}`;
}

// ── 작가: 승인된 기획안 카드로 글 작성 (최대 N편)
export async function blog_writer_write(cfg, maxPosts = 3) {
  const { items, w } = await ctx();
  const plan = latest(items, i => i.type === "기획안" && i.status === "승인" && i.week === w);
  if (!plan) return `승인된 ${w} 기획안 없음 — 대기`;
  const planT = await N.readPageText(plan.id);
  const done = new Set(byWeek(items, w).filter(i => i.line === "블로그").flatMap(i => i.stores));
  const cards = await askJSON({ system: "당신은 기획안에서 지점 카드를 추출하는 파서입니다.", model: cfg.staff.upload_recorder.model, dry: [],
    user: `아래 기획안에서 지점 카드를 JSON 배열로 추출: [{"priority":1,"store":"연수","topic":"","angle":"","type":"리뷰형|후기형","must":"","avoid":""}]. 지점명은 다음 중 하나로 정규화: ${cfg.stores.join(", ")}.\n\n${planT.slice(0, 6000)}` });
  const todo = cards.filter(c => !done.has(c.store)).sort((a, b) => a.priority - b.priority).slice(0, maxPosts);
  if (!todo.length) return `${w} 모든 지점 글 작성 완료`;
  const stores = await storeMaster(cfg); const out = [];
  const tone = readOpt(cfg, "tone_guide.md"), samples = readOpt(cfg, "tone_samples.md");
  const toneBlock = `\n\n# 톤 가이드 (반드시)\n${tone}${samples ? `\n\n# 우리 톤 표본 (관리자가 직접 쓴 글 — 문장 호흡을 이대로)\n${samples.slice(0, 6000)}` : ""}`;
  for (const c of todo) {
    const sys = systemPrompt(cfg, "blog_writer", await M.inject(cfg, "blog_writer", { line: "블로그", stores: [c.store], topic: `${c.topic} ${c.angle}` }) + toneBlock);
    const spec = `출력(마크다운): 첫 줄 "# [지점명] 제목"(톤 가이드 제목 규격) / 본문 1,500~2,000자 모바일 문단 / 📷 사진 지시 8~12개(시간대·위치·카메라 높이·피사체·빼야 할 것) / 하단 신뢰형 고정 멘트 + 준법 문장 + 주소·전화 / 해시태그 6~8개 / "## 작가 자체 점검" 10항목 ○×.`;
    const draft = await ask({ system: sys, model: cfg.staff.blog_writer.model, max_tokens: 7000,
      user: `기획안 ${w} 카드로 블로그 글 1편 초안을 쓰세요. 안내문이 아니라 사람 말로.\n카드: ${JSON.stringify(c, null, 0)}\n지점 정보(허브 원본, 그대로 사용):\n${stores}\n\n${spec}` });
    // 대화 단계: 업계 독서가가 초안을 읽고 딱딱한 문장·방향을 돌려준다 → 작가가 고쳐 쓴다
    let body = draft, fb = null;
    try {
      fb = await askJSON({ system: systemPrompt(cfg, "industry_reader", await M.inject(cfg, "industry_reader", { line: "블로그", stores: [c.store], topic: c.topic, max: 12 }) + toneBlock), model: cfg.staff.industry_reader.model, max_tokens: 1200, dry: { stiff: [], directions: ["DRY"], good: [] },
        user: `블로그 작가의 초안입니다. 업계 글을 많이 읽은 눈으로 봐 주세요. 규제는 검수관 몫이니 보지 말고 "읽히는가"만.\n\n${draft.slice(0, 7000)}\n\nJSON: {"stiff":[{"quote":"안내문처럼 읽히는 문장 그대로 인용","why":"왜","fix":"이렇게(예문)"}],"directions":["글 전체에서 고칠 방향 2~3개, 지식 카드 근거가 있으면 카드 제목 인용"],"good":["살릴 문장 1~2개"]}\n최대 stiff 4개.` });
      if (fb && (fb.stiff?.length || fb.directions?.length)) {
        body = await ask({ system: sys, model: cfg.staff.blog_writer.model, max_tokens: 7000,
          user: `초안에 대해 업계 독서가가 아래 피드백을 줬습니다. 반영해서 같은 형식으로 다시 쓰세요. 살릴 문장은 살리고, 규제·필수 요소는 그대로.\n\n초안:\n${draft.slice(0, 7000)}\n\n독서가 피드백:\n${JSON.stringify(fb, null, 1).slice(0, 3000)}\n\n${spec}` });
      }
    } catch (e) { console.error("독서가 피드백 단계 실패:", e.message); }
    const title = (body.match(/^#\s*(.+)$/m) || [, `[${c.store}] ${c.topic}`])[1].trim();
    const fbMd = fb ? `\n\n---\n## 업계 독서가 피드백 (초안 → 수정)\n${(fb.stiff || []).map(x => `- "${x.quote}" → ${x.fix} (${x.why})`).join("\n")}\n${(fb.directions || []).map(d => `- 방향: ${d}`).join("\n")}\n${(fb.good || []).map(g => `- 살림: ${g}`).join("\n")}` : "";
    const p = await N.createContent({ title, status: "검수중", line: "블로그", type: c.type === "리뷰형" ? "리뷰형" : "후기형", team: "작성", stores: [c.store], author: "블로그 작가", week: w, basis: `기획안 ${w} 카드(${c.store}) · 초안→독서가 피드백→수정 · 엔진 자동 작성`, body: body + fbMd });
    out.push(`${c.store}: ${p.url}`);
  }
  return `작성 ${out.length}편 → 검수중\n${out.join("\n")}`;
}

// ── 검수관: 검수중 → 승인 대기 / 초안
export async function regulation_reviewer_review(cfg) {
  const { items } = await ctx();
  const q = items.filter(i => i.status === "검수중").slice(0, 20); const out = [];
  for (const it of q) {
    const text = await N.readPageText(it.id);
    const r = await askJSON({ system: systemPrompt(cfg, "regulation_reviewer", await M.inject(cfg, "regulation_reviewer")), model: cfg.staff.regulation_reviewer.model, dry: { verdict: "통과", items: [], reason: "DRY", flag: false },
      user: `아래 글을 기준서 10항목으로 검수하고 JSON으로: {"verdict":"통과|수정|반려","items":[{"n":1,"ok":true,"quote":""}],"reason":"한 줄","flag":false(관리자 확인 필요 여부)}\n확신 없으면 반려.\n\n제목: ${it.title}\n${text.slice(0, 9000)}` });
    const summary = `규제 검수관 — ${r.verdict}. ${(r.items || []).map(x => `${x.n}${x.ok ? "○" : "×"}`).join(" ")} · ${r.reason}${r.flag ? " · 관리자 확인 필요" : ""}`;
    await N.updateContent(it.id, { status: r.verdict === "통과" ? "승인 대기" : "초안", review: summary });
    out.push(`${it.title} → ${r.verdict}`);
  }
  return out.length ? out.join("\n") : "검수중 항목 없음";
}

// ── 업로드 기록원: 발행 지시서 (승인·미포함 글) + 발행 URL 공란 점검
export async function upload_recorder_instruct(cfg) {
  const { items, w } = await ctx();
  const approved = items.filter(i => i.status === "승인" && (i.line === "블로그" || i.line === "POP"));
  const sheets = items.filter(i => i.title.startsWith("발행 지시서")); const covered = new Set();
  for (const s of sheets) (await N.readPageText(s.id)).split("\n").forEach(l => approved.forEach(a => { if (l.includes(a.title.slice(0, 20))) covered.add(a.id); }));
  const todo = approved.filter(a => !covered.has(a.id)); const out = [];
  if (todo.length) {
    const body = await ask({ system: systemPrompt(cfg, "upload_recorder", await M.inject(cfg, "upload_recorder")), model: cfg.staff.upload_recorder.model,
      user: `아래 승인 건의 「발행 지시서 ${w}」를 마크다운 표로: 순서 / 제목 / 종류(블로그 발행 또는 POP 인쇄·부착) / 지점 계정·부착 위치 / 권장 발행·부착 시각 / 촬영 필요 컷 요약(POP는 인쇄 매수·용지) / 주의. 마지막에 "발행 후 할 일" 3줄.\n${todo.map(t => `- [${t.line}] ${t.title} (${t.stores.join(",")}) ${t.url}`).join("\n")}` });
    const p = await N.createContent({ title: `발행 지시서 ${w} — ${todo.length}편`, status: "승인", line: "보고", type: "보고서", team: "업로드", stores: [...new Set(todo.flatMap(t => t.stores))], author: "업로드 기록원", week: w, basis: `승인 ${todo.length}편`, body });
    out.push(`발행 지시서 ${w} 생성(${todo.length}편) ${p.url}`);
  }
  for (const it of items.filter(i => i.status === "발행" && !i.pub_url)) { await N.updateContent(it.id, { memo: (it.memo ? it.memo + " / " : "") + "발행 URL 기입 필요" }); out.push(`URL 공란: ${it.title}`); }
  return out.length ? out.join("\n") : "새 승인 건 없음";
}

// ── 금요일: 주간 발행 결과 + 편집장 결과 메모
export async function upload_recorder_weekly(cfg) {
  const { items, w } = await ctx(); const wk = byWeek(items, w);
  const body = `# 주간 발행 결과 ${w}\n- 승인: ${wk.filter(i => i.status === "승인").length} / 발행: ${wk.filter(i => i.status === "발행").length} / 승인 대기: ${wk.filter(i => i.status === "승인 대기").length} / 반려: ${wk.filter(i => i.status === "반려").length} / 초안: ${wk.filter(i => i.status === "초안").length}\n## 미발행\n${wk.filter(i => i.status === "승인" && i.line === "블로그").map(i => `- ${i.title}`).join("\n") || "- 없음"}\n## 반응\n- 미수집 (발행 URL 기입 후 7일 경과 시 수집)\n## 다음 주 참고\n- (자동) 발행 담당자 지정 여부 확인`;
  const p = await N.createContent({ title: `주간 발행 결과 ${w}`, status: "승인", line: "보고", type: "보고서", team: "업로드", author: "업로드 기록원", week: w, basis: "엔진 집계", body });
  return `주간 발행 결과 ${w} ${p.url}`;
}
export async function editor_weekly_memo(cfg) {
  const { items, w } = await ctx(); const wk = byWeek(items, w);
  const memo = await ask({ system: systemPrompt(cfg, "editor", await M.inject(cfg, "editor")), model: cfg.staff.editor.model,
    user: `「주간 결과 메모 ${w}」 한 페이지: 라인별 통과·수정·반려 건수, 반복 반려 사유 상위 3, 발행 결과 요약, 관리자 반려 사유에서 배운 것, 다음 주 반영 3줄, 관리자 확인 필요.\n이번 주 결과물:\n${summarize(wk, 40)}` });
  const p = await N.createContent({ title: `주간 결과 메모 ${w}`, status: "승인 대기", line: "보고", type: "보고서", team: "편집장", author: "주간 마케팅 편집장", week: w, basis: "엔진 집계 + 편집장 정리", body: memo });
  return `주간 결과 메모 ${w} ${p.url}`;
}

// ── 이벤트 폴링: 승인되면 즉시 다음 단계 (기획안 승인 → 글 작성 / 검수중 → 검수 / 승인 글 → 지시서)
export async function events_poll(cfg) {
  const out = [];
  out.push(await blog_writer_write(cfg, 3));
  out.push(await regulation_reviewer_review(cfg));
  out.push(await upload_recorder_instruct(cfg));
  out.push(await M.detectLessons(cfg));
  return out.join("\n");
}

const _R = {
  "regulation_watcher:brief": regulation_watcher_brief, "trend_researcher:report": trend_researcher_report,
  "editor:meeting": editor_meeting, "editor:plan": editor_plan, "blog_writer:write": blog_writer_write,
  "regulation_reviewer:review": regulation_reviewer_review, "upload_recorder:instruct": upload_recorder_instruct,
  "upload_recorder:weekly": upload_recorder_weekly, "editor:weekly_memo": editor_weekly_memo, "events:poll": events_poll,
  "pop_designer:make": pop_designer_make,
  "industry_reader:read": M.industry_reader_read, "panel:study": M.panel_study,
  "company:standup": C.daily_standup, "company:retro": C.weekly_retro, "company:score": C.score_apply, "memory:lessons": M.detectLessons, "memory:self_review": M.selfReview,
};
export const REGISTRY = Object.fromEntries(Object.entries(_R).map(([k, f]) => [k, (cfg, ...a) => { WEEK_OFFSET = cfg.week_offset || 0; return f(cfg, ...a); }]));
