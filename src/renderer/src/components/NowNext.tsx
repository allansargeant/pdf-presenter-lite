import { useEffect, useRef, useState } from 'react'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import { renderPageContain, getPageLinks } from '../pdf'
import type { PageLink } from '../pdf'

const LASER_POINTER_THROTTLE_MS = 33 // ~30fps — plenty smooth for a UDP/IPC-forwarded dot

function SlideSlot({
  doc,
  pageNumber,
  label,
  onNavigate,
  onAdvance,
  onPointerPosition
}: {
  doc: PDFDocumentProxy | null
  pageNumber: number | null
  label: string
  /** Only passed for the slot the presenter actually navigates from ("Now")
   * — when present, internal PDF links become clickable jump-to-page
   * shortcuts. Omitted for "Next", which is just a preview. */
  onNavigate?: (page: number) => void
  /** Only passed for "Next" — clicking anywhere on the preview advances to
   * it, since it's always exactly one page ahead of "Now". */
  onAdvance?: () => void
  /** Only passed for "Now", and only while the laser pointer is enabled —
   * mirrors the presenter's mouse position over this slide onto the Output
   * window. Position is normalized (0-100) against the frame's own box,
   * same convention as the link overlay above, so it lines up regardless
   * of how large this preview currently renders. null on pointer leave. */
  onPointerPosition?: (pos: { xPct: number; yPct: number } | null) => void
}): React.JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [aspectRatio, setAspectRatio] = useState<number | null>(null)
  const [links, setLinks] = useState<PageLink[]>([])
  const lastPointerSendRef = useRef(0)

  const handlePointerMove = onPointerPosition
    ? (e: React.MouseEvent<HTMLDivElement>): void => {
        const now = performance.now()
        if (now - lastPointerSendRef.current < LASER_POINTER_THROTTLE_MS) return
        lastPointerSendRef.current = now
        const rect = e.currentTarget.getBoundingClientRect()
        onPointerPosition({
          xPct: ((e.clientX - rect.left) / rect.width) * 100,
          yPct: ((e.clientY - rect.top) / rect.height) * 100
        })
      }
    : undefined
  const handlePointerLeave = onPointerPosition ? () => onPointerPosition(null) : undefined

  useEffect(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!doc || !pageNumber || !canvas || !container) return
    const maxWidth = container.clientWidth || 640
    const maxHeight = container.clientHeight || 360
    renderPageContain(doc, pageNumber, canvas, maxWidth, maxHeight).catch((err) =>
      console.error('Failed to render slide', err)
    )
  }, [doc, pageNumber])

  // Percentages from getPageLinks line up with the canvas regardless of its
  // current render size, but only if the overlay sits over an element with
  // the exact same aspect ratio as the page — the surrounding
  // .slide-slot-canvas box can be a different ratio (it's just whatever
  // space is available), so a same-ratio .slide-slot-frame wrapper is what
  // the percentages are actually relative to.
  useEffect(() => {
    // Nothing to reset here on the null branch — the JSX below already only
    // renders the frame/overlay when pageNumber is truthy, so stale
    // aspectRatio/links from a previous page just go unused.
    if (!doc || !pageNumber) return
    let cancelled = false
    getPageLinks(doc, pageNumber).then((result) => {
      if (cancelled) return
      setAspectRatio(result.aspectRatio)
      setLinks(result.links)
    })
    return () => {
      cancelled = true
    }
  }, [doc, pageNumber])

  return (
    <div className="slide-slot">
      <div className="slide-slot-label">{label}</div>
      <div
        className={`slide-slot-canvas${onAdvance ? ' slide-slot-canvas--clickable' : ''}`}
        ref={containerRef}
        onClick={onAdvance}
        title={onAdvance ? 'Go to this slide' : undefined}
      >
        {pageNumber ? (
          <div
            className="slide-slot-frame"
            style={aspectRatio ? { aspectRatio: `${aspectRatio}` } : undefined}
            onMouseMove={handlePointerMove}
            onMouseLeave={handlePointerLeave}
          >
            <canvas ref={canvasRef} />
            {onNavigate &&
              links.map((link, i) => (
                <button
                  key={i}
                  className="slide-link"
                  style={{
                    left: `${link.xPct}%`,
                    top: `${link.yPct}%`,
                    width: `${link.widthPct}%`,
                    height: `${link.heightPct}%`
                  }}
                  title={`Go to slide ${link.targetPage}`}
                  onClick={() => onNavigate(link.targetPage)}
                />
              ))}
          </div>
        ) : (
          <div className="slide-slot-empty">—</div>
        )}
      </div>
    </div>
  )
}

interface NowNextProps {
  doc: PDFDocumentProxy | null
  currentPage: number
  totalPages: number
  onNavigate: (page: number) => void
  /** Only meaningful while the laser pointer is enabled — see SlideSlot's
   * onPointerPosition doc comment. Omitted (not just false) when the
   * feature is off, so no mouse-tracking overhead exists at all. */
  onPointerPosition?: (pos: { xPct: number; yPct: number } | null) => void
}

function NowNext({
  doc,
  currentPage,
  totalPages,
  onNavigate,
  onPointerPosition
}: NowNextProps): React.JSX.Element {
  const nextPage = currentPage < totalPages ? currentPage + 1 : null

  return (
    <div className="now-next">
      <SlideSlot
        doc={doc}
        pageNumber={doc ? currentPage : null}
        onPointerPosition={onPointerPosition}
        label="Now"
        onNavigate={onNavigate}
      />
      <SlideSlot
        doc={doc}
        pageNumber={doc ? nextPage : null}
        label="Next"
        onAdvance={nextPage ? () => onNavigate(nextPage) : undefined}
      />
    </div>
  )
}

export default NowNext
