import { createServerSupabaseClient } from '@/lib/supabase/server'
import { summarizeTranscript } from '@/lib/llm/openai'

export interface SummarizeVideoInput {
  video_id: string
  title: string | null
  source_type: 'transcript' | 'metadata'
  content: string
  language: string | null
  segments: Array<{ start: number; dur: number; text: string }> | null
}

export interface SummarizeVideoResult {
  videoId: string
  ok: boolean
  detail?: string
  error?: string
  tokens?: { input: number; output: number; total: number }
}

interface TimedSegment {
  start: number
  text: string
}

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

function formatTimestamp(seconds: number): string {
  return `${pad2(Math.floor(seconds / 60))}:${pad2(seconds % 60)}`
}

export function buildAnchoredContent(segments: TimedSegment[]): string {
  if (segments.length === 0) return ''
  const out: string[] = []
  let lastAnchor = -100
  for (const seg of segments) {
    if (seg.start - lastAnchor >= 15) {
      out.push(`[${formatTimestamp(seg.start)}] ${seg.text}`)
      lastAnchor = seg.start
    } else {
      out.push(seg.text)
    }
  }
  return out.join(' ')
}

export async function summarizeAndStoreVideo(
  input: SummarizeVideoInput,
): Promise<SummarizeVideoResult> {
  const supabase = createServerSupabaseClient()

  try {
    const useTranscriptMode =
      input.source_type === 'transcript' &&
      Array.isArray(input.segments) &&
      input.segments.length > 0

    const content = useTranscriptMode
      ? buildAnchoredContent(
          (input.segments ?? []).map((s) => ({ start: s.start, text: s.text })),
        )
      : input.content

    if (!content.trim()) {
      throw new Error('요약할 텍스트가 비어있어요.')
    }

    const result = await summarizeTranscript({
      title: input.title ?? '(제목 없음)',
      content,
      language: input.language ?? 'ko',
      sourceType: input.source_type,
    })

    const { error: updateErr } = await supabase
      .from('videos')
      .update({ summary: result.summary })
      .eq('video_id', input.video_id)

    if (updateErr) throw updateErr

    return {
      videoId: input.video_id,
      ok: true,
      detail: `headline=${result.summary.headline.length}c, brief=${result.summary.brief.length}c, ${result.summary.topics.length} topics, ${result.summary.people.length} people`,
      tokens: {
        input: result.usage.inputTokens,
        output: result.usage.outputTokens,
        total: result.usage.totalTokens,
      },
    }
  } catch (err) {
    return {
      videoId: input.video_id,
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}
