# TubeBrief

> 구독한 유튜브 채널의 신규 영상을 매일 자동으로 감지하여, AI 가 **헤드라인·본문·출연자·언급 인물·기업·주제·타임스탬프**까지 구조화한 요약 보고서로 변환하고 대시보드에 아카이빙해 두는 개인용 콘텐츠 다이제스트 서비스입니다.

- **데모 URL**: https://tubebrief-mvp.vercel.app/
- **GitHub**: https://github.com/leeyongjoo9-rgb/tubebrief_mvp
- **개발자**: 이용주 — 바이브코딩 기반 서비스 구축 기말과제

---

## 핵심 기능

| 기능 | 설명 |
|---|---|
| **채널 자동 감지** | 구독한 채널의 YouTube RSS 를 주기적으로 폴링해 신규 영상 자동 발견 (API 키 불필요) |
| **코너 단위 구독** | 한 채널 안에서 *제목/설명 키워드 AND 필터*로 특정 코너·호스트·게스트만 매치 (예: MBC라디오시사 채널 안의 `[권순표의 뉴스하이킥]`만, 이강민의 잡지사의 `#곽재식` 회차만) |
| **자막 → AI 요약** | youtube-transcript 로 자막 추출 후 OpenAI `gpt-5-mini` 의 structured outputs 으로 JSON Schema 강제 요약 |
| **출연자 / 언급 인물 분리** | LLM 이 "직접 출연" vs "대화 중 거론" 을 별도 필드로 분리 (역사적 인물, 인용된 학자 등) |
| **자막 실패 폴백** | 자막 추출 실패 시 RSS 의 `media:description` 메타데이터로 자동 폴백, 그래도 실패 시 `status=failed` 로 기록 후 다음 영상 계속 처리 |
| **타임스탬프 점프** | 본문에 자연스럽게 삽입된 `(mm:ss)` 마커가 YouTube 그 시점으로 점프하는 링크로 자동 변환 |
| **자동화** | Vercel Cron 으로 매일 `refresh → process → summarize` 직렬 실행 |

---

## 기술 스택

| 영역 | 선택 | 선택 이유 |
|---|---|---|
| 프레임워크 | **Next.js 16 (App Router)** | React 풀스택. API Routes 로 백엔드까지 단일 프로젝트에 통합 |
| 언어 | **TypeScript** | 타입 안전성, LLM 응답 스키마와 코드 일치 |
| 스타일 | **Tailwind CSS v4 + shadcn/ui** | 디자인 시스템, AI 코딩 친화적 |
| DB | **Supabase (PostgreSQL)** | jsonb 컬럼으로 LLM 응답 그대로 저장 가능. 무료 tier 충분 |
| LLM | **OpenAI `gpt-5-mini`** | **structured outputs** (JSON Schema 강제) 로 환각/포맷 깨짐 방지. 한국어 분량/마크업 잘 따름 |
| 자막 | **`youtube-transcript`** + RSS 폴백 | 자막 추출 라이브러리. 클라우드 IP 봇 차단 회피용 폴백 설계 |
| 신규 감지 | **YouTube RSS** | API 키·쿼터 불필요. 채널당 최근 15개 영상 노출 |
| XML 파서 | **`fast-xml-parser`** | RSS 의 `media:`, `yt:` 네임스페이스 안전 파싱 |
| 배포 | **Vercel** (Hobby) | Next.js native, Vercel Cron 통합, GitHub 자동 빌드 |

---

## 사용자 흐름

```
[채널 관리] → URL + 키워드로 구독 등록
       ↓
[매일 0시 Cron] → /api/cron
       ↓
   ┌───────────────────────────────────────────────┐
   │  refresh: 모든 구독의 RSS 폴링                  │
   │   - 제목 + 설명 안 키워드 매치하는 신규 영상만    │
   │   - 영상 메타 (id, 제목, URL, 발행일) DB INSERT │
   │       ↓                                       │
   │  process(limit=2): pending 영상 자막 추출       │
   │   - 1순위: youtube-transcript (한/영 fallback) │
   │   - 2순위: RSS description (메타데이터 폴백)    │
   │   - 3순위: status=failed                      │
   │       ↓                                       │
   │  summarize(limit=1): LLM 요약 생성              │
   │   - 자막에 [mm:ss] 마커 삽입 후 LLM 호출        │
   │   - JSON Schema 응답을 videos.summary 저장      │
   └───────────────────────────────────────────────┘
       ↓
[홈 대시보드] 영상 카드 그리드 → 카드 클릭 → 상세 페이지
   - 헤드라인, 키워드, 출연자, 언급된 인물, 본문 (타임스탬프 점프)
```

---

## 폴더 구조

```
tubebrief/
├── CLAUDE.md                  ← Claude Code 가 매 세션 읽는 프로젝트 규칙 (절대 규칙·작업 순서·코딩 스타일)
├── TubeBrief_PRD.md           ← 제품 요구사항 정의서 (문제·기능·사용자 흐름·일정)
├── SUMMARY_SCHEMA.json        ← LLM 출력 JSON 스키마 (videos.summary jsonb 형식)
├── PRESENTATION.md            ← 발표자료 노트
├── vercel.json                ← Vercel Cron (매일 0시 /api/cron) + 함수별 maxDuration
├── .env.example               ← 환경변수 템플릿
├── src/
│   ├── app/
│   │   ├── page.tsx                    ← 홈 (영상 카드 그리드 + 채널 strip)
│   │   ├── videos/[video_id]/page.tsx  ← 영상 상세
│   │   ├── channels/                   ← 채널 관리 페이지 + 서버 액션
│   │   └── api/
│   │       ├── cron/route.ts           ← refresh → process → summarize 통합 entry
│   │       ├── refresh/route.ts        ← RSS 신규 영상 감지
│   │       ├── process/route.ts        ← 자막 추출 + 폴백
│   │       ├── summarize/route.ts      ← LLM 요약
│   │       └── channels/route.ts       ← 채널/구독 등록
│   ├── lib/
│   │   ├── llm/openai.ts               ← OpenAI 클라이언트 + Summary 스키마 + 시스템 프롬프트
│   │   ├── youtube/
│   │   │   ├── channelId.ts            ← URL → channel_id 추출 (핸들/UC/동영상 URL 모두 처리)
│   │   │   ├── rss.ts                  ← RSS XML 파싱
│   │   │   ├── transcript.ts           ← 자막 추출 (한/영 fallback)
│   │   │   └── metadata.ts             ← 메타데이터 폴백
│   │   ├── supabase/                   ← Supabase 클라이언트 (server / client 분리)
│   │   ├── processVideo.ts             ← process 오케스트레이터
│   │   ├── summarizeVideo.ts           ← summarize 오케스트레이터 + [mm:ss] 앵커링
│   │   └── auth.ts                     ← requireCronAuth (Bearer CRON_SECRET)
│   └── components/
│       ├── channel-strip.tsx           ← 채널 칩 (영상 수 + NEW 배지)
│       ├── video-card.tsx              ← 영상 카드
│       ├── channels/                   ← 채널 관리 UI
│       └── ui/                         ← shadcn 컴포넌트 (button, card, badge, input)
```

---

## 로컬 실행

전제: Node 22 이상, npm 11 이상, Supabase 프로젝트, OpenAI API 키.

```bash
# 1. 의존성 설치
npm install

# 2. 환경변수 설정
cp .env.example .env.local
#  .env.local 편집:
#    NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
#    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxx
#    SUPABASE_SERVICE_ROLE_KEY=sb_secret_xxx
#    OPENAI_API_KEY=sk-proj-xxx
#    CRON_SECRET=<32자 이상 임의 문자열>

# 3. Supabase 테이블 (Supabase SQL Editor 에 붙여넣기)
#   channels / videos / transcripts / subscriptions
#   (스키마는 CLAUDE.md 의 DB 스키마 섹션 참조)

# 4. 개발 서버
npm run dev
#   http://localhost:3000

# 5. (수동) 파이프라인 호출
SECRET=$(grep "^CRON_SECRET=" .env.local | cut -d= -f2)
curl -X POST http://localhost:3000/api/refresh -H "Authorization: Bearer $SECRET"
curl -X POST http://localhost:3000/api/process -H "Authorization: Bearer $SECRET" -H "Content-Type: application/json" -d '{"limit":5}'
curl -X POST http://localhost:3000/api/summarize -H "Authorization: Bearer $SECRET" -H "Content-Type: application/json" -d '{"limit":5}'
```

---

## 배포 (Vercel)

1. **GitHub repo 와 Vercel 프로젝트 연결**: vercel.com → Add New → Project → 이 repo 선택
2. **환경변수 등록** (Vercel Project Settings → Environment Variables): `.env.local` 6개 키 그대로 (Production/Preview/Development 모두 체크)
3. **Deploy** → URL 발급. `vercel.json` 의 cron 자동 등록 (매일 0시 UTC `/api/cron`).
4. **첫 동작 확인**: `curl -X GET https://<url>/api/cron -H "Authorization: Bearer <CRON_SECRET>"`

---

## Context 문서 (개발에 활용된 .md 파일)

| 파일 | 역할 | 활용 방식 |
|---|---|---|
| [CLAUDE.md](CLAUDE.md) | Claude Code 세션마다 자동 로드되는 프로젝트 규칙 | 절대 규칙 6개 (API 키 보안 / 중복 방지 / JSON 스키마 / 자막 폴백 / 환각 방지 / `<form>` 금지) → 모든 코드가 이를 준수. 작업 순서 8단계 → 1→7단계 진행 가이드. 코딩 스타일 → TypeScript / try-catch / 친절한 에러 메시지 |
| [TubeBrief_PRD.md](TubeBrief_PRD.md) | 제품 요구사항 정의서 | 핵심 기능 우선순위 (P0/P1/P2), 자막 폴백 3단계 전략, 데이터 파이프라인 다이어그램, 2주 일정 |
| [SUMMARY_SCHEMA.json](SUMMARY_SCHEMA.json) | LLM 출력 JSON 스키마 | 그대로 OpenAI `response_format.json_schema` 에 전달 → strict mode 로 응답 스키마 강제 |
| [PRESENTATION.md](PRESENTATION.md) | 발표자료 노트 | 9슬라이드 콘텐츠 원자료 |

---

## 라이선스

이 프로젝트는 학습 목적의 기말과제 산출물입니다.
