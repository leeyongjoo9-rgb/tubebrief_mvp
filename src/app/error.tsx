'use client'

import { useEffect } from 'react'

interface Props {
  error: Error & { digest?: string }
  reset: () => void
}

export default function GlobalError({ error, reset }: Props) {
  useEffect(() => {
    console.error('TubeBrief error boundary:', error)
  }, [error])

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-16 sm:px-6 lg:px-8">
      <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-8">
        <h1 className="mb-2 text-xl font-semibold">문제가 발생했어요</h1>
        <p className="mb-4 text-sm text-muted-foreground">
          페이지를 불러오는 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.
        </p>
        {error.digest && (
          <p className="mb-4 font-mono text-xs text-muted-foreground">
            error id: {error.digest}
          </p>
        )}
        <button
          onClick={() => reset()}
          className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90"
        >
          다시 시도
        </button>
      </div>
    </main>
  )
}
