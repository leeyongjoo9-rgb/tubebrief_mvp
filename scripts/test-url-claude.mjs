import 'dotenv/config'
import { config as dotenvConfig } from 'dotenv'
import { YoutubeTranscript } from 'youtube-transcript'

dotenvConfig({ path: '.env.local' })

const args = process.argv.slice(2)
const VIDEO_URL = args.find((a) => !a.startsWith('--')) ?? 'https://www.youtube.com/watch?v=MypMoQ9fodU'
const MODEL = 'claude-sonnet-4-6'

// Sonnet 4.6 가격 (per 1M tokens, 2026 추정)
const PRICE_INPUT = 3.0
const PRICE_OUTPUT = 15.0

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
  const channelTitle = html.match(/"ownerChannelName":"([^"]+)"/)?.[1] ?? null
  const titleRaw = html.match(/<meta\s+name="title"\s+content="([^"]+)"/)?.[1] ?? null
  const descRaw = html.match(/"shortDescription":"((?:[^"\\]|\\.)*)"/)?.[1] ?? null
  const decode = (s) => { try { return JSON.parse(`"${s}"`) } catch { return s } }
  return {
    channelId,
    channelTitle: channelTitle ? decode(channelTitle) : null,
    title: titleRaw ? decode(titleRaw).replace(/&quot;/g, '"').replace(/&amp;/g, '&') : null,
    description: descRaw ? decode(descRaw) : null,
  }
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
          text: String(s.text ?? '').trim(),
        }))
        .filter((s) => s.text)
      if (segments.length === 0) continue
      const content = segments.map((s) => s.text).join(' ').replace(/\s+/g, ' ').trim()
      const language = raw.find((s) => s.lang)?.lang ?? attempt.options.lang ?? 'unknown'
      return { content, segments, language }
    } catch (err) { lastError = err }
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

const SUMMARY_INPUT_SCHEMA = {
  type: 'object',
  required: ['headline','brief','topics','people','companies','source_type','language'],
  properties: {
    headline: { type: 'string', description: '카드 미리보기용 1~2문장 TL;DR.' },
    brief: { type: 'string', description: '영상 전체 통합 요약문. 문단은 \\n\\n 으로 구분. 글머리표·번호·마크다운 금지.' },
    topics: { type: 'array', items: { type: 'string' }, description: '주제 키워드 2~6개.' },
    people: {
      type: 'array',
      items: {
        type: 'object',
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
}

const SYSTEM_PROMPT = `너는 유튜브 영상 요약 어시스턴트야. 사용자가 주는 영상 제목, 자막(또는 메타데이터), 그리고 영상 설명문을 보고 정해진 도구 스키마에 맞춰 통합된 요약을 작성한다.

[입력 자료 사용 원칙]
- [내용]: 영상 본문(자막/메타데이터). brief 본문의 사실은 여기서 가져온다.
- [설명문]: 영상 설명란. 게스트 약력·책 제목·촬영일이 있을 수 있다. people 의 role/note 와 companies 보강에 적극 활용. 채널 일반 안내·광고 문의는 무시.
- 자막에 게스트 인사가 누락된 영상이 흔하다. [설명문]에 출연자 정보가 있으면 그것을 근거로 people 을 채운다.

규칙:

1. headline: 1~2문장 TL;DR.

2. brief: 영상 전체를 다루는 통합 요약문. 정보 밀도 높고 명료한 산문체.
   ★ 분량 하한선 (강제):
       * 짧은 자료 (1500자 미만): 최소 500자, 3~5 문단.
       * 중간 자료 (1500~7000자): 최소 1000자, 5~8 문단.
       * 긴 자료 (7000자 이상): 최소 1800자, 8~12 문단.
   ★ 문단 사이는 반드시 빈 줄(\\n\\n)로 분리.
   ★ 시각 마커 — source_type="transcript" 일 때만, 입력 [mm:ss] 마커 중 의미 있는 지점 2~5곳을 (mm:ss)로 본문에 자연스럽게 삽입. 시각은 입력에 있는 것만 사용, 지어내지 마라. brief가 영상 후반까지 다뤄야 하므로 후반부 [mm:ss]도 사용.
   ★ 글머리표/번호/마크다운 금지. 산문 문장만.
   ★ 구성: 도입 → 본론 → 결론/시사점. 영상이 다루는 모든 주요 구간을 빠짐없이 다뤄라(특히 후반부 누락 금지).

3. topics: 주제 키워드 2~6개.

4. people: "사람"만 포함. 기업·브랜드·제품은 companies로.
   ★ 채울 근거 — [내용]과 [설명문] 둘 다. [설명문] 상단에 "[○○○ 교수]" 같은 출연자 블록이 있으면 1차 근거.
   ★ name: 사람 이름 그대로. [설명문] 표기 우선.
   ★ role: "○○ 교수", "△△ CEO" 같은 직함이 직접 등장할 때만. 행동 묘사에서 추론 금지. 없으면 "".
   ★ note: [설명문] 출연자 블록의 학력/경력/저서를 자연스러운 한 문장으로 압축. 추측 금지. 없으면 "".
   ★ 사람 이름이 어디에도 없으면 빈 배열.

5. companies: 영상에서 언급된 기업·회사·브랜드명. [내용]과 [설명문] 모두에서 수집. 영상 전 구간을 빠짐없이 살펴라(후반부 회사도 포함).
   ★ 사람 이름은 절대 포함 금지.
   ★ 등장 표기 그대로. 중복 제거.
   ★ "기판 업체", "대기업" 같은 일반명사 제외. 고유명사 기업만.
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
    v.push(`brief가 ${summary.brief.length}자인데, 입력 ${inputLen}자 자료는 최소 ${minBriefLen}자 이상이어야 함.`)
  }
  const paraCount = summary.brief.split(/\n\n+/).filter(p => p.trim()).length
  if (paraCount < minParas) {
    v.push(`brief가 ${paraCount}개 문단인데, 최소 ${minParas}개 문단으로 나눠야 함.`)
  }
  if (sourceType === 'transcript') {
    const tsCount = (summary.brief.match(/\(\d{1,2}:\d{2}\)/g) ?? []).length
    if (tsCount < 2) {
      v.push(`brief에 (mm:ss) 타임스탬프가 ${tsCount}개뿐. 최소 2~5개 자연스럽게 삽입.`)
    }
  }
  return v
}

async function callClaude(messages) {
  const key = process.env.ANTHROPIC_API_KEY
  if (!key) throw new Error('ANTHROPIC_API_KEY 없음')

  const body = {
    model: MODEL,
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages,
    tools: [{
      name: 'tubebrief_summary',
      description: '영상 요약을 정해진 스키마로 반환한다.',
      input_schema: SUMMARY_INPUT_SCHEMA,
    }],
    tool_choice: { type: 'tool', name: 'tubebrief_summary' },
  }

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const txt = await res.text()
    throw new Error(`Anthropic API 실패 HTTP ${res.status}: ${txt.slice(0, 500)}`)
  }
  const json = await res.json()
  const toolBlock = json.content?.find((b) => b.type === 'tool_use')
  if (!toolBlock) throw new Error(`tool_use 블록 없음. content=${JSON.stringify(json.content).slice(0, 300)}`)
  return {
    summary: toolBlock.input,
    usage: json.usage,
    rawContent: JSON.stringify(toolBlock.input),
  }
}

async function main() {
  const videoId = extractVideoId(VIDEO_URL)
  console.log(`[videoId] ${videoId}`)
  console.log(`[model] ${MODEL}`)

  console.log('[0/2] 영상 페이지 메타 + 설명문 수집...')
  const pageInfo = await fetchVideoPageInfo(videoId)
  console.log(`  channelTitle=${pageInfo.channelTitle}, title=${pageInfo.title?.slice(0, 50)}...`)
  console.log(`  description: ${pageInfo.description ? pageInfo.description.length + '자' : '없음'}`)

  console.log('[1/2] 자막 가져오는 중...')
  const tr = await fetchTranscript(videoId)
  console.log(`  ok: ${tr.segments.length} segments, ${tr.content.length} chars, lang=${tr.language}`)
  const anchored = buildAnchoredContent(tr.segments)
  console.log(`  anchored: ${anchored.length} chars`)

  console.log(`[2/2] Claude (${MODEL}) 호출 (검증+재시도 최대 2회)...`)
  const descSection = pageInfo.description?.trim() ? `\n\n[설명문]\n${pageInfo.description.trim()}` : ''
  const userPrompt = `[제목] ${pageInfo.title ?? '(제목 미상)'}\n[출처] transcript\n[언어] ${tr.language}\n\n[내용]\n${anchored}${descSection}`

  const messages = [{ role: 'user', content: userPrompt }]
  let inputTok = 0, outputTok = 0
  let summary = null
  let violations = []
  let attempts = 0
  const MAX_ATTEMPTS = 2

  while (attempts < MAX_ATTEMPTS) {
    attempts++
    const r = await callClaude(messages)
    inputTok += r.usage?.input_tokens ?? 0
    outputTok += r.usage?.output_tokens ?? 0
    summary = r.summary
    violations = validateSummary(summary, anchored.length, 'transcript')
    console.log(`  [attempt ${attempts}] brief=${summary.brief.length}자, paras=${summary.brief.split(/\n\n+/).filter(p=>p.trim()).length}, ts=${(summary.brief.match(/\(\d{1,2}:\d{2}\)/g)??[]).length}, people=${summary.people.length}, companies=${summary.companies.length}, violations=${violations.length}`)
    if (violations.length === 0) break
    if (attempts >= MAX_ATTEMPTS) break
    messages.push({ role: 'assistant', content: [{ type: 'tool_use', id: `toolu_${attempts}`, name: 'tubebrief_summary', input: summary }] })
    messages.push({ role: 'user', content: [{ type: 'tool_result', tool_use_id: `toolu_${attempts}`, content: `이전 응답이 다음 규칙을 위반했어. 같은 도구 스키마로 다시 작성하라. 자료에는 분량을 채울 사실·맥락·예시가 충분하다.\n\n${violations.map(v => `- ${v}`).join('\n')}` }] })
  }

  console.log('\n========== Claude 요약 결과 ==========')
  console.log(JSON.stringify(summary, null, 2))
  console.log('\n========== brief (가독성) ==========\n')
  console.log(summary.brief)
  console.log('\n========== meta ==========')
  console.log(`attempts=${attempts}, 최종 violations=${violations.length}`)
  if (violations.length) violations.forEach(v => console.log(`  - ${v}`))
  const cost = (inputTok / 1_000_000) * PRICE_INPUT + (outputTok / 1_000_000) * PRICE_OUTPUT
  console.log(`tokens: input=${inputTok} output=${outputTok}`)
  console.log(`예상 비용: $${cost.toFixed(4)} (Sonnet 4.6 기준 input $${PRICE_INPUT}/1M, output $${PRICE_OUTPUT}/1M)`)
  console.log(`brief 길이: ${summary.brief.length}자, topics: ${summary.topics.length}, people: ${summary.people.length}, companies: ${summary.companies.length}`)
}

main().catch((e) => {
  console.error('실패:', e?.message ?? e)
  process.exit(1)
})
