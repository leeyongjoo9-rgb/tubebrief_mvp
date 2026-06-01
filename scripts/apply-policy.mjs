import 'dotenv/config'
import { config as dotenvConfig } from 'dotenv'
import { createClient } from '@supabase/supabase-js'

dotenvConfig({ path: '.env.local' })

const supa = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
)

const PATCHES = [
  // PLUS TV — 슈카(MC, 채널 진행자) 제거
  { videoId: '5avgkEHjBeY', removePeople: ['슈카'] },
  // 한경 글로벌마켓 — 김현석/김종학/빈난새 모두 한경 고정 기자 패널이라 진행자 처리
  { videoId: 'OFLGkHxHcZg', removePeople: ['김현석', '김종학', '빈난새'] },
  // EBS 영상 — companies에 "EBS"(채널명) 남아있음
  { videoId: '79VpEZ2qQ8c', removeCompanies: ['EBS'] },
  // 신사임당 — "LG 노택"(음성 오인식, LG 이노텍과 중복), "신사임당몰"(채널 광고)
  { videoId: 'MypMoQ9fodU', removeCompanies: ['LG 노택', '신사임당몰'] },
]

for (const p of PATCHES) {
  const { data, error } = await supa.from('videos').select('summary').eq('video_id', p.videoId).single()
  if (error) { console.error(`fetch ${p.videoId} 실패: ${error.message}`); continue }
  const sm = data.summary
  const changes = []

  if (p.removePeople) {
    const before = sm.people.length
    sm.people = sm.people.filter(person => !p.removePeople.includes(person.name))
    if (sm.people.length !== before) changes.push(`people ${before}→${sm.people.length} (제거: ${p.removePeople.join(', ')})`)
  }
  if (p.removeCompanies) {
    const before = sm.companies.length
    sm.companies = sm.companies.filter(c => !p.removeCompanies.includes(c))
    if (sm.companies.length !== before) changes.push(`companies ${before}→${sm.companies.length} (제거: ${p.removeCompanies.join(', ')})`)
  }

  if (changes.length === 0) { console.log(`[${p.videoId}] 변경 없음`); continue }

  const { error: uErr } = await supa.from('videos').update({ summary: sm }).eq('video_id', p.videoId)
  if (uErr) { console.error(`update ${p.videoId} 실패: ${uErr.message}`); continue }
  console.log(`[${p.videoId}]`)
  changes.forEach(c => console.log(`  ${c}`))
}

console.log('\n✅ 적용 완료')
