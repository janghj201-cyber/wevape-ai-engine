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
// v2 — 브라우저 눈으로 검색 결과 화면을 직접 보고, 숫자(조회수·좋아요·댓글)를 근거로
//      "잘 된 것 vs 안 된 것"을 짝지어 비교해 재사용 가능한 '구조'를 뽑는다.
//      뽑은 구조는 지식 카드(글 구조·첫 문장)로도 남겨 작가·패널 출근 때 주입된다.
const TREND_QUERIES = [
  ["동네 가게 릴스", "https://www.youtube.com/results?search_query=%EB%8F%99%EB%84%A4+%EA%B0%80%EA%B2%8C+%EC%87%BC%EC%B8%A0&sp=CAM%253D"],
  ["매장 브이로그 쇼츠", "https://www.youtube.com/results?search_query=%EB%A7%A4%EC%9E%A5+%EB%B8%8C%EC%9D%B4%EB%A1%9C%EA%B7%B8+%EC%87%BC%EC%B8%A0&sp=CAM%253D"],
  ["소상공인 홍보 영상", "https://www.youtube.com/results?search_query=%EC%86%8C%EC%83%81%EA%B3%B5%EC%9D%B8+%ED%99%8D%EB%B3%B4+%EC%98%81%EC%83%81&sp=CAM%253D"],
  ["매장 블로그 후기", "https://search.naver.com/search.naver?where=blog&query=%EB%A7%A4%EC%9E%A5+%ED%9B%84%EA%B8%B0+%EB%8F%99%EB%84%A4"],
];
export async function trend_researcher_report(cfg) {
  const { items, w } = await ctx();
  if (byWeek(items, w).some(i => i.type === "트렌드 보고")) return `이미 ${w} 트렌드 보고 있음 — 건너뜀`;
  const pub = items.filter(i => i.status === "발행").slice(-10).map(i => `- ${i.title} (${i.pub_url || "URL 미기입"})`).join("\n") || "(발행 기록 없음)";

  // 브라우저 눈: 검색 결과 화면을 통째로 캡처해 '실제로 뜨는 것'을 눈으로 본다
  const shots = [], shotNames = [];
  try {
    const { snapUrl } = await import("./eyes.js");
    const day = Math.floor(Date.now() / 86400e3);
    for (let k = 0; k < 2; k++) {
      const [name, url] = TREND_QUERIES[(day + k) % TREND_QUERIES.length];
      const out = `/tmp/trend-${k}.png`;
      if (await snapUrl(url, out)) { shots.push(out); shotNames.push(name); }
    }
  } catch (e) { console.error("트렌드 브라우저 눈 생략:", e.message.slice(0, 100)); }
  const eyeNote = shots.length
    ? `\n\n첨부: 검색 결과 화면 ${shotNames.join(", ")}. 첨부를 직접 보고 화면에 찍힌 제목·썸네일 문구·조회수를 그대로 읽어 근거로 쓰세요. 화면에서 읽은 숫자는 반드시 인용합니다.`
    : "";

  const j = await askJSON({
    system: systemPrompt(cfg, "trend_researcher", await M.inject(cfg, "trend_researcher")),
    tools: ["web_search"], model: cfg.staff.trend_researcher.model, max_tokens: 6000, images: shots,
    dry: { pairs: [], rules: [], to_editor: "DRY" },
    user: `오늘 ${kstNow()}, 주차 ${w}.${eyeNote}

당신의 일은 '소재 나열'이 아니라 **왜 어떤 건 되고 어떤 건 안 됐는지 구조를 뽑는 것**입니다.

지난 7~14일, 동네 가게·소상공인·매장 일상 콘텐츠에서 **잘 된 것과 비슷한데 안 된 것을 짝지어** 5쌍 찾으세요. 웹 검색과 첨부 화면을 함께 씁니다. 반드시 숫자(조회수·좋아요·댓글 수, 가능하면 좋아요 대비 댓글 비율)를 근거로 제시하고, 숫자를 못 구한 건은 짝에서 뺍니다.

JSON:
{"pairs":[{"topic":"무엇에 대한 콘텐츠인가","won":{"what":"잘 된 것 — 제목/첫 문장 실제 인용","numbers":"조회수·좋아요·댓글","why":"된 이유"},"lost":{"what":"안 된 것 — 실제 인용","numbers":"수치","why":"안 된 이유"},"structure":"두 사례의 차이를 재사용 가능한 규칙 한 줄로","our_version":"위베이프 매장 버전 제안 1줄","line":"블로그|SNS|영상|POP","risk":"규제 위험 메모","sources":["URL"]}],
"rules":[{"title":"글·영상 구조 규칙 한 줄(30자, 구체적)","summary":"왜 통하는지 + 근거 숫자 + 실제 문구 인용, 2~4문장 250자","lines":["블로그","SNS","영상","POP","공통"],"confidence":"높음|보통|낮음","source":"URL"}],
"to_editor":"편집장에게 한 줄"}

rules는 pairs에서 뽑은 **문장·구성 규칙만** 3~5개. 예: 첫 문장에 무엇을 두는가, 효익과 분위기 중 무엇이 먼저인가, 길이, 마무리에서 무엇을 요청하는가. 소재나 아이디어는 rules에 넣지 마세요 — rules는 작가가 다음 글부터 그대로 적용할 규칙입니다.

금지: 제품·맛·니코틴 트렌드, 출처 없는 주장, 숫자 없는 단정.

최근 발행:
${pub}` });

  const P = j.pairs || [], R = j.rules || [];
  const body = `# 주간 트렌드 보고 ${w}

관찰 방식: 웹 검색 + 브라우저 눈(${shotNames.join(", ") || "화면 없음"})

## 잘 된 것 vs 안 된 것 (${P.length}쌍)
${P.map((p, i) => `### ${i + 1}. ${p.topic || ""} — [${p.line || "공통"}]
- 통함: ${p.won?.what || ""} · ${p.won?.numbers || ""} → ${p.won?.why || ""}
- 안 통함: ${p.lost?.what || ""} · ${p.lost?.numbers || ""} → ${p.lost?.why || ""}
- **구조**: ${p.structure || ""}
- 우리 버전: ${p.our_version || ""}
- 규제 위험: ${p.risk || ""}
- 출처: ${(p.sources || []).join(" / ")}`).join("\n\n") || "(없음)"}

## 작가에게 넘길 구조 규칙 ${R.length}개
${R.map(r => `- **${r.title}** — ${r.summary}${r.source ? ` [출처: ${r.source}]` : ""}`).join("\n") || "(없음)"}

## 편집장에게
${j.to_editor || ""}`;

  const p = await N.createContent({ title: `주간 트렌드 보고 ${w}`, status: "승인 대기", line: "기획", type: "트렌드 보고", team: "트렌드조사", author: "쇼츠 트렌드 리서처", week: w, basis: `웹 조사 + 브라우저 눈 · 짝 비교 ${P.length}쌍 · 구조 규칙 ${R.length}개`, body });

  // 구조 규칙을 지식 카드로 — 작가·패널이 출근할 때 주입받는다 (보고서만 쓰면 아무도 안 읽는다)
  let saved = 0;
  for (const r of R) {
    if (!r.title || !r.source) continue;
    try {
      await M.createMemory(cfg, { title: r.title, type: "지식 카드", staff: "쇼츠 트렌드 리서처", category: "글 구조·첫 문장",
        lines: r.lines?.length ? r.lines : ["공통"], tags: ["검색어"], confidence: r.confidence || "보통", source: r.source, week: w,
        summary: r.summary || "", body: `# ${r.title}\n\n${r.summary}\n\n- 출처: ${r.source}\n- 주간 트렌드 관찰에서 도출 · ${kstNow().slice(0, 16)}` });
      saved++;
    } catch (e) { console.error("구조 카드 저장 실패:", e.message.slice(0, 80)); }
  }
  return `트렌드 보고 ${w} 생성 (짝 ${P.length} · 구조 카드 ${saved}장) ${p.url}`;
}

// ── 편집장: 기획 회의 (병렬 의견 → 취합) + 회의록
// topic이 있으면 대표 지시에 따른 「안건 회의」 — 주차 중복 가드를 건너뛰고 그 안건으로 연다.
// (2026-08-28: 대표가 "회의하여 보고"라 지시해도 주간 회의록이 이미 있으면 회의가 안 열리던 문제)
export async function editor_meeting(cfg, topic = "") {
  const { items, w } = await ctx();
  const T = String(topic || "").trim();
  if (!T && byWeek(items, w).some(i => i.title.startsWith("기획 회의록"))) return `이미 ${w} 회의록 있음`;
  if (T && items.some(i => i.type === "회의록" && (i.basis || "").includes(T.slice(0, 40)))) return "같은 안건 회의록 이미 있음";
  const brief = latest(items, i => i.type === "이슈 브리핑"), trend = latest(items, i => i.type === "트렌드 보고");
  const briefT = brief ? await N.readPageText(brief.id) : "(없음)", trendT = trend ? await N.readPageText(trend.id) : "(없음)";
  const lastPlan = latest(items, i => i.type === "기획안");
  const context = `주차 ${w}. 이슈 브리핑:\n${briefT.slice(0, 2500)}\n\n트렌드 보고:\n${trendT.slice(0, 2500)}\n\n지난 기획안: ${lastPlan ? `${lastPlan.title} [${lastPlan.status}] 관리자 메모: ${lastPlan.memo || "없음"}` : "없음"}\n최근 결과물:\n${summarize(items)}\n지점: ${cfg.stores.join("·")}`;
  const roles = T ? [
    ["regulation_reviewer", `안건: ${T}\n규제 검수관으로서 이 안건에 대해: 지금 기준서로 허용되는 것과 안 되는 것의 경계를 구체적으로. 회색지대는 회색지대라고. 400자.`],
    ["pop_designer", `안건: ${T}\nPOP 디자이너로서: 지금 무엇을 어떤 목적으로 만들고 있는지 솔직히, 무엇이 막혀 있는지, 무엇이 있으면 풀리는지. 400자.`],
    ["quality_editor", `안건: ${T}\n품질 편집자로서: 지금 결과물이 관리자 눈에 몇 점인지와 그 이유, 점수를 올리려면 무엇을 먼저 바꿔야 하는지. 400자.`],
    ["panel_film", `안건: ${T}\n영화 보는 사람으로서: 시각적으로 '독보이게' 만든다는 것이 실제로 무엇을 바꾸는 일인지 구체적 방법 3개. 400자.`],
  ].filter(([id]) => cfg.staff[id]) : [
    ["regulation_watcher", "이번 주 블로그에서 반드시 피할 표현·주제 3개(이유), 권장 준법 문장 1개, 지시문 규칙 1개. 300자."],
    ["trend_researcher", "이번 주 블로그 소재·형식 3개(어느 지점), 지역 행사와 잘 붙는 지점 3개, 사진 형식 1개. 350자."],
    ["blog_writer", `9지점(${cfg.stores.join("·")}) 각 주제·각도·유형(리뷰형/후기형) 1안을 표로. 지난주와 다른 각도. 지시문에 넣을 규칙 1개.`],
    ["regulation_reviewer", "지난주 반려·수정 사유 중 이번 주 지시문에 넣을 규칙 3개, 자동 반려 단어, 작가 주의 1개. 300자."],
  ];
  // 1라운드 — 각자 의견
  const opinions = await Promise.all(roles.map(async ([id, task]) => [id, await ask({ system: systemPrompt(cfg, id, await M.inject(cfg, id)), model: cfg.staff[id].model, user: `${T ? `대표 지시로 소집된 안건 회의입니다. 안건: ${T}` : "기획 회의"} 1라운드입니다. 의견을 내세요.\n${context}\n\n요청: ${task}` })]));
  const NM = (id) => cfg.staff[id]?.display || ({ regulation_watcher: "규제 감시자", trend_researcher: "쇼츠 트렌드 리서처", blog_writer: "블로그 작가", regulation_reviewer: "규제 검수관", quality_editor: "품질 편집자" })[id] || id;
  const round1 = opinions.map(([id, t]) => `### ${NM(id)}\n${t}`).join("\n\n");

  // 2라운드 — 남의 의견을 읽고 반박한다. 여기서 충돌이 드러난다.
  const rebuttals = await Promise.all(opinions.map(async ([id]) => {
    const others = opinions.filter(([oid]) => oid !== id).map(([oid, t]) => `### ${NM(oid)}\n${t.slice(0, 1200)}`).join("\n\n");
    try {
      const j = await askJSON({ system: systemPrompt(cfg, id, await M.inject(cfg, id, { max: 4 })), model: cfg.staff[id].model, max_tokens: 800,
        dry: { agree: [], object: [], add: "" },
        user: `기획 회의 2라운드입니다. 다른 참석자들의 1라운드 의견입니다.\n\n${others}\n\nJSON: {"agree":[{"to":"동의하는 사람 이름","why":"왜 동의하는지 1줄"}],"object":[{"to":"반대하는 사람 이름","what":"어느 대목에 반대하는지 인용","why":"근거 1~2줄","instead":"대신 이렇게 하자"}],"add":"아무도 말 안 한 것 1줄(없으면 빈칸)"}\n\n당신의 관점에서 정말 문제라고 보는 것만 반대하세요. 예의상 동의는 쓰지 마세요. 반대가 없으면 object는 빈 배열로.` });
      return [id, j];
    } catch (e) { return [id, { agree: [], object: [], add: "" }]; }
  }));
  const conflicts = rebuttals.flatMap(([id, j]) => (j.object || []).map(o => ({ from: NM(id), ...o })));
  const round2 = rebuttals.map(([id, j]) => {
    const a = (j.agree || []).map(x => `- 동의 → ${x.to}: ${x.why}`).join("\n");
    const o = (j.object || []).map(x => `- **반대 → ${x.to}**: "${x.what}" — ${x.why} / 대안: ${x.instead}`).join("\n");
    return `### ${NM(id)}\n${[a, o, j.add ? `- 추가: ${j.add}` : ""].filter(Boolean).join("\n") || "- (이견 없음)"}`;
  }).join("\n\n");

  const opText = `# 1라운드 — 각자 의견\n\n${round1}\n\n# 2라운드 — 반박과 동의\n\n${round2}`;
  const minutes = await ask({ system: systemPrompt(cfg, "editor", await M.inject(cfg, "editor")), model: cfg.staff.editor.model, max_tokens: 6000,
    user: `${T ? `대표 지시로 소집된 안건 회의입니다. 안건: ${T}` : "월요일 기획 회의"}를 2라운드로 진행했습니다. 당신은 의장입니다.\n${context}\n\n${opText}\n\n「${T ? "안건 회의록" : "기획 회의록"} ${w}」를 마크다운으로 쓰세요:\n## 참석\n## 1라운드 요지 (각 1~2줄)\n## 충돌한 지점 — ${conflicts.length}건\n각 충돌마다: 누가 누구에게 무엇을 반대했나 / **당신의 판정과 이유**. 판정 기준은 「규제 > 브랜드 > 근거 있는 의견 > 취향」이며, 어느 기준으로 갈랐는지 반드시 명시하세요. 양쪽 다 맞다는 식으로 얼버무리지 마세요 — 한쪽을 고르고 이유를 대세요.\n## 결정 사항 (이번 주 실행할 것)\n## 보류 — 대표 판단이 필요한 것 (없으면 '없음')\n\n관리자의 지난 반려 사유는 최우선 반영합니다.` });

  // 사무실 화면의 회의록 탭에서 대화로 보이도록 저장
  try {
    const talkPath = path.join(path.resolve(new URL("..", import.meta.url).pathname), "office/talk.json");
    let talk = {}; try { talk = JSON.parse(fs.readFileSync(talkPath, "utf8")); } catch {}
    talk.meeting = { week: w, at: kstNow().slice(0, 16), title: `기획 회의록 ${w}`,
      round1: opinions.map(([id, t]) => ({ who: NM(id), text: t.slice(0, 900) })),
      round2: rebuttals.map(([id, j]) => ({ who: NM(id), agree: j.agree || [], object: j.object || [], add: j.add || "" })),
      conflicts, ruling: minutes.slice(0, 4000) };
    fs.mkdirSync(path.dirname(talkPath), { recursive: true });
    fs.writeFileSync(talkPath, JSON.stringify(talk, null, 1));
  } catch (e) { console.error("회의록 화면 저장 실패:", e.message.slice(0, 80)); }

  const p = await N.createContent({ title: T ? `안건 회의록 ${w} — ${T.slice(0, 30)}` : `기획 회의록 ${w} (월 09:00 자동 회의)`, status: T ? "승인 대기" : "승인", line: "보고", type: T ? "회의록" : "보고서", team: "편집장", author: "주간 마케팅 편집장", week: w, basis: `${T ? `대표 지시 안건: ${T.slice(0, 120)} · ` : ""}2라운드 토론 · 참석 ${roles.length}명 · 충돌 ${conflicts.length}건 → 편집장 판정`, body: minutes });
  return `${T ? "안건" : "기획"} 회의록 ${w} 생성 (참석 ${roles.length}명 · 충돌 ${conflicts.length}건 판정) ${p.url}`;
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

// ── 업로드 기록원: 발행 지시서 (승인·미포함 건) + 발행 URL 공란 점검
// 중복 방지: 최신 지시서의 「포함ID」 푸터로 판단. (2026-08-23 수정 — 텍스트 매칭 실패로 10분마다 중복 생성돼 크레딧 소진시킨 버그)
export async function upload_recorder_instruct(cfg) {
  const { items, w } = await ctx();
  const approved = items.filter(i => i.status === "승인" && (i.line === "블로그" || i.line === "POP"));
  const sheets = items.filter(i => i.title.startsWith("발행 지시서")).sort((a, b) => a.created.localeCompare(b.created));
  const last = sheets[sheets.length - 1];
  const covered = new Set();
  if (last) {
    const t = await N.readPageText(last.id);
    const m = t.match(/포함ID[:：]\s*([a-f0-9, \-]+)/i);
    if (m) m[1].split(/[^a-f0-9]+/).forEach(x => x.length >= 30 && covered.add(x));
    else approved.forEach(a => { if (t.includes(a.title.slice(0, 20))) covered.add(a.id.replace(/-/g, "")); });
  }
  const todo = approved.filter(a => !covered.has(a.id.replace(/-/g, ""))); const out = [];
  if (todo.length) {
    const body = await ask({ system: systemPrompt(cfg, "upload_recorder", await M.inject(cfg, "upload_recorder")), model: cfg.staff.upload_recorder.model,
      user: `아래 승인 건의 「발행 지시서 ${w}」를 마크다운 표로: 순서 / 제목 / 종류(블로그 발행 또는 POP 인쇄·부착) / 지점 계정·부착 위치 / 권장 발행·부착 시각 / 촬영 필요 컷 요약(POP는 인쇄 매수·용지) / 주의. 마지막에 "발행 후 할 일" 3줄.\n${todo.map(t => `- [${t.line}] ${t.title} (${t.stores.join(",")}) ${t.url}`).join("\n")}` });
    const footer = `\n\n---\n## 포함ID(자동·수정 금지)\n포함ID: ${approved.map(a => a.id.replace(/-/g, "")).join(",")}`;
    const p = await N.createContent({ title: `발행 지시서 ${w} — ${todo.length}편`, status: "승인", line: "보고", type: "보고서", team: "업로드", stores: [...new Set(todo.flatMap(t => t.stores))], author: "업로드 기록원", week: w, basis: `승인 ${todo.length}편(신규) · 누적 ${approved.length}편`, body: body + footer });
    out.push(`발행 지시서 ${w} 생성(신규 ${todo.length}편) ${p.url}`);
  }
  for (const it of items.filter(i => i.status === "발행" && !i.pub_url)) { if ((it.memo || "").includes("발행 URL 기입 필요")) continue; await N.updateContent(it.id, { memo: (it.memo ? it.memo + " / " : "") + "발행 URL 기입 필요" }); out.push(`URL 공란: ${it.title}`); }
  return out.length ? out.join("\n") : "새 승인 건 없음";
}

// ── 유지보수: 중복 발행 지시서 보관(archive) — 주차별 최신 1장만 남김
export async function maintenance_dedup(cfg) {
  const { items } = await ctx();
  const sheets = items.filter(i => i.title.startsWith("발행 지시서")).sort((a, b) => a.created.localeCompare(b.created));
  const newestByWeek = {}; sheets.forEach(s => { newestByWeek[s.week || "?"] = s.id; });
  const keep = new Set(Object.values(newestByWeek)); let n = 0;
  for (const s of sheets) if (!keep.has(s.id)) { try { await N.req("PATCH", `/pages/${s.id}`, { archived: true }); n++; } catch (e) { console.error("archive 실패:", e.message); } }
  return `중복 발행 지시서 ${n}건 보관 처리 (주차별 최신 1장 유지)`;
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

// ── 품질 편집자: 승인 대기로 올라온 결과물을 관리자 눈으로 100점 채점 → 70점 미만은 되돌린다
// 무한 루프 방지: 되돌린 건은 메모에 [품질반환] 표식을 남기고, 같은 건은 최대 2회까지만 되돌린다.
const QMARK = "[품질반환";
export async function quality_editor_review(cfg, maxItems = 6) {
  const { items } = await ctx();
  const targets = items.filter(i => i.status === "승인 대기" && (i.line === "블로그" || i.line === "POP") && !/품질 \d+점/.test(i.review || "")).slice(0, maxItems);
  if (!targets.length) return "품질 채점 대상 없음";
  const guide = readOpt(cfg, "brand_guide.md").slice(0, 4000);
  const out = [];
  for (const it of targets) {
    const back = ((it.memo || "").match(/\[품질반환/g) || []).length;
    let text = "";
    try { text = await N.readPageText(it.id); } catch {}
    const r = await askJSON({ system: systemPrompt(cfg, "quality_editor", await M.inject(cfg, "quality_editor", { max: 6 })), model: cfg.staff.quality_editor.model, max_tokens: 2000,
      dry: { total: 80, scores: {}, why: "DRY", weakest: "-", fix_example: "-" },
      user: `관리자(대표)는 지금까지 우리 결과물에 100점 만점 중 5점을 줬습니다. 당신은 그 관리자의 눈으로 아래 결과물을 채점합니다. 후하게 주지 마세요.\n\n종류: ${it.line} · 제목: ${it.title}\n지점: ${(it.stores || []).join(",")}\n\n[브랜드 가이드 발췌]\n${guide}\n\n[결과물]\n${text.slice(0, 9000)}\n\nJSON:\n{"total":0~100,"scores":{"목적적합":0~25,"브랜드일치":0~25,"완성도":0~25,"실전성":0~25},"why":"왜 이 점수인지 3~5줄. 관리자가 볼 때 무엇이 부족한가.","weakest":"가장 약한 한 가지","fix_example":"그 한 가지를 어떻게 고치면 되는지 실제 예시(문장 또는 프롬프트)를 그대로 써 줄 것"}\n\n채점 기준: 목적적합=위베이프 매장을 알리는 물건으로 말이 되는가(업종·지점·직영/재고 메시지). 브랜드일치=가이드의 무드·타이포·색·금지사항. 완성도=바로 인쇄/발행해도 되는 수준인가. 실전성=고객이 이걸 보고 매장에 오는가.` });
    const total = Number(r.total) || 0;
    const summary = `품질 ${total}점 (목적 ${r.scores?.목적적합 ?? "-"} / 브랜드 ${r.scores?.브랜드일치 ?? "-"} / 완성 ${r.scores?.완성도 ?? "-"} / 실전 ${r.scores?.실전성 ?? "-"}) · 약점: ${String(r.weakest || "").slice(0, 60)}`;
    if (total < 70 && back < 2) {
      await N.updateContent(it.id, { status: "초안", review: summary, memo: `${it.memo ? it.memo + " / " : ""}${QMARK}${back + 1}회] ${String(r.weakest || "").slice(0, 60)} → ${String(r.fix_example || "").slice(0, 160)}` });
      out.push(`${it.title} → ${total}점 · 반환(${back + 1}회)`);
    } else {
      await N.updateContent(it.id, { review: summary + (total < 70 ? " · 반환 한도 도달, 관리자 판단 필요" : "") });
      out.push(`${it.title} → ${total}점 · 통과`);
    }
    try { await M.note(cfg, "quality_editor", "quality:review", `${it.title} ${total}점 — ${String(r.why || "").slice(0, 300)}`); } catch {}
  }
  return out.join("\n");
}

// ── 리스크 관리자: 코드로 먼저 신호를 계산하고, 신호가 있을 때만 사람을 부른다(=크레딧 낭비 방지). 하루 1건.
export async function risk_scan(cfg) {
  const { items, w } = await ctx();
  const today = kstNow().slice(0, 10);
  if (items.some(i => i.title.startsWith("리스크 경보") && i.title.includes(today))) return "오늘 리스크 경보 이미 발행";
  const now = Date.now();
  const age = (i) => (now - new Date(i.created).getTime()) / 3600e3;
  const d1 = items.filter(i => age(i) <= 24), d2 = items.filter(i => age(i) > 24 && age(i) <= 48), d7 = items.filter(i => age(i) <= 168);
  const sig = [];
  const titles = {}; for (const i of d1) { const k = i.title.slice(0, 20); titles[k] = (titles[k] || 0) + 1; }
  const dup = Object.entries(titles).filter(([, n]) => n >= 3);
  if (dup.length) sig.push(`같은 제목 결과물이 24시간 안에 ${dup.map(([k, n]) => `「${k}」 ${n}건`).join(", ")} — 중복 생성 루프 의심`);
  if (d1.length >= 3 * Math.max(d2.length, 1) && d1.length >= 9) sig.push(`24시간 생성량 ${d1.length}건으로 전일(${d2.length}건) 대비 3배 이상 — 폭주 의심`);
  const longMemo = items.filter(i => (i.memo || "").length > 500);
  if (longMemo.length) sig.push(`메모가 500자를 넘긴 카드 ${longMemo.length}건 — 같은 카드에 반복 기입되고 있음`);
  const pend = items.filter(i => i.status === "승인 대기");
  if (pend.length > 15) sig.push(`승인 대기 ${pend.length}건 적체 — 관리자 결재 병목`);
  if (d1.length === 0) sig.push("24시간 동안 새 결과물 0건 — 엔진 정지 또는 작업 실패 의심");
  const app7 = d7.filter(i => i.status === "승인").length, pub7 = d7.filter(i => i.status === "발행").length;
  if (app7 >= 5 && pub7 === 0) sig.push(`최근 7일 승인 ${app7}건인데 발행 0건 — 승인이 실제 발행으로 이어지지 않음(발행 경로 단절)`);
  if (!sig.length) return "리스크 신호 없음";
  const body = await ask({ system: systemPrompt(cfg, "risk_watch", await M.inject(cfg, "risk_watch", { max: 6 })), model: cfg.staff.risk_watch.model, max_tokens: 2000,
    user: `아래는 오늘 조직에서 코드로 감지한 이상 신호입니다. 대표에게 바로 올라가는 「리스크 경보」 한 장을 마크다운으로 쓰세요.\n\n[감지된 신호]\n${sig.map((s, n) => `${n + 1}. ${s}`).join("\n")}\n\n[최근 결과물]\n${summarize(items, 15)}\n\n구성: ① 한 줄 요약(가장 급한 것) ② 신호별로 「무슨 일인가 / 방치하면 무엇이 깨지는가 / 지금 할 일」 ③ 대표가 직접 눌러야 하는 것이 있으면 마지막에 「대표 확인 필요」로 분리. 추측은 추측이라고 쓰고, 숫자는 위 신호에 있는 숫자만 쓰세요.` });
  const p = await N.createContent({ title: `리스크 경보 ${today} — ${sig.length}건`, status: "승인 대기", line: "보고", type: "보고서", team: "편집장", author: "관리자", week: w, basis: `자동 감지 신호 ${sig.length}건`, review: `리스크: ${sig[0].slice(0, 120)}`, body });
  try { await M.note(cfg, "risk_watch", "risk:scan", `경보 ${sig.length}건: ${sig.join(" / ").slice(0, 400)}`); } catch {}
  return `리스크 경보 ${sig.length}건 → ${p.url}`;
}

// ── 이벤트 폴링: 승인되면 즉시 다음 단계 (기획안 승인 → 글 작성 / 검수중 → 검수 / 승인 글 → 지시서)
export async function events_poll(cfg) {
  const out = [];
  out.push(await blog_writer_write(cfg, 3));
  out.push(await regulation_reviewer_review(cfg));
  out.push(await quality_editor_review(cfg, 3));
  out.push(await upload_recorder_instruct(cfg));
  out.push(await M.detectLessons(cfg));
  return out.join("\n");
}

// 직원이 답을 못 쓴 이유를 대표가 읽을 수 있는 말로 바꾼다. "회신 생성 실패" 한 줄만 남기면 대표는 원인을 알 수 없다.
function failNotice(err) {
  const e = String(err || "");
  if (/credit balance|insufficient_quota|billing/i.test(e))
    return "> ⚠️ **회신을 쓰지 못했습니다 — 직원들이 일할 수 없는 상태입니다.**\n>\n> 원인: **Anthropic API 크레딧 잔액 소진**. 조직의 모든 직원(편집장·작가·검수관·디자이너)은 이 API로 생각합니다. 잔액이 0이면 아무도 한 글자도 쓸 수 없습니다.\n>\n> 대표님이 하실 일: console.anthropic.com → Billing에서 크레딧 충전. 충전 후 이 지시를 다시 보내주시면 그대로 처리됩니다.\n>\n> (이 지시 내용은 위에 그대로 보관돼 있습니다. 사라지지 않습니다.)";
  if (/rate_limit|429/i.test(e))
    return "> ⚠️ **회신을 쓰지 못했습니다.** 원인: API 호출 한도 초과(일시적). 몇 분 뒤 같은 지시를 다시 보내주십시오.";
  if (/overloaded|529|503|timeout|ETIMEDOUT|ECONNRESET/i.test(e))
    return "> ⚠️ **회신을 쓰지 못했습니다.** 원인: 모델 서버 일시 장애. 잠시 뒤 같은 지시를 다시 보내주십시오.";
  if (!e) return "> ⚠️ **회신을 쓰지 못했습니다.** 원인 불명 — 실행 로그 확인이 필요합니다.";
  return `> ⚠️ **회신을 쓰지 못했습니다.**\n>\n> 원인: \`${e.slice(0, 300)}\``;
}

// ── 대표 지시: 대표실 명령창 → 편집장이 접수·해석 → 필요한 직원을 즉시 출근시켜 실행 → **반드시 회신을 남긴다**
export async function ceo_instruct(cfg) {
  const memo = (process.env.INPUT_MEMO || "").trim();
  if (!memo) return "지시 내용 없음 (memo 비어 있음)";
  const { items, w } = await ctx();
  const ALLOWED = ["blog_writer:write", "pop_designer:make", "regulation_watcher:brief", "trend_researcher:report", "industry_reader:read", "panel:study", "upload_recorder:instruct", "editor:plan", "editor:meeting", "company:standup", "quality_editor:review", "risk:scan"];

  // 조직 현황 — 질문형 지시에 답하려면 편집장이 지금 상태를 알아야 한다
  const w1 = items.filter(i => i.week === w);
  const pops = items.filter(i => i.line === "POP");
  const state = `이번 주(${w}) 결과물 ${w1.length}건 · 전체 ${items.length}건
상태: 승인 ${items.filter(i => i.status === "승인").length} / 승인 대기 ${items.filter(i => i.status === "승인 대기").length} / 반려 ${items.filter(i => i.status === "반려").length} / 발행 ${items.filter(i => i.status === "발행").length}
POP 누적 ${pops.length}건 (반려 ${pops.filter(i => i.status === "반려").length}건)
최근 관리자 메모: ${items.filter(i => i.memo).slice(-4).map(i => `「${i.title.slice(0, 18)}」 ${i.memo.slice(0, 60)}`).join(" / ") || "없음"}
최근 결과물:
${summarize(items, 12)}`;

  // 긴 마크다운을 JSON 문자열 안에 넣게 하면 자주 깨진다 → 라우팅(JSON, 짧게)과 회신(평문 마크다운)을 나눈다
  const sysE = systemPrompt(cfg, "editor", await M.inject(cfg, "editor", { max: 8 }));
  let plan = { kind: "지시", understanding: "", tasks: [], store: "", note_to_staff: "" };
  let routeErr = "";
  try {
    plan = await askJSON({ system: sysE, model: cfg.staff.editor.model, max_tokens: 900,
      dry: { kind: "질문", understanding: "DRY", tasks: [], store: "", note_to_staff: "" },
      user: `대표가 명령창으로 지시했습니다:\n"""${memo}"""\n\n# 지금 조직 상태\n${state}\n\n실행 가능한 작업: ${ALLOWED.join(", ")}\n지점: ${cfg.stores.join(", ")}\n\n짧은 JSON만:\n{"kind":"질문|지시|방침","understanding":"지시 요해 1줄","tasks":["즉시 실행할 작업 0~3개, 위 목록 안에서만"],"store":"특정 지점 대상이면 지점명 하나, 아니면 빈칸","note_to_staff":"담당 직원들에게 전달할 지시 요지 1~2문장"}\n\n판단: POP을 다시/새로 만들라면 pop_designer:make(+store). 글이면 blog_writer:write. 회의를 열라면 editor:meeting. 조사 지시면 해당 조사. 질문이면 tasks는 비웁니다. 여기서는 긴 설명을 쓰지 마세요.` });
  } catch (e) { console.error("지시 라우팅 실패(기본값으로 진행):", e.message.slice(0, 200)); routeErr = e.message || String(e); }

  let answer = "", answerErr = "";
  try {
    answer = await ask({ system: sysE, model: cfg.staff.editor.model, max_tokens: 5000,
      user: `대표가 명령창으로 지시했습니다:\n"""${memo}"""\n\n당신은 편집장입니다. 대표는 이 창에 쓴 것에 대해 **반드시 답을 받아야 합니다.** 접수만 하고 끝내면 안 됩니다.\n\n# 지금 조직 상태\n${state}\n\n대표에게 드리는 회신을 마크다운으로 쓰세요. 질문이면 **지금 아는 사실로 정면으로 답하고**(모르면 모른다고), 지시면 무엇을 어떻게 하겠다고, 방침이면 어디에 어떻게 반영하겠다고 씁니다. 두루뭉술한 말 금지 — 숫자와 구체적 사실로. 800~2000자. JSON이나 코드펜스로 감싸지 말고 마크다운 본문만 출력하세요.` });
  } catch (e) { console.error("회신 생성 실패:", e.message.slice(0, 200)); answerErr = e.message || String(e); }

  const kind = plan.kind || "지시";
  const body = `# 대표 지시\n\n${memo}\n\n- 접수: ${kstNow().slice(0, 16)} · 유형: ${kind}\n\n---\n\n# 편집장 회신\n\n**요해**: ${plan.understanding || "(해석 실패 — 아래 사유 참조)"}\n\n${answer || failNotice(answerErr || routeErr)}\n\n**직원 전달**: ${plan.note_to_staff || "-"}`;
  const rec = await N.createContent({ title: `대표 지시 — ${memo.slice(0, 34)}${memo.length > 34 ? "…" : ""}`, status: "승인 대기", line: "기획", type: "대표 지시", team: "편집장", author: "주간 마케팅 편집장", week: w, basis: `대표실 명령창 · ${kind} · ${answer ? "편집장 회신 포함" : "⚠️ 회신 실패"}`, review: answer ? `편집장 회신: ${String(plan.understanding || "").slice(0, 200)}` : `⚠️ 회신 실패 — ${String(answerErr || routeErr).slice(0, 160)}`, body });

  if (plan.store && cfg.stores.includes(plan.store)) process.env.POP_FORCE_STORE = plan.store;
  try { await M.note(cfg, "editor", "ceo:instruct", `대표 지시 접수·회신: ${memo.slice(0, 120)} / 회신: ${String(answer).slice(0, 200)}`); } catch (e) { console.error("지시 노트 실패:", e.message); }

  const out = [`지시 접수 ${answer ? "+ 회신" : "· ⚠️ 회신 실패"} → ${rec.url}`, `유형: ${kind} · 해석: ${plan.understanding || "-"}`];
  if (!answer) { try { await N.updateContent(rec.id, { memo: `[회신 실패] ${String(answerErr || routeErr).slice(0, 300)}` }); } catch {} }
  const ran = [];
  for (const t of (plan.tasks || []).filter(t => ALLOWED.includes(t)).slice(0, 3)) {
    try { const r = await _R[t](cfg, t === "editor:meeting" ? memo : undefined); ran.push(`${t}: ${String(r).slice(0, 200)}`); out.push(`▶ ${t}\n${String(r).slice(0, 300)}`); }
    catch (e) { ran.push(`${t} 실패: ${e.message.slice(0, 80)}`); out.push(`▶ ${t} 실패: ${e.message.slice(0, 120)}`); }
  }
  // 실행 결과까지 회신에 이어 붙인다 — 대표는 한 페이지에서 답과 결과를 함께 본다
  if (!answer) { console.error("대표 지시에 회신하지 못했습니다:", String(answerErr || routeErr).slice(0, 300)); }
  if (ran.length) { try { await N.req("PATCH", `/blocks/${rec.id}/children`, { children: N.mdToBlocks(`\n---\n\n## 즉시 실행 결과\n${ran.map(r => `- ${r}`).join("\n")}\n\n(${kstNow().slice(0, 16)})`, 90) }); } catch (e) { console.error("실행결과 append 실패:", e.message.slice(0, 60)); } }
  return out.join("\n");
}

const _R = {
  "ceo:instruct": ceo_instruct,
  "regulation_watcher:brief": regulation_watcher_brief, "trend_researcher:report": trend_researcher_report,
  "editor:meeting": editor_meeting, "editor:plan": editor_plan, "blog_writer:write": blog_writer_write,
  "regulation_reviewer:review": regulation_reviewer_review, "quality_editor:review": quality_editor_review, "risk:scan": risk_scan, "upload_recorder:instruct": upload_recorder_instruct,
  "upload_recorder:weekly": upload_recorder_weekly, "editor:weekly_memo": editor_weekly_memo, "events:poll": events_poll,
  "pop_designer:make": pop_designer_make, "maintenance:dedup": maintenance_dedup,
  "industry_reader:read": M.industry_reader_read, "panel:study": M.panel_study,
  "company:standup": C.daily_standup, "company:retro": C.weekly_retro, "company:score": C.score_apply, "memory:lessons": M.detectLessons, "memory:self_review": M.selfReview,
};
export const REGISTRY = Object.fromEntries(Object.entries(_R).map(([k, f]) => [k, (cfg, ...a) => { WEEK_OFFSET = cfg.week_offset || 0; return f(cfg, ...a); }]));
