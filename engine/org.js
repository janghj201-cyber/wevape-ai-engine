// 조직 설정 로더 — org/<dept>/department.json + 정의서 md + 규칙서
import fs from "node:fs"; import path from "node:path";
const ROOT = path.resolve(new URL("..", import.meta.url).pathname);

export function loadDept(deptId) {
  const dir = path.join(ROOT, "org", deptId);
  const cfg = JSON.parse(fs.readFileSync(path.join(dir, "department.json"), "utf8"));
  cfg.dir = dir;
  cfg.rulesText = (cfg.rules || []).map(p => fs.readFileSync(path.join(dir, p), "utf8")).join("\n\n---\n\n");
  for (const [id, s] of Object.entries(cfg.staff)) { s.id = id; s.text = fs.readFileSync(path.join(dir, s.file), "utf8"); }
  return cfg;
}
export function listDepts() {
  return fs.readdirSync(path.join(ROOT, "org")).filter(d => d !== "common" && fs.existsSync(path.join(ROOT, "org", d, "department.json")));
}
export function systemPrompt(cfg, staffId, extra = "") {
  const s = cfg.staff[staffId];
  return [
    `당신은 위베이프 ${cfg.name} AI 조직의 「${staffId}」 직원입니다. 아래 역할 정의서를 그대로 따르고, 정의서에 없는 판단은 보수적으로 합니다. 사람이 지켜보지 않는 자동 실행이므로 질문하지 말고 결과만 냅니다.`,
    `# 역할 정의서\n${s.text}`,
    `# 전사·부서 규칙서\n${cfg.rulesText}`,
    extra,
  ].join("\n\n");
}
// ISO 주차 (KST)
export function isoWeek(d = new Date(), offset = 0) {
  const k = new Date(d.getTime() + 9 * 3600e3);
  const date = new Date(Date.UTC(k.getUTCFullYear(), k.getUTCMonth(), k.getUTCDate()));
  const day = date.getUTCDay() || 7; date.setUTCDate(date.getUTCDate() + 4 - day);
  const y = date.getUTCFullYear(); const w = Math.ceil((((date - Date.UTC(y, 0, 1)) / 86400e3) + 1) / 7) + offset;
  return `${y}-W${String(w).padStart(2, "0")}`;
}
export const kstNow = () => new Date(Date.now() + 9 * 3600e3).toISOString().replace("Z", "+09:00");
