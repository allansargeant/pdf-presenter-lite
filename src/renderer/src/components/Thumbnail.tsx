import { useEffect, useRef, useState } from 'react'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import { renderPageToCanvas } from '../pdf'

const THUMBNAIL_WIDTH = 140

interface ThumbnailProps {
  doc: PDFDocumentProxy
  page: number
  active: boolean
  onSelect: (page: number) => void
}

/** Renders lazily (only once scrolled into view) so a large deck doesn't
 * kick off a hundred pdf.js renders the moment it opens. */
function Thumbnail({ doc, page, active, onSelect }: ThumbnailProps): React.JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wrapperRef = useRef<HTMLButtonElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = wrapperRef.current
    if (!el || visible) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) setVisible(true)
      },
      { root: el.closest('.thumbnail-strip'), rootMargin: '200px' }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [visible])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!visible || !canvas) return
    renderPageToCanvas(doc, page, canvas, THUMBNAIL_WIDTH).catch((err) =>
      console.error('Failed to render thumbnail', err)
    )
  }, [doc, page, visible])

  return (
    <button
      ref={wrapperRef}
      className={`thumbnail${active ? ' thumbnail-active' : ''}`}
      onClick={() => onSelect(page)}
      title={`Slide ${page}`}
    >
      <div className="thumbnail-frame">
        {visible ? <canvas ref={canvasRef} /> : <div className="thumbnail-placeholder" />}
      </div>
      <span className="thumbnail-number">{page}</span>
    </button>
  )
}

export default Thumbnail
