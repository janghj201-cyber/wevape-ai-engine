# 위베이프 AI 조직 엔진 (wevape-ai-engine)

**대표가 자고 있을 때도 회사가 일한다.** 정의서(문서)를 프롬프트로, 노션을 기억으로, GitHub Actions를 출근 시계로 쓰는 AI 직원 조직 엔진. 서버·세션 없이 돈다. 비용: GitHub Actions 무료 티어 + Claude API 사용량(현재 규모 월 수만 원).

## 구조 (마인드맵의 ① 두뇌 + ② 심장)

```
org/                         ← ① 두뇌: 조직 설정 (부서 폴더 하나 = 부서 하나)
  common/rules_*.md          ← 전사 규칙서 (규제 기준서 등)
  marketing/
    department.json          ← 부서 설정: 직원·모델·시계(cron)·지점·규칙 파일
    DEPARTMENT.md            ← 부서 설계서 (사람용)
    staff/*.md               ← 직원 정의서 = 그대로 system 프롬프트
engine/                      ← ② 심장
  run.js                     ← 진입점: node engine/run.js <부서> <job|task>
  jobs.js                    ← 직원별 작업 (브리핑·회의·기획안·작성·검수·지시서·주간)
  claude.js / notion.js      ← Claude API / 노션 API
  snapshot.js                ← ⑤ 얼굴: 노션 → office/index.html 재생성
  notify.js                  ← 카카오/웹훅 알림
office/                      ← 사무실 화면 (GitHub Pages로 배포)
.github/workflows/engine.yml ← 출근 시계 (cron 6개 + 수동 실행)
```

## 새 부서·직원 추가 (코드 수정 없음)
- 직원 추가: `org/<부서>/staff/<id>.md` 정의서 작성 → `department.json.staff`에 한 줄 → 작업이 필요하면 `jobs.js`에 함수 1개(패턴 복붙).
- 부서 추가: `org/<새부서>/` 폴더 복사 → department.json·정의서 채우기 → 워크플로 `node engine/run.js <새부서> ...` 한 줄.

## 배포 5단계 (15분)
1. **GitHub 저장소 만들기** — 이 폴더를 그대로 push (예: `ceohj0101/wevape-ai-engine`). Settings → Pages → Source: `main` / `/office` (사무실 화면 주소가 생김).
2. **노션 통합 토큰** — notion.so/my-integrations → 새 통합(Internal) → 토큰 복사. 노션 「위베이프 마케팅 AI 조직」 본부 페이지 우측 상단 `···` → 연결(Connections) → 방금 만든 통합 추가(하위 DB 자동 포함).
3. **Claude API 키** — console.anthropic.com → API Keys.
4. **GitHub Secrets** — 저장소 Settings → Secrets and variables → Actions:
   `ANTHROPIC_API_KEY`, `NOTION_TOKEN`, `NOTION_CONTENT_DB`=`85a080aa1d354972aa21de7b1d8b4a4c`, `NOTION_STAFF_DB`=`9c4a5cf2625f4d4aa290ea9a8ef7ad54`, `NOTION_HQ_URL`(선택), `KAKAO_ACCESS_TOKEN`(선택).
5. **첫 출근** — Actions 탭 → 「위베이프 AI 조직 · 출근 시계」 → Run workflow → job: `events:poll`. 성공하면 이후는 자동.

## 출근 시계 (KST)
| 시각 | 누가 | 무엇 |
|---|---|---|
| 일 20:00 | 규제 감시자 · 트렌드 리서처 | 주간 이슈 브리핑 · 트렌드 보고 (승인 대기) |
| 월 09:00 | 편집장 + 4명 병렬 회의 | 기획 회의록(승인) · 주간 기획안(승인 대기) |
| 매일 10:00 | 블로그 작가 → 규제 검수관 | 승인된 기획안 카드로 최대 3편 작성 → 10항목 검수 → 승인 대기/초안 |
| 매일 17:00 | 업로드 기록원 | 승인 글 발행 지시서, 발행 URL 공란 점검 |
| 금 17:30 | 업로드 기록원 → 편집장 | 주간 발행 결과 · 주간 결과 메모(승인 대기) |
| 10분마다 | 이벤트 폴링 | 관리자가 승인하면 최대 10분 안에 다음 단계 실행 |

관리자가 하는 일은 노션에서 **승인 대기 → 승인/반려(관리자 메모)**, 발행 후 **발행일·URL 기입 → 상태=발행** 두 가지뿐.

## 로컬 시험
```
cp .env.example .env   # 값 채우기 (DRY_RUN=1 이면 API 호출 없이 흐름만)
set -a; source .env; set +a
node engine/run.js marketing events:poll
node engine/run.js marketing editor:plan
```

## 원칙
정의서가 곧 코드다 · 사람은 결정만 · 한 번에 한 라인, 한 부서 · 기존 도구는 부수지 않는다 · 모든 결과에 근거·검수·승인 꼬리표.


## v0.2 (2026-08-17) — 본사 화면 + POP 라인
- **본사 화면**: `office/index.html` 이 3장면으로 바뀜 — 대표실(#ceo, 결재함) → 복도(#hall, 부서 문) → 마케팅 방(#marketing). 엔진이 돌 때마다 재생성.
- **POP 라인**: 직원 2명 추가 — `pop_designer`(POP 디자이너, 작성팀) + `panel_poem`(시 읽는 사람, 관점 패널). 화·목 12:00 `pop_make` 시계. 결과물은 `office/pop/*.html`(GitHub Pages로 미리보기·인쇄) + 노션 페이지(라인=POP, 검수중→검수관→승인 대기).
- 업로드 기록원의 발행 지시서에 POP(인쇄·부착) 포함.
- `department.json`에 `pages_url`(GitHub Pages 주소)와 `lines` 추가. Pages 폴더를 /(root)로 했다면 `pages_url` 끝에 `/office`를 붙일 것.
- 새 부서 만들기: `org/<id>/department.json` + `staff/*.md` 만 만들면 복도에 문이 열림 (`engine/snapshot.js`의 PLANNED 목록이 잠긴 문).
