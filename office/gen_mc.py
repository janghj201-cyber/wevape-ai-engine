#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
AI Company Mission Control — office/index.html 생성기
인계 문서(2026-09-06) 명세 적용. snapshot.json을 그대로 페이지에 실어 보내고,
미션·단계·병목·승인 지점 도출은 페이지 안에서 한다 (snapshot이 바뀌면 화면도 같이 바뀐다).

  python3 office/gen_mc.py office/snapshot.json > office/index.html
"""
import json, sys, html

def main():
    src = sys.argv[1] if len(sys.argv) > 1 else "office/snapshot.json"
    with open(src, encoding="utf-8") as f:
        snap = json.load(f)
    data = json.dumps(snap, ensure_ascii=False).replace("</", "<\\/")
    print(PAGE.replace("__DATA__", data))


PAGE = r"""<!DOCTYPE html><html lang="ko"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>위베이프 AI 조직 — Mission Control</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700;900&family=JetBrains+Mono:wght@400;700&display=swap" rel="stylesheet">
<style>
:root{
  --bg:#f7f8fa; --panel:#fff; --line:#e4e6ec; --line2:#eef0f4;
  --ink:#14161c; --ink2:#5a6070; --ink3:#8b91a3;
  --active:#6d3ff5;   /* 보라 — 활성 작업 */
  --flow:#0bb3c4;     /* 청록 — 데이터 이동 */
  --done:#63b81a;     /* 라임 — 완료 */
  --warn:#e0801a; --stop:#d8443c;
  --r:10px; --sh:0 1px 2px rgba(16,20,32,.05),0 4px 14px rgba(16,20,32,.04);
}
:root[data-theme="dark"],:root:not([data-theme="light"]).dark-auto{}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){
  --bg:#0d0f14; --panel:#14171f; --line:#242833; --line2:#1c202a;
  --ink:#eef0f6; --ink2:#9aa1b4; --ink3:#6b7285;
  --active:#9575ff; --flow:#2fd4e4; --done:#8ade3c; --warn:#f0a94a; --stop:#ff6a60;
  --sh:0 1px 2px rgba(0,0,0,.4),0 4px 16px rgba(0,0,0,.3);
}}
:root[data-theme="dark"]{
  --bg:#0d0f14; --panel:#14171f; --line:#242833; --line2:#1c202a;
  --ink:#eef0f6; --ink2:#9aa1b4; --ink3:#6b7285;
  --active:#9575ff; --flow:#2fd4e4; --done:#8ade3c; --warn:#f0a94a; --stop:#ff6a60;
  --sh:0 1px 2px rgba(0,0,0,.4),0 4px 16px rgba(0,0,0,.3);
}
*{box-sizing:border-box}
html,body{margin:0;padding:0}
body{background:var(--bg);color:var(--ink);font-family:'Noto Sans KR',system-ui,sans-serif;font-size:13px;line-height:1.55;-webkit-font-smoothing:antialiased}
button,input,textarea,select{font:inherit;color:inherit}
a{color:inherit}
.mono{font-family:'JetBrains Mono',ui-monospace,monospace;font-variant-numeric:tabular-nums}

/* ── 전역 바 ─────────────────────────────── */
.top{position:sticky;top:0;z-index:40;display:flex;align-items:center;gap:14px;
  padding:0 14px;height:52px;background:var(--panel);border-bottom:1px solid var(--line)}
.brand{display:flex;align-items:center;gap:9px;font-weight:900;letter-spacing:-.2px;white-space:nowrap}
.logo{width:24px;height:24px;border-radius:7px;background:linear-gradient(135deg,var(--active),var(--flow));
  display:grid;place-items:center;color:#fff;font-size:12px;font-weight:900}
.nav{display:flex;gap:2px;margin-left:6px}
.nav button{background:none;border:0;padding:6px 11px;border-radius:7px;color:var(--ink2);cursor:pointer;font-weight:700;font-size:12.5px}
.nav button[aria-selected="true"]{background:var(--line2);color:var(--ink)}
.nav button:hover{color:var(--ink)}
.top .sp{flex:1}
.agents{display:flex;align-items:center;gap:7px;padding:5px 11px;border:1px solid var(--line);border-radius:999px;font-size:12px;color:var(--ink2);white-space:nowrap}
.pulse{width:7px;height:7px;border-radius:50%;background:var(--done);box-shadow:0 0 0 0 var(--done);animation:pl 2.4s infinite}
.pulse.off{background:var(--ink3);animation:none}
@keyframes pl{0%{box-shadow:0 0 0 0 rgba(99,184,26,.5)}70%{box-shadow:0 0 0 7px rgba(99,184,26,0)}100%{box-shadow:0 0 0 0 rgba(99,184,26,0)}}
.search{position:relative}
.search input{width:180px;padding:6px 10px 6px 28px;border:1px solid var(--line);border-radius:8px;background:var(--bg);outline:0}
.search input:focus{border-color:var(--active)}
.search .ic{position:absolute;left:9px;top:50%;transform:translateY(-50%);color:var(--ink3);font-size:12px}
.btn{border:1px solid var(--line);background:var(--panel);border-radius:8px;padding:6px 12px;cursor:pointer;font-weight:700;font-size:12.5px}
.btn:hover{border-color:var(--ink3)}
.btn.pri{background:var(--active);border-color:var(--active);color:#fff}
.btn.pri:hover{filter:brightness(1.08)}
.btn.sm{padding:4px 9px;font-size:11.5px;border-radius:7px}
.icobtn{border:1px solid var(--line);background:var(--panel);border-radius:8px;width:31px;height:31px;cursor:pointer;display:grid;place-items:center}

/* ── 레이아웃 ────────────────────────────── */
.wrap{display:grid;grid-template-columns:266px minmax(0,1fr) 340px;gap:12px;padding:12px;align-items:start}
.col{display:flex;flex-direction:column;gap:12px;min-width:0}
.card{background:var(--panel);border:1px solid var(--line);border-radius:var(--r);box-shadow:var(--sh)}
.card>h3{margin:0;padding:11px 13px;border-bottom:1px solid var(--line2);font-size:12px;font-weight:800;
  color:var(--ink2);letter-spacing:.3px;display:flex;align-items:center;gap:7px}
.card>h3 .n{margin-left:auto;color:var(--ink3);font-weight:700}
.pad{padding:12px 13px}
.sticky{position:sticky;top:64px}

/* ── 왼쪽 미션 레일 ───────────────────────── */
.mrow{display:block;width:100%;text-align:left;background:none;border:0;border-bottom:1px solid var(--line2);
  padding:11px 13px;cursor:pointer}
.mrow:last-child{border-bottom:0}
.mrow:hover{background:var(--line2)}
.mrow[aria-selected="true"]{background:color-mix(in srgb,var(--active) 9%,transparent);
  box-shadow:inset 3px 0 0 var(--active)}
.mrow .t{font-weight:700;font-size:12.8px;margin-bottom:5px;display:flex;gap:6px;align-items:center}
.mrow .meta{display:flex;gap:8px;align-items:center;color:var(--ink3);font-size:11px}
.bar{height:3px;border-radius:2px;background:var(--line);overflow:hidden;margin-top:7px}
.bar i{display:block;height:100%;background:var(--active);border-radius:2px;transition:width .5s}
.bar.done i{background:var(--done)}
.bar.block i{background:var(--warn)}

.dept{display:flex;align-items:center;gap:8px;padding:8px 13px;border-bottom:1px solid var(--line2);font-size:12px}
.dept:last-child{border-bottom:0}
.dept .nm{font-weight:600}
.dept .c{margin-left:auto;color:var(--ink3);font-size:11px}
.dept.off .nm,.dept.off .ic{opacity:.45}

/* ── 상태 배지 ───────────────────────────── */
.badge{display:inline-flex;align-items:center;gap:4px;padding:2px 7px;border-radius:6px;font-size:10.5px;font-weight:800;
  border:1px solid transparent;white-space:nowrap}
.b-done{background:color-mix(in srgb,var(--done) 14%,transparent);color:var(--done);border-color:color-mix(in srgb,var(--done) 30%,transparent)}
.b-active{background:color-mix(in srgb,var(--active) 12%,transparent);color:var(--active);border-color:color-mix(in srgb,var(--active) 30%,transparent)}
.b-flow{background:color-mix(in srgb,var(--flow) 12%,transparent);color:var(--flow);border-color:color-mix(in srgb,var(--flow) 30%,transparent)}
.b-wait{background:color-mix(in srgb,var(--warn) 14%,transparent);color:var(--warn);border-color:color-mix(in srgb,var(--warn) 32%,transparent)}
.b-stop{background:color-mix(in srgb,var(--stop) 12%,transparent);color:var(--stop);border-color:color-mix(in srgb,var(--stop) 30%,transparent)}
.b-idle{background:var(--line2);color:var(--ink3);border-color:var(--line)}

/* ── 중앙 ────────────────────────────────── */
.hero{padding:15px 16px 13px}
.hero h1{margin:0 0 4px;font-size:19px;font-weight:900;letter-spacing:-.3px}
.hero .sub{color:var(--ink2);font-size:12.5px;margin-bottom:13px}
.facts{display:grid;grid-template-columns:repeat(auto-fit,minmax(126px,1fr));gap:9px}
.fact{border:1px solid var(--line);border-radius:9px;padding:9px 11px;background:var(--bg)}
.fact .k{font-size:10.5px;color:var(--ink3);font-weight:700;letter-spacing:.2px;margin-bottom:3px}
.fact .v{font-size:14px;font-weight:800;letter-spacing:-.2px}
.fact.alarm{border-color:color-mix(in srgb,var(--stop) 45%,transparent);background:color-mix(in srgb,var(--stop) 7%,transparent)}
.fact.alarm .v{color:var(--stop)}
.fact.wait{border-color:color-mix(in srgb,var(--warn) 45%,transparent);background:color-mix(in srgb,var(--warn) 7%,transparent)}
.fact.wait .v{color:var(--warn)}
.who{display:flex;gap:4px;margin-top:12px;flex-wrap:wrap;row-gap:6px;align-items:center}
.who .lbl{font-size:11px;color:var(--ink3);margin-right:4px;font-weight:700}
.av{width:25px;height:25px;border-radius:50%;display:grid;place-items:center;font-size:10px;font-weight:800;color:#fff;
  border:2px solid var(--panel);position:relative;flex:0 0 auto}
.av.ai::after{content:"";position:absolute;right:-1px;bottom:-1px;width:9px;height:9px;border-radius:50%;
  background:var(--active);border:1.5px solid var(--panel)}
.av.work::after{background:var(--done)}
.av.idle::after{background:var(--ink3)}

/* 4단계 흐름 */
.flow{padding:14px 16px 6px;position:relative}
.stages{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;position:relative}
.stage{border:1px solid var(--line);border-radius:10px;padding:11px;background:var(--bg);cursor:pointer;
  position:relative;text-align:left;font:inherit;color:inherit}
.stage:hover{border-color:var(--ink3)}
.stage[aria-selected="true"]{border-color:var(--active);box-shadow:0 0 0 3px color-mix(in srgb,var(--active) 15%,transparent)}
.stage .no{font-size:10px;color:var(--ink3);font-weight:800;letter-spacing:.4px}
.stage .nm{font-weight:800;font-size:13px;margin:3px 0 2px}
.stage .rm{font-size:11px;color:var(--ink3);margin-bottom:8px}
.stage.s-active{background:color-mix(in srgb,var(--active) 7%,transparent);border-color:color-mix(in srgb,var(--active) 35%,transparent)}
.stage.s-done{background:color-mix(in srgb,var(--done) 6%,transparent)}
.stage.s-needs{background:color-mix(in srgb,var(--warn) 8%,transparent);border-color:color-mix(in srgb,var(--warn) 45%,transparent)}
.stage.s-blocked{background:color-mix(in srgb,var(--stop) 7%,transparent);border-color:color-mix(in srgb,var(--stop) 40%,transparent)}
/* 데이터 패킷 — 완료된 단계 사이에서만 흐른다 */
.wire{position:absolute;top:44px;height:2px;background:var(--line);border-radius:2px;z-index:1}
.wire.live{background:color-mix(in srgb,var(--flow) 45%,transparent)}
.wire i{position:absolute;top:-3px;width:7px;height:7px;border-radius:50%;background:var(--flow);
  box-shadow:0 0 8px var(--flow);animation:pk 2.4s linear infinite}
@keyframes pk{from{left:-8%}to{left:104%}}
.wire.dead{opacity:.5}
.wire.dead i{display:none}

/* 작업 레인 */
.lanes{padding:4px 16px 14px}
.lane{display:grid;grid-template-columns:118px minmax(0,1fr);gap:10px;align-items:center;padding:5px 0}
.lane .nm{display:flex;align-items:center;gap:6px;font-size:11.5px;color:var(--ink2);font-weight:600;
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.track{height:17px;border-radius:5px;background:var(--line2);position:relative;overflow:hidden;
  border:1px solid var(--line)}
.track i{position:absolute;inset:0 auto 0 0;border-radius:5px;opacity:.34}
.track span{position:absolute;left:7px;right:7px;top:50%;transform:translateY(-50%);font-size:10px;font-weight:700;
  color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.track.run i{animation:sh 2.6s ease-in-out infinite}
@keyframes sh{0%,100%{filter:brightness(1)}50%{filter:brightness(1.22)}}

/* 이벤트 */
.ev{display:grid;grid-template-columns:52px 18px minmax(0,1fr);gap:8px;padding:7px 13px;border-bottom:1px solid var(--line2);align-items:start}
.ev:last-child{border-bottom:0}
.ev .tm{color:var(--ink3);font-size:10.5px;padding-top:2px}
.ev .dt{width:7px;height:7px;border-radius:50%;background:var(--ink3);margin:6px auto 0}
.ev.hi{background:color-mix(in srgb,var(--warn) 6%,transparent)}
.ev.hi .dt{background:var(--warn)}
.ev.ok .dt{background:var(--done)}
.ev.act .dt{background:var(--active)}
.ev .tx{min-width:0}
.ev .tx b{font-weight:700}
.ev .tx .m{color:var(--ink3);font-size:11px;display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}

/* ── 오른쪽 인스펙터 ──────────────────────── */
.kv{display:grid;grid-template-columns:74px minmax(0,1fr);gap:6px 10px;font-size:12px;padding:11px 13px}
.kv .k{color:var(--ink3);font-weight:700}
.out{display:block;padding:9px 13px;border-bottom:1px solid var(--line2);text-decoration:none}
.out:last-child{border-bottom:0}
.out:hover{background:var(--line2)}
.out .t{font-weight:700;font-size:12.3px;margin-bottom:3px;display:flex;gap:6px;align-items:center}
.out .m{color:var(--ink3);font-size:11px}
.thumb{width:100%;border:1px solid var(--line);border-radius:8px;background:var(--bg);height:172px;overflow:hidden;position:relative}
.thumb iframe{width:840px;height:1188px;border:0;transform:scale(.196);transform-origin:0 0;position:absolute;inset:0}

/* 승인 */
.approve{padding:11px 13px;border-top:1px solid var(--line2)}
.approve textarea{width:100%;min-height:52px;padding:8px 9px;border:1px solid var(--line);border-radius:8px;
  background:var(--bg);outline:0;resize:vertical;font-size:12px}
.approve textarea:focus{border-color:var(--active)}
.arow{display:flex;gap:6px;margin-top:8px;align-items:center;flex-wrap:wrap}
.arow input[type=number]{width:62px;padding:6px 8px;border:1px solid var(--line);border-radius:7px;background:var(--bg);outline:0}
.hint{color:var(--ink3);font-size:11px;margin-top:7px}
.hint.err{color:var(--stop)}
.hint.ok{color:var(--done)}

/* 기타 화면 */
.grid2{display:grid;grid-template-columns:repeat(auto-fill,minmax(216px,1fr));gap:11px;padding:12px 13px}
.pcard{border:1px solid var(--line);border-radius:9px;overflow:hidden;background:var(--bg)}
.pcard .th{height:196px;position:relative;overflow:hidden;border-bottom:1px solid var(--line)}
.pcard .th iframe{width:840px;height:1188px;border:0;transform:scale(.223);transform-origin:0 0;position:absolute;inset:0}
.pcard .cap{padding:8px 10px;font-size:11.5px}
.pcard .cap b{display:block;margin-bottom:3px}
.say{padding:10px 13px;border-bottom:1px solid var(--line2)}
.say:last-child{border-bottom:0}
.say .w{font-weight:800;font-size:12px;margin-bottom:4px;display:flex;gap:6px;align-items:center}
.say .b{color:var(--ink2);font-size:12px;white-space:pre-wrap}
.obj{border-left:2px solid var(--warn);padding-left:9px;margin:6px 0;font-size:11.5px}
.rul{border-left:2px solid var(--done);padding-left:9px;margin:6px 0;font-size:11.5px}
.tabs{display:flex;gap:2px;padding:9px 13px 0}
.tabs button{background:none;border:0;padding:6px 10px;border-radius:7px 7px 0 0;color:var(--ink2);cursor:pointer;font-weight:700;font-size:12px}
.tabs button[aria-selected="true"]{background:var(--line2);color:var(--ink)}
.scorebar{display:grid;grid-template-columns:96px minmax(0,1fr) 42px;gap:9px;align-items:center;padding:6px 13px;font-size:12px}
.scorebar .t{height:7px;border-radius:4px;background:var(--line2);overflow:hidden}
.scorebar .t i{display:block;height:100%;background:var(--active);border-radius:4px}
.empty{padding:26px 13px;text-align:center;color:var(--ink3);font-size:12px}
.hide{display:none!important}

@media (max-width:1180px){
  .wrap{grid-template-columns:minmax(0,1fr) 320px}
  .rail{display:none}
  .msel{display:block!important}
}
@media (max-width:880px){
  .wrap{grid-template-columns:minmax(0,1fr)}
  .insp{display:none}
  .search input{width:120px}
  .stages{grid-template-columns:repeat(2,1fr)}
  .wire{display:none}
}
.msel{display:none;padding:9px 13px}
.msel select{width:100%;padding:8px 10px;border:1px solid var(--line);border-radius:8px;background:var(--bg);outline:0}
:root[data-motion="off"] *{animation:none!important;transition:none!important}
:focus-visible{outline:2px solid var(--active);outline-offset:2px}
</style></head><body>

<header class="top">
  <div class="brand"><span class="logo">W</span><span>Mission Control</span></div>
  <nav class="nav" id="nav">
    <button data-v="command" aria-selected="true">Command</button>
    <button data-v="rooms">Rooms</button>
    <button data-v="library">Library</button>
  </nav>
  <div class="sp"></div>
  <div class="agents" id="agents"><span class="pulse"></span><span>—</span></div>
  <div class="search"><span class="ic">⌕</span><input id="q" placeholder="결과물 검색" aria-label="검색"></div>
  <button class="icobtn" id="motion" title="모션 끄기/켜기" aria-label="모션 전환">◐</button>
  <button class="icobtn" id="theme" title="밝게/어둡게" aria-label="테마 전환">☾</button>
  <button class="btn pri" id="newmission">＋ 지시</button>
</header>

<div class="wrap">
  <!-- 왼쪽 -->
  <div class="col rail">
    <div class="card sticky">
      <h3>진행 중인 미션 <span class="n" id="mcount"></span></h3>
      <div id="missions"></div>
    </div>
    <div class="card">
      <h3>부서</h3>
      <div id="depts"></div>
    </div>
  </div>

  <!-- 중앙 -->
  <div class="col">
    <div class="msel"><select id="msel" aria-label="미션 선택"></select></div>

    <section id="v-command">
      <div class="card">
        <div class="hero">
          <h1 id="mt">—</h1>
          <div class="sub" id="ms"></div>
          <div class="facts" id="facts"></div>
          <div class="who" id="who"></div>
        </div>
        <div class="flow"><div class="stages" id="stages"></div></div>
        <div class="lanes" id="lanes"></div>
      </div>
      <div class="card" style="margin-top:12px">
        <h3>활동 <span class="n" id="evn"></span></h3>
        <div id="events"></div>
      </div>
    </section>

    <section id="v-rooms" class="hide">
      <div class="card">
        <div class="tabs" id="rtabs">
          <button data-t="talk" aria-selected="true">회의록</button>
          <button data-t="stand">스탠드업</button>
          <button data-t="staff">직원</button>
          <button data-t="sched">시계</button>
        </div>
        <div id="rooms"></div>
      </div>
    </section>

    <section id="v-library" class="hide">
      <div class="card">
        <div class="tabs" id="ltabs">
          <button data-t="pop" aria-selected="true">POP</button>
          <button data-t="items">결과물</button>
          <button data-t="mem">기억</button>
          <button data-t="score">점수</button>
        </div>
        <div id="library"></div>
      </div>
    </section>
  </div>

  <!-- 오른쪽 -->
  <div class="col insp">
    <div class="card sticky">
      <h3 id="ih">단계 상세</h3>
      <div class="kv" id="ikv"></div>
      <div id="iout"></div>
      <div id="iapp"></div>
    </div>
    <div class="card">
      <h3>연결 <span class="n">외부</span></h3>
      <div id="links"></div>
    </div>
  </div>
</div>

<script>
const D = __DATA__;
const $ = s => document.querySelector(s);
const esc = s => String(s??"").replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const NOW = new Date();

/* ── 상태 모델 ───────────────────────────────
   미션   queued collecting analyzing waiting_for_review approved producing completed failed
   단계   pending active blocked needs_approval done
   사람AI idle working reviewing discussing waiting offline                       */

const STAGE_DEF = [
  {id:"collect", no:"01", nm:"신호 수집",  rm:"조사팀",       types:["이슈 브리핑","트렌드 보고"]},
  {id:"analyze", no:"02", nm:"패턴 분석",  rm:"기획 회의",     types:["회의록"], titlePrefix:"기획 회의록"},
  {id:"decide",  no:"03", nm:"회의·결정",  rm:"편집장 → 대표", types:["기획안"]},
  {id:"produce", no:"04", nm:"결과물 제작", rm:"작성·검수",    types:null},
];
const LINES = [
  {key:"블로그", label:"블로그", produce:["리뷰형","후기형"]},
  {key:"POP",   label:"POP",   produce:["POP"]},
];
const DONE=new Set(["승인","발행"]);

function weeksOf(items){
  const w=[...new Set(items.map(i=>i.week).filter(Boolean))].sort();
  return w.slice(-3).reverse();
}
function stageOf(week, line, items){
  const inW = items.filter(i=>i.week===week);
  return STAGE_DEF.map(sd=>{
    let rows;
    if(sd.id==="produce") rows = inW.filter(i=>i.line===line.key && line.produce.includes(i.type));
    else if(sd.titlePrefix) rows = inW.filter(i=>(i.title||"").startsWith(sd.titlePrefix));
    else rows = inW.filter(i=>sd.types.includes(i.type));
    let status="pending", progress=0;
    if(rows.length){
      const done = rows.filter(r=>DONE.has(r.status)).length;
      const wait = rows.filter(r=>r.status==="승인 대기").length;
      const rej  = rows.filter(r=>r.status==="반려").length;
      progress = Math.round(done/rows.length*100);
      if(done===rows.length) status="done";
      else if(wait) status="needs_approval";
      else if(rej && !done) status="blocked";
      else status="active";
    }
    return {...sd, rows, status, progress};
  });
}
function buildMissions(){
  const out=[];
  for(const week of weeksOf(D.items)){
    for(const line of LINES){
      const stages = stageOf(week, line, D.items);
      const rows = stages.flatMap(s=>s.rows);
      if(!rows.length) continue;
      const gate = stages.findIndex(s=>s.status!=="done");
      const progress = Math.round(stages.reduce((a,s)=>a+s.progress,0)/stages.length);
      const pub = stages[3].rows.filter(r=>r.status==="발행").length;
      let status, bottleneck;
      if(gate===-1){ status = pub ? "completed" : "approved"; bottleneck="없음"; }
      else {
        const s=stages[gate];
        bottleneck = s.status==="needs_approval" ? `${s.nm} — 대표 승인 대기 ${s.rows.filter(r=>r.status==="승인 대기").length}건`
                   : s.status==="blocked" ? `${s.nm} — 반려 후 재작업 안 됨`
                   : s.status==="pending" ? `${s.nm} — 아직 시작 안 함`
                   : `${s.nm} 진행 중`;
        status = s.status==="needs_approval" ? "waiting_for_review"
               : s.status==="blocked" ? "failed"
               : ["collecting","analyzing","analyzing","producing"][gate];
      }
      if(gate===3 && stages[3].status!=="done" && pub===0 && stages[3].rows.length) status="producing";
      out.push({id:`${week}-${line.key}`, week, line:line.key,
        title:`${week} ${line.label} 라인`, status, progress, bottleneck, stages, rows, published:pub});
    }
  }
  const rank={waiting_for_review:0,failed:1,producing:2,analyzing:3,collecting:4,approved:5,completed:6};
  return out.sort((a,b)=>(rank[a.status]??9)-(rank[b.status]??9) || b.week.localeCompare(a.week));
}
const MIS = buildMissions();
let cur = MIS[0] || null, curStage = 0, view="command";

const MSTAT={queued:["대기","b-idle"],collecting:["신호 수집","b-flow"],analyzing:["분석 중","b-active"],
  waiting_for_review:["승인 대기","b-wait"],approved:["승인됨","b-done"],producing:["제작 중","b-active"],
  completed:["완료","b-done"],failed:["막힘","b-stop"]};
const SSTAT={pending:["대기","b-idle"],active:["진행","b-active"],blocked:["막힘","b-stop"],
  needs_approval:["승인 필요","b-wait"],done:["완료","b-done"]};

/* ── 왼쪽 ───────────────────────────────── */
function renderRail(){
  $("#mcount").textContent = MIS.length+"건";
  $("#missions").innerHTML = MIS.map(m=>{
    const [t,c]=MSTAT[m.status]||["—","b-idle"];
    const cls = m.status==="completed"?"done":(m.status==="waiting_for_review"||m.status==="failed")?"block":"";
    return `<button class="mrow" data-m="${esc(m.id)}" aria-selected="${cur&&m.id===cur.id}">
      <div class="t"><span>${esc(m.title)}</span><span class="badge ${c}">${t}</span></div>
      <div class="meta"><span>단계 ${m.stages.filter(s=>s.status==="done").length}/4</span>
        <span>결과물 ${m.rows.length}</span><span>${m.progress}%</span></div>
      <div class="bar ${cls}"><i style="width:${m.progress}%"></i></div></button>`;
  }).join("") || `<div class="empty">진행 중인 미션이 없습니다</div>`;
  $("#msel").innerHTML = MIS.map(m=>`<option value="${esc(m.id)}" ${cur&&m.id===cur.id?"selected":""}>${esc(m.title)} · ${MSTAT[m.status][0]}</option>`).join("");

  const active = new Set(D.staff.filter(s=>s.status==="근무").map(s=>s.team));
  $("#depts").innerHTML = D.departments.map(d=>{
    const n = d.active ? D.staff.length : 0;
    return `<div class="dept ${d.active?"":"off"}"><span class="ic">${d.icon}</span>
      <span class="nm">${esc(d.name)}</span>
      <span class="c">${d.active?`AI ${n}명`:"예정"}</span></div>`;
  }).join("");
}

/* ── 중앙 ───────────────────────────────── */
function renderMission(){
  if(!cur){ $("#mt").textContent="미션 없음"; return; }
  const [st,sc]=MSTAT[cur.status];
  $("#mt").innerHTML = `${esc(cur.title)} <span class="badge ${sc}" style="vertical-align:middle">${st}</span>`;
  $("#ms").textContent = `${cur.line} 라인의 이번 주 작업 — 수집부터 발행까지 한 흐름`;

  const waitRows = cur.rows.filter(r=>r.status==="승인 대기");
  const waiting = waitRows.length;
  const oldest = waitRows.map(r=>r.t).sort()[0];
  const stuckD = oldest ? Math.floor((NOW-new Date(oldest))/86400e3) : 0;
  const stale = D.items.filter(i=>i.status==="승인 대기").length;
  const lastAt = D.items.map(i=>i.t).sort().slice(-1)[0]||"";
  const hoursIdle = lastAt ? Math.round((NOW - new Date(lastAt))/3600e3) : null;
  $("#facts").innerHTML = [
    {k:"현재 병목", v:cur.bottleneck, cls: cur.bottleneck==="없음"?"":"wait"},
    {k:"진행률", v:cur.progress+"%"},
    {k:"대표 승인 대기", v: waiting? `${waiting}건 · ${stuckD}일째` : "0건", cls: stuckD>=2?"alarm":waiting?"wait":""},
    {k:"실제 발행", v:cur.published+"건", cls: cur.published?"":"alarm"},
    {k:"마지막 결과물", v: hoursIdle===null?"—":(hoursIdle<24?`${hoursIdle}시간 전`:`${Math.floor(hoursIdle/24)}일 전`), cls: hoursIdle>26?"alarm":""},
  ].map(f=>`<div class="fact ${f.cls||""}"><div class="k">${f.k}</div><div class="v">${esc(f.v)}</div></div>`).join("");

  const authors=[...new Set(cur.rows.map(r=>r.author).filter(Boolean))];
  const joined = D.staff.filter(s=>authors.includes(s.name));
  const rest = D.staff.length - joined.length;
  $("#who").innerHTML = `<span class="lbl">참여</span>`
    + `<span class="av" style="background:#3a4050" title="장현진 대표 — 사람. 승인·채점">대표</span>`
    + joined.map(s=>`<span class="av ai work" style="background:${s.color}" title="${esc(s.name)} · ${esc(s.team)} · 이번 미션 참여">${esc(s.name.slice(0,2))}</span>`).join("")
    + (rest?`<span class="badge b-idle" style="margin-left:4px">대기 ${rest}명</span>`:"");

  // 4단계
  $("#stages").innerHTML = cur.stages.map((s,i)=>{
    const [t,c]=SSTAT[s.status];
    const k = s.status==="done"?"s-done":s.status==="active"?"s-active":s.status==="needs_approval"?"s-needs":s.status==="blocked"?"s-blocked":"";
    return `<button class="stage ${k}" data-s="${i}" aria-selected="${i===curStage}">
      <div class="no">${s.no}</div><div class="nm">${s.nm}</div><div class="rm">${s.rm}</div>
      <span class="badge ${c}">${t}</span>
      <div class="bar" style="margin-top:8px"><i style="width:${s.progress}%"></i></div></button>`;
  }).join("") + [0,1,2].map(i=>{
    const flow = cur.stages[i].status==="done" && cur.stages[i+1].status!=="pending";
    const L=`calc(${(i+1)*25}% - 5px)`;
    return `<div class="wire ${flow?"live":"dead"}" style="left:${L};width:10px">${flow?"<i></i>":""}</div>`;
  }).join("");

  // 작업 레인
  const lanes = cur.rows.slice(-9).map(r=>{
    const p = r.status==="발행"?100:r.status==="승인"?88:r.status==="승인 대기"?70:r.status==="검수중"?45:r.status==="반려"?30:18;
    const col = r.status==="발행"||r.status==="승인"?"var(--done)":r.status==="승인 대기"?"var(--warn)":r.status==="반려"?"var(--stop)":"var(--active)";
    const run = !DONE.has(r.status) && r.status!=="반려";
    return `<div class="lane"><div class="nm" title="${esc(r.author)}">${esc(r.author||"—")}</div>
      <div class="track ${run?"run":""}"><i style="width:${p}%;background:${col}"></i>
      <span>${esc((r.title||"").slice(0,34))} · ${esc(r.status)}</span></div></div>`;
  }).join("");
  $("#lanes").innerHTML = lanes || `<div class="empty">이 미션에 아직 작업이 없습니다</div>`;

  renderEvents();
  renderInspector();
}

function renderEvents(){
  const q=($("#q").value||"").trim();
  let rows=[...D.items].sort((a,b)=>String(b.t).localeCompare(String(a.t)));
  if(q) rows=rows.filter(i=>(i.title+i.author+i.type+i.status).includes(q));
  rows=rows.slice(0,26);
  $("#evn").textContent = q?`검색 ${rows.length}`:`최근 ${rows.length}`;
  $("#events").innerHTML = rows.map(i=>{
    const hi = i.status==="승인 대기" ? "hi" : DONE.has(i.status) ? "ok" : i.status==="반려" ? "" : "act";
    const when=(i.t||"").slice(5,16).replace("T"," ");
    const memo = i.memo? ` · 대표: ${i.memo.slice(0,44)}` : i.review? ` · ${i.review.slice(0,44)}` : "";
    return `<div class="ev ${hi}"><div class="tm mono">${esc(when)}</div><div class="dt"></div>
      <div class="tx"><b>${esc(i.title)}</b>
      <span class="m">${esc(i.author||"—")} · ${esc(i.type)} · ${esc(i.status)}${esc(memo)}</span></div></div>`;
  }).join("") || `<div class="empty">결과가 없습니다</div>`;
}

/* ── 인스펙터 ───────────────────────────── */
function renderInspector(){
  if(!cur) return;
  const s=cur.stages[curStage];
  const [t,c]=SSTAT[s.status];
  $("#ih").innerHTML = `${s.no} ${s.nm} <span class="badge ${c}" style="margin-left:auto">${t}</span>`;
  const people=[...new Set(s.rows.map(r=>r.author).filter(Boolean))].join(", ")||"—";
  const basis = s.rows.slice(-1)[0]?.basis || "—";
  $("#ikv").innerHTML = [
    ["담당", people],["방", s.rm],["진행", s.progress+"%"],
    ["결과물", s.rows.length+"건"],["근거", basis.slice(0,90)],
  ].map(([k,v])=>`<div class="k">${k}</div><div>${esc(v)}</div>`).join("");

  $("#iout").innerHTML = s.rows.slice(-6).reverse().map(r=>{
    const cl = r.status==="승인 대기"?"b-wait":DONE.has(r.status)?"b-done":r.status==="반려"?"b-stop":"b-active";
    return `<a class="out" href="${esc(r.url)}" target="_blank" rel="noopener">
      <div class="t"><span>${esc(r.title)}</span><span class="badge ${cl}">${esc(r.status)}</span></div>
      <div class="m">${esc(r.author||"—")} · ${esc((r.t||"").slice(0,10))}${r.memo?` · 대표 메모: ${esc(r.memo.slice(0,52))}`:""}</div></a>`;
  }).join("") || `<div class="empty">이 단계의 결과물이 아직 없습니다</div>`;

  // 승인 지점 — 승인 대기 건이 있을 때만 나타난다
  const pend = s.rows.filter(r=>r.status==="승인 대기");
  const pop = cur.line==="POP" ? (D.pops||[]).filter(p=>pend.some(x=>x.id===p.notion_id))[0] : null;
  $("#iapp").innerHTML = pend.length ? `
    <div class="approve">
      <div style="font-weight:800;margin-bottom:7px">⚑ 대표 승인이 필요합니다 — ${pend.length}건</div>
      ${pop?`<div class="thumb" style="margin-bottom:9px"><iframe src="${esc(pop.file)}" loading="lazy" title="POP 미리보기"></iframe></div>`:""}
      <select id="ap-id" style="width:100%;padding:7px 9px;border:1px solid var(--line);border-radius:8px;background:var(--bg);margin-bottom:7px">
        ${pend.map(r=>`<option value="${esc(r.id)}">${esc(r.title)}</option>`).join("")}
      </select>
      <textarea id="ap-memo" placeholder="무엇이 왜 몇 점인지. 이 문장이 그대로 직원 교훈 카드가 됩니다."></textarea>
      <div class="arow">
        <input type="number" id="ap-score" min="0" max="100" placeholder="점수">
        <button class="btn pri sm" data-d="승인">승인</button>
        <button class="btn sm" data-d="반려">반려</button>
        <button class="btn sm" id="ap-tok">⚙ 결재 연결</button>
      </div>
      <div class="hint" id="ap-out">승인하면 다음 단계가 즉시 시작됩니다. 이 미션은 지금 여기서 멈춰 있습니다.</div>
    </div>` : `<div class="approve"><div class="hint">지금 이 단계에 대표 결재가 필요한 건은 없습니다.</div></div>`;

  $("#links").innerHTML = [
    ["🎙️","대표 지시 보내기","#cmd"],
    ["📥","자료함 — 재료 던지기", D.materials_url||""],
    ["🏢","노션 본부", D.pages_url||""],
    ["📤","SNS 발행 시스템","https://znsl132-lang.github.io/wevape-web/"],
    ["⚙️","엔진 저장소", D.repo?`https://github.com/${D.repo}`:""],
  ].filter(x=>x[2]).map(([i,t,u])=>`<a class="out" href="${esc(u)}" ${u.startsWith("#")?"":'target="_blank" rel="noopener"'}>
    <div class="t"><span>${i}</span><span>${esc(t)}</span></div></a>`).join("");
}

/* ── Rooms / Library ─────────────────────── */
function renderRooms(t){
  const el=$("#rooms");
  if(t==="talk"){
    const m=D.talk?.meeting;
    if(!m){ el.innerHTML=`<div class="empty">회의록이 아직 없습니다</div>`; return; }
    el.innerHTML = `<div class="pad" style="border-bottom:1px solid var(--line2)"><b>${esc(m.title||"회의록")}</b>
      <div style="color:var(--ink3);font-size:11px">${esc(m.at||"")} · 참석 ${(m.round1||[]).length}명 · 충돌 ${(m.conflicts||[]).length}건</div></div>`
      + (m.round1||[]).map(r=>`<div class="say"><div class="w">${esc(r.who)}</div><div class="b">${esc((r.text||"").slice(0,420))}</div></div>`).join("")
      + (m.conflicts||[]).slice(0,8).map(c=>`<div class="say"><div class="w">⚔ ${esc(c.from)} → ${esc(c.to)}</div>
          <div class="obj">"${esc((c.what||"").slice(0,150))}" — ${esc((c.why||"").slice(0,150))}</div>
          <div class="rul">대안: ${esc((c.instead||"").slice(0,150))}</div></div>`).join("")
      + (m.ruling?`<div class="say"><div class="w">🧭 편집장 판정</div><div class="b">${esc(m.ruling.slice(0,1400))}</div></div>`:"");
  } else if(t==="stand"){
    const s=D.talk?.standup;
    el.innerHTML = s ? `<div class="pad"><b>데일리 스탠드업 ${esc(s.date||"")}</b>
      <div style="color:var(--ink3);font-size:11px">${esc(s.at||"")} · 전달 ${(s.sent||[]).length}건</div></div>`
      + (s.lines||[]).map(l=>`<div class="say"><div class="w">${esc(l.who||l.name||"")}</div><div class="b">${esc(l.text||l.line||"")}</div></div>`).join("")
      : `<div class="empty">스탠드업 기록이 없습니다</div>`;
  } else if(t==="staff"){
    el.innerHTML = D.staff.map(s=>`<div class="say"><div class="w">
      <span class="av ai" style="background:${s.color};margin-right:2px">${esc(s.name.slice(0,2))}</span>
      ${esc(s.name)} <span class="badge b-idle">${esc(s.team)}</span>
      <span class="badge ${s.status==="근무"?"b-done":"b-idle"}" style="margin-left:auto">${esc(s.status||"")}</span></div></div>`).join("");
  } else {
    el.innerHTML = (D.schedule||[]).map(s=>`<div class="say"><div class="w">${esc(s.when)}</div>
      <div class="b">${esc(s.what)} · ${(s.who||[]).join(", ")}</div></div>`).join("")
      + `<div class="pad hint">${esc(D.next_shift?.label||"")}</div>`;
  }
}
function renderLibrary(t){
  const el=$("#library");
  if(t==="pop"){
    const ps=[...(D.pops||[])].reverse().slice(0,12);
    el.innerHTML = ps.length ? `<div class="grid2">`+ps.map(p=>`<div class="pcard">
      <div class="th"><iframe src="${esc(p.file)}" loading="lazy" title="${esc(p.title)}"></iframe></div>
      <div class="cap"><b>${esc(p.title)}</b>${esc(p.store)} · ${esc(p.week)}
        <span class="badge ${DONE.has(p.status)?"b-done":p.status==="반려"?"b-stop":"b-active"}">${esc(p.status)}</span></div></div>`).join("")+`</div>`
      : `<div class="empty">POP이 없습니다</div>`;
  } else if(t==="items"){
    el.innerHTML = [...D.items].reverse().slice(0,40).map(i=>`<a class="out" href="${esc(i.url)}" target="_blank" rel="noopener">
      <div class="t"><span>${esc(i.title)}</span><span class="badge ${DONE.has(i.status)?"b-done":i.status==="승인 대기"?"b-wait":i.status==="반려"?"b-stop":"b-active"}">${esc(i.status)}</span></div>
      <div class="m">${esc(i.author||"—")} · ${esc(i.type)} · ${esc(i.week||"")}</div></a>`).join("");
  } else if(t==="mem"){
    const m=D.memory||{};
    el.innerHTML = `<div class="facts" style="padding:12px 13px">
      ${[["지식 카드",m.knowledge],["교훈 카드",m.lessons],["업무 노트",m.notes],["개정 제안",m.proposals]]
        .map(([k,v])=>`<div class="fact"><div class="k">${k}</div><div class="v">${v??0}</div></div>`).join("")}</div>`
      + (m.latest||[]).slice(0,16).map(k=>`<a class="out" href="${esc(k.url||"#")}" target="_blank" rel="noopener">
        <div class="t"><span>${esc(k.title)}</span><span class="badge b-idle">${esc(k.type)}</span></div>
        <div class="m">${esc(k.staff||"")} · ${esc((k.summary||"").slice(0,80))}</div></a>`).join("");
  } else {
    const s=D.score||{};
    const rows=[["블로그 품질",s.blog_quality],["POP 품질",s.pop_quality],["실행(발행)",s.execution],
      ["규제 준수",s.regulation],["학습",s.learning],["협업",s.collaboration]];
    el.innerHTML = `<div class="pad"><div style="font-size:28px;font-weight:900">${s.total??0}<span style="font-size:14px;color:var(--ink3)"> / 100</span></div>
      <div style="color:var(--ink3);font-size:11.5px">${esc(s.week||"")} 회사 점수</div></div>`
      + rows.map(([k,v])=>`<div class="scorebar"><div>${k}</div>
        <div class="t"><i style="width:${v||0}%;background:${(v||0)>=70?"var(--done)":(v||0)>=40?"var(--warn)":"var(--stop)"}"></i></div>
        <div class="mono" style="text-align:right">${v??0}</div></div>`).join("");
  }
}

/* ── 결재·지시 (GitHub Actions dispatch) ──── */
function tok(){ return localStorage.getItem("wv_gh_token")||""; }
function askTok(){
  const t=prompt("GitHub 토큰(fine-grained, 이 리포 Actions: Read and write). 이 브라우저에만 저장됩니다.", tok());
  if(t!==null) localStorage.setItem("wv_gh_token", t.trim());
}
async function dispatch(inputs, out){
  const t=tok();
  if(!t){ out.className="hint err"; out.textContent="먼저 ⚙ 결재 연결에서 토큰을 넣어주세요."; return false; }
  out.className="hint"; out.textContent="보내는 중…";
  try{
    const r=await fetch(`https://api.github.com/repos/${D.repo}/actions/workflows/engine.yml/dispatches`,{
      method:"POST",headers:{Authorization:"Bearer "+t,Accept:"application/vnd.github+json","Content-Type":"application/json"},
      body:JSON.stringify({ref:"main",inputs})});
    if(r.status===204){ out.className="hint ok"; out.textContent="접수됐습니다. 1~3분 뒤 화면이 갱신됩니다."; return true; }
    out.className="hint err"; out.textContent="실패 "+r.status+" — "+(await r.text()).slice(0,120); return false;
  }catch(e){ out.className="hint err"; out.textContent="실패: "+e.message; return false; }
}

/* ── 이벤트 배선 ─────────────────────────── */
$("#nav").addEventListener("click",e=>{
  const b=e.target.closest("button[data-v]"); if(!b) return;
  view=b.dataset.v;
  [...$("#nav").children].forEach(x=>x.setAttribute("aria-selected", x===b));
  $("#v-command").classList.toggle("hide",view!=="command");
  $("#v-rooms").classList.toggle("hide",view!=="rooms");
  $("#v-library").classList.toggle("hide",view!=="library");
  if(view==="rooms") renderRooms("talk");
  if(view==="library") renderLibrary("pop");
});
$("#rtabs").addEventListener("click",e=>{const b=e.target.closest("button[data-t]");if(!b)return;
  [...$("#rtabs").children].forEach(x=>x.setAttribute("aria-selected",x===b)); renderRooms(b.dataset.t);});
$("#ltabs").addEventListener("click",e=>{const b=e.target.closest("button[data-t]");if(!b)return;
  [...$("#ltabs").children].forEach(x=>x.setAttribute("aria-selected",x===b)); renderLibrary(b.dataset.t);});
$("#missions").addEventListener("click",e=>{const b=e.target.closest("[data-m]");if(!b)return;
  cur=MIS.find(m=>m.id===b.dataset.m); curStage=Math.max(0,cur.stages.findIndex(s=>s.status!=="done")); renderRail(); renderMission();});
$("#msel").addEventListener("change",e=>{cur=MIS.find(m=>m.id===e.target.value);
  curStage=Math.max(0,cur.stages.findIndex(s=>s.status!=="done")); renderRail(); renderMission();});
$("#stages").addEventListener("click",e=>{const b=e.target.closest("[data-s]");if(!b)return;
  curStage=+b.dataset.s; [...$("#stages").querySelectorAll(".stage")].forEach((x,i)=>x.setAttribute("aria-selected",i===curStage));
  renderInspector();});
$("#q").addEventListener("input",renderEvents);
$("#iapp").addEventListener("click",async e=>{
  if(e.target.id==="ap-tok") return askTok();
  const b=e.target.closest("[data-d]"); if(!b) return;
  const out=$("#ap-out"), id=$("#ap-id").value, memo=$("#ap-memo").value.trim(), score=$("#ap-score").value;
  if(!memo){ out.className="hint err"; out.textContent="이유를 한 줄이라도 적어주세요 — 그대로 교훈 카드가 됩니다."; return; }
  await dispatch({job:"company:score",page_id:id,score:String(score||""),decision:b.dataset.d,memo},out);
});
$("#newmission").addEventListener("click",()=>{
  const memo=prompt("대표 지시 — 편집장이 접수하고 회신합니다.\n(예: 이번 주 POP은 제품이 주인공이 되게 다시 짜라)");
  if(!memo) return;
  const out=document.createElement("div"); out.className="hint"; $("#links").prepend(out);
  dispatch({job:"ceo:instruct",memo:memo.slice(0,900)},out);
});
$("#theme").addEventListener("click",()=>{
  const r=document.documentElement, d=r.getAttribute("data-theme")==="dark";
  r.setAttribute("data-theme", d?"light":"dark"); localStorage.setItem("wv_theme", d?"light":"dark");
});
$("#motion").addEventListener("click",()=>{
  const r=document.documentElement, off=r.getAttribute("data-motion")==="off";
  r.setAttribute("data-motion", off?"on":"off"); localStorage.setItem("wv_motion", off?"on":"off");
});
document.addEventListener("keydown",e=>{
  if(e.key==="/"&&document.activeElement!==$("#q")){e.preventDefault();$("#q").focus();}
  if(e.key>="1"&&e.key<="4"&&document.activeElement.tagName!=="TEXTAREA"&&document.activeElement.tagName!=="INPUT"){
    curStage=+e.key-1; [...$("#stages").querySelectorAll(".stage")].forEach((x,i)=>x.setAttribute("aria-selected",i===curStage)); renderInspector();}
});

/* ── 기동 ───────────────────────────────── */
(function boot(){
  const th=localStorage.getItem("wv_theme"); if(th) document.documentElement.setAttribute("data-theme",th);
  const mo=localStorage.getItem("wv_motion"); if(mo) document.documentElement.setAttribute("data-motion",mo);
  if(matchMedia("(prefers-reduced-motion: reduce)").matches) document.documentElement.setAttribute("data-motion","off");

  const lastAt=D.items.map(i=>i.t).sort().slice(-1)[0];
  const idle = lastAt ? (NOW-new Date(lastAt))/3600e3 : 999;
  const working = MIS.filter(m=>["producing","analyzing","collecting"].includes(m.status)).length;
  $("#agents").innerHTML = `<span class="pulse ${idle>26?"off":""}"></span>
    <span>AI ${D.staff.length}명 · 활동 ${working}건${idle>26?" · 정지":""}</span>`;

  if(cur) curStage=Math.max(0,cur.stages.findIndex(s=>s.status!=="done"));
  renderRail(); renderMission();
  document.title = cur ? `${cur.bottleneck==="없음"?"정상":"⚑ "+cur.bottleneck} — Mission Control` : "Mission Control";
})();
</script></body></html>"""

if __name__ == "__main__":
    main()
