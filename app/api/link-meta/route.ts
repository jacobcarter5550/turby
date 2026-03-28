import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url')
  if (!url) return NextResponse.json({ canIframe: false })

  try {
    const res = await fetch(url, {
      method: 'HEAD',
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Turbybot/1.0)' },
      next: { revalidate: 86400 },
    })

    const xfo = res.headers.get('x-frame-options')
    const csp = res.headers.get('content-security-policy')
    const blockedByXfo = !!xfo // DENY or SAMEORIGIN both block us
    const blockedByCsp = !!csp && /frame-ancestors\s+('none'|[^;]*(?!\*))/.test(csp)

    return NextResponse.json({ canIframe: !blockedByXfo && !blockedByCsp })
  } catch {
    return NextResponse.json({ canIframe: true }) // optimistic if fetch fails
  }
}
