import { NextRequest, NextResponse } from 'next/server'
import { requireCronAuth } from '@/lib/auth'

// Vercel Hobby 의 cron 2개 / 일 1회 / 함수 60초 제약을 우회하기 위한 통합 entrypoint.
// 한 번 호출에 refresh → process(limit=2) → summarize(limit=1) 을 순차 실행한다.
// summarize 는 LLM 호출이라 1개당 40~80초가 걸려서 60초 안에 안정적으로 끝내려면 1개로 제한.
// 잔여 pending 영상은 다음 cron 또는 수동 호출로 처리.
export const dynamic = 'force-dynamic'
export const maxDuration = 60

async function callSelf(
  baseUrl: string,
  path: string,
  auth: string,
  body?: object,
) {
  const res = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: {
      Authorization: auth,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  let json: unknown
  try {
    json = await res.json()
  } catch {
    json = { parseError: true }
  }
  return { status: res.status, body: json }
}

export async function GET(req: NextRequest) {
  const authFail = requireCronAuth(req)
  if (authFail) return authFail

  const baseUrl = new URL(req.url).origin
  const auth = req.headers.get('authorization') ?? ''

  const out: Record<string, unknown> = {}

  try {
    out.refresh = await callSelf(baseUrl, '/api/refresh', auth)
  } catch (e) {
    out.refresh = { error: e instanceof Error ? e.message : String(e) }
  }
  try {
    out.process = await callSelf(baseUrl, '/api/process', auth, { limit: 2 })
  } catch (e) {
    out.process = { error: e instanceof Error ? e.message : String(e) }
  }
  try {
    out.summarize = await callSelf(baseUrl, '/api/summarize', auth, { limit: 1 })
  } catch (e) {
    out.summarize = { error: e instanceof Error ? e.message : String(e) }
  }

  return NextResponse.json({ ok: true, results: out })
}

export async function POST(req: NextRequest) {
  return GET(req)
}
