// SNS 발행 — 승인된 글을 위베이프 SNS 자동발행 시스템으로 넘겨 실제 게시까지 잇는다.
//
// 지금까지 조직은 "발행 지시서"를 써주는 데서 멈췄다. 사람이 그걸 보고 직접 올렸다.
// 이 모듈이 그 마지막 한 칸을 채운다.
//
// 흐름: 승인된 블로그 글 → SNS 길이로 요약 → 규제 사전검사 → 인입 → 노션 상태 '발행'
//
// 필요 시크릿: WEVAPE_SNS_CODE  (발행 시스템 전용 접속코드)

import { ask } from "./claude.js";
import * as N from "./notion.js";
import { systemPrompt, isoWeek, kstNow } from "./org.js";

const SNS_URL =
  "https://script.google.com/macros/s/AKfycby79BDH9Z6HXAPLS9t4_Te4kqIucJicsMtmNzx_9MGx0D4NgRMBXxT4MbuN109IC9hE/exec";

// 조직의 지점 표기(축약형) → 발행 시스템의 정식 지점명
const STORE_MAP = {
  "연수": "인천연수점",
  "논현": "인천논현점",
  "구월길병원": "인천구월길병원점",
  "구월로데오": "인천구월로데오점",
  "공항": "인천공항점",
  "검단": "인천검단점",
  "계산": "인천계산점",
  "신중동": "부천신중동점",
  "상동": "부천상동점",
};

// 조직의 글 종류 → 발행 시스템의 카테고리
const CATEGORY_MAP = { "리뷰형": "B.매장정보", "후기형": "D.매장일상", "POP": "A.영업공지" };

const CHANNEL = "인스타+쓰레드";   // 사진 필요 채널. 사진은 발행 시스템이 자동 생성한다.
const LEN_MIN = 60, LEN_MAX = 200;

// 직원 선택 — SNS 발행원이 등록돼 있으면 그 정의서를, 없으면 블로그 작가를 쓴다.
// department.json 수정 PR과 이 PR의 머지 순서가 어긋나도 오류가 나지 않게 하기 위함.
const WHO = (cfg) => (cfg.staff.sns_publisher ? "sns_publisher" : "blog_writer");
const MODEL = (cfg) => (cfg.staff.sns_publisher || cfg.staff.blog_writer).model;

// 재시도 차단 — 이 파일은 10분 폴링 안에서 돌기 때문에,
// 실패한 건에 표식을 남기지 않으면 같은 글이 하루 288번 다시 처리된다.
//   [SNS보류]            규제로 막힌 건. 사람이 표식을 지울 때까지 재시도 안 함.
//   [SNS대기 YYYY-MM-DD]  일시적 거절(하루 상한 등). 날짜가 바뀌면 다시 시도.
// 표식은 항상 하나만 남는다. 메모가 무한히 길어지지 않는다.
const MARK_HOLD = "[SNS보류]";
const MARK_WAIT = "[SNS대기";

function todayKst() {
  const d = new Date(Date.now() + 9 * 3600 * 1000);
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function stamp(memo, mark) {
  const base = String(memo || "")
    .split("/")
    .map((s) => s.trim())
    .filter((s) => s && !s.startsWith(MARK_HOLD) && !s.startsWith(MARK_WAIT))
    .join(" / ");
  return base ? `${base} / ${mark}` : mark;
}

function shouldSkip(memo) {
  const m = String(memo || "");
  if (m.includes(MARK_HOLD)) return true;
  if (m.includes(`${MARK_WAIT} ${todayKst()}]`)) return true;
  return false;
}

/** 발행 시스템 호출 — Content-Type은 반드시 text/plain (JSON이면 구글이 막는다) */
async function call(path, payload) {
  const code = process.env.WEVAPE_SNS_CODE;
  if (!code) throw new Error("WEVAPE_SNS_CODE 시크릿이 없습니다");
  const res = await fetch(SNS_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ path, code, ...payload }),
  });
  const j = await res.json();
  if (!j.ok) throw new Error(j.error || "발행 시스템 오류");
  return j.data;
}

/** 발행 시각 — 성과 데이터상 저녁 도달이 가장 높다. 내일 저녁으로 잡는다. */
function nextSlot(offsetMin = 0) {
  const d = new Date(Date.now() + 9 * 3600 * 1000);
  d.setDate(d.getDate() + 1);
  d.setHours(19, 20 + offsetMin, 0, 0);
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** 블로그 원문(1,500~2,000자)을 SNS 길이로 줄인다 */
async function toSns(cfg, item, bodyText, banned) {
  return await ask({
    system: systemPrompt(cfg, WHO(cfg)),
    model: MODEL(cfg),
    max_tokens: 900,
    user:
      `아래 블로그 글을 인스타그램·스레드용 짧은 게시글로 다시 쓰세요.\n\n` +
      `# 반드시 지킬 것\n` +
      `- 길이 ${LEN_MIN}~${LEN_MAX}자. 이 범위를 벗어나면 실패입니다.\n` +
      `- 아래 단어는 하나도 쓰지 마세요: ${banned.join(", ")}\n` +
      `- 제품·맛·니코틴·가격·구매 권유를 넣지 않습니다.\n` +
      `- 해시태그는 마지막 줄에만 3~5개.\n` +
      `- 설명이나 머리말 없이 게시글 본문만 출력합니다.\n\n` +
      `# 원문 (${item.stores.join(",")} · ${item.type})\n${bodyText.slice(0, 4000)}`,
  });
}

/**
 * 승인된 글을 실제로 발행한다.
 * 상태가 '승인'이고 아직 pub_url이 없는 블로그 글이 대상.
 */
export async function sns_publish(cfg, maxPosts = 3) {
  let banned;
  try {
    const _b = await call("banned", {});
    banned = _b.words.filter((w) => w.length < 20);
  } catch (e) {
    // 발행 시스템이 응답하지 않으면 여기서 끝낸다.
    // throw하면 events_poll의 뒷단까지 함께 멈춘다.
    return "SNS 발행 건너뜀 — 발행 시스템 응답 없음: " + String(e.message || e).slice(0, 80);
  }
  const items = await N.queryContent(undefined, [{ timestamp: "created_time", direction: "ascending" }]);

  const todo = items
    .filter((i) => i.status === "승인" && i.line === "블로그" && !i.pub_url && !shouldSkip(i.memo))
    .slice(0, maxPosts);

  if (!todo.length) return "발행할 승인 건 없음";

  const out = [];
  let slot = 0;

  for (const it of todo) {
    try {
      const store = STORE_MAP[(it.stores || [])[0]];
      if (!store) {
        // 매핑에 없는 지점은 사람이 고쳐야 한다. 계속 재시도할 이유가 없다.
        await N.updateContent(it.id, {
          memo: stamp(it.memo, MARK_HOLD + " 지점 매핑 없음: " + it.stores),
        });
        out.push("보류: " + it.title + " — 지점 매핑 없음");
        continue;
      }

      // 1) SNS 길이로 요약
      const bodyText = await N.readPageText(it.id);
      let text = (await toSns(cfg, it, bodyText, banned)).trim();

      // 2) 발행 시스템에 사전 검사
      let chk = await call("check", { text, channel: CHANNEL });

      // 3) 걸리면 이유를 알려주고 한 번 더 고쳐 쓴다
      if (!chk.ok) {
        text = (await ask({
          system: systemPrompt(cfg, "regulation_reviewer"),
          model: MODEL(cfg),
          max_tokens: 900,
          user:
            `아래 게시글이 반려됐습니다. 지적된 부분만 고쳐 다시 쓰세요.\n` +
            `반려 사유: ${chk.hits && chk.hits.length ? `금지어 ${chk.hits.join(", ")}` : `길이 ${chk.len}자 (허용 ${chk.limit})`}\n` +
            `길이 ${LEN_MIN}~${LEN_MAX}자를 지키고, 본문만 출력하세요.\n\n${text}`,
        })).trim();
        chk = await call("check", { text, channel: CHANNEL });
      }

      // 두 번 다 실패 — 자동으로는 못 고친다. 사람이 볼 때까지 보류.
      if (!chk.ok) {
        const why = (chk.hits && chk.hits.length) ? chk.hits.join(",") : "길이 규격";
        await N.updateContent(it.id, {
          memo: stamp(it.memo, MARK_HOLD + " 규제 " + why),
        });
        out.push("보류: " + it.title + " — " + why);
        continue;
      }

      // 4) 발행 시스템에 인입 (규제 검사는 그쪽에서 한 번 더 돈다)
      const r = await call("intake", {
        source: "AI 조직",
        date: nextSlot(slot),
        store,
        channel: CHANNEL,
        category: CATEGORY_MAP[it.type] || "D.매장일상",
        approved: true,
        text,
      });
      slot += 20;

      // 인입 거절은 대개 하루 발행 상한(8건)이다. 오늘은 여기서 멈춘다.
      // 계속 돌면 나머지 글도 같은 이유로 거절되며 호출만 소모한다.
      if (!r.accepted) {
        await N.updateContent(it.id, {
          memo: stamp(it.memo, MARK_WAIT + " " + todayKst() + "] " + r.reason),
        });
        out.push("대기: " + it.title + " — " + r.reason + " (내일 재시도)");
        break;
      }

      // 5) 노션에 발행 기록
      await N.updateContent(it.id, {
        status: "발행",
        pub_url: `SNS 예약 #${r.row} · ${r.publishAt}`,
        review: `${it.review ? it.review + " / " : ""}SNS 발행 시스템 접수 (${r.publishAt} ${CHANNEL})`,
        memo: stamp(it.memo, ""),   // 남아 있던 표식 정리
      });
      out.push(`발행 예약: ${it.title} → ${store} ${r.publishAt}`);
    } catch (e) {
      // 예상 못 한 오류도 표식을 남긴다. 안 남기면 10분 뒤 또 같은 글이 온다.
      const msg = String(e.message || e).slice(0, 60);
      try {
        await N.updateContent(it.id, {
          memo: stamp(it.memo, MARK_WAIT + " " + todayKst() + "] 오류 " + msg),
        });
      } catch (_) { /* 노션까지 막힌 상황 — 다음 회차에 다시 본다 */ }
      out.push("오류: " + it.title + " — " + msg);
    }
  }

  return out.join("\n");
}

/** 발행 시스템 상태 점검 — 큐 잔량·토큰 만료 등을 조직 쪽에서도 볼 수 있게 */
export async function sns_health(cfg) {
  try {
    const h = await call("health", {});
    const issues = h.issues || [];
    if (!issues.length) return "SNS 발행 시스템 정상";
    const w = isoWeek(new Date(), cfg.week_offset || 0);
    await N.createContent({
      title: `SNS 발행 시스템 점검 ${w}`,
      status: "승인 대기",
      line: "보고",
      type: "보고서",
      team: "업로드",
      author: "업로드 기록원",
      week: w,
      basis: `발행 시스템 상태 점검 · ${kstNow()}`,
      body: `# SNS 발행 시스템 점검\n\n${issues.map((s) => `- ${s}`).join("\n")}`,
    });
    return `점검 이상 ${issues.length}건 — 노션에 기록`;
  } catch (e) {
    return `점검 실패 — ${String(e.message || e).slice(0, 100)}`;
  }
}
