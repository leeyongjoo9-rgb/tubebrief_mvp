'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { softDeleteVideo } from '@/app/videos/[video_id]/actions'

interface Props {
  videoId: string
}

export function DeleteVideoButton({ videoId }: Props) {
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const handleDelete = () => {
    setError(null)
    startTransition(async () => {
      const result = await softDeleteVideo(videoId)
      // softDeleteVideo 가 성공하면 redirect 로 throw 됨 → 여기 도달 X
      // 도달했다면 에러 케이스
      if (!result.ok) {
        setError(result.error ?? '삭제 실패')
        setConfirming(false)
      }
    })
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-1.5">
        {error && <span className="text-xs text-destructive">{error}</span>}
        <Button
          variant="destructive"
          size="sm"
          onClick={handleDelete}
          disabled={pending}
        >
          {pending ? '삭제 중…' : '정말 삭제'}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setConfirming(false)
            setError(null)
          }}
          disabled={pending}
        >
          취소
        </Button>
      </div>
    )
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => setConfirming(true)}
      className="text-muted-foreground hover:text-destructive"
      title="이 보고서 삭제 (한 번 보고 더 안 볼 영상 정리)"
    >
      삭제
    </Button>
  )
}
