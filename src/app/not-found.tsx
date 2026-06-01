import Link from 'next/link'

export default function NotFound() {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-16 sm:px-6 lg:px-8">
      <div className="rounded-xl border border-dashed p-8 text-center">
        <h1 className="mb-2 text-xl font-semibold">페이지를 찾을 수 없어요</h1>
        <p className="mb-6 text-sm text-muted-foreground">
          요청하신 영상이나 페이지가 존재하지 않습니다.
        </p>
        <Link
          href="/"
          className="inline-block rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90"
        >
          홈으로 돌아가기
        </Link>
      </div>
    </main>
  )
}
