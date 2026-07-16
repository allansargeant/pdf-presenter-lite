import { useEffect, useRef, useState } from 'react'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import { loadPdf } from './pdf'
import NowNext from './components/NowNext'
import Thumbnail from './components/Thumbnail'
import OutputControl from './components/OutputControl'

function App(): React.JSX.Element {
  const [fileName, setFileName] = useState<string | null>(null)
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null)
  const [pdfData, setPdfData] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(0)
  const [outputOpen, setOutputOpen] = useState(false)

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
    window.api.output.pushState({ data: pdfData, currentPage })
  }, [outputOpen, pdfData, currentPage])

  useEffect(() => {
    const handleKey = (e: KeyboardEvent): void => {
      if (e.key === 'ArrowRight' || e.key === ' ') {
        setCurrentPage((p) => Math.min(p + 1, totalPagesRef.current || p))
      }
      if (e.key === 'ArrowLeft') setCurrentPage((p) => Math.max(p - 1, 1))
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
          <OutputControl disabled={!doc} />
          <button className="transport-btn" onClick={openPdf}>
            {fileName ? 'Open Different PDF…' : 'Open PDF…'}
          </button>
        </div>
      </div>

      {doc ? (
        <>
          <NowNext doc={doc} currentPage={currentPage} totalPages={totalPages} />
          <div className="page-indicator">
            {currentPage} / {totalPages}
          </div>
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
