import { createClient, type SupabaseClient } from '@supabase/supabase-js'

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(
      `환경변수 ${name} 가 설정되지 않았어요. 프로젝트 루트의 .env.local 파일에 값을 추가했는지 확인해 주세요. (참고: .env.example)`,
    )
  }
  return value
}

export function createServerSupabaseClient(): SupabaseClient {
  const url = requireEnv('NEXT_PUBLIC_SUPABASE_URL')
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    requireEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY')

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
