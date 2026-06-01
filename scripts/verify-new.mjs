import 'dotenv/config'
import { config as dotenvConfig } from 'dotenv'
import { YoutubeTranscript } from 'youtube-transcript'

dotenvConfig({ path: '.env.local' })

const VIDEO_ID = process.argv[2] ?? 'GO6ItvEqXOg'
const KEYWORDS = process.argv.slice(3)

const raw = await YoutubeTranscript.fetchTranscript(VIDEO_ID, {})
const segs = raw.map(s => ({ start: Math.round((s.offset ?? 0) / 1000), text: String(s.text ?? '').trim() })).filter(s => s.text)

async function fetchDesc(videoId) {
  const res = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
    headers: { 'User-Agent': 'Mozilla/5.0', 'Accept-Language': 'ko,en;q=0.9' },
  })
  const html = await res.text()
  const m = html.match(/"shortDescription":"((?:[^"\\]|\\.)*)"/)
  if (!m) return null
  try { return JSON.parse(`"${m[1]}"`) } catch { return m[1] }
}

function pad2(n) { return String(n).padStart(2, '0') }
function fmt(s) { return `${pad2(Math.floor(s/60))}:${pad2(s%60)}` }

const desc = await fetchDesc(VIDEO_ID)
console.log(`설명문: ${desc?.length ?? 0}자\n---`)

for (const kw of KEYWORDS) {
  const inTr = segs.filter(s => s.text.includes(kw))
  const inDesc = desc?.includes(kw) ?? false
  console.log(`"${kw}": 자막 ${inTr.length}회, 설명문 ${inDesc ? '있음' : '없음'}`)
  inTr.slice(0, 2).forEach(h => console.log(`  [${fmt(h.start)}] ${h.text}`))
}
