'use client'

import { ExternalLinkIcon } from 'lucide-react'
import { useEffect, useState } from 'react'

export function LinkViewer({ url, label, ogImage }: { url: string; label: string; ogImage?: string | null }) {
  const domain = (() => { try { return new URL(url).hostname.replace('www.', '') } catch { return url } })()
  const ogSrc = ogImage ?? `/api/og?url=${encodeURIComponent(url)}`
  const [canIframe, setCanIframe] = useState<boolean | null>(null)

  useEffect(() => {
    fetch(`/api/link-meta?url=${encodeURIComponent(url)}`)
      .then(r => r.json())
      .then(d => setCanIframe(d.canIframe))
      .catch(() => setCanIframe(true))
  }, [url])

  return (
    <div className="flex flex-col min-w-0">

      {/* Header */}
      <div className="px-1 pr-10 mb-5">
        <p className="text-[0.6rem] uppercase tracking-[0.2em] text-muted-foreground/50 font-sans mb-4">
          Link
        </p>
        <h2 className="font-ivy-headline text-[1.85rem] leading-[1.1] font-light text-foreground mb-3">
          {label}
        </h2>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-[0.7rem] text-muted-foreground/50 hover:text-foreground transition-colors"
        >
          <ExternalLinkIcon size={10} />
          <span className="truncate max-w-[220px]">{domain}</span>
        </a>
      </div>

      {/* Content */}
      {canIframe === null ? (
        <div className="w-full rounded-xl bg-muted border border-border/40 flex items-center justify-center" style={{ height: '52vh' }}>
          <span className="text-[0.7rem] text-muted-foreground/40">Loading…</span>
        </div>
      ) : canIframe ? (
        <div className="w-full rounded-xl overflow-hidden bg-muted border border-border/40" style={{ height: '52vh' }}>
          <iframe
            src={url}
            className="w-full h-full border-0"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
            title={label}
          />
        </div>
      ) : (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full rounded-xl overflow-hidden bg-muted border border-border/40 block relative group"
          style={{ height: '52vh' }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={ogSrc} alt={label} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
            <ExternalLinkIcon size={16} className="text-white" />
            <span className="text-white text-[0.8rem]">Open in browser</span>
          </div>
        </a>
      )}

    </div>
  )
}
