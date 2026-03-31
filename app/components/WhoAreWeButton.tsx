'use client'

export function WhoAreWeButton() {
  return (
    <button
      style={{ all: 'unset', cursor: 'pointer', pointerEvents: 'auto' }}
      onClick={() => window.dispatchEvent(new CustomEvent('open-people-folder'))}
    >
      Who are we?
    </button>
  )
}
