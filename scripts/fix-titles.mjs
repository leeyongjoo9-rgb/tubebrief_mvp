import 'dotenv/config'
import { config as dotenvConfig } from 'dotenv'
import { createClient } from '@supabase/supabase-js'

dotenvConfig({ path: '.env.local' })

function decodeJsonStr(s) {
  if (!s) return s
  try { return JSON.parse(`"${s}"`) } catch { return s }
}

function cleanTitle(s) {
  if (!s) return s
  s = s
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
  s = s.replace(/[‘’‛‚`´]/g, "'")
  s = s.replace(/[“”„‟]/g, '"')
  return s
}

async function fetchTitleFromPage(videoId) {
  const res = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0',
      'Accept-Language': 'ko,en;q=0.9',
    },
  })
  if (!res.ok) return null
  const html = await res.text()
  const raw = html.match(/<meta\s+name="title"\s+content="([^"]+)"/)?.[1]
    ?? html.match(/"title":"([^"]+)","lengthSeconds"/)?.[1]
  if (!raw) return null
  return cleanTitle(decodeJsonStr(raw))
}

const supa = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
)

const { data: videos, error } = await supa.from('videos').select('video_id, title')
if (error) throw error

let changed = 0, skipped = 0
for (const v of videos) {
  const fresh = await fetchTitleFromPage(v.video_id)
  if (!fresh) { console.log(`skip ${v.video_id}: 페이지 fetch 실패`); skipped++; continue }
  if (fresh !== v.title) {
    const { error: uErr } = await supa.from('videos').update({ title: fresh }).eq('video_id', v.video_id)
    if (uErr) { console.error(`fail ${v.video_id}: ${uErr.message}`); continue }
    console.log(`[${v.video_id}]`)
    console.log(`  before: ${v.title}`)
    console.log(`  after : ${fresh}`)
    changed++
  }
}

console.log(`\n✅ 완료: ${changed}건 정정, ${skipped}건 스킵`)
