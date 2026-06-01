import { YoutubeTranscript } from 'youtube-transcript'

export interface TranscriptSegment {
  start: number
  dur: number
  text: string
}

export interface TranscriptResult {
  content: string
  segments: TranscriptSegment[]
  language: string
}

export class TranscriptUnavailableError extends Error {
  constructor(
    message: string,
    public videoId: string,
  ) {
    super(message)
    this.name = 'TranscriptUnavailableError'
  }
}

interface RawSegment {
  text?: string
  duration?: number
  offset?: number
  lang?: string
}

const ATTEMPTS: Array<{ label: string; options: { lang?: string } }> = [
  { label: 'default', options: {} },
  { label: 'ko', options: { lang: 'ko' } },
  { label: 'en', options: { lang: 'en' } },
]

export async function fetchTranscript(
  videoId: string,
): Promise<TranscriptResult> {
  let lastError: unknown

  for (const attempt of ATTEMPTS) {
    try {
      const raw = (await YoutubeTranscript.fetchTranscript(
        videoId,
        attempt.options,
      )) as RawSegment[]

      const segments: TranscriptSegment[] = (raw ?? [])
        .map((s) => ({
          start: Math.round((s.offset ?? 0) / 1000),
          dur: Math.round((s.duration ?? 0) / 1000),
          text: String(s.text ?? '').trim(),
        }))
        .filter((s) => s.text)

      if (segments.length === 0) continue

      const content = segments
        .map((s) => s.text)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim()

      const language = raw.find((s) => s.lang)?.lang ?? attempt.options.lang ?? 'unknown'

      return { content, segments, language }
    } catch (err) {
      lastError = err
    }
  }

  const msg = lastError instanceof Error ? lastError.message : String(lastError)
  throw new TranscriptUnavailableError(
    `자막을 가져오지 못했어요 (videoId=${videoId}): ${msg}`,
    videoId,
  )
}
