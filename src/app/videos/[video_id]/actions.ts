'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export interface SoftDeleteResult {
  ok: boolean
  error?: string
}

/**
 * 영상 소프트 삭제 — `videos.deleted_at = now()`.
 *
 * - 행을 실제로 지우지 않아 RSS 가 같은 영상을 다시 발견해도 `video_id` UNIQUE 로
 *   재인입이 막힘 (의도된 동작: "삭제 후 다시 안 나타나야 함").
 * - 홈/상세 페이지는 `deleted_at IS NULL` 로 필터해 사용자에게 노출 안 함.
 * - 자막·요약 데이터는 보존되므로 추후 SQL 로 `deleted_at = null` 갱신하면 복구 가능.
 */
export async function softDeleteVideo(videoId: string): Promise<SoftDeleteResult> {
  if (!videoId) return { ok: false, error: 'videoId 가 비어있어요.' }

  const supabase = createServerSupabaseClient()
  const { error } = await supabase
    .from('videos')
    .update({ deleted_at: new Date().toISOString() })
    .eq('video_id', videoId)
    .is('deleted_at', null)

  if (error) return { ok: false, error: error.message }

  revalidatePath('/')
  revalidatePath('/channels')
  revalidatePath(`/videos/${videoId}`)

  // 삭제 후 홈으로 돌아감 (redirect 는 throw 처럼 동작하므로 마지막에)
  redirect('/')
}
