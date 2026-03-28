'use client'

import { useState, useEffect } from 'react'
import { ArrowLeftIcon, ArrowRightIcon } from 'lucide-react'

export type ViewableItem = {
  id: number | string
  type: 'article' | 'image'
  label: string
  preview?: string
  color?: string
  imageUrl?: string | null
}

export function ContentViewer({ items, startIndex }: { items: ViewableItem[]; startIndex: number }) {
  const [idx, setIdx] = useState(startIndex)
  const item = items[idx]
  const total = items.length

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft')  setIdx(i => Math.max(0, i - 1))
      if (e.key === 'ArrowRight') setIdx(i => Math.min(total - 1, i + 1))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [total])

  if (!item) return null

  const hasPrev = idx > 0
  const hasNext = idx < total - 1
  const hasCover = !!(item.imageUrl || item.type === 'image')

  return (
    <div className="flex flex-col min-w-0">

      {/* Cover image — 4:3 suits portrait/headshot photos better than 16:9 */}
      {hasCover && (
        <div className="w-full overflow-hidden rounded-xl bg-muted mb-7" style={{ aspectRatio: '4/3' }}>
          {item.imageUrl
            ? <img src={item.imageUrl} alt={item.label} className="w-full h-full object-cover" />
            : <div className="w-full h-full" style={{ background: item.color ?? '#c8b89a' }} />
          }
        </div>
      )}

      {/* Text block — own horizontal padding so it breathes regardless of dialog container */}
      <div className="flex flex-col px-1">

        {/* Eyebrow: type · counter */}
        <p className={`text-[0.6rem] uppercase tracking-[0.2em] text-muted-foreground/50 font-sans mb-4 ${!hasCover ? 'pr-8 mt-1' : ''}`}>
          {item.type === 'image' ? 'Image' : 'Article'}
          {total > 1 && <> &middot; {idx + 1} / {total}</>}
        </p>

        {/* Title */}
        <h2 className={`font-ivy-headline text-[1.85rem] leading-[1.1] font-light text-foreground mb-5 ${!hasCover ? 'pr-8' : ''}`}>
          {item.label}
        </h2>

        {/* Rule */}
        <div className="w-8 h-px bg-foreground/25 mb-6" />

        {/* Body */}
        {item.preview && (
          <p className="text-[0.875rem] leading-[1.85] text-muted-foreground tracking-[0.01em] mb-2">
            {item.preview}
          </p>
        )}

      </div>

      {/* Navigation */}
      {total > 1 && (
        <div className="flex items-center justify-between mt-8 pt-4 mx-1 border-t border-border/60">
          <button
            onClick={() => setIdx(i => Math.max(0, i - 1))}
            disabled={!hasPrev}
            className="flex items-center gap-2 text-[0.7rem] uppercase tracking-[0.12em] text-muted-foreground/60 hover:text-foreground disabled:opacity-20 disabled:cursor-not-allowed transition-colors group"
          >
            <ArrowLeftIcon size={12} className="transition-transform group-hover:-translate-x-1" />
            <span>Prev</span>
          </button>

          <button
            onClick={() => setIdx(i => Math.min(total - 1, i + 1))}
            disabled={!hasNext}
            className="flex items-center gap-2 text-[0.7rem] uppercase tracking-[0.12em] text-muted-foreground/60 hover:text-foreground disabled:opacity-20 disabled:cursor-not-allowed transition-colors group"
          >
            <span>Next</span>
            <ArrowRightIcon size={12} className="transition-transform group-hover:translate-x-1" />
          </button>
        </div>
      )}
    </div>
  )
}
