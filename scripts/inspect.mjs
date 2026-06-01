import 'dotenv/config'
import { config as dotenvConfig } from 'dotenv'
import { YoutubeTranscript } from 'youtube-transcript'

dotenvConfig({ path: '.env.local' })

const VIDEO_ID = process.argv[2] ?? 'MypMoQ9fodU'
const KEYWORDS = ['권영화', '교수', '박사', '저자', '저서', '슈퍼사이클', '서울기독', '서울과학', '오늘 모셨', '안녕하세요', '소개', '출연']

async function fetchTranscriptRaw(videoId) {
  const raw = await YoutubeTranscript.fetchTranscript(videoId, {})
  return raw.map(s => ({ start: Math.round((s.offset ?? 0) / 1000), text: String(s.text ?? '').trim() }))
}

async function fetchDescription(videoId) {
  const res = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
      'Accept-Language': 'ko,en;q=0.9',
    },
  })
  const html = await res.text()
  // shortDescription is the cleanest source
  const m = html.match(/"shortDescription":"((?:[^"\\]|\\.)*)"/)
  if (!m) return null
  try { return JSON.parse(`"${m[1]}"`) } catch { return m[1] }
}

function pad2(n) { return String(n).padStart(2, '0') }
function fmt(s) { return `${pad2(Math.floor(s/60))}:${pad2(s%60)}` }

const tr = await fetchTranscriptRaw(VIDEO_ID)
const fullText = tr.map(s => s.text).join(' ')
const desc = await fetchDescription(VIDEO_ID)

console.log(`\n=== 자막 통계 ===`)
console.log(`세그먼트 ${tr.length}개, 총 ${fullText.length}자`)
console.log(`\n=== 자막 첫 30 세그먼트 (도입부 — 게스트 소개 구간) ===`)
tr.slice(0, 30).forEach(s => console.log(`[${fmt(s.start)}] ${s.text}`))

console.log(`\n=== 키워드 자막 검색 ===`)
for (const kw of KEYWORDS) {
  const hits = tr.filter(s => s.text.includes(kw))
  if (hits.length) {
    console.log(`"${kw}": ${hits.length}회`)
    hits.slice(0, 3).forEach(h => console.log(`  [${fmt(h.start)}] ${h.text}`))
  } else {
    console.log(`"${kw}": 없음`)
  }
}

console.log(`\n=== 영상 설명문 (shortDescription) ===`)
if (!desc) {
  console.log('(추출 실패)')
} else {
  console.log(`길이 ${desc.length}자`)
  console.log('---')
  console.log(desc.slice(0, 1500))
  if (desc.length > 1500) console.log(`... (이하 ${desc.length - 1500}자 생략)`)
  console.log('---')
  console.log(`\n설명문 키워드 검색:`)
  for (const kw of KEYWORDS) {
    if (desc.includes(kw)) console.log(`  "${kw}": 포함됨`)
  }
}
