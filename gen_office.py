#!/usr/bin/env python3
"""위베이프 마케팅 AI 조직 — AI 에이전트 사무실 HTML 생성기.
사용: python3 gen_office.py snapshot.json > office.html
snapshot.json 은 노션 「콘텐츠·보고」「AI 직원 명부」에서 뽑은 스냅샷.
"""
import json, sys, html

snap = json.load(open(sys.argv[1], encoding="utf-8"))
DATA = json.dumps(snap, ensure_ascii=False)

TEMPLATE = r"""<!DOCTYPE html>
<html lang="ko"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>위베이프 마케팅 AI 조직 · AI 에이전트 사무실</title>
<style>
:root{--bg:#f4f1ea;--ink:#1f2937;--muted:#6b7280;--line:#d9d2c5;--card:#fffdf8;--navy:#1e2a3a;
--ok:#2f855a;--wait:#dd6b20;--rej:#c53030;--pub:#2b6cb0;--draft:#9ca3af;--rev:#d69e2e}
*{box-sizing:border-box}html,body{margin:0;background:var(--bg);color:var(--ink);font-family:"Pretendard","Apple SD Gothic Neo","Noto Sans KR",system-ui,sans-serif}
.top{background:var(--navy);color:#fff;display:flex;align-items:center;gap:18px;padding:12px 22px;position:sticky;top:0;z-index:5}
.top h1{font-size:19px;margin:0;font-weight:800;letter-spacing:-.2px}
.top .tag{font-size:12px;opacity:.75}
.top .sp{flex:1}
.top .clock{font-variant-numeric:tabular-nums;font-size:13px;opacity:.9;text-align:right;line-height:1.35}
.wrap{max-width:1400px;margin:0 auto;padding:16px 18px 40px}
.grid{display:grid;grid-template-columns:230px 1fr 250px;gap:14px;align-items:start}
.room{background:var(--card);border:1.5px solid var(--line);border-radius:14px;padding:10px 12px;position:relative;min-height:96px;margin-bottom:12px;overflow:hidden}
.room h3{margin:0 0 6px;font-size:12px;letter-spacing:.2px;color:var(--muted);font-weight:700;display:flex;gap:6px;align-items:center}
.room h3 .dot{width:8px;height:8px;border-radius:50%;background:var(--muted)}
.room .desk{height:8px;border-radius:4px;background:#e9e2d5;margin:4px 0 8px}
.people{display:flex;gap:10px;flex-wrap:wrap;min-height:58px;align-items:flex-end}
.person{width:54px;text-align:center;font-size:10px;line-height:1.15;color:#374151;position:relative;transition:transform .8s}
.person svg{display:block;margin:0 auto 2px}
.person.away{opacity:.28}
.person .bub{position:absolute;left:50%;transform:translateX(-50%);bottom:64px;background:#fff;border:1px solid var(--line);border-radius:10px;padding:4px 7px;font-size:10px;white-space:nowrap;box-shadow:0 2px 6px rgba(0,0,0,.08);opacity:0;transition:opacity .4s;pointer-events:none;max-width:200px;white-space:normal;width:max-content}
.person.talk .bub{opacity:1}
.person.walk svg{animation:bob .6s infinite alternate}
@keyframes bob{from{transform:translateY(0)}to{transform:translateY(-3px)}}
.out{font-size:11px;background:#fbf7ee;border-left:3px solid var(--line);padding:5px 8px;border-radius:6px;margin-top:6px;color:#374151}
.out b{display:block;font-size:11px;color:#111}
.status{display:inline-block;font-size:10px;padding:1px 7px;border-radius:999px;color:#fff;font-weight:700;vertical-align:middle}
.s-승인{background:var(--ok)}.s-승인대기{background:var(--wait)}.s-반려{background:var(--rej)}.s-발행{background:var(--pub)}.s-초안{background:var(--draft)}.s-검수중{background:var(--rev)}
.center .room{min-height:150px}
.meet{min-height:210px}
.meet .table{margin:8px auto 4px;width:76%;height:44px;border-radius:50%;background:#e6dcc7;border:2px solid #d2c4a6;box-shadow:inset 0 3px 8px rgba(0,0,0,.06)}
.meet .seats{display:flex;justify-content:space-around;flex-wrap:wrap}
.meet .agenda{font-size:11px;color:#374151;margin-top:6px}
.meet .agenda li{margin:2px 0}
.factory{min-height:230px}
.belt{position:relative;height:120px;background:repeating-linear-gradient(90deg,#efe8da 0 24px,#e7dfcf 24px 48px);border-radius:10px;overflow:hidden;border:1px solid var(--line)}
.belt .card{position:absolute;top:14px;width:165px;background:#fff;border:1px solid var(--line);border-radius:8px;padding:6px 8px;font-size:11px;box-shadow:0 2px 6px rgba(0,0,0,.08);animation:slide var(--dur,40s) linear infinite;animation-delay:var(--delay,0s)}
.belt .card b{display:block;font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.belt .card small{color:var(--muted)}
@keyframes slide{from{left:100%}to{left:-190px}}
.flow{display:flex;gap:6px;align-items:center;font-size:11px;color:var(--muted);margin:8px 0 2px;flex-wrap:wrap}
.flow span{background:#fff;border:1px solid var(--line);border-radius:6px;padding:2px 8px}
.flow i{font-style:normal}
.stats{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:8px}
.stat{background:#fff;border:1px solid var(--line);border-radius:8px;padding:6px 8px;text-align:center}
.stat b{display:block;font-size:20px;line-height:1.1}
.stat small{font-size:10px;color:var(--muted)}
.ceo{border-color:#c9b98f;background:#fffaf0}
.ceo .tray{background:#fff;border:1px dashed #c9b98f;border-radius:8px;padding:6px 8px;font-size:11px;min-height:60px}
.ceo .tray li{margin:3px 0;list-style:none;padding-left:0}
.ceo .tray ul{margin:0;padding:0}
.log{margin-top:16px;background:var(--card);border:1.5px solid var(--line);border-radius:14px;padding:12px 14px}
.log h3{margin:0 0 8px;font-size:13px;color:var(--muted)}
.tl{display:grid;grid-template-columns:120px 26px 1fr;gap:6px 10px;font-size:12px;align-items:start;max-height:330px;overflow:auto}
.tl .t{color:var(--muted);font-variant-numeric:tabular-nums}
.tl .av{width:22px;height:22px;border-radius:50%;display:inline-block}
.tl .row{cursor:pointer;padding:3px 6px;border-radius:6px;display:contents}
.tl .row:hover > div{background:#f7f2e8}
.trace{margin-top:10px;background:#fff;border:1px solid var(--line);border-radius:10px;padding:10px 12px;font-size:12px;min-height:60px}
.trace .step{display:inline-block;background:#f3eee3;border-radius:6px;padding:3px 8px;margin:2px 4px 2px 0}
.trace .arrow{color:var(--muted);margin:0 2px}
.sched{display:grid;grid-template-columns:70px 1fr;gap:4px 8px;font-size:11px}
.sched .w{color:var(--muted);font-variant-numeric:tabular-nums}
.chip{display:inline-block;width:10px;height:10px;border-radius:50%;margin-right:3px;vertical-align:-1px}
.foot{font-size:11px;color:var(--muted);margin-top:10px}
a{color:inherit}
@media(max-width:1000px){.grid{grid-template-columns:1fr}.stats{grid-template-columns:repeat(2,1fr)}}
</style></head><body>
<div class="top">
  <h1>위베이프 마케팅 AI 조직 · AI 에이전트 사무실</h1>
  <span class="tag">관리자는 승인만 한다. 나머지는 출근 시계가 돌린다.</span>
  <span class="sp"></span>
  <div class="clock"><div id="now"></div><div id="next"></div></div>
</div>
<div class="wrap">
<div class="grid">
  <div class="left" id="left"></div>
  <div class="center">
    <div class="room meet" id="meet"></div>
    <div class="room factory" id="factory"></div>
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
</div>
<script>
const D = __DATA__;
const byId = Object.fromEntries(D.staff.map(s=>[s.id,s]));
const teamRooms = ["트렌드조사","이슈조사","작성","검수","업로드"];
const teamIcon = {"트렌드조사":"📱","이슈조사":"🚨","작성":"✍️","검수":"🛡️","업로드":"📤","편집장":"🧭","관점패널":"🎭"};
function fig(s, size=38){
  const c=s.color; return `<svg width="${size}" height="${size+8}" viewBox="0 0 38 46"><circle cx="19" cy="10" r="8" fill="#fde7c8" stroke="#3b3b3b" stroke-width="1.5"/><path d="M11 10 q8-9 16 0" fill="#3b3b3b"/><rect x="9" y="19" width="20" height="17" rx="5" fill="${c}"/><rect x="11" y="36" width="6" height="8" fill="#3b3b3b"/><rect x="21" y="36" width="6" height="8" fill="#3b3b3b"/><rect x="26" y="24" width="8" height="10" rx="1" fill="#f6d365" stroke="#b7791f"/></svg>`;
}
function person(s, cls="", bub=""){ return `<div class="person ${cls}" data-id="${s.id}">${fig(s)}<div>${s.name}</div>${bub?`<div class="bub">${bub}</div>`:""}</div>`; }
function st(x){ return `<span class="status s-${x.replace(/\s/g,'')}">${x}</span>`; }
function esc(x){ return (x||"").replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c])); }
const items = [...D.items].sort((a,b)=>a.t.localeCompare(b.t));
const latestBy = {};
items.forEach(it=>{ const id=D.author_map[it.author]; if(id) latestBy[id]=it; });

// LEFT: department rooms
let L="";
teamRooms.forEach(team=>{
  const members = D.staff.filter(s=>s.team===team);
  L += `<div class="room"><h3><span>${teamIcon[team]}</span>${team}팀</h3><div class="desk"></div><div class="people">`;
  members.forEach(s=>{ const it=latestBy[s.id]; L += person(s, "", it? `${it.title.slice(0,26)}… ${it.status}`:""); });
  L += `</div>`;
  members.forEach(s=>{ const it=latestBy[s.id]; if(it) L += `<div class="out"><b>${esc(it.title)}</b>${st(it.status)} <small>${it.t.slice(5,16).replace('T',' ')}</small></div>`; });
  L += `</div>`;
});
const panel = D.staff.filter(s=>s.team==="관점패널");
L += `<div class="room"><h3><span>🎭</span>관점 패널 <small style="font-weight:400">· 채용 예정</small></h3><div class="desk"></div><div class="people">${panel.map(s=>person(s,"away")).join("")}</div></div>`;
document.getElementById('left').innerHTML = L;

// MEETING ROOM
const m = D.meeting;
let M = `<h3><span>🤝</span>회의실 — ${esc(m.title)} <small style="font-weight:400">(${m.when}, 자동 회의)</small></h3>`;
M += `<div class="table"></div><div class="seats">${[m.chair,...m.attendees].map(id=>person(byId[id],"", "")).join("")}</div>`;
M += `<ul class="agenda"><b style="font-size:11px">결정</b>${m.decisions.map(d=>`<li>• ${esc(d)}</li>`).join("")}</ul>`;
document.getElementById('meet').innerHTML = M;

// FACTORY
const cnt = s=>items.filter(i=>i.status===s).length;
const outputs = items.filter(i=>["블로그","기획","보고"].includes(i.line));
let F = `<h3><span>🏭</span>AI 가공실 — 결과물 흐름</h3>
<div class="flow"><span>이슈 브리핑·트렌드 보고</span><i>→</i><span>기획 회의</span><i>→</i><span>기획안</span><i>→</i><span>글 작성</span><i>→</i><span>10항목 검수</span><i>→</i><span>관리자 승인</span><i>→</i><span>발행 지시서</span><i>→</i><span>발행</span></div>
<div class="belt">`;
const last=outputs.slice(-5), dur=60; last.forEach((it,i)=>{ F += `<div class="card" style="--delay:${-i*(dur/last.length)}s;--dur:${dur}s"><b>${esc(it.title)}</b><small>${it.line}·${it.type} · ${esc(it.author)}</small><br>${st(it.status)}</div>`; });
F += `</div><div class="stats"><div class="stat"><b>${items.length}</b><small>누적 결과물</small></div><div class="stat"><b>${cnt("승인")}</b><small>승인</small></div><div class="stat"><b>${cnt("승인 대기")}</b><small>승인 대기</small></div><div class="stat"><b>${cnt("반려")}</b><small>반려</small></div></div>`;
document.getElementById('factory').innerHTML = F;

// CEO room
const wait = items.filter(i=>i.status==="승인 대기");
let C = `<h3><span>👤</span>대표실 · 관리자(${esc(D.manager)}) — 승인함</h3><div class="tray">`;
C += wait.length? `<ul>${wait.map(i=>`<li>${st(i.status)} <a href="${i.url}" target="_blank">${esc(i.title)}</a></li>`).join("")}</ul>` : `<div style="color:#6b7280">승인 대기 없음 — 모두 처리됨 ✔</div>`;
C += `</div><div class="out" style="margin-top:8px"><b>최근 결정</b>${items.filter(i=>i.memo).slice(-2).map(i=>`· ${esc(i.memo.slice(0,60))}`).join("<br>")}</div>`;
document.getElementById('ceo').innerHTML = C;

// Editor room
const ed = byId.editor, edIt = latestBy.editor;
document.getElementById('editor').innerHTML = `<h3><span>🧭</span>편집장실</h3><div class="desk"></div><div class="people">${person(ed,"",edIt?edIt.title.slice(0,30):"")}</div>${edIt?`<div class="out"><b>${esc(edIt.title)}</b>${st(edIt.status)}</div>`:""}`;

// Schedule
let S = `<h3><span>⏰</span>출근 시계 (KST)</h3><div class="sched">`;
D.schedule.forEach(r=>{ S += `<div class="w">${r.when}</div><div>${r.who.map(id=>`<span class="chip" style="background:${byId[id].color}"></span>`).join("")}${esc(r.what)}</div>`; });
S += `</div>`;
document.getElementById('sched').innerHTML = S;

// Timeline
let T="";
items.slice().reverse().forEach((it,idx)=>{
  const s = byId[D.author_map[it.author]] || {color:"#999"};
  T += `<div class="row" data-i="${items.length-1-idx}"><div class="t">${it.t.slice(5,16).replace('T',' ')}</div><div><span class="av" style="background:${s.color}"></span></div><div><b>${esc(it.author)}</b> · ${esc(it.title)} ${st(it.status)}</div></div>`;
});
document.getElementById('tl').innerHTML = T;
document.querySelectorAll('.tl .row').forEach(r=>r.addEventListener('click',()=>{
  const it = items[+r.dataset.i];
  let h = `<b>${esc(it.title)}</b> <a href="${it.url}" target="_blank" style="font-size:11px">노션 열기</a><br>`;
  h += `<span class="step">근거: ${esc(it.basis||"—")}</span><span class="arrow">→</span><span class="step">${esc(it.author)} 작성 (${it.t.slice(5,16).replace('T',' ')})</span>`;
  if(it.review) h += `<span class="arrow">→</span><span class="step">규제 검수관: ${esc(it.review)}</span>`;
  h += `<span class="arrow">→</span><span class="step">관리자: ${it.status}${it.memo?` — ${esc(it.memo)}`:""}</span>`;
  if(it.status==="승인" && it.line==="블로그") h += `<span class="arrow">→</span><span class="step">업로드 기록원: 발행 지시서 포함</span>`;
  document.getElementById('trace').innerHTML = h;
}));

// Clock + next shift + animation loop (people talk/walk)
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
const persons = [...document.querySelectorAll('.person:not(.away)')];
let k=0;
setInterval(()=>{ persons.forEach(p=>p.classList.remove('talk','walk')); const p = persons[k%persons.length]; if(p){ p.classList.add(p.querySelector('.bub')?'talk':'walk'); } k++; }, 1800);
// meeting bubbles cycle
const seatEls = [...document.querySelectorAll('#meet .person')];
let oi=0; setInterval(()=>{ seatEls.forEach(e=>{e.classList.remove('talk'); const b=e.querySelector('.bub'); if(b) b.remove();}); const op = m.opinions[oi%m.opinions.length]; const el = seatEls.find(e=>e.dataset.id===op.who); if(el){ el.insertAdjacentHTML('beforeend',`<div class="bub">${esc(op.text)}</div>`); el.classList.add('talk'); } oi++; }, 3200);
</script></body></html>"""

print(TEMPLATE.replace("__DATA__", DATA))
