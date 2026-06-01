const VID = process.argv[2] ?? 'e0YXjUeM78M'
const r = await fetch(`https://www.youtube.com/watch?v=${VID}`, {
  headers: { 'User-Agent': 'Mozilla/5.0', 'Accept-Language': 'ko' },
})
const html = await r.text()
const m = html.match(/"shortDescription":"((?:[^"\\]|\\.)*)"/)
if (!m) { console.log('no desc'); process.exit(0) }
const desc = JSON.parse(`"${m[1]}"`)
console.log(desc)
