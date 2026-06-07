import { XMLParser } from 'fast-xml-parser'

export interface RssVideo {
  videoId: string
  title: string
  description: string
  url: string
  publishedAt: string
}

export interface RssResult {
  channelId: string
  channelTitle: string
  videos: RssVideo[]
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  trimValues: true,
})

interface RssEntry {
  'yt:videoId'?: string
  'yt:channelId'?: string
  title?: string
  published?: string
  'media:group'?: {
    'media:description'?: string
  }
}

interface RssFeed {
  feed?: {
    title?: string
    'yt:channelId'?: string
    entry?: RssEntry | RssEntry[]
  }
}

export async function fetchChannelRss(channelId: string): Promise<RssResult> {
  const url = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'TubeBrief/0.1 (+RSS)',
      'Accept-Language': 'ko,en;q=0.9',
    },
  })
  if (!res.ok) {
    throw new Error(
      `RSS 피드를 불러오지 못했어요 (HTTP ${res.status}, channel_id=${channelId})`,
    )
  }

  const xml = await res.text()
  const doc = parser.parse(xml) as RssFeed
  const feed = doc.feed
  if (!feed) {
    throw new Error(
      `RSS XML 형식이 예상과 달라요 (channel_id=${channelId}). 채널이 비공개거나 삭제됐을 수 있어요.`,
    )
  }

  const rawEntries = feed.entry
  const entries: RssEntry[] = Array.isArray(rawEntries)
    ? rawEntries
    : rawEntries
      ? [rawEntries]
      : []

  const videos: RssVideo[] = entries
    .filter((e): e is RssEntry & { 'yt:videoId': string } =>
      Boolean(e['yt:videoId']),
    )
    .map((e) => ({
      videoId: e['yt:videoId'],
      title: String(e.title ?? '').trim(),
      description: String(
        e['media:group']?.['media:description'] ?? '',
      ).trim(),
      url: `https://www.youtube.com/watch?v=${e['yt:videoId']}`,
      publishedAt: e.published ?? new Date().toISOString(),
    }))

  return {
    channelId: feed['yt:channelId'] ?? channelId,
    channelTitle: String(feed.title ?? '').trim(),
    videos,
  }
}
