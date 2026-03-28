'use client'

import { useState, useRef, useMemo, useCallback } from 'react'
import type { Housemate, Happening } from '../lib/notion'
import { useDialog } from '@/lib/providers/dialog-provider'
import { ContentViewer, type ViewableItem } from './ContentViewer'
import { LinkViewer } from './LinkViewer'

// ── Content types ──────────────────────────────────────────────────────────────

type LeafItem =
  | { id: number; type: 'image'; label: string; color: string }
  | { id: number; type: 'article'; label: string; preview: string; imageUrl?: string | null }
  | { id: number; type: 'link'; label: string; url: string; ogImage?: string | null }

type ViewableLeaf = Extract<LeafItem, { type: 'image' | 'article' }>

type ContentItem =
  | LeafItem
  | { id: number; type: 'folder'; label: string; contents?: LeafItem[] }

const FOLDERS: { id: number; label: string; contents: ContentItem[] }[] = [
  {
    id: 1, label: 'PEOPLE',
    contents: [
    ],
  },
  {
    id: 2, label: 'HAPPENINGS',
    contents: [
      { id: 1, type: 'article', label: 'Q2 Update', preview: 'Latest project milestones and blockers.' },
      { id: 2, type: 'image', label: 'event.png', color: '#fd8d3c' },
      {
        id: 3, type: 'folder', label: 'Archive', contents: [
          { id: 1, type: 'article', label: 'Q1 Update', preview: 'Previous quarter summary.' },
          { id: 2, type: 'article', label: 'Q4 2024', preview: 'End of year wrap-up.' },
        ]
      },
      { id: 4, type: 'article', label: 'Notes', preview: 'Meeting notes from last all-hands.' },
    ],
  },
  {
    id: 3, label: 'PICTURES',
    contents: [
      { id: 1, type: 'image', label: 'site_a.jpg', color: '#74c476' },
      { id: 2, type: 'image', label: 'site_b.jpg', color: '#9e9ac8' },
      { id: 3, type: 'image', label: 'aerial.jpg', color: '#f0b429' },
    ],
  },
]

const INITIAL_POSITIONS = [
  { x: 250, y: 200 },
  { x: 420, y: 200 },
  { x: 250, y: 360 },
]

// ── Dialog helpers ─────────────────────────────────────────────────────────────

function toViewable(items: ViewableLeaf[]): ViewableItem[] {
  return items.map(item => ({
    id: item.id,
    type: item.type,
    label: item.label,
    preview: item.type === 'article' ? item.preview : undefined,
    color: item.type === 'image' ? item.color : undefined,
    imageUrl: item.type === 'article' ? item.imageUrl : undefined,
  }))
}

const DIALOG_OPTS = { options: { className: 'bg-[#FFFDF1]' } }

function useOpenContent() {
  const { dialog } = useDialog()
  return useCallback((items: ViewableLeaf[], startIndex: number) => {
    dialog(<ContentViewer items={toViewable(items)} startIndex={startIndex} />, DIALOG_OPTS)
  }, [dialog])
}

function useOpenLink() {
  const { dialog } = useDialog()
  return useCallback((url: string, label: string, ogImage?: string | null) => {
    dialog(<LinkViewer url={url} label={label} ogImage={ogImage} />, DIALOG_OPTS)
  }, [dialog])
}

// ── Item offsets ───────────────────────────────────────────────────────────────

function getScatterOffsets(count: number, dist: number) {
  return Array.from({ length: count }, (_, i) => {
    const startAngle = -Math.PI * 1.1
    const sweep = Math.PI * 1.35
    const angle = startAngle + (i / Math.max(count - 1, 1)) * sweep
    return { x: Math.cos(angle) * (dist + (i % 2) * 18), y: Math.sin(angle) * (dist + (i % 2) * 18) }
  })
}

const GRID_COLS = 4
const GRID_COL_W = 88
const GRID_ROW_H = 80

function getGridOffsets(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    x: 16 + (i % GRID_COLS) * GRID_COL_W,
    y: 16 + (Math.floor(i / GRID_COLS) + 1) * GRID_ROW_H,
  }))
}

function getOffsets(count: number, scatterDist: number) {
  return count > 5 ? getGridOffsets(count) : getScatterOffsets(count, scatterDist)
}

// ── Folder SVG layers ──────────────────────────────────────────────────────────

function FolderBack({ scale = 1 }: { scale?: number }) {
  const w = 72 * scale, h = 62 * scale
  return (
    <svg width={w} height={h} viewBox="0 0 56 48" fill="none" style={{ display: 'block' }}>
      <path d="M3 13 L3 7 Q3 4 6 4 L20 4 Q23.5 4 25 7.5 L27.5 13 Z" fill="#c8922a" />
      <rect x="3" y="11" width="50" height="34" rx="5" fill="#c47e1a" />
    </svg>
  )
}

function FolderFront({ open, scale = 1 }: { open: boolean; scale?: number }) {
  const w = 72 * scale, h = 62 * scale
  return (
    <svg
      width={w} height={h}
      viewBox="0 0 56 48"
      fill="none"
      style={{
        display: 'block',
        transformOrigin: '50% 100%',
        transform: open
          ? 'perspective(260px) rotateX(32deg) translateY(-4px)'
          : 'perspective(260px) rotateX(0deg)',
        transition: 'transform 0.38s cubic-bezier(0.34, 1.3, 0.64, 1)',
      }}
    >
      <rect x="3" y="11" width="50" height="34" rx="5" fill="#f0b429" />
      <rect x="3" y="11" width="50" height="14" rx="5" fill="#f8d06b" />
      <rect x="3" y="34" width="50" height="11" rx="5" fill="#d49520" />
    </svg>
  )
}

// ── Item cards ─────────────────────────────────────────────────────────────────

function ImageCard({ item }: { item: Extract<ContentItem, { type: 'image' }> }) {
  return (
    <>
      <div style={{
        width: 76, height: 62, borderRadius: 10,
        background: item.color,
        boxShadow: '0 4px 16px rgba(0,0,0,0.22)',
      }} />
      <aside style={{ width: 76, overflow: 'hidden', paddingInline: 4, marginTop: '.35rem' }}>
        <span style={{ textAlign: "right",
          display: 'block', color: 'white', fontSize: '0.6rem', fontWeight: 500,
          textShadow: '0 1px 3px rgba(0,0,0,0.8)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {item.label}
        </span>
      </aside>
    </>
  )
}

function ArticleCard({ item }: { item: Extract<ContentItem, { type: 'article' }> }) {
  return (
    <>
      <div style={{
        width: 76, height: 62, borderRadius: 10,
        background: 'rgba(255,255,255,0.96)',
        boxShadow: '0 4px 16px rgba(0,0,0,0.22)',
        overflow: 'hidden',
        position: 'relative',
      }}>
        {item.imageUrl ? (
          <img
            src={item.imageUrl}
            alt={item.label}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        ) : (
          <div style={{ padding: '10px 10px 8px', display: 'flex', flexDirection: 'column', gap: 5 }}>
            <div style={{ height: 6, borderRadius: 3, background: '#c4c4c4', width: '88%' }} />
            <div style={{ height: 5, borderRadius: 3, background: '#dedede', width: '72%' }} />
            <div style={{ height: 5, borderRadius: 3, background: '#dedede', width: '82%' }} />
            <div style={{ height: 5, borderRadius: 3, background: '#ebebeb', width: '58%' }} />
          </div>
        )}
      </div>
      <aside style={{ width: 76, overflow: 'hidden', paddingInline: 4, marginTop: '.35rem' }}>
        <span style={{
          textAlign: "right",
          display: 'block', color: 'white', fontSize: '0.6rem', fontWeight: 500,
          textShadow: '0 1px 3px rgba(0,0,0,0.8)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {item?.label}
        </span>
      </aside>
    </>
  )
}

function LinkCard({ item }: { item: Extract<LeafItem, { type: 'link' }> }) {
  const ogSrc = item.ogImage ?? `/api/og?url=${encodeURIComponent(item.url)}`
  return (
    <>
      <div style={{
        width: 76, height: 62, borderRadius: 10,
        background: 'rgba(255,255,255,0.96)',
        boxShadow: '0 4px 16px rgba(0,0,0,0.22)',
        overflow: 'hidden',
      }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={ogSrc} alt={item.label} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
      </div>
      <aside style={{ width: 76, overflow: 'hidden', paddingInline: 4, marginTop: '.35rem' }}>
        <span style={{
          display: 'block', color: 'white', fontSize: '0.6rem', fontWeight: 500,
          textShadow: '0 1px 3px rgba(0,0,0,0.8)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>{item.label}</span>
      </aside>
    </>
  )
}

// ── Mini folder (interactive, same open mechanic, smaller scale) ───────────────

const MINI_SCALE = 0.65
const MINI_W = 72 * MINI_SCALE
const MINI_H = 62 * MINI_SCALE

function MiniFolder({ item }: { item: Extract<ContentItem, { type: 'folder' }> }) {
  const [open, setOpen] = useState(false)
  const [visible, setVisible] = useState(false)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const drag = useRef<{ ox: number; oy: number } | null>(null)
  const moved = useRef(false)
  const openContent = useOpenContent()

  const openLink = useOpenLink()
  const contents = item.contents ?? []
  const viewableItems = useMemo(() => contents.filter((c): c is ViewableLeaf => c.type === 'image' || c.type === 'article'), [contents])
  const offsets = useMemo(() => getOffsets(contents.length, 75), [contents.length])
  const cx = MINI_W / 2
  const cy = MINI_H / 2

  const toggle = () => {
    if (!contents.length) return
    if (open) {
      setVisible(false)
      setTimeout(() => setOpen(false), 380)
    } else {
      setOpen(true)
      requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)))
    }
  }

  return (
    <div style={{
      position: 'relative',
      userSelect: 'none',
      transform: `translate(${dragOffset.x}px, ${dragOffset.y}px)`,
    }}>

      {/* Sub-items scatter */}
      {open && contents.map((sub, i) => {
        const isLeaf = true // sub is always a LeafItem inside a MiniFolder
        const isLink = sub.type === 'link'
        const viewableIdx = isLeaf && !isLink ? viewableItems.indexOf(sub as ViewableLeaf) : -1
        const handleClick = !isLeaf ? undefined
          : isLink ? () => { const l = sub as Extract<LeafItem, { type: 'link' }>; openLink(l.url, l.label, l.ogImage) }
            : () => openContent(viewableItems, viewableIdx)
        return (
          <div
            key={sub.id}
            style={{
              position: 'absolute',
              left: cx, top: cy,
              transform: visible
                ? `translate(calc(${offsets[i].x}px - 50%), calc(${offsets[i].y}px - 50%))`
                : `translate(-50%, -50%) scale(0.3)`,
              opacity: visible ? 1 : 0,
              transition: [
                `transform 0.4s cubic-bezier(0.34, 1.5, 0.64, 1) ${i * 60}ms`,
                `opacity   0.28s ease                             ${i * 60}ms`,
              ].join(', '),
              pointerEvents: 'auto',
              zIndex: 10,
              cursor: isLeaf ? 'pointer' : 'default',
            }}
            onClick={handleClick}
          >
            <ItemCard item={sub} />
          </div>
        )
      })}

      {/* Folder icon */}
      <div
        style={{
          position: 'relative',
          width: MINI_W, height: MINI_H,
          cursor: 'grab',
          filter: open
            ? 'drop-shadow(0 6px 14px rgba(0,0,0,0.35))'
            : 'drop-shadow(0 2px 6px rgba(0,0,0,0.22))',
          transition: 'filter 0.25s ease',
        }}
        onPointerDown={(e) => {
          moved.current = false
          drag.current = { ox: e.clientX - dragOffset.x, oy: e.clientY - dragOffset.y }
          e.currentTarget.setPointerCapture(e.pointerId)
          e.currentTarget.style.cursor = 'grabbing'
        }}
        onPointerMove={(e) => {
          if (!drag.current) return
          moved.current = true
          setDragOffset({ x: e.clientX - drag.current.ox, y: e.clientY - drag.current.oy })
        }}
        onPointerUp={(e) => {
          drag.current = null
          e.currentTarget.style.cursor = 'grab'
        }}
        onClick={() => { if (!moved.current) toggle() }}
      >
        <div style={{ position: 'absolute', inset: 0 }}>
          <FolderBack scale={MINI_SCALE} />
        </div>
        <div style={{ position: 'absolute', inset: 0 }}>
          <FolderFront open={open} scale={MINI_SCALE} />
        </div>
      </div>

      <div style={{ textAlign: 'center', marginTop: 3 }}>
        <span className="font-ivy-display" style={{
          letterSpacing: '0.05em',
          color: 'white', fontSize: '0.9rem', fontWeight: 400,
          textShadow: '0 1px 4px rgba(0,0,0,0.8)', whiteSpace: 'nowrap',
        }}>
          {item.label}
        </span>
      </div>
    </div>
  )
}

// ── Item card dispatcher ───────────────────────────────────────────────────────

function ItemCard({ item }: { item: ContentItem }) {
  if (item.type === 'folder') return <MiniFolder item={item} />
  if (item.type === 'image') return <ImageCard item={item} />
  if (item.type === 'link') return <LinkCard item={item} />
  return <ArticleCard item={item} />
}

// ── Folder (top-level) ────────────────────────────────────────────────────────

interface FolderProps {
  label: string
  initialX: number
  initialY: number
  contents: ContentItem[]
}

const W = 72, H = 62

function Folder({ label, initialX, initialY, contents }: FolderProps) {
  const [pos, setPos] = useState({ x: initialX, y: initialY })
  const [open, setOpen] = useState(false)
  const [visible, setVisible] = useState(false)
  const drag = useRef<{ ox: number; oy: number } | null>(null)
  const moved = useRef(false)
  const openContent = useOpenContent()

  const openLink = useOpenLink()
  const viewableItems = useMemo(() => contents.filter((c): c is ViewableLeaf => c.type === 'image' || c.type === 'article'), [contents])
  const offsets = useMemo(() => getOffsets(contents.length, 105), [contents.length])
  const cx = W / 2, cy = H / 2

  const toggleOpen = () => {
    if (open) {
      setVisible(false)
      setTimeout(() => setOpen(false), 400)
    } else {
      setOpen(true)
      requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)))
    }
  }

  return (
    <div style={{ position: 'absolute', left: pos.x, top: pos.y, userSelect: 'none' }}>

      {/* Scattered items */}
      {open && contents.map((item, i) => {
        const isLeaf = item.type !== 'folder'
        const isLink = item.type === 'link'
        const viewableIdx = isLeaf && !isLink ? viewableItems.indexOf(item as ViewableLeaf) : -1
        const handleClick = !isLeaf ? undefined
          : isLink ? () => { const l = item as Extract<LeafItem, { type: 'link' }>; openLink(l.url, l.label, l.ogImage) }
            : () => openContent(viewableItems, viewableIdx)
        return (
          <div
            key={item.id}
            style={{
              position: 'absolute',
              left: cx, top: cy,
              transform: visible
                ? `translate(calc(${offsets[i].x}px - 50%), calc(${offsets[i].y}px - 50%))`
                : `translate(-50%, -50%) scale(0.35)`,
              opacity: visible ? 1 : 0,
              transition: [
                `transform 0.44s cubic-bezier(0.34, 1.5, 0.64, 1) ${i * 60}ms`,
                `opacity   0.3s  ease                              ${i * 60}ms`,
              ].join(', '),
              pointerEvents: 'auto',
              cursor: isLeaf ? 'pointer' : 'default',
            }}
            onClick={handleClick}
          >
            <ItemCard item={item} />
          </div>
        )
      })}

      {/* Folder icon */}
      <div
        style={{
          position: 'relative',
          width: W, height: H,
          cursor: 'grab',
          pointerEvents: 'auto',
          filter: open
            ? 'drop-shadow(0 10px 24px rgba(0,0,0,0.35))'
            : 'drop-shadow(0 4px 10px rgba(0,0,0,0.25))',
          transition: 'filter 0.3s ease',
        }}
        onPointerDown={(e) => {
          moved.current = false
          drag.current = { ox: e.clientX - pos.x, oy: e.clientY - pos.y }
          e.currentTarget.setPointerCapture(e.pointerId)
          e.currentTarget.style.cursor = 'grabbing'
        }}
        onPointerMove={(e) => {
          if (!drag.current) return
          moved.current = true
          setPos({ x: e.clientX - drag.current.ox, y: e.clientY - drag.current.oy })
        }}
        onPointerUp={(e) => {
          drag.current = null
          e.currentTarget.style.cursor = 'grab'
        }}
        onClick={() => { if (!moved.current) toggleOpen() }}
      >
        <div style={{ position: 'absolute', inset: 0 }}><FolderBack /></div>
        <div style={{ position: 'absolute', inset: 0 }}><FolderFront open={open} /></div>
      </div>

      <div style={{ textAlign: 'center' }}>
        <span className="font-ivy-display" style={{
          color: 'white', fontSize: '1rem', fontWeight: 300,
          letterSpacing: '0.02em', textShadow: '0 1px 5px rgba(0,0,0,0.75)',
        }}>
          {label}
        </span>
      </div>
    </div>
  )
}

// ── Loose items ────────────────────────────────────────────────────────────────

const LOOSE_ITEMS: { item: ViewableLeaf; x: number; y: number }[] = [
  { item: { id: 100, type: 'article', label: 'turby.md', preview: 'A few things that keep things running smoothly for everyone.' }, x: 1200, y: 800 },
  { item: { id: 101, type: 'image', label: 'living room', color: '#b5c4b1' }, x: 450, y: 800 },
  { item: { id: 102, type: 'image', label: 'garden', color: '#c9b99a' }, x: 550, y: 800 },
  { item: { id: 103, type: 'image', label: 'kitchen', color: '#a8bfd8' }, x: 350, y: 800 },
]

function StandaloneLeaf({ item, initialX, initialY, onOpen }: {
  item: ViewableLeaf
  initialX: number
  initialY: number
  onOpen: () => void
}) {
  const [pos, setPos] = useState({ x: initialX, y: initialY })
  const drag = useRef<{ ox: number; oy: number } | null>(null)
  const moved = useRef(false)

  return (
    <div
      style={{ position: 'absolute', left: pos.x, top: pos.y, userSelect: 'none', cursor: 'grab', pointerEvents: 'auto' }}
      onPointerDown={(e) => {
        moved.current = false
        drag.current = { ox: e.clientX - pos.x, oy: e.clientY - pos.y }
        e.currentTarget.setPointerCapture(e.pointerId)
        e.currentTarget.style.cursor = 'grabbing'
      }}
      onPointerMove={(e) => {
        if (!drag.current) return
        moved.current = true
        setPos({ x: e.clientX - drag.current.ox, y: e.clientY - drag.current.oy })
      }}
      onPointerUp={(e) => {
        drag.current = null
        e.currentTarget.style.cursor = 'grab'
      }}
      onClick={() => { if (!moved.current) onOpen() }}
    >
      <ItemCard item={item} />
    </div>
  )
}

// ── Export ─────────────────────────────────────────────────────────────────────

export function Folders({ housemates, happenings }: { housemates: Housemate[]; happenings: Happening[] }) {
  const openContent = useOpenContent()
  const looseViewable = useMemo(() => LOOSE_ITEMS.map(l => l.item), [])

  const folders = useMemo(() => FOLDERS.map(f => {
    if (f.label === 'PEOPLE') {
      const hmItems: ContentItem[] = housemates.map((h, i) => ({
        id: -(i + 1),
        type: 'article' as const,
        label: h.name,
        preview: h.about,
        imageUrl: h.imageUrl,
      }))
      return { ...f, contents: [...hmItems, ...f.contents] }
    }
    if (f.label === 'HAPPENINGS') {
      const hItems: ContentItem[] = happenings.map((h, i) => ({
        id: -(i + 1),
        type: 'link' as const,
        label: h.label,
        url: h.url,
      }))
      return { ...f, contents: [...hItems, ...f.contents] }
    }
    return f
  }), [housemates, happenings])

  return (
    <>
      {folders.map((f, i) => (
        <Folder
          key={f.id}
          label={f.label}
          contents={f.contents}
          initialX={INITIAL_POSITIONS[i].x}
          initialY={INITIAL_POSITIONS[i].y}
        />
      ))}
      {LOOSE_ITEMS.map(({ item, x, y }) => (
        <StandaloneLeaf
          key={item.id}
          item={item}
          initialX={x}
          initialY={y}
          onOpen={() => openContent(looseViewable, looseViewable.indexOf(item))}
        />
      ))}
    </>
  )
}
