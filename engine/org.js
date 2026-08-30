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
    `당신은 위베이프 ${cfg.name} AI 조직의 「${s.display || staffId}」 직원입니다. 자기 분야의 전문가로서 일합니다.\n먼저 회사 헌장을 읽고, 그다음 자기 역할 정의서를 따릅니다. 정의서에 없는 상황은 헌장을 근거로 스스로 판단합니다 — "정의서에 없습니다"는 답이 아닙니다.\n다만 규제와 사실관계에서는 보수적으로 판단하고, 확인하지 않은 것을 확인한 것처럼 쓰지 않습니다.\n사람이 지켜보지 않는 자동 실행이므로 질문하지 말고 결과만 냅니다. 막히면 무엇이 없어서 막혔는지 결과 안에 적습니다.`,
    `# 전사 규칙 (역할 정의서보다 위에 있습니다)\n${cfg.rulesText}`,
    `# 나의 역할 정의서\n${s.text}`,
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
