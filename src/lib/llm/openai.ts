import OpenAI from 'openai'

const SUMMARIZE_MODEL = process.env.TUBEBRIEF_SUMMARIZE_MODEL ?? 'gpt-5-mini'

export interface Summary {
  headline: string
  brief: string
  topics: string[]
  // 실제 영상에 직접 등장한 외부 인물 (게스트·전문가·인터뷰이). 진행자/MC 는 제외.
  people: Array<{ name: string; role: string; note: string }>
  // 영상 안에서 출연자/진행자가 대화 중에 거론한 다른 인물 (역사적 인물, 인용된 학자 등).
  // 옛 데이터엔 이 필드가 없을 수 있어 optional.
  mentioned_people?: Array<{ name: string; role: string; note: string }>
  companies: string[]
  source_type: 'transcript' | 'metadata'
  language: string
}

export interface SummarizeInput {
  title: string
  content: string
  language: string
  sourceType: 'transcript' | 'metadata'
  description?: string | null
}

export interface SummarizeResult {
  summary: Summary
  usage: {
    inputTokens: number
    outputTokens: number
    totalTokens: number
  }
  attempts: number
  violations: string[]
}

function getRequirements(inputLen: number): { minBriefLen: number; minParas: number } {
  if (inputLen < 1500) return { minBriefLen: 500, minParas: 3 }
  if (inputLen < 7000) return { minBriefLen: 1000, minParas: 5 }
  return { minBriefLen: 1800, minParas: 8 }
}

function validateSummary(
  summary: Summary,
  inputLen: number,
  sourceType: 'transcript' | 'metadata',
): string[] {
  const violations: string[] = []
  const { minBriefLen, minParas } = getRequirements(inputLen)

  if (summary.brief.length < minBriefLen) {
    violations.push(
      `brief가 ${summary.brief.length}자인데, 입력 ${inputLen}자 자료는 최소 ${minBriefLen}자 이상이어야 함. 자료에서 더 많은 사실·맥락·예시를 끌어와 분량을 채워라.`,
    )
  }

  const paraCount = summary.brief.split(/\n\n+/).filter((p) => p.trim()).length
  if (paraCount < minParas) {
    violations.push(
      `brief가 ${paraCount}개 문단인데, 최소 ${minParas}개 문단으로 나눠야 함. 문단 사이는 빈 줄(\\n\\n)로 반드시 분리하라.`,
    )
  }

  if (sourceType === 'transcript') {
    const tsCount = (summary.brief.match(/\(\d{1,2}:\d{2}\)/g) ?? []).length
    if (tsCount < 2) {
      violations.push(
        `brief에 (mm:ss) 형식 타임스탬프가 ${tsCount}개뿐. transcript 모드에서는 입력의 [mm:ss] 마커 중 의미 있는 지점 2~5곳을 (mm:ss)로 본문에 자연스럽게 삽입해야 함. 시각은 입력에 있는 것만 사용하고 지어내지 마라.`,
      )
    }
  }

  return violations
}

const SUMMARY_JSON_SCHEMA = {
  name: 'tubebrief_summary',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    required: [
      'headline',
      'brief',
      'topics',
      'people',
      'mentioned_people',
      'companies',
      'source_type',
      'language',
    ],
    properties: {
      headline: {
        type: 'string',
        description:
          '카드 미리보기용 1~2문장 TL;DR. 영상의 핵심을 한 줄로.',
      },
      brief: {
        type: 'string',
        description:
          '영상 전체를 다루는 통합 요약문. 문단은 \\n\\n 으로 구분. 글머리표/번호 매기기/마크다운 금지. 길이는 자료에 비례. source_type=transcript 일 때만, 입력의 [mm:ss] 마커에서 가져온 시각을 `(mm:ss)` 형태로 본문에 자연스럽게 삽입 가능.',
      },
      topics: {
        type: 'array',
        items: { type: 'string' },
        description: '영상이 다루는 주제 키워드 2~6개.',
      },
      people: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['name', 'role', 'note'],
          properties: {
            name: { type: 'string' },
            role: {
              type: 'string',
              description:
                '역할 (예: 진행자, 게스트). 자막 명시 없으면 빈 문자열.',
            },
            note: {
              type: 'string',
              description:
                '한 줄 소개. 자막/설명 근거 없으면 빈 문자열.',
            },
          },
        },
        description:
          '실제 영상에 직접 등장한 외부 인물(게스트·전문가·인터뷰이)만. 진행자/MC 는 제외. 거론만 된 사람은 mentioned_people 로. 모르면 빈 배열.',
      },
      mentioned_people: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['name', 'role', 'note'],
          properties: {
            name: { type: 'string' },
            role: {
              type: 'string',
              description:
                '역할/직함 (예: 역사적 인물, 학자, 노벨상 수상자). 자막 명시 없으면 빈 문자열.',
            },
            note: {
              type: 'string',
              description:
                '한 줄 소개. 자막/설명 근거 없으면 빈 문자열.',
            },
          },
        },
        description:
          '영상에 직접 출연하진 않았지만, 출연자가 대화 중에 거론한 인물 (역사적 인물, 인용된 학자, 사례 속 인물 등). 같은 인물이 직접 출연도 했다면 people 에만 등재하고 여기엔 넣지 마라. 모르면 빈 배열.',
      },
      companies: {
        type: 'array',
        items: { type: 'string' },
        description:
          '자막/설명에서 언급된 기업·회사·브랜드 및 연구기관·대학·연구소. 사람·정부 부처·대회명·시청 안내 플랫폼은 제외. 모르면 빈 배열.',
      },
      source_type: {
        type: 'string',
        enum: ['transcript', 'metadata'],
      },
      language: {
        type: 'string',
        description: '출력 언어 코드 (예: "ko", "en").',
      },
    },
  },
} as const

const SYSTEM_PROMPT = `너는 유튜브 영상 요약 어시스턴트야. 사용자가 주는 영상 제목, 자막(또는 메타데이터), 그리고 영상 설명문을 보고 정해진 JSON 스키마에 맞춰 통합된 요약을 작성한다.

[입력 자료 사용 원칙]
- [내용]: 영상 본문 (자막 또는 메타데이터). 가장 중요한 출처. brief 본문의 사실은 여기서 가져온다.
- [설명문]: 영상 설명란. 게스트 약력, 책 제목, 촬영일, 채널 안내문이 들어있는 경우가 많다. **people 의 약력(role/note)과 companies 보강에 적극 활용**할 것. 단, 채널 일반 안내·광고 문의는 무시.
- 자막에 게스트 인사·소개가 누락된 영상이 흔하다. 출연자 정보가 자막에 없어도 [설명문]에 있으면 그것을 근거로 people 을 채운다.

규칙:

1. headline: 카드 미리보기에 들어갈 1~2문장 TL;DR. 영상의 핵심을 한 줄로.

2. brief: 영상 전체를 다루는 통합 요약문. "한 장짜리 CEO brief" 톤. 정보 밀도 높고 명료한 산문체.

   ★ 분량 — 반드시 다음 하한선을 충족할 것 (가이드 아닌 강제 요구사항):
       * 짧은 자료 (입력 자막 1500자 미만): brief 최소 500자 이상, 3~5 문단.
       * 중간 자료 (1500~7000자): brief 최소 1000자 이상, 5~8 문단.
       * 긴 자료 (7000자 이상): brief 최소 1800자 이상, 8~12 문단.
       자료가 충분한데 위 하한선보다 짧게 쓰면 규칙 위반이다. 자료에서 끌어올 수 있는 사실·맥락·인용·예시를 적극 활용해 분량을 채워라.

   ★ 단락 분리 — 반드시:
       문단 사이는 반드시 빈 줄(\\n\\n) 로 분리한다. 한 단락에 통째로 묶지 마라.
       문단마다 하나의 핵심 메시지/사실의 흐름을 다룬다.

   ★ 시각 마커 — source_type="transcript" 일 때만:
       입력 본문에 [mm:ss] 마커가 곳곳에 박혀있다. brief 안에 의미 있는 지점마다 \`(mm:ss)\` 형태로 시각을 적극적으로 삽입하라.
       권장: brief 안에 최소 2~5 곳에 자연스럽게 짝짓는다 (영상이 길수록 더 많이).
       반드시 입력 [mm:ss] 에서 직접 본 시각만 사용. 시각을 지어내지 마라.
       source_type="metadata" 인 경우: 자막이 없으므로 시각 마커 사용 절대 금지.

   ★ 형식 금지:
       글머리표(-, *, •), 번호 매기기(1., 2.), 마크다운 표기(**, ##, []()) 모두 사용 금지. 자연스러운 산문 문장만.

   ★ 구성 흐름:
       도입(이 영상이 무엇을 다루는지) → 본론(핵심 주장/사례/맥락/단계들) → 결론·시사점.

3. topics: 영상이 다루는 주제 키워드 2~6개.

4. people: 실제 영상에 직접 등장한 외부 인물 (게스트·전문가·인터뷰이) 만 포함.
   ★ 판별 기준 — 절대 중요:
       * 이 사람이 영상 안에서 직접 말하고 있는가 (또는 마이크 앞에서 발화하고 있는가)?  YES → people.
       * 출연자가 대화 중에 이름만 언급하고 있는가 (역사적 인물, 인용된 학자, 사례 속 인물 등)?  YES → mentioned_people. people 에는 넣지 마라.
       * 같은 인물이 직접 출연도 하면서 다른 사람도 거론한다면, 그 인물 본인은 people, 거론된 다른 사람들은 mentioned_people.
   ★ 채울 근거 — [내용](자막)과 [설명문] 둘 다 활용한다. 자막에 게스트 호명이 없어도 [설명문] 상단의 "[○○○ 교수]" 같은 출연자 블록이 1차 근거.
   ★ name: 사람 이름 그대로. 음성 인식 결과를 임의로 보정하지 마라. [설명문] 표기가 있으면 그 표기 우선.
   ★ role: "○○ 교수", "△△ 회사 CEO" 같은 직함이 [내용]·[설명문]에 직접 등장할 때만. "전문가입니다", "분석합니다" 같은 행동 묘사에서 추론하지 마라. 없으면 "".
   ★ note: [설명문] 출연자 블록의 학력/경력/저서 등 한 줄 소개의 직접 근거가 있을 때 그 사실을 압축. 여러 줄이면 가장 식별성 높은 정보 1~2가지를 자연스러운 한 문장으로. 추측 금지. 없으면 "".
   ★ "전문가", "강연자", "선생님" 같은 일반 호칭만 있고 실제 사람 이름이 어디에도 안 나오면 그 인물은 포함하지 말고 빈 배열로 둬라.
   ★ 채널 진행자·MC·호스트는 제외. 영상이 게시된 채널의 주인이나 정기 진행자는 출연자가 아니라 진행자이므로 people 에 넣지 마라. 예: "권순표의 뉴스하이킥"에서 권순표, "슈카월드"에서 슈카, "김작가 TV"에서 김작가, "신사임당" 채널의 신사임당, "한경 글로벌마켓"의 고정 기자 패널 등은 모두 진행자로 분류. 게스트로 초대된 외부 인물(교수·전문가·CEO 등)만 등재한다. [설명문]에 "출연:" 항목이 명시되어 있으면 그 명단을 1차 근거로 삼되, 그 명단의 인물이 채널 정기 진행자에 해당하면 제외한다.

5. mentioned_people: 영상에 직접 출연하진 않았지만, 출연자가 대화 중에 거론한 인물.
   ★ 대표 케이스:
       * 역사적 인물 (예: 세종대왕, 시몬 볼리바르, 이순신).
       * 학자·연구자 본인이 영상에 나오지 않고 그 업적이나 발견이 거론된 경우 (예: 출연자가 "이호왕 박사가 한타바이러스를 발견했죠" 라고 설명하면, 이호왕 박사는 mentioned_people).
       * 사례·일화 속 인물, 인용된 저자, 영상 본인은 아닌 또 다른 전문가.
   ★ 같은 인물이 영상에 직접 출연도 했다면 → people 에만 등재. mentioned_people 엔 중복으로 넣지 마라.
   ★ name/role/note 규칙은 people 과 동일. 자막 근거 있을 때만, 없으면 "".
   ★ 모르면 빈 배열.

6. companies: 영상에서 언급된 기업·회사·브랜드 및 연구기관·대학·연구소. [내용]과 [설명문] 모두에서 수집. 영상 전 구간을 빠짐없이 살펴라(후반부도 포함).
   ★ 사람 이름은 절대 포함 금지 (그건 people 로).
   ★ 다음은 모두 제외하라:
       - 사람의 외형·머리 스타일·옷차림 묘사 단어. 자막 문맥이 사람을 수식하면 그 단어는 회사가 아니다 (예: "웨이브 머리가 굉장히…"의 "웨이브"는 회사 아님).
       - OTT·시청 경로 안내 플랫폼명. 영상 본문에 회사로 언급된 적 없이 [설명문]의 "다시 보기는 ○○에서" 같은 시청 안내 문구에만 등장하는 플랫폼(티빙, 왓챠, 웨이브, 시즌 등)은 제외.
       - 정부 부처·행정 기관 (국방부, 산업통상자원부 등).
       - 대회·이벤트·프로그램명 (DARPA 챌린지, 로보컵, CES, GTC 등). 다만 그 주최 기관 자체가 본문에서 별도로 의미 있게 다뤄지면 그 기관은 포함.
       - 주가 지수·종목군 약칭 (S&P 500, KOSPI, 코스닥, 나스닥, M7, FANG, 매그니피센트 7 등). 지수는 회사가 아니라 벤치마크/종목 묶음명.
       - 영상 자료 출처·라이선스 표기 (gettyimages, Shutterstock, Unsplash, freepik 등). 보통 [설명문] 하단에 자료 출처로만 등장하고 영상 본문 주제와 무관.
       - 같은 회사의 본체와 하위 서비스명 중복. 같은 회사가 본체("퍼플렉시티")와 서비스("퍼플렉시티 파이낸스") 둘 다 거론되면 본체 하나만 등재한다.
       - 영상이 게시된 채널·방송사 자체. 영상 본문 주제가 그 방송사를 분석·평가하는 게 아니라면 채널명은 메타 정보일 뿐이므로 제외 (예: KBS 다큐멘터리에서 KBS·KBS 1TV, EBS 클립에서 EBS, MBC 채널 영상에서 MBC 자체).
       - [설명문]의 "제작도움", "협찬", "후원", "스폰서", "비즈니스 문의" 같은 비즈니스 메타 섹션에만 등장하는 회사. 영상 본문 주제와 무관한 협찬·후원사일 뿐이다 (예: 한경 영상의 "제작도움: KB자산운용·삼성자산운용", 다른 영상의 "광고 문의: ○○에이전시").
   ★ 다음은 반드시 포함하라:
       - 연구기관·대학·연구소·국립연구원 (예: KAIST, ETRI, MIT 미디어랩, 카네기멜런대학, DARPA 자체). 산업 분석에서 회사 못지않게 중요한 정보다.
   ★ 한국어 사용자에게 자연스러운 한글 표기로 통일하라. 외국 회사명이 영문으로만 등장해도 한국어 외래어 표기로 변환한다 (Nvidia → 엔비디아, Tesla → 테슬라, Anthropic → 앤트로픽, Boston Dynamics → 보스턴 다이나믹스, Microsoft → 마이크로소프트, Snowflake → 스노플레이크, Palantir → 팔란티어). 예외: 한국에서 영문 약어 그대로가 표준 표기로 통용되는 경우(KAIST, ETRI, IBM, AMD, SK, LG, SKT, KBS, EBS, MIT 등 약어성 표기)는 영문 유지.
   ★ 중복 제거. 같은 회사를 한 번만 등재. 한 영상에 같은 회사가 영문과 한글 두 표기로 모두 등장하면 한글 표기 하나만.
   ★ "기판 업체", "대기업" 같은 일반명사는 제외. 고유명사만.
   ★ 모르면 빈 배열.

7. source_type, language: 입력값을 그대로 반환.

환각 금지: 자막/메타데이터에 근거 없는 정보는 절대 만들지 마라. 확신이 없으면 비워라.
brief 의 출력 언어는 입력 language 값에 맞춘다 (ko → 한국어, en → 영어).`

let client: OpenAI | null = null

function getClient(): OpenAI {
  if (client) return client
  const key = process.env.OPENAI_API_KEY
  if (!key) {
    throw new Error(
      'OPENAI_API_KEY 환경변수가 설정되지 않았어요. .env.local 에 키를 추가해 주세요.',
    )
  }
  client = new OpenAI({ apiKey: key })
  return client
}

export async function summarizeTranscript(
  input: SummarizeInput,
): Promise<SummarizeResult> {
  const openai = getClient()

  const descSection = input.description && input.description.trim()
    ? `\n\n[설명문]\n${input.description.trim()}`
    : ''

  const userPrompt = `[제목] ${input.title}
[출처] ${input.sourceType}
[언어] ${input.language}

[내용]
${input.content}${descSection}`

  const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: userPrompt },
  ]

  let inputTokens = 0
  let outputTokens = 0
  let totalTokens = 0
  let summary: Summary | null = null
  let violations: string[] = []
  let attempts = 0
  const MAX_ATTEMPTS = 2

  while (attempts < MAX_ATTEMPTS) {
    attempts++

    // gpt-5 / o-series reasoning 모델은 custom temperature 미지원 (default 1만 가능)
    const completion = await openai.chat.completions.create({
      model: SUMMARIZE_MODEL,
      messages,
      response_format: { type: 'json_schema', json_schema: SUMMARY_JSON_SCHEMA },
      ...(/^(gpt-5|o\d)/.test(SUMMARIZE_MODEL) ? {} : { temperature: 0.2 }),
    })

    inputTokens += completion.usage?.prompt_tokens ?? 0
    outputTokens += completion.usage?.completion_tokens ?? 0
    totalTokens += completion.usage?.total_tokens ?? 0

    const choice = completion.choices[0]
    const content = choice?.message?.content
    if (!content) {
      throw new Error(
        `OpenAI 응답이 비어있어요. finish_reason=${choice?.finish_reason ?? 'unknown'}`,
      )
    }

    try {
      summary = JSON.parse(content) as Summary
    } catch (err) {
      throw new Error(
        `OpenAI 응답 JSON 파싱 실패: ${err instanceof Error ? err.message : String(err)}. content=${content.slice(0, 200)}`,
      )
    }

    violations = validateSummary(summary, input.content.length, input.sourceType)
    if (violations.length === 0) break
    if (attempts >= MAX_ATTEMPTS) break

    messages.push({ role: 'assistant', content })
    messages.push({
      role: 'user',
      content: `이전 응답이 다음 규칙을 위반했어. 같은 JSON 스키마로 다시 작성하라. 자료에는 분량을 채울 사실·맥락·예시가 충분하다.\n\n${violations.map((v) => `- ${v}`).join('\n')}`,
    })
  }

  if (!summary) {
    throw new Error('요약 생성 실패: summary가 비어있음.')
  }

  return {
    summary,
    usage: { inputTokens, outputTokens, totalTokens },
    attempts,
    violations,
  }
}
