import { XMLParser } from 'fast-xml-parser'

export interface VideoMetadata {
  videoId: string
  title: string
  description: string
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  trimValues: true,
})

interface RssEntry {
  'yt:videoId'?: string
  title?: string
  'media:group'?: {
    'media:description'?: string
  }
}

interface RssDoc {
  feed?: {
    entry?: RssEntry | RssEntry[]
  }
}

export async function fetchVideoMetadata(
  channelId: string,
  videoId: string,
): Promise<VideoMetadata> {
  const res = await fetch(
    `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`,
    {
      headers: {
        'User-Agent': 'TubeBrief/0.1 (+fallback-metadata)',
        'Accept-Language': 'ko,en;q=0.9',
      },
    },
  )
  if (!res.ok) {
    throw new Error(
      `메타데이터 폴백용 RSS 가져오기 실패 (HTTP ${res.status}, channel_id=${channelId})`,
    )
  }

  const xml = await res.text()
  const doc = parser.parse(xml) as RssDoc
  const rawEntries = doc.feed?.entry
  const entries: RssEntry[] = Array.isArray(rawEntries)
    ? rawEntries
    : rawEntries
      ? [rawEntries]
      : []

  const entry = entries.find((e) => e['yt:videoId'] === videoId)
  if (!entry) {
    throw new Error(
      `RSS 피드에 ${videoId} 가 보이지 않아요. RSS 는 채널의 최근 15개 영상만 노출하므로, 그보다 오래된 영상은 폴백 메타데이터를 얻을 수 없어요.`,
    )
  }

  const title = String(entry.title ?? '').trim()
  const description = String(
    entry['media:group']?.['media:description'] ?? '',
  ).trim()

  return { videoId, title, description }
}
