const UC_RE = /^UC[A-Za-z0-9_-]{22}$/
const OG_TITLE_RE = /<meta\s+property="og:title"\s+content="([^"]+)"/

// 다양한 유튜브 페이지(채널 페이지 / 동영상 페이지 / 쇼츠 등) HTML 에서 channel_id 를
// 추출하기 위한 패턴들. 위에서부터 차례로 매치 시도하고 첫 번째 적중을 채택한다.
//
// - 1, 2 번은 채널 홈/소개 페이지가 안정적으로 노출하는 형태.
// - 3~5 번은 동영상(`/watch?v=...`) 페이지 본문에 박혀있는 Schema.org/JSON 데이터.
const CHANNEL_ID_PATTERNS: RegExp[] = [
  /<link\s+rel="canonical"\s+href="https:\/\/www\.youtube\.com\/channel\/(UC[A-Za-z0-9_-]{22})"/,
  /<meta\s+property="og:url"\s+content="https:\/\/www\.youtube\.com\/channel\/(UC[A-Za-z0-9_-]{22})"/,
  /<meta\s+itemprop="(?:channelId|identifier)"\s+content="(UC[A-Za-z0-9_-]{22})"/,
  /<link\s+itemprop="url"\s+href="https?:\/\/www\.youtube\.com\/channel\/(UC[A-Za-z0-9_-]{22})"/,
  /"channelId"\s*:\s*"(UC[A-Za-z0-9_-]{22})"/,
  /"externalChannelId"\s*:\s*"(UC[A-Za-z0-9_-]{22})"/,
]

export interface ResolvedChannel {
  channelId: string
  title?: string
  url: string
}

export function isChannelId(input: string): boolean {
  return UC_RE.test(input.trim())
}

export async function resolveChannelId(
  input: string,
): Promise<ResolvedChannel> {
  const raw = input.trim()
  if (!raw) {
    throw new Error('채널 URL 또는 ID 가 비어있어요.')
  }

  if (isChannelId(raw)) {
    return {
      channelId: raw,
      url: `https://www.youtube.com/channel/${raw}`,
    }
  }

  let url: URL
  try {
    url = new URL(raw)
  } catch {
    if (raw.startsWith('@')) {
      url = new URL(`https://www.youtube.com/${raw}`)
    } else {
      throw new Error(
        `인식할 수 없는 입력이에요: "${raw}". 유튜브 URL (예: https://www.youtube.com/@channelname) 또는 UC... 형식의 channel_id 를 보내주세요.`,
      )
    }
  }

  const inPath = url.pathname.match(/\/channel\/(UC[A-Za-z0-9_-]{22})/)
  if (inPath) {
    return {
      channelId: inPath[1],
      url: `https://www.youtube.com/channel/${inPath[1]}`,
    }
  }

  const res = await fetch(url.toString(), {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
      'Accept-Language': 'ko,en;q=0.9',
    },
    redirect: 'follow',
  })
  if (!res.ok) {
    throw new Error(
      `유튜브 채널 페이지를 불러오지 못했어요 (HTTP ${res.status}): ${url}`,
    )
  }
  const html = await res.text()

  let channelId: string | undefined
  for (const pattern of CHANNEL_ID_PATTERNS) {
    const m = html.match(pattern)
    if (m) {
      channelId = m[1]
      break
    }
  }
  if (!channelId) {
    throw new Error(
      `이 URL 에서 channel_id 를 찾지 못했어요. 영상/채널이 존재하는지, URL 이 정확한지 확인해 주세요: ${url}`,
    )
  }

  // 동영상 페이지(/watch, /shorts) 의 og:title 은 영상 제목이라 채널명으로 쓸 수 없다.
  // 채널 홈/소개 페이지의 og:title 만 채널 이름. 동영상 페이지면 비워두고 RSS 가 채우게 둔다.
  const isVideoPage =
    url.pathname.startsWith('/watch') || url.pathname.startsWith('/shorts')
  const ogTitle = isVideoPage ? undefined : html.match(OG_TITLE_RE)?.[1]

  return {
    channelId,
    title: ogTitle,
    url: `https://www.youtube.com/channel/${channelId}`,
  }
}
