import { useEffect, useRef, useState } from 'react'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import { loadPdf } from './pdf'
import type { ScreenBlank } from '../../shared/output'
import NowNext from './components/NowNext'
import Thumbnail from './components/Thumbnail'
import OutputControl from './components/OutputControl'
import Transport from './components/Transport'

function App(): React.JSX.Element {
  const [fileName, setFileName] = useState<string | null>(null)
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null)
  const [pdfData, setPdfData] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(0)
  const [outputOpen, setOutputOpen] = useState(false)
  const [screenBlank, setScreenBlank] = useState<ScreenBlank>('none')
  const [hideCursor, setHideCursor] = useState(false)

  const totalPagesRef = useRef(0)
  useEffect(() => {
    totalPagesRef.current = totalPages
  }, [totalPages])

  useEffect(() => {
    return window.api.output.onOpenChanged(setOutputOpen)
  }, [])

  // Keep the fullscreen Output window in sync with whatever the presenter is
  // currently looking at, whenever it's open.
  useEffect(() => {
    if (!outputOpen || !pdfData) return
    window.api.output.pushState({ data: pdfData, currentPage, screenBlank, hideCursor })
  }, [outputOpen, pdfData, currentPage, screenBlank, hideCursor])

  useEffect(() => {
    const handleKey = (e: KeyboardEvent): void => {
      const target = e.target as HTMLElement | null
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return
      if (
        e.key === 'ArrowRight' ||
        e.key === ' ' ||
        e.key === 'ArrowDown' ||
        e.key === 'PageDown'
      ) {
        e.preventDefault()
        setCurrentPage((p) => Math.min(p + 1, totalPagesRef.current || p))
      }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp' || e.key === 'PageUp') {
        e.preventDefault()
        setCurrentPage((p) => Math.max(p - 1, 1))
      }
      if (e.key === 'b' || e.key === 'B') {
        setScreenBlank((b) => (b === 'black' ? 'none' : 'black'))
      }
      if (e.key === 'w' || e.key === 'W') {
        setScreenBlank((b) => (b === 'white' ? 'none' : 'white'))
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [])

  const openPdf = async (): Promise<void> => {
    const result = await window.api.pdf.open()
    if (!result) return
    const loaded = await loadPdf(result.data)
    setFileName(result.filePath.split('/').pop() ?? result.filePath)
    setPdfData(result.data)
    setDoc(loaded)
    setTotalPages(loaded.numPages)
    setCurrentPage(1)
  }

  return (
    <div className="app-shell">
      <div className="app-titlebar">
        <span>{fileName ?? 'PDF Presenter Lite'}</span>
        <div className="titlebar-actions">
          <OutputControl
            disabled={!doc}
            hideCursor={hideCursor}
            onHideCursorChange={setHideCursor}
          />
          <button className="transport-btn" onClick={openPdf}>
            {fileName ? 'Open Different PDF…' : 'Open PDF…'}
          </button>
        </div>
      </div>

      {doc ? (
        <>
          <NowNext
            doc={doc}
            currentPage={currentPage}
            totalPages={totalPages}
            onNavigate={setCurrentPage}
          />
          <Transport
            currentPage={currentPage}
            totalPages={totalPages}
            onPrev={() => setCurrentPage((p) => Math.max(p - 1, 1))}
            onNext={() => setCurrentPage((p) => Math.min(p + 1, totalPagesRef.current || p))}
          />
          <div className="thumbnail-strip">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
              <Thumbnail
                key={page}
                doc={doc}
                page={page}
                active={page === currentPage}
                onSelect={setCurrentPage}
              />
            ))}
          </div>
        </>
      ) : (
        <div className="empty-state">Open a PDF to start presenting.</div>
      )}
    </div>
  )
}

export default App
