#!/usr/bin/env python3
"""위베이프 AI 조직 — 본사 화면 생성기 v2 (대표실 → 복도 → 부서 방)
사용: python3 gen_office.py snapshot.json > index.html
snapshot.json 은 engine/snapshot.js 가 노션에서 뽑아 만든다.
장면 3개를 한 파일에 담고 해시(#ceo / #hall / #marketing)로 전환한다.
"""
import json, sys

snap = json.load(open(sys.argv[1], encoding="utf-8"))
DATA = json.dumps(snap, ensure_ascii=False)

TEMPLATE = r"""<!DOCTYPE html>
<html lang="ko"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>위베이프 AI 조직 · 본사</title>
<style>
:root{--bg:#efe9dd;--ink:#1f2937;--muted:#6b7280;--line:#d9d2c5;--card:#fffdf8;--navy:#1e2a3a;--wood:#c9a97a;--wood2:#a8875a;
--ok:#2f855a;--wait:#dd6b20;--rej:#c53030;--pub:#2b6cb0;--draft:#9ca3af;--rev:#d69e2e}
*{box-sizing:border-box}html,body{margin:0;background:var(--bg);color:var(--ink);font-family:"Pretendard","Apple SD Gothic Neo","Noto Sans KR",system-ui,sans-serif}
a{color:inherit}
.top{background:var(--navy);color:#fff;display:flex;align-items:center;gap:14px;padding:10px 20px;position:sticky;top:0;z-index:9}
.top h1{font-size:17px;margin:0;font-weight:800;letter-spacing:-.2px;white-space:nowrap}
.crumb{display:flex;gap:6px;align-items:center;font-size:13px}
.crumb a{color:#fff;text-decoration:none;opacity:.7;padding:3px 9px;border-radius:999px;border:1px solid transparent}
.crumb a.on{opacity:1;border-color:rgba(255,255,255,.4);background:rgba(255,255,255,.08)}
.crumb i{opacity:.4;font-style:normal}
.top .sp{flex:1}
.top .clock{font-variant-numeric:tabular-nums;font-size:12px;opacity:.9;text-align:right;line-height:1.35}
.scene{display:none;max-width:1400px;margin:0 auto;padding:16px 18px 44px}
.scene.on{display:block}
.badge{display:inline-block;min-width:20px;padding:1px 7px;border-radius:999px;background:var(--wait);color:#fff;font-size:11px;font-weight:800;text-align:center;vertical-align:middle}
.badge.zero{background:#cbd5e1}
.status{display:inline-block;font-size:10px;padding:1px 7px;border-radius:999px;color:#fff;font-weight:700;vertical-align:middle}
.s-승인{background:var(--ok)}.s-승인대기{background:var(--wait)}.s-반려{background:var(--rej)}.s-발행{background:var(--pub)}.s-초안{background:var(--draft)}.s-검수중{background:var(--rev)}
.btn{display:inline-block;background:var(--navy);color:#fff;text-decoration:none;font-size:12px;font-weight:700;padding:7px 12px;border-radius:8px;border:0;cursor:pointer}
.btn.ghost{background:#fff;color:var(--navy);border:1.5px solid var(--navy)}
.btn.sm{padding:4px 9px;font-size:11px}

/* ── 대표실 ── */
.ceo-room{position:relative;border-radius:18px;overflow:hidden;border:2px solid #b8a27a;background:linear-gradient(#f7f1e3 0 42%,#e7d6b6 42% 100%);min-height:560px;padding:18px}
.ceo-room:before{content:"";position:absolute;left:0;right:0;top:42%;height:6px;background:#a8875a;opacity:.5}
.ceo-head{display:flex;align-items:center;gap:12px;margin-bottom:8px}
.ceo-head h2{margin:0;font-size:20px}
.ceo-head small{color:var(--muted);font-size:12px}
.window{margin-left:auto;width:150px;height:74px;flex:none;border:6px solid #8b6f45;border-radius:6px;background:linear-gradient(#bfe0f5,#eaf6fb);box-shadow:inset 0 0 0 2px #fff}
.window:before,.window:after{content:"";position:absolute;background:#8b6f45}
.window:before{left:50%;top:0;bottom:0;width:4px;margin-left:-2px}.window:after{top:50%;left:0;right:0;height:4px;margin-top:-2px}
.ceo-grid{display:grid;grid-template-columns:1.35fr .9fr;gap:16px;position:relative;margin-top:6px}
.desk{background:linear-gradient(#d8b98a,#c9a97a);border:2px solid var(--wood2);border-radius:14px;padding:14px;box-shadow:0 10px 24px rgba(0,0,0,.12)}
.desk h3{margin:0 0 8px;font-size:14px;display:flex;align-items:center;gap:8px}
.tray{background:#fffdf8;border:1.5px solid var(--line);border-radius:12px;padding:10px;min-height:250px;box-shadow:inset 0 2px 8px rgba(0,0,0,.05)}
.docs{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:10px}
.doc{background:#fff;border:1px solid var(--line);border-left:5px solid var(--wait);border-radius:8px;padding:9px 10px;font-size:12px;box-shadow:0 2px 5px rgba(0,0,0,.06);position:relative;transition:transform .15s}
.doc:hover{transform:translateY(-2px)}
.doc b{display:block;font-size:12.5px;line-height:1.35;margin-bottom:4px;padding-right:58px}
.doc .who{color:var(--muted);font-size:11px}
.doc .rev{margin-top:5px;font-size:11px;background:#fbf7ee;border-radius:6px;padding:4px 6px;color:#374151;max-height:56px;overflow:hidden}
.doc .act{margin-top:7px;display:flex;gap:6px;flex-wrap:wrap}
.doc.pop{border-left-color:#b83280}.doc.plan{border-left-color:#2f855a}.doc.report{border-left-color:#2b6cb0}
.stamp{position:absolute;right:8px;top:8px;font-size:10px;border:1.5px solid var(--wait);color:var(--wait);border-radius:4px;padding:1px 5px;transform:rotate(-8deg);font-weight:800;letter-spacing:.5px}
.empty{color:var(--muted);text-align:center;padding:60px 0;font-size:13px}
.side{display:flex;flex-direction:column;gap:12px}
.card{background:var(--card);border:1.5px solid var(--line);border-radius:12px;padding:10px 12px;font-size:12px}
.card h3{margin:0 0 6px;font-size:12px;color:var(--muted);display:flex;gap:6px;align-items:center}
.brief li{margin:3px 0}
.brief ul{margin:0;padding-left:16px}
.doorbtn{display:flex;align-items:center;gap:12px;background:#8b6f45;color:#fff;border-radius:12px;padding:12px 14px;text-decoration:none;font-weight:800;font-size:14px;box-shadow:0 6px 14px rgba(0,0,0,.15);border:2px solid #6c5433}
.doorbtn .d{width:26px;height:40px;background:#c9a97a;border:2px solid #6c5433;border-radius:3px;position:relative}
.doorbtn .d:after{content:"";position:absolute;right:4px;top:18px;width:4px;height:4px;border-radius:50%;background:#f6d365}
.doorbtn small{display:block;font-weight:400;font-size:11px;opacity:.85}
.person{width:54px;text-align:center;font-size:10px;line-height:1.15;color:#374151;position:relative;transition:transform .8s}
.person svg{display:block;margin:0 auto 2px}
.person.away{opacity:.28}
.person .bub{position:absolute;left:50%;transform:translateX(-50%);bottom:64px;background:#fff;border:1px solid var(--line);border-radius:10px;padding:4px 7px;font-size:10px;box-shadow:0 2px 6px rgba(0,0,0,.08);opacity:0;transition:opacity .4s;pointer-events:none;max-width:200px;white-space:normal;width:max-content;z-index:3}
.person.talk .bub{opacity:1}
.person.walk svg{animation:bob .6s infinite alternate}
@keyframes bob{from{transform:translateY(0)}to{transform:translateY(-3px)}}
.ceo-chair{position:absolute;left:50%;top:6px;transform:translateX(-50%)}

/* ── 복도 ── */
.hall{position:relative;border-radius:18px;overflow:hidden;border:2px solid #b8a27a;background:linear-gradient(#f3ecdd 0 55%,#dcc9a6 55% 100%);min-height:520px;padding:18px}
.hall h2{margin:0 0 4px;font-size:20px}
.hall p.sub{margin:0 0 14px;color:var(--muted);font-size:12px}
.doors{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:18px;margin-top:26px}
.door{position:relative;background:#fff;border:1.5px solid var(--line);border-radius:14px;padding:12px;text-decoration:none;color:inherit;display:block;transition:transform .15s,box-shadow .15s}
.door:hover{transform:translateY(-3px);box-shadow:0 10px 24px rgba(0,0,0,.12)}
.door .frame{height:120px;border-radius:8px 8px 2px 2px;background:linear-gradient(#a8875a,#8b6f45);border:3px solid #6c5433;position:relative;margin-bottom:10px;display:flex;align-items:center;justify-content:center;color:#fff;font-size:34px}
.door .frame:after{content:"";position:absolute;right:12px;top:56px;width:7px;height:7px;border-radius:50%;background:#f6d365;box-shadow:0 0 0 2px #6c5433}
.door .frame .plate{position:absolute;top:8px;left:50%;transform:translateX(-50%);background:#f6d365;color:#3b3b3b;font-size:11px;font-weight:800;padding:2px 8px;border-radius:3px;border:1px solid #b7791f;white-space:nowrap}
.door h3{margin:0 0 3px;font-size:14px;display:flex;justify-content:space-between;align-items:center}
.door .meta{font-size:11px;color:var(--muted);line-height:1.5}
.door.locked{opacity:.62;filter:grayscale(.3)}
.door.locked .frame{background:linear-gradient(#b8b0a2,#8f877a);border-color:#6b6357}
.door.locked .frame:after{background:#ddd}
.door .lock{position:absolute;right:10px;top:10px;font-size:14px}
.door .heads{display:flex;gap:2px;margin-top:6px}
.door .heads span{width:16px;height:16px;border-radius:50%;border:2px solid #fff;box-shadow:0 0 0 1px var(--line)}

/* ── 부서 방 (마케팅) ── */
.grid{display:grid;grid-template-columns:230px 1fr 250px;gap:14px;align-items:start}
.room{background:var(--card);border:1.5px solid var(--line);border-radius:14px;padding:10px 12px;position:relative;min-height:96px;margin-bottom:12px;overflow:hidden}
.room h3{margin:0 0 6px;font-size:12px;letter-spacing:.2px;color:var(--muted);font-weight:700;display:flex;gap:6px;align-items:center}
.room .desk2{height:8px;border-radius:4px;background:#e9e2d5;margin:4px 0 8px}
.people{display:flex;gap:10px;flex-wrap:wrap;min-height:58px;align-items:flex-end}
.out{font-size:11px;background:#fbf7ee;border-left:3px solid var(--line);padding:5px 8px;border-radius:6px;margin-top:6px;color:#374151}
.out b{display:block;font-size:11px;color:#111}
.center .room{min-height:150px}
.meet{min-height:210px}
.meet .table{margin:8px auto 4px;width:76%;height:44px;border-radius:50%;background:#e6dcc7;border:2px solid #d2c4a6;box-shadow:inset 0 3px 8px rgba(0,0,0,.06)}
.meet .seats{display:flex;justify-content:space-around;flex-wrap:wrap}
.meet .agenda{font-size:11px;color:#374151;margin-top:6px}
.meet .agenda li{margin:2px 0}
.factory{min-height:230px}
.belt{position:relative;height:120px;background:repeating-linear-gradient(90deg,#efe8da 0 24px,#e7dfcf 24px 48px);border-radius:10px;overflow:hidden;border:1px solid var(--line)}
.belt .bcard{position:absolute;top:14px;width:165px;background:#fff;border:1px solid var(--line);border-radius:8px;padding:6px 8px;font-size:11px;box-shadow:0 2px 6px rgba(0,0,0,.08);animation:slide var(--dur,40s) linear infinite;animation-delay:var(--delay,0s)}
.belt .bcard b{display:block;font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.belt .bcard small{color:var(--muted)}
@keyframes slide{from{left:100%}to{left:-190px}}
.flow{display:flex;gap:6px;align-items:center;font-size:11px;color:var(--muted);margin:8px 0 2px;flex-wrap:wrap}
.flow span{background:#fff;border:1px solid var(--line);border-radius:6px;padding:2px 8px}
.flow i{font-style:normal}
.stats{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:8px}
.stat{background:#fff;border:1px solid var(--line);border-radius:8px;padding:6px 8px;text-align:center}
.stat b{display:block;font-size:20px;line-height:1.1}
.stat small{font-size:10px;color:var(--muted)}
.popwall{min-height:150px}
.mem{min-height:120px}
.mem .shelf{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:6px 0 8px}
.mem .book{border-radius:6px;padding:6px 8px;color:#fff;text-align:center;font-size:11px}
.mem .book b{display:block;font-size:18px;line-height:1.1}
.mem .feed{font-size:11px;max-height:120px;overflow:auto}
.mem .feed div{padding:3px 0;border-bottom:1px dashed var(--line)}
.mem .feed .k{display:inline-block;font-size:10px;padding:0 6px;border-radius:999px;color:#fff;margin-right:4px}
.pops{display:flex;gap:10px;overflow-x:auto;padding:6px 2px}
.popthumb{flex:0 0 150px;text-decoration:none;color:inherit}
.popthumb .fr{width:150px;height:212px;overflow:hidden;border:1px solid var(--line);border-radius:6px;background:#fff;box-shadow:0 3px 8px rgba(0,0,0,.1);position:relative}
.popthumb iframe{width:800px;height:1130px;transform:scale(.1875);transform-origin:0 0;border:0;pointer-events:none}
.popthumb small{display:block;font-size:10px;color:var(--muted);margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.log{margin-top:16px;background:var(--card);border:1.5px solid var(--line);border-radius:14px;padding:12px 14px}
.log h3{margin:0 0 8px;font-size:13px;color:var(--muted)}
.tl{display:grid;grid-template-columns:120px 26px 1fr;gap:6px 10px;font-size:12px;align-items:start;max-height:330px;overflow:auto}
.tl .t{color:var(--muted);font-variant-numeric:tabular-nums}
.tl .av{width:22px;height:22px;border-radius:50%;display:inline-block}
.tl .row{cursor:pointer;display:contents}
.tl .row:hover > div{background:#f7f2e8}
.trace{margin-top:10px;background:#fff;border:1px solid var(--line);border-radius:10px;padding:10px 12px;font-size:12px;min-height:60px}
.trace .step{display:inline-block;background:#f3eee3;border-radius:6px;padding:3px 8px;margin:2px 4px 2px 0}
.trace .arrow{color:var(--muted);margin:0 2px}
.sched{display:grid;grid-template-columns:70px 1fr;gap:4px 8px;font-size:11px}
.sched .w{color:var(--muted);font-variant-numeric:tabular-nums}
.chip{display:inline-block;width:10px;height:10px;border-radius:50%;margin-right:3px;vertical-align:-1px}
.foot{font-size:11px;color:var(--muted);margin-top:10px}
@media(max-width:1000px){.grid,.ceo-grid{grid-template-columns:1fr}.stats{grid-template-columns:repeat(2,1fr)}.window{display:none}}
</style></head><body>
<div class="top">
  <h1>🏢 위베이프 AI 조직 · 본사</h1>
  <nav class="crumb"><a href="#ceo" data-s="ceo">👤 대표실</a><i>›</i><a href="#hall" data-s="hall">🚪 복도</a><i>›</i><a href="#marketing" data-s="marketing" id="crumb-dept">📣 마케팅 방</a></nav>
  <span class="sp"></span>
  <div class="clock"><div id="now"></div><div id="next"></div></div>
</div>

<section class="scene" id="s-ceo"></section>
<section class="scene" id="s-hall"></section>
<section class="scene" id="s-marketing">
<div class="grid">
  <div class="left" id="left"></div>
  <div class="center">
    <div class="room meet" id="meet"></div>
    <div class="room factory" id="factory"></div>
    <div class="room popwall" id="popwall"></div>
    <div class="room mem" id="mem"></div>
  </div>
  <div class="right">
    <div class="room ceo" id="ceo"></div>
    <div class="room" id="editor"></div>
    <div class="room" id="sched"></div>
  </div>
</div>
<div class="log">
  <h3>🕓 활동 로그 — 누가, 언제, 무엇을 (클릭하면 처리 과정 추적)</h3>
  <div class="tl" id="tl"></div>
  <div class="trace" id="trace">항목을 클릭하면 「누가 무엇을 근거로 만들었고 → 누가 검수했고 → 관리자가 어떻게 처리했는지」가 표시됩니다.</div>
  <div class="foot">스냅샷 생성: <span id="gen"></span> · 데이터 원본: 노션 「위베이프 마케팅 AI 조직」 콘텐츠·보고 DB · 이 화면은 출근 시계가 돌 때마다 다시 생성됩니다.</div>
</div>
</section>

<script>
const D = __DATA__;
D.pops = D.pops || []; D.departments = D.departments || [{id:"marketing",name:"마케팅",icon:"📣",active:true}];
const byId = Object.fromEntries(D.staff.map(s=>[s.id,s]));
const teamRooms = ["트렌드조사","이슈조사","작성","검수","업로드"];
const teamIcon = {"트렌드조사":"📱","이슈조사":"🚨","작성":"✍️","검수":"🛡️","업로드":"📤","편집장":"🧭","관점패널":"🎭"};
function fig(s, size=38){
  const c=s.color; return `<svg width="${size}" height="${size+8}" viewBox="0 0 38 46"><circle cx="19" cy="10" r="8" fill="#fde7c8" stroke="#3b3b3b" stroke-width="1.5"/><path d="M11 10 q8-9 16 0" fill="#3b3b3b"/><rect x="9" y="19" width="20" height="17" rx="5" fill="${c}"/><rect x="11" y="36" width="6" height="8" fill="#3b3b3b"/><rect x="21" y="36" width="6" height="8" fill="#3b3b3b"/><rect x="26" y="24" width="8" height="10" rx="1" fill="#f6d365" stroke="#b7791f"/></svg>`;
}
function person(s, cls="", bub=""){ if(!s) return ""; return `<div class="person ${cls}" data-id="${s.id}">${fig(s)}<div>${s.name}</div>${bub?`<div class="bub">${bub}</div>`:""}</div>`; }
function st(x){ return `<span class="status s-${(x||'').replace(/\s/g,'')}">${x}</span>`; }
function esc(x){ return (x||"").replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c])); }
const items = [...D.items].sort((a,b)=>a.t.localeCompare(b.t));
const latestBy = {};
items.forEach(it=>{ const id=D.author_map[it.author]; if(id) latestBy[id]=it; });
const wait = items.filter(i=>i.status==="승인 대기");
const today = D.generated_at.slice(0,10);
const todayItems = items.filter(i=>i.t.slice(0,10)===today);
const cnt = s=>items.filter(i=>i.status===s).length;

/* ─────────── 장면 1: 대표실 ─────────── */
(function(){
  const kind = it => it.line==="POP"?"pop":(it.type==="기획안"?"plan":(it.type==="개정 제안"?"plan":(it.line==="보고"||it.line==="기획"?"report":"")));
  const docs = wait.length ? `<div class="docs">${wait.map(it=>`
    <div class="doc ${kind(it)}"><span class="stamp">결재 대기</span>
      <b>${esc(it.title)}</b>
      <div class="who">${esc(it.author)} · ${it.line}·${it.type} · ${it.t.slice(5,16).replace('T',' ')}</div>
      ${it.review?`<div class="rev">🛡️ ${esc(it.review)}</div>`:""}
      <div class="act"><a class="btn sm" href="${it.url}" target="_blank">서류 열기 → 승인/반려</a>${it.file?`<a class="btn sm ghost" href="${it.file}" target="_blank">미리보기</a>`:""}</div>
    </div>`).join("")}</div>` : `<div class="empty">📭 결재함이 비었습니다 — 모두 처리됨. 직원들이 다음 결과물을 만드는 중입니다.</div>`;
  const byDept = D.departments.map(d=>{
    const n = d.active ? items.length : 0;
    return `<li><b>${d.icon} ${d.name}</b> — ${d.active?`오늘 산출물 ${todayItems.length}건 · 승인 대기 ${wait.length}건 · 근무 ${D.staff.filter(s=>s.status!=="채용 예정").length}명`:"준비 중"}</li>`;
  }).join("");
  const MEMc = D.memory || {knowledge:0,notes:0,lessons:0,proposals:0};
  const recent = items.filter(i=>i.memo).slice(-3).map(i=>`<li>${esc(i.title.slice(0,28))} — ${esc(i.memo.slice(0,70))}</li>`).join("") || "<li>기록 없음</li>";
  const ceo = {id:"ceo",name:D.manager,color:"#1e2a3a"};
  document.getElementById('s-ceo').innerHTML = `
  <div class="ceo-room">
    <div class="ceo-head"><h2>👤 대표실</h2><small>관리자 ${esc(D.manager)} · 여기서 하는 일은 승인·반려뿐. 나머지는 직원들이 돌린다.</small><div class="window"></div></div>
    <div class="ceo-grid">
      <div class="desk">
        <h3>🗂️ 결재함 <span class="badge ${wait.length?'':'zero'}">${wait.length}</span> <small style="font-weight:400;color:#5b4630">서류를 열어 노션에서 상태를 「승인」 또는 「반려」로 바꾸면 10분 안에 직원들이 이어받습니다.</small></h3>
        <div class="tray">${docs}</div>
        <div style="margin-top:10px;display:flex;justify-content:center"><div class="person" style="width:64px">${fig(ceo,44)}<div>${esc(D.manager)}</div></div></div>
      </div>
      <div class="side">
        <a class="doorbtn" href="#hall"><span class="d"></span><span>복도로 나가기<small>부서 방으로 이동 · ${D.departments.filter(d=>d.active).length}개 부서 근무 중</small></span></a>
        <div class="card brief"><h3>📋 오늘 브리핑 (${today})</h3><ul>${byDept}</ul></div>
        <div class="card brief"><h3>📌 최근 결정 (관리자 메모)</h3><ul>${recent}</ul><div style="margin-top:6px;color:var(--muted)">반려·메모는 10분 안에 해당 직원의 교훈 카드가 됩니다.</div></div>
        <div class="card brief"><h3>📚 조직의 기억</h3><ul><li>지식 카드 <b>${MEMc.knowledge}</b> · 업무 노트 <b>${MEMc.notes}</b> · 교훈 <b>${MEMc.lessons}</b> · 개정 제안 <b>${MEMc.proposals}</b></li></ul></div>
        <div class="card"><h3>📈 누적</h3>
          <div class="stats"><div class="stat"><b>${items.length}</b><small>결과물</small></div><div class="stat"><b>${cnt("승인")+cnt("발행")}</b><small>승인·발행</small></div><div class="stat"><b>${cnt("승인 대기")}</b><small>대기</small></div><div class="stat"><b>${cnt("반려")}</b><small>반려</small></div></div></div>
      </div>
    </div>
  </div>`;
})();

/* ─────────── 장면 2: 복도 ─────────── */
(function(){
  const doors = D.departments.map(d=>{
    if(!d.active) return `<div class="door locked"><span class="lock">🔒</span><div class="frame"><span class="plate">${d.name}</span>${d.icon}</div><h3>${d.name} 방</h3><div class="meta">${esc(d.desc||"준비 중 — department.json 하나로 개설")}</div></div>`;
    const active = D.staff.filter(s=>s.status!=="채용 예정");
    return `<a class="door" href="#${d.id}"><div class="frame"><span class="plate">${d.name}</span>${d.icon}</div>
      <h3>${d.name} 방 <span class="badge ${wait.length?'':'zero'}">${wait.length}</span></h3>
      <div class="meta">근무 ${active.length}명 · 라인: ${esc(d.lines||"블로그·POP")}<br>오늘 산출물 ${todayItems.length}건 · 다음 출근 ${esc(D.next_shift.label.split(" ")[0])}</div>
      <div class="heads">${active.slice(0,9).map(s=>`<span style="background:${s.color}" title="${s.name}"></span>`).join("")}</div></a>`;
  }).join("");
  document.getElementById('s-hall').innerHTML = `<div class="hall"><h2>🚪 복도</h2><p class="sub">문을 열면 그 부서의 사무실이 보입니다. 잠긴 문은 아직 채용 전 부서 — 정의서와 시계만 있으면 열립니다.</p><div class="doors">${doors}</div>
  <div style="margin-top:22px"><a class="btn ghost" href="#ceo">← 대표실로</a></div></div>`;
})();

/* ─────────── 장면 3: 마케팅 방 (기존 사무실) ─────────── */
let L="";
teamRooms.forEach(team=>{
  const members = D.staff.filter(s=>s.team===team);
  L += `<div class="room"><h3><span>${teamIcon[team]}</span>${team}팀</h3><div class="desk2"></div><div class="people">`;
  members.forEach(s=>{ const it=latestBy[s.id]; L += person(s, s.status==="채용 예정"?"away":"", it? `${it.title.slice(0,26)}… ${it.status}`:""); });
  L += `</div>`;
  members.forEach(s=>{ const it=latestBy[s.id]; if(it) L += `<div class="out"><b>${esc(it.title)}</b>${st(it.status)} <small>${it.t.slice(5,16).replace('T',' ')}</small></div>`; });
  L += `</div>`;
});
const panel = D.staff.filter(s=>s.team==="관점패널");
L += `<div class="room"><h3><span>🎭</span>관점 패널 <small style="font-weight:400">· POP·영상 라인 참여</small></h3><div class="desk2"></div><div class="people">${panel.map(s=>person(s, s.status==="채용 예정"?"away":"", latestBy[s.id]?latestBy[s.id].title.slice(0,26):"")).join("")}</div></div>`;
document.getElementById('left').innerHTML = L;

const m = D.meeting;
let M = `<h3><span>🤝</span>회의실 — ${esc(m.title)} <small style="font-weight:400">(${m.when}, 자동 회의)</small></h3>`;
M += `<div class="table"></div><div class="seats">${[m.chair,...m.attendees].map(id=>person(byId[id],"", "")).join("")}</div>`;
M += `<ul class="agenda"><b style="font-size:11px">결정</b>${m.decisions.map(d=>`<li>• ${esc(d)}</li>`).join("")}</ul>`;
document.getElementById('meet').innerHTML = M;

const outputs = items.filter(i=>["블로그","기획","보고","POP"].includes(i.line));
let F = `<h3><span>🏭</span>AI 가공실 — 결과물 흐름</h3>
<div class="flow"><span>이슈 브리핑·트렌드 보고</span><i>→</i><span>기획 회의</span><i>→</i><span>기획안</span><i>→</i><span>글·POP 제작</span><i>→</i><span>10항목 검수</span><i>→</i><span>관리자 승인</span><i>→</i><span>발행·인쇄 지시서</span><i>→</i><span>발행</span></div>
<div class="belt">`;
const last=outputs.slice(-5), dur=60; last.forEach((it,i)=>{ F += `<div class="bcard" style="--delay:${-i*(dur/last.length)}s;--dur:${dur}s"><b>${esc(it.title)}</b><small>${it.line}·${it.type} · ${esc(it.author)}</small><br>${st(it.status)}</div>`; });
F += `</div><div class="stats"><div class="stat"><b>${items.length}</b><small>누적 결과물</small></div><div class="stat"><b>${cnt("승인")}</b><small>승인</small></div><div class="stat"><b>${cnt("승인 대기")}</b><small>승인 대기</small></div><div class="stat"><b>${cnt("반려")}</b><small>반려</small></div></div>`;
document.getElementById('factory').innerHTML = F;

// POP 게시판
let P = `<h3><span>🖼️</span>POP 게시판 — 매장 인쇄물 (검수·승인 후 인쇄)</h3>`;
P += D.pops.length ? `<div class="pops">${D.pops.slice(-8).reverse().map(p=>`<a class="popthumb" href="${p.file}" target="_blank" title="${esc(p.title)}"><div class="fr"><iframe src="${p.file}" loading="lazy" tabindex="-1"></iframe></div><small>${esc(p.store)} · ${esc(p.title)} ${st(p.status||"")}</small></a>`).join("")}</div>` : `<div class="out">아직 POP 없음 — POP 디자이너 첫 근무(화·목 12:00) 후 여기 걸립니다.</div>`;
document.getElementById('popwall').innerHTML = P;

// 기억·성장 서고
const MEM = D.memory || {knowledge:0,notes:0,lessons:0,proposals:0,latest:[]};
const kcol = {"지식 카드":"#2b6cb0","업무 노트":"#6b7280","교훈 카드":"#c53030","개정 제안":"#6b46c1"};
let MM = `<h3><span>📚</span>기억·성장 서고 — 업계 독서가가 채우고, 모든 직원이 출근 전에 읽는다</h3>
<div class="shelf"><div class="book" style="background:#2b6cb0"><b>${MEM.knowledge}</b>지식 카드</div><div class="book" style="background:#6b7280"><b>${MEM.notes}</b>업무 노트</div><div class="book" style="background:#c53030"><b>${MEM.lessons}</b>교훈 카드</div><div class="book" style="background:#6b46c1"><b>${MEM.proposals}</b>정의서 개정 제안</div></div>
<div class="feed">${MEM.latest.length? MEM.latest.map(k=>`<div><span class="k" style="background:${kcol[k.type]||'#888'}">${k.type}</span><b>${esc(k.staff)}</b> · <a href="${k.url}" target="_blank">${esc(k.title)}</a> <span style="color:var(--muted)">— ${esc(k.summary)}</span></div>`).join("") : `<div style="color:var(--muted)">아직 비어 있음 — 업계 독서가 첫 근무 후 채워집니다.</div>`}</div>`;
document.getElementById('mem').innerHTML = MM;

let C = `<h3><span>👤</span>대표실 결재함 (요약)</h3><div class="out">`;
C += wait.length? `<ul style="margin:0;padding-left:14px">${wait.map(i=>`<li>${st(i.status)} <a href="${i.url}" target="_blank">${esc(i.title.slice(0,30))}</a></li>`).join("")}</ul>` : `<div style="color:#6b7280">승인 대기 없음 ✔</div>`;
C += `</div><div style="margin-top:8px"><a class="btn sm" href="#ceo">대표실로 가서 결재하기 →</a></div>`;
document.getElementById('ceo').innerHTML = C;

const ed = byId.editor, edIt = latestBy.editor;
document.getElementById('editor').innerHTML = `<h3><span>🧭</span>편집장실</h3><div class="desk2"></div><div class="people">${person(ed,"",edIt?edIt.title.slice(0,30):"")}</div>${edIt?`<div class="out"><b>${esc(edIt.title)}</b>${st(edIt.status)}</div>`:""}`;

let S = `<h3><span>⏰</span>출근 시계 (KST)</h3><div class="sched">`;
D.schedule.forEach(r=>{ S += `<div class="w">${r.when}</div><div>${r.who.map(id=>byId[id]?`<span class="chip" style="background:${byId[id].color}"></span>`:"").join("")}${esc(r.what)}</div>`; });
S += `</div>`;
document.getElementById('sched').innerHTML = S;

let T="";
items.slice().reverse().forEach((it,idx)=>{
  const s = byId[D.author_map[it.author]] || {color:"#999"};
  T += `<div class="row" data-i="${items.length-1-idx}"><div class="t">${it.t.slice(5,16).replace('T',' ')}</div><div><span class="av" style="background:${s.color}"></span></div><div><b>${esc(it.author)}</b> · ${esc(it.title)} ${st(it.status)}</div></div>`;
});
document.getElementById('tl').innerHTML = T;
document.querySelectorAll('.tl .row').forEach(r=>r.addEventListener('click',()=>{
  const it = items[+r.dataset.i];
  let h = `<b>${esc(it.title)}</b> <a href="${it.url}" target="_blank" style="font-size:11px">노션 열기</a>${it.file?` · <a href="${it.file}" target="_blank" style="font-size:11px">미리보기</a>`:""}<br>`;
  h += `<span class="step">근거: ${esc(it.basis||"—")}</span><span class="arrow">→</span><span class="step">${esc(it.author)} 작성 (${it.t.slice(5,16).replace('T',' ')})</span>`;
  if(it.review) h += `<span class="arrow">→</span><span class="step">규제 검수관: ${esc(it.review)}</span>`;
  h += `<span class="arrow">→</span><span class="step">관리자: ${it.status}${it.memo?` — ${esc(it.memo)}`:""}</span>`;
  if(it.status==="승인" && (it.line==="블로그"||it.line==="POP")) h += `<span class="arrow">→</span><span class="step">업로드 기록원: ${it.line==="POP"?"인쇄":"발행"} 지시서 포함</span>`;
  document.getElementById('trace').innerHTML = h;
}));

/* ─────────── 장면 전환 + 시계 + 애니메이션 ─────────── */
function show(){
  let s = (location.hash||"#ceo").slice(1); if(!document.getElementById('s-'+s)) s="ceo";
  document.querySelectorAll('.scene').forEach(e=>e.classList.toggle('on', e.id==='s-'+s));
  document.querySelectorAll('.crumb a').forEach(a=>a.classList.toggle('on', a.dataset.s===s));
  window.scrollTo(0,0);
}
window.addEventListener('hashchange', show); show();
document.getElementById('gen').textContent = D.generated_at;
function tick(){
  const now = new Date();
  const kst = new Date(now.getTime() + (9*60 + now.getTimezoneOffset())*60000);
  document.getElementById('now').textContent = `KST ${kst.toLocaleString('ko-KR',{hour12:false})} · ${D.week}`;
  const nx = new Date(D.next_shift.at); const diff = Math.max(0, nx - now);
  const h = Math.floor(diff/3600000), mm = Math.floor(diff%3600000/60000);
  document.getElementById('next').textContent = `다음 출근: ${D.next_shift.label} · ${h}시간 ${mm}분 후`;
}
tick(); setInterval(tick, 30000);
const persons = [...document.querySelectorAll('#s-marketing .person:not(.away)')];
let k=0;
setInterval(()=>{ persons.forEach(p=>p.classList.remove('talk','walk')); const p = persons[k%persons.length]; if(p){ p.classList.add(p.querySelector('.bub')?'talk':'walk'); } k++; }, 1800);
const seatEls = [...document.querySelectorAll('#meet .person')];
let oi=0; setInterval(()=>{ if(!m.opinions.length) return; seatEls.forEach(e=>{e.classList.remove('talk'); const b=e.querySelector('.bub'); if(b) b.remove();}); const op = m.opinions[oi%m.opinions.length]; const el = seatEls.find(e=>e.dataset.id===op.who); if(el){ el.insertAdjacentHTML('beforeend',`<div class="bub">${esc(op.text)}</div>`); el.classList.add('talk'); } oi++; }, 3200);
</script></body></html>"""

print(TEMPLATE.replace("__DATA__", DATA))
