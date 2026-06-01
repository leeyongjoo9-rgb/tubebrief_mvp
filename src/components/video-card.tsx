import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { SourceBadge } from '@/components/source-badge'
import { TopicChips } from '@/components/topic-chips'
import type { Summary } from '@/lib/llm/openai'

export interface VideoCardData {
  video_id: string
  title: string | null
  url: string | null
  published_at: string | null
  channelTitle: string | null
  summary: Summary
}

function formatShortDate(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  const yy = String(d.getFullYear()).slice(2)
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yy}.${mm}.${dd}`
}

export function VideoCard({ video }: { video: VideoCardData }) {
  const { summary } = video
  const dateStr = formatShortDate(video.published_at)

  return (
    <Link
      href={`/videos/${video.video_id}`}
      className="group block focus:outline-none focus:ring-2 focus:ring-ring rounded-xl"
    >
      <Card className="h-full transition-shadow group-hover:shadow-md">
        <CardHeader className="space-y-2 pb-3">
          <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
            <span className="truncate">
              {video.channelTitle ?? '(채널 미상)'}
              {dateStr && <span className="ml-2 font-mono">{dateStr}</span>}
            </span>
            <SourceBadge sourceType={summary.source_type} />
          </div>
          <CardTitle className="text-base leading-snug line-clamp-2">
            {video.title ?? '(제목 없음)'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 pt-0">
          <p className="text-sm text-muted-foreground line-clamp-3 leading-relaxed">
            {summary.headline}
          </p>
          <TopicChips topics={summary.topics} max={5} />
        </CardContent>
      </Card>
    </Link>
  )
}
