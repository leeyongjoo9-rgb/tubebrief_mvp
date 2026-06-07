import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { ReactNode } from 'react'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { SourceBadge } from '@/components/source-badge'
import { TopicChips } from '@/components/topic-chips'
import type { Summary } from '@/lib/llm/openai'

interface PageProps {
  params: Promise<{ video_id: string }>
}

interface VideoRow {
  video_id: string
  title: string | null
  url: string | null
  published_at: string | null
  channel_id: string
  status: string
  summary: Summary | null
  channels: { title: string | null } | { title: string | null }[] | null
}

export const dynamic = 'force-dynamic'

function formatLongDate(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`
}

// "(mm:ss)" 또는 "(h:mm:ss)" 마커를 찾아 YouTube 점프 링크로 변환.
// 입력: 한 문단 텍스트 + videoId. 출력: 텍스트와 <a> 가 섞인 ReactNode 배열.
const TIMESTAMP_RE = /\((\d{1,2}):(\d{2})(?::(\d{2}))?\)/g

function renderParagraphWithTimestamps(
  text: string,
  videoId: string,
): ReactNode[] {
  const nodes: ReactNode[] = []
  let lastIndex = 0
  let key = 0
  let match: RegExpExecArray | null

  TIMESTAMP_RE.lastIndex = 0
  while ((match = TIMESTAMP_RE.exec(text)) !== null) {
    const [full, a, b, c] = match

    let totalSeconds: number
    let label: string
    if (c) {
      totalSeconds = parseInt(a, 10) * 3600 + parseInt(b, 10) * 60 + parseInt(c, 10)
      label = `${a}:${b.padStart(2, '0')}:${c}`
    } else {
      totalSeconds = parseInt(a, 10) * 60 + parseInt(b, 10)
      label = `${a.padStart(2, '0')}:${b}`
    }

    if (match.index > lastIndex) {
      nodes.push(
        <span key={`t-${key++}`}>{text.slice(lastIndex, match.index)}</span>,
      )
    }
    nodes.push(
      <a
        key={`l-${key++}`}
        href={`https://www.youtube.com/watch?v=${videoId}&t=${totalSeconds}s`}
        target="_blank"
        rel="noopener noreferrer"
        className="font-mono text-blue-600 hover:underline dark:text-blue-400"
        title="유튜브에서 이 시각으로 이동"
      >
        ({label})
      </a>,
    )
    lastIndex = match.index + full.length
  }

  if (lastIndex < text.length) {
    nodes.push(<span key={`t-${key++}`}>{text.slice(lastIndex)}</span>)
  }

  return nodes
}

export default async function VideoDetailPage({ params }: PageProps) {
  const { video_id } = await params
  const supabase = createServerSupabaseClient()

  const { data, error } = await supabase
    .from('videos')
    .select(
      `
        video_id, title, url, published_at, channel_id, status, summary,
        channels ( title )
      `,
    )
    .eq('video_id', video_id)
    .single<VideoRow>()

  if (error || !data || !data.summary) notFound()

  const v = data
  const summary = v.summary!
  const channelTitle = Array.isArray(v.channels)
    ? (v.channels[0]?.title ?? null)
    : (v.channels?.title ?? null)
  const dateStr = formatLongDate(v.published_at)
  const youtubeUrl = v.url ?? `https://www.youtube.com/watch?v=${v.video_id}`

  const paragraphs = summary.brief
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean)

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <nav className="mb-6 flex items-center justify-between text-sm">
        <Link href="/" className="text-muted-foreground hover:text-foreground">
          ← 홈으로
        </Link>
        <a
          href={youtubeUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-muted-foreground hover:text-foreground"
        >
          유튜브에서 보기 ↗
        </a>
      </nav>

      <header className="mb-8 space-y-3">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{channelTitle ?? '(채널 미상)'}</span>
          {dateStr && <span>·</span>}
          {dateStr && <span className="font-mono">{dateStr}</span>}
        </div>
        <h1 className="text-2xl font-semibold leading-tight sm:text-3xl">
          {v.title ?? '(제목 없음)'}
        </h1>
        <div className="flex flex-wrap items-center gap-2">
          <SourceBadge sourceType={summary.source_type} />
          {summary.language && (
            <span className="text-xs text-muted-foreground">
              요약 언어: {summary.language}
            </span>
          )}
        </div>
      </header>

      <section className="mb-8 border-l-2 border-foreground/20 pl-4">
        <p className="text-base font-medium leading-relaxed">
          {summary.headline}
        </p>
      </section>

      {(() => {
        const keywords = [
          ...(summary.topics ?? []),
          ...(summary.companies ?? []),
        ]
        if (keywords.length === 0) return null
        return (
          <section className="mb-8">
            <h2 className="mb-2 text-sm font-medium text-muted-foreground">
              키워드
            </h2>
            <TopicChips topics={keywords} />
          </section>
        )
      })()}

      {summary.people.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-2 text-sm font-medium text-muted-foreground">
            출연자
          </h2>
          <ul className="space-y-2">
            {summary.people.map((p, i) => (
              <li key={`${p.name}-${i}`} className="text-sm">
                <span className="font-medium">{p.name}</span>
                {p.role && (
                  <span className="ml-2 text-muted-foreground">— {p.role}</span>
                )}
                {p.note && (
                  <div className="ml-1 mt-0.5 text-xs text-muted-foreground">
                    {p.note}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {summary.mentioned_people && summary.mentioned_people.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-2 text-sm font-medium text-muted-foreground">
            언급된 인물
          </h2>
          <ul className="space-y-2">
            {summary.mentioned_people.map((p, i) => (
              <li key={`mp-${p.name}-${i}`} className="text-sm">
                <span className="font-medium">{p.name}</span>
                {p.role && (
                  <span className="ml-2 text-muted-foreground">— {p.role}</span>
                )}
                {p.note && (
                  <div className="ml-1 mt-0.5 text-xs text-muted-foreground">
                    {p.note}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}


      <section className="mb-12">
        <h2 className="mb-3 text-sm font-medium text-muted-foreground">
          요약 (Brief)
        </h2>
        {paragraphs.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            요약 본문이 비어있어요.
          </p>
        ) : (
          <div className="space-y-4 text-[15px] leading-[1.75]">
            {paragraphs.map((para, i) => (
              <p key={i}>
                {renderParagraphWithTimestamps(para, v.video_id)}
              </p>
            ))}
          </div>
        )}
        {summary.source_type === 'metadata' && (
          <p className="mt-4 text-xs text-muted-foreground">
            ※ 이 영상은 자막을 가져올 수 없어 제목·설명문 기반으로만 요약됐어요.
            타임스탬프 시각 표시는 표시되지 않습니다.
          </p>
        )}
      </section>
    </main>
  )
}
