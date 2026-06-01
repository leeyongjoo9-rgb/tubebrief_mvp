import { createServerSupabaseClient } from '@/lib/supabase/server'
import { fetchTranscript } from '@/lib/youtube/transcript'
import { fetchVideoMetadata } from '@/lib/youtube/metadata'

export type VideoFinalStatus =
  | 'transcript_ok'
  | 'metadata_fallback'
  | 'failed'

export interface ProcessInput {
  video_id: string
  channel_id: string
  title: string | null
}

export interface ProcessResult {
  videoId: string
  status: VideoFinalStatus
  detail?: string
  transcriptError?: string
  metadataError?: string
}

export async function processVideo(
  video: ProcessInput,
): Promise<ProcessResult> {
  const supabase = createServerSupabaseClient()

  let transcriptError: string | undefined

  try {
    const result = await fetchTranscript(video.video_id)

    const { error: insertErr } = await supabase
      .from('transcripts')
      .upsert(
        {
          video_id: video.video_id,
          source: 'youtube-auto',
          language: result.language,
          content: result.content,
          segments: result.segments,
        },
        { onConflict: 'video_id' },
      )
    if (insertErr) throw insertErr

    const { error: updateErr } = await supabase
      .from('videos')
      .update({ status: 'transcript_ok' })
      .eq('video_id', video.video_id)
    if (updateErr) throw updateErr

    return {
      videoId: video.video_id,
      status: 'transcript_ok',
      detail: `${result.segments.length} segments, ${result.content.length} chars, lang=${result.language}`,
    }
  } catch (err) {
    transcriptError = err instanceof Error ? err.message : String(err)
  }

  try {
    const meta = await fetchVideoMetadata(video.channel_id, video.video_id)
    const content = [meta.title, meta.description].filter(Boolean).join('\n\n')
    if (!content) {
      throw new Error('RSS 에 title 도 description 도 비어있어요.')
    }

    const { error: insertErr } = await supabase
      .from('transcripts')
      .upsert(
        {
          video_id: video.video_id,
          source: 'metadata-fallback',
          language: null,
          content,
          segments: null,
        },
        { onConflict: 'video_id' },
      )
    if (insertErr) throw insertErr

    const { error: updateErr } = await supabase
      .from('videos')
      .update({ status: 'metadata_fallback' })
      .eq('video_id', video.video_id)
    if (updateErr) throw updateErr

    return {
      videoId: video.video_id,
      status: 'metadata_fallback',
      detail: `title+description, ${content.length} chars`,
      transcriptError,
    }
  } catch (err) {
    const metadataError = err instanceof Error ? err.message : String(err)

    await supabase
      .from('videos')
      .update({ status: 'failed' })
      .eq('video_id', video.video_id)

    return {
      videoId: video.video_id,
      status: 'failed',
      transcriptError,
      metadataError,
    }
  }
}
