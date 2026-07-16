import { useEffect, useRef } from 'react'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import { renderPageContain } from '../pdf'

function SlideSlot({
  doc,
  pageNumber,
  label
}: {
  doc: PDFDocumentProxy | null
  pageNumber: number | null
  label: string
}): React.JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

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

  return (
    <div className="slide-slot">
      <div className="slide-slot-label">{label}</div>
      <div className="slide-slot-canvas" ref={containerRef}>
        {pageNumber ? <canvas ref={canvasRef} /> : <div className="slide-slot-empty">—</div>}
      </div>
    </div>
  )
}

interface NowNextProps {
  doc: PDFDocumentProxy | null
  currentPage: number
  totalPages: number
}

function NowNext({ doc, currentPage, totalPages }: NowNextProps): React.JSX.Element {
  const nextPage = currentPage < totalPages ? currentPage + 1 : null

  return (
    <div className="now-next">
      <SlideSlot doc={doc} pageNumber={doc ? currentPage : null} label="Now" />
      <SlideSlot doc={doc} pageNumber={doc ? nextPage : null} label="Next" />
    </div>
  )
}

export default NowNext
