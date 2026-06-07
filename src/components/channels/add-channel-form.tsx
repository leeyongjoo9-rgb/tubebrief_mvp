'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { addChannel } from '@/app/channels/actions'

function parseCSV(s: string): string[] {
  return s
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean)
}

export function AddChannelForm() {
  const [url, setUrl] = useState('')
  const [label, setLabel] = useState('')
  const [include, setInclude] = useState('')
  const [exclude, setExclude] = useState('')
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState<{
    type: 'ok' | 'err'
    msg: string
  } | null>(null)

  const handleSubmit = async () => {
    if (!url.trim()) {
      setFeedback({ type: 'err', msg: 'URL이 비어있어요.' })
      return
    }
    setBusy(true)
    setFeedback(null)

    try {
      const result = await addChannel({
        url: url.trim(),
        label: label.trim() || undefined,
        includeKeywords: parseCSV(include),
        excludeKeywords: parseCSV(exclude),
      })
      if (result.ok) {
        setFeedback({
          type: 'ok',
          msg: `등록 완료: ${result.subscriptionLabel ?? result.channelTitle ?? '구독 추가됨'}`,
        })
        setUrl('')
        setLabel('')
        setInclude('')
        setExclude('')
      } else {
        setFeedback({ type: 'err', msg: result.error ?? '알 수 없는 오류' })
      }
    } catch (err) {
      setFeedback({
        type: 'err',
        msg: err instanceof Error ? err.message : String(err),
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4 rounded-lg border bg-card p-4">
      <div className="space-y-1.5">
        <label className="text-sm font-medium" htmlFor="ch-url">
          채널 URL <span className="text-destructive">*</span>
        </label>
        <Input
          id="ch-url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://www.youtube.com/@channelname"
          autoComplete="off"
        />
        <p className="text-xs text-muted-foreground">
          @핸들, /channel/UC..., /c/customname 모두 OK
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label className="text-sm font-medium" htmlFor="ch-label">
            구독 라벨 (선택)
          </label>
          <Input
            id="ch-label"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="비우면 채널명으로 자동"
            autoComplete="off"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium" htmlFor="ch-include">
            제목 필터: include
          </label>
          <Input
            id="ch-include"
            value={include}
            onChange={(e) => setInclude(e.target.value)}
            placeholder="쉼표 구분 (예: [뉴스하이킥], 곽상준)"
            autoComplete="off"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium" htmlFor="ch-exclude">
          제목 필터: exclude
        </label>
        <Input
          id="ch-exclude"
          value={exclude}
          onChange={(e) => setExclude(e.target.value)}
          placeholder="쉼표 구분"
          autoComplete="off"
        />
        <p className="text-xs text-muted-foreground">
          include 단어를 <strong>모두</strong> 포함하고 exclude 단어를{' '}
          <strong>전혀</strong> 포함하지 않는 영상만 수집합니다.
        </p>
      </div>

      <div className="flex items-center justify-between gap-3 pt-1">
        {feedback ? (
          <p
            className={`text-sm ${
              feedback.type === 'ok'
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-destructive'
            }`}
          >
            {feedback.msg}
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">
            추가 후 다음 cron 또는 수동 호출 시 RSS 가져옴
          </p>
        )}
        <Button onClick={handleSubmit} disabled={busy}>
          {busy ? '추가 중…' : '추가'}
        </Button>
      </div>
    </div>
  )
}
