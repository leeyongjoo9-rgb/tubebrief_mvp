import 'dotenv/config'
import { config as dotenvConfig } from 'dotenv'
import { YoutubeTranscript } from 'youtube-transcript'
import { createClient } from '@supabase/supabase-js'

dotenvConfig({ path: '.env.local' })

const VIDEO_ID = process.argv[2] ?? '79VpEZ2qQ8c'

async function fetchTranscriptText(videoId) {
  const raw = await YoutubeTranscript.fetchTranscript(videoId, {})
  const segs = raw.map(s => ({ start: Math.round((s.offset ?? 0) / 1000), text: String(s.text ?? '').trim() })).filter(s => s.text)
  return { segs, full: segs.map(s => s.text).join(' ') }
}

async function fetchDescription(videoId) {
  const res = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0',
      'Accept-Language': 'ko,en;q=0.9',
    },
  })
  const html = await res.text()
  const m = html.match(/"shortDescription":"((?:[^"\\]|\\.)*)"/)
  if (!m) return null
  try { return JSON.parse(`"${m[1]}"`) } catch { return m[1] }
}

function pad2(n) { return String(n).padStart(2, '0') }
function fmt(s) { return `${pad2(Math.floor(s/60))}:${pad2(s%60)}` }

function searchKeyword(segs, kw) {
  return segs.filter(s => s.text.includes(kw)).map(s => `[${fmt(s.start)}] ${s.text}`)
}

const { segs, full } = await fetchTranscriptText(VIDEO_ID)
const desc = await fetchDescription(VIDEO_ID)
console.log(`\n=== 자막 통계: ${segs.length} segments, ${full.length} chars`)
console.log(`=== 설명문: ${desc?.length ?? 0} chars\n`)

// DB에 저장된 요약 가져오기
const supa = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const { data, error } = await supa.from('videos').select('summary').eq('video_id', VIDEO_ID).single()
if (error || !data?.summary) { console.error('DB에서 요약 못 찾음:', error?.message); process.exit(1) }
const summary = data.summary

// === 출연자 이름 검증 ===
console.log('=========================================')
console.log('1. 출연자 이름 검증 (요약 vs 자막 vs 설명문)')
console.log('=========================================')
console.log('요약 people:', JSON.stringify(summary.people, null, 2))
for (const name of ['한재권', '한재원', '재권', '재원', '박상준', '한양']) {
  const inTr = searchKeyword(segs, name)
  const inDesc = desc?.includes(name) ?? false
  console.log(`  "${name}": 자막 ${inTr.length}회, 설명문 ${inDesc ? '있음' : '없음'}`)
  inTr.slice(0, 3).forEach(h => console.log(`    ${h}`))
}

// === 회사 리스트 검증 ===
console.log('\n=========================================')
console.log('2. 회사 리스트 검증 (요약의 15개 회사가 자막/설명문에 실제 등장하는가)')
console.log('=========================================')
for (const c of summary.companies) {
  const inTr = searchKeyword(segs, c)
  const inDesc = desc?.includes(c) ?? false
  const status = inTr.length === 0 && !inDesc ? '⚠️ 환각?' : (inTr.length === 0 ? '설명문만' : '✓')
  console.log(`  "${c}": 자막 ${inTr.length}회, 설명문 ${inDesc ? '있음' : '없음'} ${status}`)
  if (inTr.length > 0) inTr.slice(0, 2).forEach(h => console.log(`    ${h}`))
}

// === 주요 주제 키워드 검증 ===
console.log('\n=========================================')
console.log('3. 우리 요약이 주장한 주요 사실 — 자막에 실제 있는가')
console.log('=========================================')
const claims = [
  ['DARPA', 'DARPA / 다르파 챌린지'],
  ['다르파', 'DARPA / 다르파 챌린지'],
  ['후쿠시마', '후쿠시마 사고 계기'],
  ['ROS', 'ROS (Robot Operating System)'],
  ['로봇 오퍼레이팅', 'ROS 풀네임'],
  ['오퍼레이팅', 'ROS 풀네임'],
  ['피지컬', '피지컬 AI 패러다임'],
  ['VLA', 'Vision-Language-Action'],
  ['모방', '모방학습'],
  ['시뮬레이션', '시뮬레이션 학습'],
  ['파운데이션', '로봇 파운데이션 모델'],
  ['앨리스', '한재권 교수 휴머노이드'],
  ['알리스', '음성인식 변형'],
  ['옵티머스', '테슬라 옵티머스'],
  ['옵티마스', '음성인식 변형'],
  ['CCTV', 'CCTV 학습 데이터'],
  ['ARM', 'ARM 아키텍처'],
  ['x86', 'x86'],
  ['엑스86', '음성인식 변형'],
  ['눈치', '눈치/일머리 문화적 학습'],
  ['일머리', '눈치/일머리'],
  ['친구', '친구 같은 로봇 결론'],
]
for (const [kw, desc] of claims) {
  const hits = searchKeyword(segs, kw)
  const inDesc_ = desc.includes(kw) ?? false
  console.log(`  "${kw}" (${desc}): 자막 ${hits.length}회`)
  if (hits.length > 0 && hits.length <= 3) hits.forEach(h => console.log(`    ${h}`))
  else if (hits.length > 3) console.log(`    ${hits[0]}\n    ... (${hits.length-1}개 더)`)
}

// === 요약 brief의 (mm:ss) 마커가 자막에 실제 있는지 ===
console.log('\n=========================================')
console.log('4. brief의 (mm:ss) 타임스탬프 검증')
console.log('=========================================')
const tsMatches = [...summary.brief.matchAll(/\((\d{1,2}):(\d{2})\)/g)]
for (const m of tsMatches) {
  const totalSec = parseInt(m[1]) * 60 + parseInt(m[2])
  const nearby = segs.filter(s => Math.abs(s.start - totalSec) <= 5)
  console.log(`  ${m[0]}: 자막 인근 세그먼트 ${nearby.length}개`)
  nearby.slice(0, 2).forEach(s => console.log(`    [${fmt(s.start)}] ${s.text.slice(0, 60)}`))
}

console.log('\n=========================================')
console.log('5. 요약에 등장 안 한 자막 후반부 (영상 30분 이후) 핵심 주제 점검')
console.log('=========================================')
const lateSegs = segs.filter(s => s.start >= 1800) // 30분 이후
console.log(`30분 이후 세그먼트: ${lateSegs.length}개`)
// 후반부에서 흥미 키워드
for (const kw of ['일자리', '인간', '한국', '제조업', '데이터', '미래', '친구', '공감', '눈치']) {
  const hits = lateSegs.filter(s => s.text.includes(kw))
  if (hits.length) console.log(`  후반 "${kw}": ${hits.length}회`)
}
