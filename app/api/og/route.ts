import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url')
  if (!url) return NextResponse.json({ error: 'missing url' }, { status: 400 })

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Turbybot/1.0)' },
      next: { revalidate: 3600 },
    })

    if (!res.ok) return NextResponse.json({ error: 'fetch failed' }, { status: 502 })

    const html = await res.text()

    const match =
      html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ??
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i)

    if (!match?.[1]) return NextResponse.json({ error: 'no og:image' }, { status: 404 })

    // Redirect to the actual image so the browser can cache it
    return NextResponse.redirect(match[1])
  } catch {
    return NextResponse.json({ error: 'error' }, { status: 500 })
  }
}
