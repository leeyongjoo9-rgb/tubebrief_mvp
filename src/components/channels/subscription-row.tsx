'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { deleteSubscription } from '@/app/channels/actions'

interface Props {
  id: string
  label: string | null
  channelTitle: string | null
  channelUrl: string | null
  includeKeywords: string[]
  excludeKeywords: string[]
  videoCount: number
  lastChecked: string | null
}

function formatKR(iso: string | null): string {
  if (!iso) return '아직 없음'
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Seoul',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date(iso))
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '??'
  return `${get('month')}/${get('day')} ${get('hour')}:${get('minute')}`
}

export function SubscriptionRow(props: Props) {
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const handleDelete = () => {
    setError(null)
    startTransition(async () => {
      const result = await deleteSubscription(props.id)
      if (!result.ok) {
        setError(result.error ?? '삭제 실패')
        setConfirming(false)
      }
      // success → revalidatePath 가 페이지 자동 새로고침
    })
  }

  return (
    <li className="rounded-lg border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="font-medium leading-snug">
            {props.label ?? '(라벨 없음)'}
          </div>
          <div className="text-xs text-muted-foreground">
            {props.channelUrl ? (
              <a
                href={props.channelUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline"
              >
                {props.channelTitle ?? '(이름 없음)'} ↗
              </a>
            ) : (
              <span>{props.channelTitle ?? '(이름 없음)'}</span>
            )}
            <span className="mx-2">·</span>
            <span>요약 {props.videoCount}건</span>
            <span className="mx-2">·</span>
            <span>마지막 확인 {formatKR(props.lastChecked)}</span>
          </div>
          {(props.includeKeywords.length > 0 ||
            props.excludeKeywords.length > 0) && (
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              {props.includeKeywords.map((k) => (
                <Badge
                  key={`i-${k}`}
                  variant="outline"
                  className="font-normal text-emerald-700 dark:text-emerald-300"
                >
                  +{k}
                </Badge>
              ))}
              {props.excludeKeywords.map((k) => (
                <Badge
                  key={`e-${k}`}
                  variant="outline"
                  className="font-normal text-destructive"
                >
                  −{k}
                </Badge>
              ))}
            </div>
          )}
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
        <div className="shrink-0">
          {confirming ? (
            <div className="flex items-center gap-1.5">
              <Button
                variant="destructive"
                size="sm"
                onClick={handleDelete}
                disabled={pending}
              >
                {pending ? '삭제 중…' : '확인'}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setConfirming(false)}
                disabled={pending}
              >
                취소
              </Button>
            </div>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setConfirming(true)}
              className="text-muted-foreground hover:text-destructive"
            >
              삭제
            </Button>
          )}
        </div>
      </div>
    </li>
  )
}
