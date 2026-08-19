// 노션 API 얇은 래퍼 — 「콘텐츠·보고」「AI 직원 명부」 DB 읽기/쓰기
// env: NOTION_TOKEN, NOTION_CONTENT_DB (database id), NOTION_STAFF_DB
const API = "https://api.notion.com/v1";
const H = () => ({
  "Authorization": `Bearer ${process.env.NOTION_TOKEN}`,
  "Notion-Version": "2022-06-28",
  "Content-Type": "application/json",
});
const DRY = process.env.DRY_RUN === "1";

export async function req(method, path, body) {
  if (DRY) {
    console.log(`[DRY] ${method} ${path}`, JSON.stringify(body || {}).slice(0, 200));
    if (path.includes("/query") || path.includes("/children")) return { results: [], has_more: false };
    return { id: "dry-" + Math.random().toString(36).slice(2), url: "https://notion.so/dry" };
  }
  const r = await fetch(API + path, { method, headers: H(), body: body ? JSON.stringify(body) : undefined });
  if (!r.ok) throw new Error(`Notion ${method} ${path} ${r.status}: ${await r.text()}`);
  return r.json();
}

const rich = (t) => [{ type: "text", text: { content: String(t ?? "").slice(0, 1900) } }];
const plain = (p) => (p?.rich_text || p?.title || []).map(x => x.plain_text).join("");

export function pageToItem(p) {
  const P = p.properties;
  return {
    id: p.id, url: p.url, created: p.created_time, edited: p.last_edited_time,
    title: plain(P["제목"]), status: P["상태"]?.select?.name || "", line: P["라인"]?.select?.name || "",
    type: P["유형"]?.select?.name || "", team: P["팀"]?.select?.name || "", author: P["작성자"]?.select?.name || "",
    week: P["주차"]?.select?.name || "", stores: (P["지점"]?.multi_select || []).map(x => x.name),
    basis: plain(P["근거"]), review: plain(P["검수 결과"]), memo: plain(P["관리자 메모"]),
    published: P["발행일"]?.date?.start || "", pub_url: P["발행 URL"]?.url || "",
  };
}

export async function queryContent(filter, sorts) {
  const out = []; let cursor;
  do {
    const body = { page_size: 100 };
    if (filter) body.filter = filter; if (sorts) body.sorts = sorts; if (cursor) body.start_cursor = cursor;
    const r = await req("POST", `/databases/${process.env.NOTION_CONTENT_DB}/query`, body);
    out.push(...r.results.map(pageToItem)); cursor = r.has_more ? r.next_cursor : null;
  } while (cursor);
  return out;
}

export async function queryStaff() {
  const r = await req("POST", `/databases/${process.env.NOTION_STAFF_DB}/query`, { page_size: 100 });
  return r.results.map(p => ({ id: p.id, name: plain(p.properties["이름"]), team: p.properties["팀"]?.select?.name, kind: p.properties["구분"]?.select?.name, status: p.properties["상태"]?.select?.name, role: plain(p.properties["한 줄 역할"]) }));
}

// 마크다운(간단) → 노션 블록. 제목/불릿/코드/구분선/문단만 지원 (표는 문단으로).
export function mdToBlocks(md, max = 95) {
  const blocks = []; const lines = md.split("\n"); let i = 0;
  const T = (t) => ({ type: "text", text: { content: t.slice(0, 1900) } });
  while (i < lines.length && blocks.length < max) {
    const l = lines[i];
    if (l.startsWith("```")) { const buf = []; i++; while (i < lines.length && !lines[i].startsWith("```")) buf.push(lines[i++]); i++;
      blocks.push({ object: "block", type: "code", code: { language: "plain text", rich_text: [T(buf.join("\n"))] } }); continue; }
    if (/^#{1,3} /.test(l)) { const lvl = l.match(/^#+/)[0].length; const k = `heading_${Math.min(lvl, 3)}`; blocks.push({ object: "block", type: k, [k]: { rich_text: [T(l.replace(/^#+ /, ""))] } }); }
    else if (/^\s*[-•] /.test(l)) blocks.push({ object: "block", type: "bulleted_list_item", bulleted_list_item: { rich_text: [T(l.replace(/^\s*[-•] /, ""))] } });
    else if (/^\d+\. /.test(l)) blocks.push({ object: "block", type: "numbered_list_item", numbered_list_item: { rich_text: [T(l.replace(/^\d+\. /, ""))] } });
    else if (l.trim() === "---") blocks.push({ object: "block", type: "divider", divider: {} });
    else if (l.trim()) blocks.push({ object: "block", type: "paragraph", paragraph: { rich_text: [T(l)] } });
    i++;
  }
  return blocks;
}

export async function createContent({ title, status, line, type, team, stores = ["공통"], author, week, basis = "", review = "", memo = "", body = "" }) {
  const props = {
    "제목": { title: rich(title) }, "상태": { select: { name: status } }, "라인": { select: { name: line } },
    "유형": { select: { name: type } }, "팀": { select: { name: team } }, "지점": { multi_select: stores.map(name => ({ name })) },
    "작성자": { select: { name: author } }, "근거": { rich_text: rich(basis) },
  };
  if (week) props["주차"] = { select: { name: week } };
  if (review) props["검수 결과"] = { rich_text: rich(review) };
  if (memo) props["관리자 메모"] = { rich_text: rich(memo) };
  const blocks = mdToBlocks(body, 100000);
  const page = await req("POST", "/pages", { parent: { database_id: process.env.NOTION_CONTENT_DB }, properties: props, children: blocks.slice(0, 95) });
  for (let i = 95; i < blocks.length; i += 95) { try { await req("PATCH", `/blocks/${page.id}/children`, { children: blocks.slice(i, i + 95) }); } catch (e) { console.error("본문 이어붙이기 실패:", e.message); break; } }
  return page;
}

export async function updateContent(pageId, { status, review, memo, published, pub_url }) {
  const props = {};
  if (status) props["상태"] = { select: { name: status } };
  if (review !== undefined) props["검수 결과"] = { rich_text: rich(review) };
  if (memo !== undefined) props["관리자 메모"] = { rich_text: rich(memo) };
  if (published) props["발행일"] = { date: { start: published } };
  if (pub_url) props["발행 URL"] = { url: pub_url };
  return req("PATCH", `/pages/${pageId}`, { properties: props });
}

export async function readPageText(pageId) {
  const out = []; let cursor;
  do {
    const r = await req("GET", `/blocks/${pageId}/children?page_size=100${cursor ? `&start_cursor=${cursor}` : ""}`);
    for (const b of r.results) { const t = b[b.type]?.rich_text; if (t) out.push(t.map(x => x.plain_text).join("")); }
    cursor = r.has_more ? r.next_cursor : null;
  } while (cursor);
  return out.join("\n");
}
