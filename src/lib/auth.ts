import { NextRequest, NextResponse } from 'next/server'

// Cron/관리자 호출 보호용. Vercel Cron 이 보내는 `Authorization: Bearer <CRON_SECRET>` 헤더,
// 또는 같은 형식의 헤더를 가진 호출만 통과시킨다.
//
// 통과면 null, 실패면 NextResponse(401/500) 를 반환한다.
export function requireCronAuth(req: NextRequest): NextResponse | null {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    return NextResponse.json(
      {
        error:
          'CRON_SECRET 환경변수가 설정되지 않았어요. .env.local 과 Vercel Project Settings 모두에 같은 값을 등록해 주세요.',
      },
      { status: 500 },
    )
  }

  const header = req.headers.get('authorization')
  if (header !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  return null
}
