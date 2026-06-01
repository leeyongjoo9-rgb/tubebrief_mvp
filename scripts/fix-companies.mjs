import 'dotenv/config'
import { config as dotenvConfig } from 'dotenv'
import { createClient } from '@supabase/supabase-js'

dotenvConfig({ path: '.env.local' })

const VIDEO_ID = 'OFLGkHxHcZg'
const REMOVE = ['KB자산운용', '삼성자산운용']

const supa = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
)

const { data, error } = await supa.from('videos').select('summary').eq('video_id', VIDEO_ID).single()
if (error) throw error

const before = data.summary.companies
const after = before.filter(c => !REMOVE.includes(c))
console.log(`before (${before.length}): ${JSON.stringify(before)}`)
console.log(`after  (${after.length}): ${JSON.stringify(after)}`)
console.log(`removed: ${REMOVE.join(', ')}`)

const newSummary = { ...data.summary, companies: after }
const { error: updErr } = await supa.from('videos').update({ summary: newSummary }).eq('video_id', VIDEO_ID)
if (updErr) throw updErr
console.log('✅ DB 갱신 완료')
