#!/usr/bin/env node
// 사용: node engine/run.js <dept> <job|task> [task...]
//   node engine/run.js marketing monday_meeting        (department.json 의 jobs 이름)
//   node engine/run.js marketing editor:plan            (개별 작업)
//   DRY_RUN=1 이면 Claude/노션 쓰기 없이 흐름만 확인
import { loadDept } from "./org.js";
import { REGISTRY } from "./jobs.js";
import { snapshot } from "./snapshot.js";
import { notify } from "./notify.js";

const [dept = "marketing", ...args] = process.argv.slice(2);
const cfg = loadDept(dept);
const tasks = args.flatMap(a => cfg.jobs[a]?.run || [a]);
if (!tasks.length) { console.error("작업을 지정하세요. jobs:", Object.keys(cfg.jobs).join(", ")); process.exit(1); }

const results = [];
for (const t of tasks) {
  const fn = REGISTRY[t]; if (!fn) { results.push(`${t}: 알 수 없는 작업`); continue; }
  const started = Date.now();
  try { const r = await fn(cfg); results.push(`✅ ${t} (${((Date.now() - started) / 1000).toFixed(0)}s)\n${r}`); }
  catch (e) { results.push(`❌ ${t}: ${e.message}`); }
}
console.log(results.join("\n\n"));
try { await snapshot(cfg); } catch (e) { console.error("snapshot 실패:", e.message); }
try { await notify(`[위베이프 AI 조직 · ${dept}]\n` + results.join("\n\n").slice(0, 900)); } catch (e) { console.error("알림 실패:", e.message); }
if (results.some(r => r.startsWith("❌"))) process.exit(2);
