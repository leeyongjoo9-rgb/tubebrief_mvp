import 'dotenv/config'
import { config as dotenvConfig } from 'dotenv'
import { YoutubeTranscript } from 'youtube-transcript'
import OpenAI from 'openai'
import { createClient } from '@supabase/supabase-js'

dotenvConfig({ path: '.env.local' })

const args = process.argv.slice(2)
const SAVE = args.includes('--save')
const modelIdx = args.indexOf('--model')
const MODEL = modelIdx >= 0 && args[modelIdx + 1] ? args[modelIdx + 1] : (process.env.TUBEBRIEF_SUMMARIZE_MODEL ?? 'gpt-5-mini')
const VIDEO_URL = args.find((a, i) => !a.startsWith('--') && args[i - 1] !== '--model') ?? 'https://www.youtube.com/watch?v=AhdostzpxTU'

function extractVideoId(url) {
  const m = url.match(/(?:v=|youtu\.be\/)([\w-]{11})/)
  if (!m) throw new Error(`video id 추출 실패: ${url}`)
  return m[1]
}

async function fetchVideoPageInfo(videoId) {
  const res = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
      'Accept-Language': 'ko,en;q=0.9',
    },
  })
  if (!res.ok) throw new Error(`영상 페이지 로드 실패: HTTP ${res.status}`)
  const html = await res.text()
  const channelId = html.match(/"channelId":"(UC[A-Za-z0-9_-]{22})"/)?.[1]
  if (!channelId) throw new Error('channelId 추출 실패')
  const channelTitle = html.match(/"ownerChannelName":"([^"]+)"/)?.[1] ?? html.match(/"author":"([^"]+)"/)?.[1] ?? null
  const title = html.match(/<meta\s+name="title"\s+content="([^"]+)"/)?.[1] ?? html.match(/"title":"([^"]+)","lengthSeconds"/)?.[1] ?? null
  const publishedAt = html.match(/<meta\s+itemprop="datePublished"\s+content="([^"]+)"/)?.[1] ?? html.match(/"publishDate":"([^"]+)"/)?.[1] ?? null
  const descRaw = html.match(/"shortDescription":"((?:[^"\\]|\\.)*)"/)?.[1] ?? null
  let description = null
  if (descRaw) {
    try { description = JSON.parse(`"${descRaw}"`) } catch { description = descRaw }
  }
  return { channelId, channelTitle, title, publishedAt, description }
}

function decodeJsonStr(s) {
  if (!s) return s
  try { return JSON.parse(`"${s}"`) } catch { return s }
}

// HTML 엔티티를 풀고 유니코드 따옴표를 ASCII로 정규화한다.
// 따옴표의 종류(큰/작은)는 보존 — 원본 작성자가 의도한 표기를 그대로 살림.
function cleanTitle(s) {
  if (!s) return s
  s = s
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
  // 유니코드 따옴표 → ASCII (종류는 보존)
  s = s.replace(/[‘’‛‚`´]/g, "'") // 유니코드 작은따옴표류 → '
  s = s.replace(/[“”„‟]/g, '"')    // 유니코드 큰따옴표류 → "
  return s
}

const ATTEMPTS = [
  { label: 'default', options: {} },
  { label: 'ko', options: { lang: 'ko' } },
  { label: 'en', options: { lang: 'en' } },
]

async function fetchTranscript(videoId) {
  let lastError
  for (const attempt of ATTEMPTS) {
    try {
      const raw = await YoutubeTranscript.fetchTranscript(videoId, attempt.options)
      const segments = (raw ?? [])
        .map((s) => ({
          start: Math.round((s.offset ?? 0) / 1000),
          dur: Math.round((s.duration ?? 0) / 1000),
          text: String(s.text ?? '').trim(),
        }))
        .filter((s) => s.text)
      if (segments.length === 0) continue
      const content = segments.map((s) => s.text).join(' ').replace(/\s+/g, ' ').trim()
      const language = raw.find((s) => s.lang)?.lang ?? attempt.options.lang ?? 'unknown'
      return { content, segments, language, attempt: attempt.label }
    } catch (err) {
      lastError = err
    }
  }
  throw new Error(`자막 가져오기 실패: ${lastError?.message ?? lastError}`)
}

function pad2(n) { return String(n).padStart(2, '0') }
function fmtTs(s) { return `${pad2(Math.floor(s/60))}:${pad2(s%60)}` }

function buildAnchoredContent(segments) {
  const out = []
  let lastAnchor = -100
  for (const seg of segments) {
    if (seg.start - lastAnchor >= 15) {
      out.push(`[${fmtTs(seg.start)}] ${seg.text}`)
      lastAnchor = seg.start
    } else {
      out.push(seg.text)
    }
  }
  return out.join(' ')
}

const SUMMARY_JSON_SCHEMA = {
  name: 'tubebrief_summary',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    required: ['headline','brief','topics','people','companies','source_type','language'],
    properties: {
      headline: { type: 'string' },
      brief: { type: 'string' },
      topics: { type: 'array', items: { type: 'string' } },
      people: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['name','role','note'],
          properties: {
            name: { type: 'string' },
            role: { type: 'string' },
            note: { type: 'string' },
          },
        },
      },
      companies: { type: 'array', items: { type: 'string' } },
      source_type: { type: 'string', enum: ['transcript','metadata'] },
      language: { type: 'string' },
    },
  },
}

const SYSTEM_PROMPT = `너는 유튜브 영상 요약 어시스턴트야. 사용자가 주는 영상 제목, 자막(또는 메타데이터), 그리고 영상 설명문을 보고 정해진 JSON 스키마에 맞춰 통합된 요약을 작성한다.

[입력 자료 사용 원칙]
- [내용]: 영상 본문(자막/메타데이터). brief 본문의 사실은 여기서 가져온다.
- [설명문]: 영상 설명란. 게스트 약력·책 제목·촬영일이 있을 수 있다. people 의 role/note 와 companies 보강에 적극 활용. 채널 일반 안내·광고 문의는 무시.
- 자막에 게스트 인사가 누락된 영상이 흔하다. [설명문]에 출연자 정보가 있으면 그것을 근거로 people 을 채운다.

규칙:

1. headline: 카드 미리보기에 들어갈 1~2문장 TL;DR. 영상의 핵심을 한 줄로.

2. brief: 영상 전체를 다루는 통합 요약문. "한 장짜리 CEO brief" 톤. 정보 밀도 높고 명료한 산문체.

   ★ 분량 — 반드시 다음 하한선을 충족할 것 (가이드 아닌 강제 요구사항):
       * 짧은 자료 (입력 자막 1500자 미만): brief 최소 500자 이상, 3~5 문단.
       * 중간 자료 (1500~7000자): brief 최소 1000자 이상, 5~8 문단.
       * 긴 자료 (7000자 이상): brief 최소 1800자 이상, 8~12 문단.
       자료가 충분한데 위 하한선보다 짧게 쓰면 규칙 위반이다.

   ★ 단락 분리 — 문단 사이는 반드시 빈 줄(\\n\\n)로.

   ★ 시각 마커 — source_type="transcript" 일 때만, 입력의 [mm:ss] 마커에서 가져온 시각만 \`(mm:ss)\` 형태로 본문에 삽입. 시각 지어내지 마라.

   ★ 글머리표/번호/마크다운 금지. 산문 문장만.

3. topics: 영상이 다루는 주제 키워드 2~6개.

4. people: "사람"만 포함. 기업·브랜드·제품은 절대 여기 넣지 말 것 (그건 companies 필드로).
   ★ 채울 근거 — [내용](자막)과 [설명문] 둘 다 활용. 자막에 게스트 호명이 없어도 [설명문] 상단에 "[○○○ 교수]" 같은 출연자 블록이 있으면 그것이 1차 근거.
   ★ name: 사람 이름 그대로. 음성 인식 결과를 임의로 보정하지 마라. [설명문] 표기가 있으면 그쪽 우선.
   ★ role: "○○ 교수", "△△ CEO" 같은 직함이 [내용]·[설명문]에 직접 등장할 때만. 행동 묘사로부터 추론 금지. 없으면 "".
   ★ note: [설명문] 출연자 블록의 학력/경력/저서 등 한 줄 소개의 직접 근거가 있을 때 압축. 여러 줄이면 가장 식별성 높은 1~2가지를 자연스러운 한 문장으로. 추측 금지. 없으면 "".
   ★ 사람 이름이 [내용]·[설명문] 어디에도 없으면 빈 배열.
   ★ 채널 진행자·MC·호스트는 제외. 영상이 게시된 채널의 주인이나 정기 진행자는 출연자가 아니므로 people에 넣지 마라 (예: 권순표·슈카·김작가·신사임당·한경 글로벌마켓 고정 패널 등). 게스트로 초대된 외부 인물(교수·전문가·CEO 등)만 등재. 모든 출연진이 채널 정기 패널뿐이면 빈 배열도 허용.

5. companies: 영상에서 언급된 기업·회사·브랜드 및 연구기관·대학·연구소. [내용]과 [설명문] 모두에서 수집. 영상 전 구간 포함.
   ★ 사람 이름은 절대 포함 금지 (그건 people 로).
   ★ 다음은 모두 제외:
       - 사람의 외형·머리 스타일·옷차림 묘사 단어 (예: "웨이브 머리"의 "웨이브"는 회사 아님).
       - OTT·시청 경로 안내 플랫폼명. [설명문]의 "다시 보기는 ○○에서" 같은 안내에만 등장하는 플랫폼(티빙, 왓챠, 웨이브, 시즌 등)은 제외.
       - 정부 부처·행정 기관 (국방부, 산업통상자원부 등).
       - 대회·이벤트·프로그램명 (DARPA 챌린지, 로보컵, CES, GTC 등). 단 주최 기관 자체가 본문에서 별도로 의미 있게 다뤄지면 그 기관은 포함.
       - 주가 지수·종목군 약칭 (S&P 500, KOSPI, 코스닥, 나스닥, M7, FANG 등). 지수는 회사 아닌 벤치마크.
       - 영상 자료 출처·라이선스 표기 (gettyimages, Shutterstock, Unsplash 등). [설명문] 출처 표기는 본문과 무관.
       - 같은 회사 본체와 하위 서비스명 중복 ("퍼플렉시티"+"퍼플렉시티 파이낸스" → 본체 하나만).
       - 영상이 게시된 채널·방송사 자체. 영상 본문 주제가 그 방송사를 분석·평가하는 게 아니라면 메타 정보이므로 제외 (KBS 다큐의 KBS, EBS 클립의 EBS, MBC 채널 영상의 MBC 등).
       - [설명문]의 "제작도움", "협찬", "후원", "스폰서", "비즈니스 문의" 같은 비즈니스 메타 섹션에만 등장하는 회사. 영상 본문 주제와 무관한 협찬·후원사 (한경 영상의 "제작도움: KB자산운용·삼성자산운용" 등).
   ★ 다음은 반드시 포함:
       - 연구기관·대학·연구소·국립연구원 (예: KAIST, ETRI, MIT 미디어랩, 카네기멜런대학, DARPA 자체).
   ★ 한국어 사용자에게 자연스러운 한글 표기로 통일 (Nvidia → 엔비디아, Tesla → 테슬라, Anthropic → 앤트로픽, Boston Dynamics → 보스턴 다이나믹스). 단 한국에서 영문 약어가 표준인 경우(KAIST, IBM, AMD, SK, LG, SKT, KBS, EBS, MIT 등)는 영문 유지.
   ★ 중복 제거. 같은 회사가 영문·한글 두 표기로 등장하면 한글 하나만.
   ★ "기판 업체", "대기업" 같은 일반명사는 제외. 고유명사만.
   ★ 모르면 빈 배열.

6. source_type, language: 입력값 그대로.

환각 금지. brief 출력 언어는 입력 language에 맞춰라 (ko→한국어).`

function getRequirements(inputLen) {
  if (inputLen < 1500) return { minBriefLen: 500, minParas: 3 }
  if (inputLen < 7000) return { minBriefLen: 1000, minParas: 5 }
  return { minBriefLen: 1800, minParas: 8 }
}

function validateSummary(summary, inputLen, sourceType) {
  const v = []
  const { minBriefLen, minParas } = getRequirements(inputLen)
  if (summary.brief.length < minBriefLen) {
    v.push(`brief가 ${summary.brief.length}자인데, 입력 ${inputLen}자 자료는 최소 ${minBriefLen}자 이상이어야 함. 자료에서 더 많은 사실·맥락·예시를 끌어와 분량을 채워라.`)
  }
  const paraCount = summary.brief.split(/\n\n+/).filter(p => p.trim()).length
  if (paraCount < minParas) {
    v.push(`brief가 ${paraCount}개 문단인데, 최소 ${minParas}개 문단으로 나눠야 함. 문단 사이는 빈 줄(\\n\\n)로 반드시 분리하라.`)
  }
  if (sourceType === 'transcript') {
    const tsCount = (summary.brief.match(/\(\d{1,2}:\d{2}\)/g) ?? []).length
    if (tsCount < 2) {
      v.push(`brief에 (mm:ss) 타임스탬프가 ${tsCount}개뿐. transcript 모드에서는 입력 [mm:ss] 마커 중 의미 있는 지점 2~5곳을 (mm:ss)로 본문에 자연스럽게 삽입하라. 시각은 입력에 있는 것만 사용.`)
    }
  }
  return v
}

async function main() {
  const videoId = extractVideoId(VIDEO_URL)
  console.log(`[videoId] ${videoId}${SAVE ? ' (--save 모드)' : ''}`)
  console.log(`[model] ${MODEL}`)

  console.log('[0/3] 영상 페이지 메타 + 설명문 수집...')
  const pageInfo = await fetchVideoPageInfo(videoId)
  pageInfo.title = cleanTitle(decodeJsonStr(pageInfo.title))
  pageInfo.channelTitle = cleanTitle(decodeJsonStr(pageInfo.channelTitle))
  console.log(`  channelId=${pageInfo.channelId}, channelTitle=${pageInfo.channelTitle}, title=${pageInfo.title?.slice(0, 40)}..., publishedAt=${pageInfo.publishedAt}`)
  console.log(`  description: ${pageInfo.description ? pageInfo.description.length + '자' : '없음'}`)

  console.log(`[${SAVE ? '1/3' : '1/2'}] 자막 가져오는 중...`)
  const tr = await fetchTranscript(videoId)
  console.log(`  ok: ${tr.segments.length} segments, ${tr.content.length} chars, lang=${tr.language} (attempt=${tr.attempt})`)

  const anchored = buildAnchoredContent(tr.segments)
  console.log(`  anchored: ${anchored.length} chars`)

  console.log(`[${SAVE ? '2/3' : '2/2'}] OpenAI 요약 호출 (검증+재시도 최대 2회)...`)
  const key = process.env.OPENAI_API_KEY
  if (!key) throw new Error('OPENAI_API_KEY 없음')
  const openai = new OpenAI({ apiKey: key })

  const descSection = pageInfo.description?.trim() ? `\n\n[설명문]\n${pageInfo.description.trim()}` : ''
  const userPrompt = `[제목] ${pageInfo.title ?? '(제목 미상)'}\n[출처] transcript\n[언어] ${tr.language}\n\n[내용]\n${anchored}${descSection}`
  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: userPrompt },
  ]

  let inputTok = 0, outputTok = 0, totalTok = 0
  let summary = null
  let violations = []
  let attempts = 0
  const MAX_ATTEMPTS = 2

  while (attempts < MAX_ATTEMPTS) {
    attempts++
    const callParams = {
      model: MODEL,
      messages,
      response_format: { type: 'json_schema', json_schema: SUMMARY_JSON_SCHEMA },
    }
    // gpt-5 / o-series reasoning 모델은 custom temperature 미지원 (default 1만 가능)
    if (!/^(gpt-5|o\d)/.test(MODEL)) callParams.temperature = 0.2
    const completion = await openai.chat.completions.create(callParams)
    inputTok += completion.usage?.prompt_tokens ?? 0
    outputTok += completion.usage?.completion_tokens ?? 0
    totalTok += completion.usage?.total_tokens ?? 0

    const content = completion.choices[0]?.message?.content
    if (!content) throw new Error('OpenAI 응답 비어있음')
    summary = JSON.parse(content)
    violations = validateSummary(summary, anchored.length, 'transcript')
    console.log(`  [attempt ${attempts}] brief=${summary.brief.length}자, paras=${summary.brief.split(/\n\n+/).filter(p=>p.trim()).length}, ts=${(summary.brief.match(/\(\d{1,2}:\d{2}\)/g)??[]).length}, violations=${violations.length}`)
    if (violations.length === 0) break
    if (attempts >= MAX_ATTEMPTS) break
    messages.push({ role: 'assistant', content })
    messages.push({ role: 'user', content: `이전 응답이 다음 규칙을 위반했어. 같은 JSON 스키마로 다시 작성하라. 자료에는 분량을 채울 사실·맥락·예시가 충분하다.\n\n${violations.map(v => `- ${v}`).join('\n')}` })
  }

  console.log('\n========== 요약 결과 ==========')
  console.log(JSON.stringify(summary, null, 2))
  console.log('\n========== brief (가독성) ==========\n')
  console.log(summary.brief)
  console.log('\n========== meta ==========')
  console.log(`attempts=${attempts}, 최종 violations=${violations.length}`)
  if (violations.length) violations.forEach(v => console.log(`  - ${v}`))
  console.log(`tokens: input=${inputTok} output=${outputTok} total=${totalTok}`)
  console.log(`brief 길이: ${summary.brief.length}자, topics: ${summary.topics.length}, people: ${summary.people.length}, companies: ${summary.companies?.length ?? 0}`)

  if (!SAVE) return

  console.log('\n[3/3] Supabase 저장...')
  const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supaKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supaUrl || !supaKey) throw new Error('NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 없음')
  const supabase = createClient(supaUrl, supaKey, { auth: { persistSession: false, autoRefreshToken: false } })

  const channelRow = {
    channel_id: pageInfo.channelId,
    title: pageInfo.channelTitle,
    url: `https://www.youtube.com/channel/${pageInfo.channelId}`,
  }
  const { error: chErr } = await supabase.from('channels').upsert(channelRow, { onConflict: 'channel_id' })
  if (chErr) throw new Error(`channels upsert 실패: ${chErr.message}`)
  console.log(`  channels upsert ok: ${pageInfo.channelTitle}`)

  const videoRow = {
    video_id: videoId,
    channel_id: pageInfo.channelId,
    title: pageInfo.title,
    url: `https://www.youtube.com/watch?v=${videoId}`,
    published_at: pageInfo.publishedAt,
    status: 'transcript_ok',
    summary,
  }
  const { error: vErr } = await supabase.from('videos').upsert(videoRow, { onConflict: 'video_id' })
  if (vErr) throw new Error(`videos upsert 실패: ${vErr.message}`)
  console.log(`  videos upsert ok`)

  console.log('\n✅ 저장 완료. 대시보드에서 확인: npm run dev → http://localhost:3000')
}

main().catch((e) => {
  console.error('실패:', e?.message ?? e)
  process.exit(1)
})
