'use server'

import { revalidatePath } from 'next/cache'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { resolveChannelId } from '@/lib/youtube/channelId'
import { fetchChannelRss } from '@/lib/youtube/rss'

export interface AddChannelInput {
  url: string
  label?: string
  includeKeywords?: string[]
  excludeKeywords?: string[]
}

export interface AddChannelResult {
  ok: boolean
  error?: string
  channelTitle?: string
  subscriptionLabel?: string
}

export async function addChannel(
  input: AddChannelInput,
): Promise<AddChannelResult> {
  if (!input.url?.trim()) {
    return { ok: false, error: 'URL이 비어있어요.' }
  }

  try {
    const resolved = await resolveChannelId(input.url.trim())

    let channelTitle = resolved.title
    try {
      const rss = await fetchChannelRss(resolved.channelId)
      if (rss.channelTitle) channelTitle = rss.channelTitle
    } catch {
      // RSS 실패해도 등록은 진행
    }

    const supabase = createServerSupabaseClient()

    const { error: chErr } = await supabase.from('channels').upsert(
      {
        channel_id: resolved.channelId,
        title: channelTitle ?? null,
        url: resolved.url,
      },
      { onConflict: 'channel_id' },
    )
    if (chErr) return { ok: false, error: chErr.message }

    const include = (input.includeKeywords ?? []).filter(Boolean)
    const exclude = (input.excludeKeywords ?? []).filter(Boolean)
    const autoLabel =
      input.label?.trim() ||
      (include.length > 0
        ? `${channelTitle ?? resolved.channelId} - ${include.join('+')}`
        : (channelTitle ?? resolved.channelId))

    const { error: subErr } = await supabase.from('subscriptions').insert({
      channel_id: resolved.channelId,
      label: autoLabel,
      include_keywords: include,
      exclude_keywords: exclude,
    })
    if (subErr) return { ok: false, error: subErr.message }

    revalidatePath('/channels')
    revalidatePath('/')

    return {
      ok: true,
      channelTitle: channelTitle ?? undefined,
      subscriptionLabel: autoLabel,
    }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

export async function deleteSubscription(
  id: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!id) return { ok: false, error: 'id가 비어있어요.' }

  const supabase = createServerSupabaseClient()
  const { error } = await supabase.from('subscriptions').delete().eq('id', id)

  if (error) return { ok: false, error: error.message }

  revalidatePath('/channels')
  revalidatePath('/')
  return { ok: true }
}
