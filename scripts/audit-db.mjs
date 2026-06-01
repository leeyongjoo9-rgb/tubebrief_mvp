import 'dotenv/config'
import { config as dotenvConfig } from 'dotenv'
import { createClient } from '@supabase/supabase-js'

dotenvConfig({ path: '.env.local' })

const supa = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
)

const { data } = await supa
  .from('videos')
  .select('video_id, title, summary, channels(title)')
  .not('summary', 'is', null)
  .order('created_at', { ascending: false })

for (const v of data) {
  const ch = Array.isArray(v.channels) ? v.channels[0]?.title : v.channels?.title
  console.log(`\n[${v.video_id}] ${ch ?? '?'}`)
  console.log(`  title : ${v.title?.slice(0, 60)}`)
  console.log(`  people: ${v.summary.people.map(p => `${p.name}${p.role ? '/' + p.role : ''}`).join(', ')}`)
  console.log(`  comps : ${v.summary.companies?.join(', ') ?? '(none)'}`)
}
