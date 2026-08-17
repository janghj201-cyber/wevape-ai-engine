// 알림 — 카카오 「나에게 보내기」(KAKAO_ACCESS_TOKEN) 또는 웹훅(NOTIFY_WEBHOOK). 없으면 로그만.
export async function notify(text) {
  if (process.env.KAKAO_ACCESS_TOKEN) {
    const tpl = { object_type: "text", text: text.slice(0, 950), link: { web_url: process.env.NOTION_HQ_URL || "https://www.notion.so", mobile_web_url: process.env.NOTION_HQ_URL || "https://www.notion.so" }, button_title: "노션 열기" };
    const r = await fetch("https://kapi.kakao.com/v2/api/talk/memo/default/send", { method: "POST", headers: { Authorization: `Bearer ${process.env.KAKAO_ACCESS_TOKEN}`, "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ template_object: JSON.stringify(tpl) }) });
    if (!r.ok) throw new Error(`Kakao ${r.status}: ${await r.text()}`); return;
  }
  if (process.env.NOTIFY_WEBHOOK) { await fetch(process.env.NOTIFY_WEBHOOK, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }) }); return; }
  console.log("[알림 미설정] " + text.split("\n")[0]);
}
