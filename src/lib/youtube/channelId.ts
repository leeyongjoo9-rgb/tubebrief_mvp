const UC_RE = /^UC[A-Za-z0-9_-]{22}$/
const CANONICAL_RE =
  /<link\s+rel="canonical"\s+href="https:\/\/www\.youtube\.com\/channel\/(UC[A-Za-z0-9_-]{22})"/
const OG_TITLE_RE = /<meta\s+property="og:title"\s+content="([^"]+)"/

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

  const canonical = html.match(CANONICAL_RE)
  if (!canonical) {
    throw new Error(
      `채널 페이지에서 channel_id 를 찾지 못했어요. 채널이 존재하는지, URL 이 정확한지 확인해 주세요: ${url}`,
    )
  }

  const ogTitle = html.match(OG_TITLE_RE)?.[1]

  return {
    channelId: canonical[1],
    title: ogTitle,
    url: `https://www.youtube.com/channel/${canonical[1]}`,
  }
}
