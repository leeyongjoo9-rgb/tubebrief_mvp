# CLAUDE.md — TubeBrief 프로젝트 가이드

이 파일은 Claude Code가 세션마다 자동으로 읽는 프로젝트 규칙서입니다.
상세 제품 요구사항은 `PRD.md`를 따르세요. 이 문서는 그 위의 "작업 규칙"입니다.

---

## 프로젝트 한 줄 요약

유튜브 구독 채널의 신규 영상을 **자동 감지**하여, AI가 **주제·출연자·타임스탬프**까지 구조화한 깊이 있는 요약을 생성하고 텍스트로 아카이빙해 대시보드에 보여주는 웹 서비스. 목표는 2주 내 작동하는 MVP.

---

## 기술 스택 (이 스택을 벗어나지 말 것)

- **프레임워크:** Next.js (App Router). 백엔드는 별도 서버 없이 `src/app/api/...` Route로 처리.
- **스타일/UI:** Tailwind CSS + shadcn/ui.
- **DB/인증:** Supabase.
- **자동 실행:** Vercel Cron 또는 Supabase pg_cron + Edge Function.
- **자막 추출:** `youtube-transcript` (+ 메타데이터 폴백).
- **요약 LLM:** Claude Haiku 또는 GPT-4o-mini (저비용 모델 기본).
- **신규 감지:** 유튜브 RSS 피드 (`youtube.com/feeds/videos.xml?channel_id=...`).

---

## 절대 규칙 (Hard Rules)

1. **API 키는 절대 클라이언트에 노출하지 않는다.** LLM·외부 API 호출은 반드시 서버 사이드(API Route)에서만. 키는 `.env.local` 환경변수로만 읽는다. 프론트 컴포넌트에 키를 import하지 말 것.
2. **중복 요약 금지.** 영상 처리 전 `video_id`로 DB 존재 여부를 먼저 확인한다. `videos.video_id`에 UNIQUE 제약을 둔다.
3. **요약 출력은 정해진 JSON 스키마를 따른다.** (`SUMMARY_SCHEMA.json` 참조.) LLM 프롬프트에 스키마를 명시하고, 응답을 파싱·검증한 뒤 저장한다.
4. **자막 추출 실패가 파이프라인을 멈추게 하지 않는다.** 실패 시 메타데이터 폴백 → 그래도 실패 시 `status='failed'` 저장 후 계속 진행.
5. **환각 방지.** 출연자·정보가 자막/설명문에서 확인되지 않으면 비워둔다. 지어내지 않는다.
6. **HTML `<form>` 태그를 React에서 쓰지 않는다.** onClick/onChange 핸들러 사용.

---

## 작업 순서 (P0부터. 한 번에 하나씩)

> 큰 덩어리를 한 번에 구현하려 하지 말 것. 아래 단계를 순서대로, 각 단계가 동작 확인된 뒤 다음으로.

1. **프로젝트 초기화** — Next.js(App Router) + Tailwind + shadcn/ui + Supabase 클라이언트 연동. `.env.local` 템플릿(`.env.example`) 작성.
2. **DB 스키마** — `channels`, `videos` 테이블 생성 (아래 스키마 참조).
3. **RSS 신규 감지** — 채널 ID로 RSS 파싱 → 신규 `video_id` 판별 (중복 제외).
4. **자막 추출 + 폴백** — 자막 추출, 실패 시 메타데이터 폴백.
5. **LLM 구조화 요약** — `SUMMARY_SCHEMA.json` 형식으로 요약 생성·검증·저장. 긴 영상은 청크 맵-리듀스.
6. **대시보드 UI** — 요약 카드 그리드, 필터, 상세 뷰(타임스탬프 점프 링크).
7. **자동화(Cron)** — 위 3~5 파이프라인을 주기 실행으로 전환. "마지막 확인" 상태 표시.
8. (이후) 채널 등록/관리 UI, 텍스트 내보내기.

---

## DB 스키마 (초안)

```sql
-- 구독 채널
create table channels (
  id           uuid primary key default gen_random_uuid(),
  channel_id   text not null unique,      -- 유튜브 channel_id (UC...)
  title        text,
  url          text,
  created_at   timestamptz default now(),
  last_checked timestamptz                 -- 마지막 폴링 시각
);

-- 영상 + 요약
create table videos (
  id            uuid primary key default gen_random_uuid(),
  video_id      text not null unique,      -- 중복 방지 핵심
  channel_id    text not null references channels(channel_id),
  title         text,
  url           text,
  published_at  timestamptz,
  status        text not null default 'pending',
                -- pending | transcript_ok | metadata_fallback | failed
  summary       jsonb,                     -- SUMMARY_SCHEMA.json 형식
  created_at    timestamptz default now()
);
```

---

## 코딩 스타일

- TypeScript 사용.
- API Route는 입력 검증 → 처리 → 명확한 에러 응답 구조로.
- 외부 호출(RSS/자막/LLM)은 try-catch로 감싸고 실패해도 전체가 죽지 않게.
- 환경변수 누락 시 친절한 에러 메시지.
- 커밋은 단계별로 작게.

---

## 하지 말 것

- 키워드 기반 감지(YouTube Data API)는 MVP 범위 밖. 요청받기 전까지 구현하지 말 것.
- 스택에 없는 새 라이브러리를 임의로 추가하지 말 것. 필요하면 먼저 제안.
- PRD에 없는 기능을 임의로 늘리지 말 것.
