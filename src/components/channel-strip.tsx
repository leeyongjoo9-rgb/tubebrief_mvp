'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

export interface ChannelStat {
  channel_id: string
  title: string | null
  count: number
  latestAt: string | null
}

interface Props {
  channels: ChannelStat[]
  totalCount: number
  activeChannel?: string
}

export function ChannelStrip({ channels, totalCount, activeChannel }: Props) {
  const [newIds, setNewIds] = useState<Set<string>>(new Set())
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    const news = new Set<string>()
    for (const ch of channels) {
      if (!ch.latestAt) continue
      const lastSeen = localStorage.getItem(`tubebrief.lastSeen.${ch.channel_id}`)
      if (!lastSeen || ch.latestAt > lastSeen) news.add(ch.channel_id)
    }
    setNewIds(news)
    setHydrated(true)
  }, [channels])

  const markSeen = (channelId: string, latestAt: string | null) => {
    if (latestAt) localStorage.setItem(`tubebrief.lastSeen.${channelId}`, latestAt)
    setNewIds((prev) => {
      const next = new Set(prev)
      next.delete(channelId)
      return next
    })
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Link
        href="/"
        className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors ${
          !activeChannel
            ? 'border-foreground bg-foreground text-background'
            : 'border-border hover:bg-muted'
        }`}
      >
        <span>전체</span>
        <span className="text-xs opacity-70">{totalCount}</span>
      </Link>
      {channels.map((ch) => {
        const isActive = activeChannel === ch.channel_id
        const isNew = hydrated && newIds.has(ch.channel_id)
        return (
          <Link
            key={ch.channel_id}
            href={`/?channel=${ch.channel_id}`}
            onClick={() => markSeen(ch.channel_id, ch.latestAt)}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors ${
              isActive
                ? 'border-foreground bg-foreground text-background'
                : 'border-border hover:bg-muted'
            }`}
          >
            <span className="max-w-[180px] truncate">{ch.title ?? '(이름 없음)'}</span>
            <span className="text-xs opacity-70">{ch.count}</span>
            {isNew && (
              <span className="ml-0.5 rounded-full bg-blue-500 px-1.5 py-0.5 text-[10px] font-medium text-white">
                NEW
              </span>
            )}
          </Link>
        )
      })}
    </div>
  )
}
