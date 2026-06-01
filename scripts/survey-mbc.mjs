// MBC 라디오 시사 채널의 (1) RSS 피드 영상 제목 패턴, (2) 재생목록 구조 조사

const CHANNEL_ID = 'UCTTmtS2ljy1vyl_s-d_LEHQ'

// 1) RSS 피드 — 최근 15개 영상 제목
console.log('=== RSS 피드 (최근 15개 영상) ===')
const rssRes = await fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${CHANNEL_ID}`)
const xml = await rssRes.text()
const titles = [...xml.matchAll(/<title>([^<]+)<\/title>/g)].slice(1).map(m => m[1])  // 첫 title 은 채널명
const ids = [...xml.matchAll(/<yt:videoId>([^<]+)<\/yt:videoId>/g)].map(m => m[1])
const pubs = [...xml.matchAll(/<published>([^<]+)<\/published>/g)].map(m => m[1])
for (let i = 0; i < titles.length; i++) {
  console.log(`[${pubs[i]?.slice(0,10)}] ${ids[i]}  ${titles[i]}`)
}

// 2) 재생목록 조사 — 채널 페이지의 playlists 탭 스크래핑
console.log('\n=== 채널 재생목록 ===')
const plUrl = `https://www.youtube.com/channel/${CHANNEL_ID}/playlists`
const plRes = await fetch(plUrl, {
  headers: { 'User-Agent': 'Mozilla/5.0', 'Accept-Language': 'ko' },
})
const plHtml = await plRes.text()

// ytInitialData JSON에서 playlist 추출
const matches = [...plHtml.matchAll(/"playlistRenderer":\{"playlistId":"([^"]+)"[^}]*?"title":\{"simpleText":"([^"]+)"\}/g)]
if (matches.length === 0) {
  // 다른 구조 시도
  const alt = [...plHtml.matchAll(/"playlistId":"(PL[A-Za-z0-9_-]{16,})"/g)]
  console.log(`(simpleText 매칭 없음, raw playlist id ${alt.length}개)`)
  const uniq = [...new Set(alt.map(m => m[1]))].slice(0, 30)
  uniq.forEach(id => console.log(`  ${id}`))
} else {
  for (const m of matches.slice(0, 30)) {
    console.log(`  ${m[1]}  ${m[2]}`)
  }
}

// 3) 제목 패턴 — 코너별 prefix 추출
console.log('\n=== 제목 prefix 빈도 (코너 식별) ===')
const prefixes = new Map()
for (const t of titles) {
  const m = t.match(/^(\[[^\]]+\])/)
  const p = m ? m[1] : '(no prefix)'
  prefixes.set(p, (prefixes.get(p) || 0) + 1)
}
for (const [p, c] of [...prefixes.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${c}회: ${p}`)
}
