'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import type { ChangeEvent } from 'react'

interface Channel {
  channel_id: string
  title: string | null
}

interface Props {
  channels: Channel[]
}

export function ChannelFilter({ channels }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const current = searchParams.get('channel') ?? ''

  if (channels.length < 2) return null

  const handleChange = (e: ChangeEvent<HTMLSelectElement>) => {
    const next = e.target.value
    const params = new URLSearchParams(searchParams.toString())
    if (next) params.set('channel', next)
    else params.delete('channel')
    const qs = params.toString()
    router.push(qs ? `${pathname}?${qs}` : pathname)
  }

  return (
    <select
      value={current}
      onChange={handleChange}
      className="rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
      aria-label="채널 필터"
    >
      <option value="">모든 채널</option>
      {channels.map((c) => (
        <option key={c.channel_id} value={c.channel_id}>
          {c.title ?? c.channel_id}
        </option>
      ))}
    </select>
  )
}
