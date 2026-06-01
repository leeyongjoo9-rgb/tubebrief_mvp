import 'dotenv/config'
import { config as dotenvConfig } from 'dotenv'
import { YoutubeTranscript } from 'youtube-transcript'

dotenvConfig({ path: '.env.local' })

const raw = await YoutubeTranscript.fetchTranscript('79VpEZ2qQ8c', {})
const segs = raw.map(s => ({ start: Math.round((s.offset ?? 0) / 1000), text: String(s.text ?? '').trim() })).filter(s => s.text)

function pad2(n) { return String(n).padStart(2, '0') }
function fmt(s) { return `${pad2(Math.floor(s/60))}:${pad2(s%60)}` }

const variants = ['레인보우', '레인보', '래인보', '레인보우 로보틱스', '로보틱스', '레인보우로보틱스', 'Rainbow', 'rainbow', '레보', '레인', '보틱스', '레인보스', '레인보우 로', '레인보트']
for (const kw of variants) {
  const hits = segs.filter(s => s.text.includes(kw))
  if (hits.length > 0) {
    console.log(`"${kw}": ${hits.length}회`)
    hits.slice(0, 5).forEach(h => console.log(`  [${fmt(h.start)}] ${h.text}`))
  }
}

// 추가: "한국" 또는 "국내" 인근의 로봇 회사 언급 찾기
console.log('\n=== "로보틱스" 모든 등장 ===')
segs.filter(s => /로보틱스|로보트|로봇/.test(s.text)).slice(0, 20).forEach(h => console.log(`  [${fmt(h.start)}] ${h.text}`))

console.log('\n=== 자막 후반부 (25~35분) 회사명 등장 가능 구간 ===')
segs.filter(s => s.start >= 1500 && s.start <= 2100).forEach(h => {
  if (/[가-힣]{2,}/.test(h.text) && (h.text.includes('회사') || h.text.includes('기업') || h.text.includes('스타트') || /[A-Z]/.test(h.text))) {
    console.log(`  [${fmt(h.start)}] ${h.text}`)
  }
})
