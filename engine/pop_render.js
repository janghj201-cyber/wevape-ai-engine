// POP v2 렌더러 — 브랜드 가이드 무드 4종 (glow-dark / pop-purple / holo-pastel / sky-pastel)
// 스펙 JSON → A4 세로 HTML. 글자가 주인공, device.png 있으면 히어로로.
const esc = (x) => String(x ?? "").replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
const FONTS = `<link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Anton&family=Bebas+Neue&family=Black+Han+Sans&family=Noto+Sans+KR:wght@400;700;900&family=Noto+Serif+KR:wght@700&family=Playfair+Display:ital,wght@0,700;1,700&family=Noto+Sans+SC:wght@700;900&display=swap" rel="stylesheet">`;

const MOODS = {
  "glow-dark": {
    bg: `background:#0b0b0f;`,
    layers: (a) => `<div class="blob" style="left:20%;top:38%;width:70mm;height:70mm;background:${a};opacity:.55"></div><div class="blob" style="left:60%;top:60%;width:60mm;height:60mm;background:#7b2cff;opacity:.5"></div><div class="orb" style="left:78%;top:14%;width:9mm;height:9mm;background:radial-gradient(circle at 30% 30%,#fff,${a} 40%,#7b2cff)"></div><div class="orb" style="left:10%;top:70%;width:6mm;height:6mm;background:radial-gradient(circle at 30% 30%,#fff,#7b2cff 45%,${a})"></div><svg class="arrow" style="left:6mm;top:22mm" width="90" height="90" viewBox="0 0 60 60"><path d="M50 8 Q10 10 12 52" fill="none" stroke="${a}" stroke-width="4" stroke-linecap="round"/><path d="M4 44 L12 54 L22 46" fill="none" stroke="${a}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    h1: (a) => `color:#fff;font-family:Anton,'Black Han Sans','Noto Sans KR',sans-serif;text-transform:uppercase;letter-spacing:.5mm;`,
    h1b: (a) => `color:${a};font-family:Anton,'Black Han Sans','Noto Sans KR',sans-serif;text-transform:uppercase;text-shadow:0 0 6mm ${a}88;`,
    ink: "#fff", sub: "#e9d5ff", cap: "#c9b6ff", zh: "#fff", ban: (a) => `background:${a};color:#0b0b0f`, badgeBg: (a) => a, badgeInk: "#0b0b0f",
    scrim: "linear-gradient(180deg,rgba(11,11,15,.80) 0%,rgba(11,11,15,.28) 40%,rgba(11,11,15,.20) 58%,rgba(11,11,15,.85) 100%)",
  },
  "pop-purple": {
    bg: `background:#5b1fd6;`,
    layers: (a) => `<div class="half" style="background:${a}"></div><svg class="squig" style="left:6mm;top:8mm" width="90" height="60" viewBox="0 0 90 60"><path d="M4 40 C20 0,30 60,46 20 S72 40,86 8" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round"/></svg><svg class="squig" style="right:8mm;top:52%" width="70" height="60" viewBox="0 0 70 60"><path d="M6 10 C40 -6,64 30,30 40 S60 62,66 30" fill="none" stroke="#ff2fd0" stroke-width="5" stroke-linecap="round"/></svg><div class="star" style="left:80%;top:9%;color:#fff">✱</div><div class="star" style="left:6%;top:56%;color:#fff">✱</div>`,
    h1: (a) => `color:${a};font-family:Anton,'Black Han Sans','Noto Sans KR',sans-serif;text-transform:uppercase;`,
    h1b: (a) => `color:#fff;font-family:Anton,'Black Han Sans','Noto Sans KR',sans-serif;text-transform:uppercase;`,
    ink: "#fff", sub: "#fff", cap: "#1a0a4a", zh: "#1a0a4a", ban: (a) => `background:#1a0a4a;color:${a}`, badgeBg: () => "#ff2fd0", badgeInk: "#fff",
    scrim: "linear-gradient(180deg,rgba(38,10,110,.82) 0%,rgba(38,10,110,.32) 42%,rgba(38,10,110,.24) 60%,rgba(26,10,74,.88) 100%)",
  },
  "holo-pastel": {
    bg: `background:linear-gradient(135deg,#f7b7e6 0%,#c9b6ff 45%,#f9c6ec 70%,#bfe4ff 100%);`,
    layers: (a) => `<div class="heart" style="left:66%;top:6%;width:34mm;height:34mm"></div><div class="heart" style="left:-6%;top:60%;width:26mm;height:26mm;opacity:.7"></div><div class="ring"></div><div class="spark" style="left:8%;top:30%">✦</div><div class="spark" style="left:86%;top:24%">✦</div><div class="spark" style="left:76%;top:80%">✦</div><div class="spark small" style="left:14%;top:84%">✦</div><div class="wm">WEVAPE · BUBBLEMON · WEVAPE · BUBBLEMON ·</div>`,
    h1: (a) => `color:transparent;-webkit-text-stroke:.55mm #fff;font-family:'Playfair Display','Noto Serif KR',serif;text-transform:uppercase;letter-spacing:.8mm;text-shadow:0 0 5mm rgba(255,255,255,.55);`,
    h1b: (a) => `color:#fff;font-family:'Playfair Display','Noto Serif KR',serif;font-style:italic;text-transform:uppercase;`,
    ink: "#fff", sub: "#4a2a7a", cap: "#4a2a7a", zh: "#fff", ban: (a) => `background:rgba(255,255,255,.55);color:#4a2a7a`, badgeBg: () => "#fff", badgeInk: "#a03aa0",
    scrim: "linear-gradient(180deg,rgba(255,240,252,.80) 0%,rgba(255,240,252,.28) 42%,rgba(255,240,252,.22) 60%,rgba(255,240,252,.86) 100%)",
  },
  "sky-pastel": {
    bg: `background:linear-gradient(180deg,#bfe4ff 0%,#eaf6ff 55%,#ffffff 100%);`,
    layers: (a) => `<div class="snow" style="left:6%;top:14%">❄</div><div class="snow" style="left:84%;top:40%;font-size:16mm">❄</div><div class="snow" style="left:12%;top:74%;font-size:9mm">❄</div><div class="spark" style="left:70%;top:10%;color:#7b2cff">✦</div><div class="balloon" style="left:82%;top:4%;background:#ff6fa8"></div><div class="balloon" style="left:88%;top:8%;background:#7b2cff"></div>`,
    h1: (a) => `color:#7b2cff;font-family:'Playfair Display','Noto Serif KR',serif;text-transform:uppercase;letter-spacing:.6mm;`,
    h1b: (a) => `color:${a};font-family:'Playfair Display','Noto Serif KR',serif;font-style:italic;text-transform:uppercase;`,
    ink: "#2b1a5a", sub: "#4a2a7a", cap: "#4a2a7a", zh: "#4a2a7a", ban: (a) => `background:#7b2cff;color:#fff`, badgeBg: () => "#7b2cff", badgeInk: "#fff",
    scrim: "linear-gradient(180deg,rgba(240,248,255,.82) 0%,rgba(240,248,255,.30) 42%,rgba(240,248,255,.22) 60%,rgba(255,255,255,.88) 100%)",
  },
};

export function renderPop2(spec, opts = {}) {
  const mood = MOODS[spec.mood] || MOODS["glow-dark"]; const a = spec.accent || "#ff2fd0";
  const dev = opts.deviceUrl; // office/brand/device.png 있으면 히어로
  const full = opts.heroFull; // 생성 이미지 — 포스터 '전체 배경'으로 깔고 무드 스크림으로 글자 대비 확보
  const [h1a, h1b] = Array.isArray(spec.headline) ? spec.headline : String(spec.headline || "").split("\n");
  const L = Math.max((h1a || "").length, (h1b || "").length); const size = spec.headline_size || (L > 9 ? 21 : L > 6 ? 27 : 33);
  return `<!DOCTYPE html><html lang="ko"><head><meta charset="utf-8"><title>${esc(spec.title)}</title>${FONTS}
<style>@page{size:A4 portrait;margin:0}html,body{margin:0;background:#e5e7eb}
.pop{width:210mm;height:297mm;margin:0 auto;position:relative;overflow:hidden;${mood.bg}font-family:'Noto Sans KR',sans-serif;color:${mood.ink}}
.heroBg{position:absolute;inset:0;background-size:cover;background-position:center}
.scrim{position:absolute;inset:0;background:${mood.scrim || "linear-gradient(180deg,rgba(0,0,0,.7),rgba(0,0,0,.2) 45%,rgba(0,0,0,.75))"}}
.blob{position:absolute;border-radius:50%;filter:blur(14mm)}
.orb{position:absolute;border-radius:50%;filter:blur(.3mm);box-shadow:0 0 6mm rgba(255,255,255,.4)}
.arrow,.squig{position:absolute}
.half{position:absolute;left:-10%;bottom:-18%;width:120%;height:52%;border-radius:50% 50% 0 0}
.star{position:absolute;font-size:12mm}
.heart{position:absolute;background:radial-gradient(circle at 30% 30%,#fff 0%,#ffd6f5 25%,#c9b6ff 55%,#bfe4ff 100%);clip-path:path('M50 90 L15 55 A20 20 0 1 1 50 25 A20 20 0 1 1 85 55 Z');opacity:.9}
.heart{clip-path:polygon(50% 100%,10% 55%,10% 30%,30% 12%,50% 25%,70% 12%,90% 30%,90% 55%);border-radius:50%}
.ring{position:absolute;left:8%;top:34%;width:84%;height:38%;border:.5mm solid rgba(255,255,255,.85);border-radius:50%;transform:rotate(-14deg)}
.spark{position:absolute;color:#fff;font-size:14mm;text-shadow:0 0 3mm rgba(255,255,255,.7)}.spark.small{font-size:8mm}
.wm{position:absolute;left:-40%;top:46%;width:180%;text-align:center;font-family:'Playfair Display',serif;font-size:14mm;color:rgba(255,255,255,.28);transform:rotate(-24deg);white-space:nowrap;letter-spacing:1mm}
.snow{position:absolute;color:#fff;font-size:22mm;text-shadow:0 0 2mm rgba(120,160,220,.5)}
.balloon{position:absolute;width:11mm;height:14mm;border-radius:50% 50% 50% 50%/45% 45% 55% 55%;box-shadow:inset -2mm -2mm 4mm rgba(0,0,0,.15)}
.wrap{position:absolute;inset:0;padding:14mm 14mm 12mm;display:flex;flex-direction:column}
.brand{display:flex;justify-content:space-between;align-items:center;font-family:'Bebas Neue',Anton,sans-serif;font-size:7mm;letter-spacing:1mm;opacity:.95}
.badge{display:inline-block;padding:1.2mm 5mm;border-radius:999px;font-family:'Noto Sans KR',sans-serif;font-weight:900;font-size:4.6mm;letter-spacing:.3mm;background:${mood.badgeBg(a)};color:${mood.badgeInk};transform:rotate(-3deg)}
h1{margin:10mm 0 0;font-size:${size}mm;line-height:.98;font-weight:900;word-break:keep-all;position:relative}
h1 .a{display:block;${mood.h1(a)}}h1 .b{display:block;${mood.h1b(a)}}
.sub{margin:6mm 0 0;font-size:7.2mm;font-weight:700;color:${mood.sub};letter-spacing:.2mm}
.hero{flex:1;display:flex;align-items:center;justify-content:center;position:relative;min-height:60mm}
.hero img{max-height:118mm;max-width:80%;filter:drop-shadow(0 8mm 10mm rgba(0,0,0,.35))}
.hero .big{font-family:Anton,'Black Han Sans',sans-serif;font-size:54mm;line-height:1;color:transparent;-webkit-text-stroke:.6mm ${mood.ink};opacity:.35;letter-spacing:2mm}
.foot{position:relative}
.kr{font-size:6.4mm;font-weight:700;color:${mood.ink}}
.zh{font-family:'Noto Sans SC','Noto Sans KR',sans-serif;font-size:7.4mm;font-weight:900;color:${full ? mood.ink : mood.zh};margin-top:1mm}
.ban{margin-top:5mm;padding:2.6mm 5mm;font-family:'Bebas Neue',Anton,sans-serif;font-size:5.6mm;letter-spacing:.8mm;${mood.ban(a)};display:flex;justify-content:space-between}
.law{margin-top:2.5mm;font-size:3.2mm;opacity:.8;color:${full ? mood.ink : mood.cap}}
@media print{html,body{background:#fff}}</style></head><body>
<div class="pop">${full ? `<div class="heroBg" style="background-image:url('${full}')"></div><div class="scrim"></div>` : mood.layers(a)}
<div class="wrap">
  <div class="brand"><span>WEVAPE</span><span class="badge">${esc(spec.tag || "본사 직영")}</span></div>
  <h1><span class="a">${esc(h1a || "")}</span>${h1b ? `<span class="b">${esc(h1b)}</span>` : ""}</h1>
  <div class="sub">${esc(spec.sub || "")}</div>
  <div class="hero">${dev ? `<img src="${dev}" alt="">` : full ? "" : `<div class="big">${esc(spec.hero_word || "WEVAPE")}</div>`}</div>
  <div class="foot">
    <div class="kr">${esc(spec.kr || "")}</div>
    <div class="zh">${esc(spec.zh || "本店为总公司直营门店 · 库存充足")}</div>
    <div class="ban"><span>${esc(spec.store_name)}</span><span>${esc(spec.store_phone || "")}</span></div>
    <div class="law">${esc(spec.store_addr || "")} · ${esc(spec.law || "본 매장은 성인만 이용할 수 있습니다. 담배는 건강에 해롭습니다.")}</div>
  </div>
</div></div></body></html>`;
}
export const MOOD_KEYS = Object.keys(MOODS);
