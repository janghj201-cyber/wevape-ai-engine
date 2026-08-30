// 노션 → office/snapshot.json → office/index.html (gen_office.py) — 본사 화면(대표실→복도→부서 방) 재생성
import fs from "node:fs"; import path from "node:path"; import { execSync } from "node:child_process";
import * as N from "./notion.js";
import { queryMemory } from "./memory.js";
import { currentScore } from "./company.js";
import { kstNow, isoWeek, listDepts } from "./org.js";
const ROOT = path.resolve(new URL("..", import.meta.url).pathname);
const COLORS = { "편집장": "#2f855a", "트렌드조사": "#d69e2e", "이슈조사": "#c53030", "작성": "#2b6cb0", "검수": "#dd6b20", "업로드": "#6b46c1", "관점패널": "#b83280", "관제": "#0f766e" };
const IDS = { "업계 독서가": "reader", "주간 마케팅 편집장": "editor", "쇼츠 트렌드 리서처": "trend", "규제 감시자": "reg", "블로그 작가": "writer", "규제 검수관": "reviewer", "업로드 기록원": "uploader", "POP 디자이너": "pop", "소설 읽는 사람": "novel", "영화 보는 사람": "film", "시 읽는 사람": "poem", "품질 편집자": "quality", "리스크 관리자": "risk", "SNS 발행원": "snspub" };
// 복도에 보일 부서 문 — 활성 부서는 org/ 폴더에서, 나머지는 예정 목록
const PLANNED = [
  { id: "store_ops", name: "매장운영", icon: "🏪", desc: "지점 매출·재고 요약, 근무표, 응대 매뉴얼, 순회 체크리스트" },
  { id: "customer", name: "고객응대", icon: "💬", desc: "리뷰·문의·DM 모니터링, 답변 초안, 불만 조기 경보" },
  { id: "legal", name: "규제·법무", icon: "⚖️", desc: "담배사업법·광고 규제·단속 D-day 전사 브리핑" },
  { id: "hr", name: "채용·교육", icon: "🎓", desc: "공고 문안, 신입 교육 자료, 테스트 문제" },
  { id: "bubblemon", name: "버블몬", icon: "🫧", desc: "일본 타겟 사이트 UX 카피, 상품 설명, 일본어 검수, SNS" },
];
const ICON = { marketing: "📣" };

export function popIndex() {
  const f = path.join(ROOT, "office/pop/index.json");
  try { return JSON.parse(fs.readFileSync(f, "utf8")); } catch { return []; }
}

export async function snapshot(cfg) {
  if (process.env.DRY_RUN === "1") return;
  const items = await N.queryContent(undefined, [{ timestamp: "created_time", direction: "ascending" }]);
  const staffRows = await N.queryStaff();
  const staff = staffRows.map(s => ({ id: IDS[s.name] || s.name, name: s.name, team: s.team, color: COLORS[s.team] || "#888", status: s.status }));
  // 명부에 아직 없는 설정 직원도 화면에 표시
  for (const [id, s] of Object.entries(cfg.staff)) { const nm = s.display || id; if (!staff.some(x => x.id === (IDS[nm] || nm) || x.name === nm)) staff.push({ id: IDS[nm] || id, name: nm, team: s.team, color: COLORS[s.team] || "#888", status: "근무" }); }
  const minutes = items.filter(i => i.title.startsWith("기획 회의록")).slice(-1)[0];
  const meeting = { title: minutes?.title || "기획 회의록 (없음)", when: "월 09:00", chair: "editor", attendees: ["reg", "trend", "writer", "reviewer"], opinions: [], decisions: [] };
  if (minutes) { const t = await N.readPageText(minutes.id); meeting.decisions = t.split("\n").filter(l => /^(•|-|\d+\.)/.test(l.trim())).slice(0, 6).map(l => l.replace(/^(\s*[-•]|\d+\.)\s*/, "")); }
  const kst = (iso) => new Date(new Date(iso).getTime() + 9 * 3600e3).toISOString().slice(0, 16) + "+09:00";
  let memory = { knowledge: 0, notes: 0, lessons: 0, proposals: 0, latest: [] };
  try { const all = await queryMemory(cfg, undefined, 400); memory = { knowledge: all.filter(k => k.type === "지식 카드").length, notes: all.filter(k => k.type === "업무 노트").length, lessons: all.filter(k => k.type === "교훈 카드").length, proposals: all.filter(k => k.type === "개정 제안").length, latest: all.slice(0, 12).map(k => ({ t: kst(k.created), type: k.type, staff: k.staff, title: k.title, summary: k.summary.slice(0, 120), url: k.url, category: k.category })) }; } catch (e) { console.error("memory snapshot 실패:", e.message); }
  const score = await currentScore(cfg);
  let talk = {}; try { talk = JSON.parse(fs.readFileSync(path.join(ROOT, "office/talk.json"), "utf8")); } catch {}
  const pops = popIndex().map(p => ({ ...p, status: items.find(i => i.id === p.notion_id)?.status || p.status }));
  const fileOf = (i) => pops.find(p => p.notion_id === i.id)?.file || "";
  const departments = [
    ...listDepts().map(d => ({ id: d, name: d === cfg.id ? cfg.name : d, icon: ICON[d] || "🏢", active: true, lines: d === cfg.id ? (cfg.lines || []).join("·") : "" })),
    ...PLANNED,
  ];
  const nextJob = Object.values(cfg.jobs).filter(j => !j.kst.includes("분마다"))[0];
  const snap = {
    generated_at: kstNow().slice(0, 16), week: isoWeek(new Date(), cfg.week_offset || 0), manager: cfg.manager, staff, author_map: IDS, departments, pages_url: cfg.pages_url || "", repo: cfg.github_repo || "", materials_url: cfg.materials_url || "",
    items: items.map(i => ({ id: i.id, t: kst(i.created), title: i.title, status: i.status, line: i.line, type: i.type, author: i.author, stores: i.stores, week: i.week, basis: i.basis, review: i.review, memo: i.memo, url: i.url, file: fileOf(i) })),
    pops, memory, score, talk,
    meeting,
    schedule: Object.values(cfg.jobs).filter(j => !j.kst.includes("분마다")).map(j => ({ when: j.kst, who: j.run.map(r => ({ regulation_watcher: "reg", trend_researcher: "trend", editor: "editor", blog_writer: "writer", regulation_reviewer: "reviewer", upload_recorder: "uploader", pop_designer: "pop", panel_poem: "poem", industry_reader: "reader", memory: "reader", company: "editor", panel: "film", panel_film: "film", panel_novel: "novel" })[r.split(":")[0]]).filter(Boolean), what: j.run.map(r => r.split(":")[1]).join(" · ") })),
    next_shift: { at: new Date(Date.now() + 3600e3).toISOString(), label: "10분마다 승인 감지 · 매일 10:00 작성 / 12:00 POP(화·목) / 17:00 지시서" },
  };
  fs.mkdirSync(path.join(ROOT, "office"), { recursive: true });
  fs.writeFileSync(path.join(ROOT, "office/snapshot.json"), JSON.stringify(snap, null, 1));
  execSync(`python3 office/gen_office.py office/snapshot.json > office/index.html`, { cwd: ROOT, stdio: "inherit" });
  console.log("본사 화면 재생성: office/index.html");
}
