import Link from 'next/link'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { AddChannelForm } from '@/components/channels/add-channel-form'
import { SubscriptionRow } from '@/components/channels/subscription-row'

export const dynamic = 'force-dynamic'

interface SubscriptionRow {
  id: string
  channel_id: string
  label: string | null
  include_keywords: string[]
  exclude_keywords: string[]
  created_at: string
  last_checked: string | null
  channels:
    | { title: string | null; url: string | null }
    | { title: string | null; url: string | null }[]
    | null
}

interface VideoCountRow {
  channel_id: string
}

export default async function ChannelsPage() {
  const supabase = createServerSupabaseClient()

  const [subsRes, videosRes] = await Promise.all([
    supabase
      .from('subscriptions')
      .select(
        `
          id, channel_id, label, include_keywords, exclude_keywords,
          created_at, last_checked,
          channels ( title, url )
        `,
      )
      .order('created_at', { ascending: false }),
    supabase
      .from('videos')
      .select('channel_id')
      .not('summary', 'is', null)
      .is('deleted_at', null),
  ])

  const subs = (subsRes.data ?? []) as SubscriptionRow[]
  const videos = (videosRes.data ?? []) as VideoCountRow[]

  const countByChannel = new Map<string, number>()
  for (const v of videos) {
    countByChannel.set(
      v.channel_id,
      (countByChannel.get(v.channel_id) ?? 0) + 1,
    )
  }

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <nav className="mb-6 text-sm">
        <Link href="/" className="text-muted-foreground hover:text-foreground">
          ← 홈으로
        </Link>
      </nav>

      <header className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          채널 관리
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          구독을 추가하거나 삭제합니다. 삭제해도 그동안 모은 영상·요약은
          보관됩니다.
        </p>
      </header>

      <section className="mb-10">
        <h2 className="mb-3 text-sm font-medium text-muted-foreground">
          새 구독 추가
        </h2>
        <AddChannelForm />
      </section>

      <section>
        <h2 className="mb-3 text-sm font-medium text-muted-foreground">
          현재 구독 ({subs.length}개)
        </h2>
        {subs.length === 0 ? (
          <div className="rounded-lg border border-dashed py-12 text-center text-sm text-muted-foreground">
            등록된 구독이 없어요. 위 폼에서 채널 URL을 추가하세요.
          </div>
        ) : (
          <ul className="space-y-3">
            {subs.map((s) => {
              const ch = Array.isArray(s.channels) ? s.channels[0] : s.channels
              return (
                <SubscriptionRow
                  key={s.id}
                  id={s.id}
                  label={s.label}
                  channelTitle={ch?.title ?? null}
                  channelUrl={ch?.url ?? null}
                  includeKeywords={s.include_keywords ?? []}
                  excludeKeywords={s.exclude_keywords ?? []}
                  videoCount={countByChannel.get(s.channel_id) ?? 0}
                  lastChecked={s.last_checked}
                />
              )
            })}
          </ul>
        )}
      </section>
    </main>
  )
}
