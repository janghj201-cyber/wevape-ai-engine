// 노션 → office/snapshot.json → office/index.html (gen_office.py) — 사무실 화면 재생성
import fs from "node:fs"; import path from "node:path"; import { execSync } from "node:child_process";
import * as N from "./notion.js";
import { kstNow, isoWeek } from "./org.js";
const ROOT = path.resolve(new URL("..", import.meta.url).pathname);
const COLORS = { "편집장": "#2f855a", "트렌드조사": "#d69e2e", "이슈조사": "#c53030", "작성": "#2b6cb0", "검수": "#dd6b20", "업로드": "#6b46c1", "관점패널": "#b83280" };
const IDS = { "주간 마케팅 편집장": "editor", "쇼츠 트렌드 리서처": "trend", "규제 감시자": "reg", "블로그 작가": "writer", "규제 검수관": "reviewer", "업로드 기록원": "uploader", "소설 읽는 사람": "novel", "영화 보는 사람": "film", "시 읽는 사람": "poem" };

export async function snapshot(cfg) {
  if (process.env.DRY_RUN === "1") return;
  const items = await N.queryContent(undefined, [{ timestamp: "created_time", direction: "ascending" }]);
  const staffRows = await N.queryStaff();
  const staff = staffRows.map(s => ({ id: IDS[s.name] || s.name, name: s.name, team: s.team, color: COLORS[s.team] || "#888", status: s.status }));
  const minutes = items.filter(i => i.title.startsWith("기획 회의록")).slice(-1)[0];
  const meeting = { title: minutes?.title || "기획 회의록 (없음)", when: "월 09:00", chair: "editor", attendees: ["reg", "trend", "writer", "reviewer"], opinions: [], decisions: [] };
  if (minutes) { const t = await N.readPageText(minutes.id); meeting.decisions = t.split("\n").filter(l => /^(•|-|\d+\.)/.test(l.trim())).slice(0, 6).map(l => l.replace(/^(\s*[-•]|\d+\.)\s*/, "")); }
  const kst = (iso) => new Date(new Date(iso).getTime() + 9 * 3600e3).toISOString().slice(0, 16) + "+09:00";
  const snap = {
    generated_at: kstNow().slice(0, 16), week: isoWeek(new Date(), cfg.week_offset || 0), manager: cfg.manager, staff, author_map: IDS,
    items: items.map(i => ({ t: kst(i.created), title: i.title, status: i.status, line: i.line, type: i.type, author: i.author, stores: i.stores, week: i.week, basis: i.basis, review: i.review, memo: i.memo, url: i.url })),
    meeting,
    schedule: Object.values(cfg.jobs).filter(j => !j.kst.includes("분마다")).map(j => ({ when: j.kst, who: j.run.map(r => ({ regulation_watcher: "reg", trend_researcher: "trend", editor: "editor", blog_writer: "writer", regulation_reviewer: "reviewer", upload_recorder: "uploader" })[r.split(":")[0]]).filter(Boolean), what: j.run.map(r => r.split(":")[1]).join(" · ") })),
    next_shift: { at: new Date(Date.now() + 3600e3).toISOString(), label: "다음 출근 시계 (10분마다 이벤트 폴링, 매일 10:00/17:00 정기)" },
  };
  fs.mkdirSync(path.join(ROOT, "office"), { recursive: true });
  fs.writeFileSync(path.join(ROOT, "office/snapshot.json"), JSON.stringify(snap, null, 1));
  execSync(`python3 office/gen_office.py office/snapshot.json > office/index.html`, { cwd: ROOT, stdio: "inherit" });
  console.log("사무실 화면 재생성: office/index.html");
}
