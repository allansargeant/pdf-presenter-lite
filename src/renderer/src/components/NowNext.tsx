import { useEffect, useRef, useState } from 'react'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import { renderPageContain, getPageLinks } from '../pdf'
import type { PageLink } from '../pdf'

function SlideSlot({
  doc,
  pageNumber,
  label,
  onNavigate,
  onAdvance
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
}): React.JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [aspectRatio, setAspectRatio] = useState<number | null>(null)
  const [links, setLinks] = useState<PageLink[]>([])

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
}

function NowNext({ doc, currentPage, totalPages, onNavigate }: NowNextProps): React.JSX.Element {
  const nextPage = currentPage < totalPages ? currentPage + 1 : null

  return (
    <div className="now-next">
      <SlideSlot
        doc={doc}
        pageNumber={doc ? currentPage : null}
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
