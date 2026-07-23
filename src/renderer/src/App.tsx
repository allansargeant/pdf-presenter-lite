import { useEffect, useRef, useState } from 'react'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import { loadPdf } from './pdf'
import type { ScreenBlank } from '../../shared/output'
import NowNext from './components/NowNext'
import Thumbnail from './components/Thumbnail'
import OutputControl from './components/OutputControl'
import Transport from './components/Transport'
import OscControl from './components/OscControl'
import { handleOscAction, allFeedback } from './osc/oscpoint'
import type { OscSnapshot } from './osc/oscpoint'

function App(): React.JSX.Element {
  const [fileName, setFileName] = useState<string | null>(null)
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null)
  const [pdfData, setPdfData] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(0)
  const [outputOpen, setOutputOpen] = useState(false)
  const [screenBlank, setScreenBlank] = useState<ScreenBlank>('none')
  const [hideCursor, setHideCursor] = useState(false)
  const [oscRunning, setOscRunning] = useState(false)
  const [oscActionsEnabled, setOscActionsEnabled] = useState(true)
  const [oscFeedbacksEnabled, setOscFeedbacksEnabled] = useState(true)
  const [filesEnabled, setFilesEnabled] = useState(false)
  const [filesFolderRelative, setFilesFolderRelative] = useState<string | null>(null)
  const [filesFolderFullPath, setFilesFolderFullPath] = useState<string | null>(null)
  const oscSnapshotRef = useRef<OscSnapshot>({
    currentPage: 1,
    totalPages: 0,
    fileName: null,
    screenBlank: 'none',
    outputOpen: false,
    actionsEnabled: true,
    feedbacksEnabled: true,
    filesEnabled: false,
    filesFolderRelative: null,
    filesFolderFullPath: null
  })

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
    window.api.osc.isRunning().then(setOscRunning)
    return window.api.osc.onStatusChanged(setOscRunning)
  }, [])

  useEffect(() => {
    window.api.files.getConfig().then((config) => {
      setFilesEnabled(config.enabled)
      setFilesFolderRelative(config.relativeToHome)
      setFilesFolderFullPath(config.folderPath)
    })
  }, [])

  // Keeps a ref-mirrored snapshot of everything the OSC action dispatcher
  // and feedback builders need, and reactively resends feedback whenever
  // any of it changes.
  useEffect(() => {
    const snapshot: OscSnapshot = {
      currentPage,
      totalPages,
      fileName,
      screenBlank,
      outputOpen,
      actionsEnabled: oscActionsEnabled,
      feedbacksEnabled: oscFeedbacksEnabled,
      filesEnabled,
      filesFolderRelative,
      filesFolderFullPath
    }
    oscSnapshotRef.current = snapshot
    if (oscRunning && oscFeedbacksEnabled) {
      allFeedback(snapshot).forEach((m) => window.api.osc.send(m.address, m.args))
    }
  }, [
    currentPage,
    totalPages,
    fileName,
    screenBlank,
    outputOpen,
    oscActionsEnabled,
    oscFeedbacksEnabled,
    filesEnabled,
    filesFolderRelative,
    filesFolderFullPath,
    oscRunning
  ])

  const applyPdfResult = async (result: { filePath: string; data: string }): Promise<void> => {
    const loaded = await loadPdf(result.data)
    setFileName(result.filePath.split('/').pop() ?? result.filePath)
    setPdfData(result.data)
    setDoc(loaded)
    setTotalPages(loaded.numPages)
    setCurrentPage(1)
  }

  useEffect(() => {
    return window.api.osc.onAction((action) => {
      handleOscAction(action, oscSnapshotRef.current, {
        goToPage: (page) => setCurrentPage(page),
        nextPage: () => setCurrentPage((p) => Math.min(p + 1, totalPagesRef.current || p)),
        previousPage: () => setCurrentPage((p) => Math.max(p - 1, 1)),
        setScreenBlank: (next) => setScreenBlank(next),
        openOutput: () => window.api.output.open(),
        closeOutput: () => window.api.output.close(),
        setActionsEnabled: setOscActionsEnabled,
        setFeedbacksEnabled: setOscFeedbacksEnabled,
        refreshFeedback: () => {
          allFeedback(oscSnapshotRef.current).forEach((m) => window.api.osc.send(m.address, m.args))
        },
        setFilesPath: (relativeToHome) => {
          window.api.files.setFolderRelative(relativeToHome).then((config) => {
            setFilesFolderRelative(config.relativeToHome)
            setFilesFolderFullPath(config.folderPath)
          })
        },
        requestFilesList: () => {
          window.api.files.list().then((files) => {
            window.api.osc.send('/oscpoint/v2/files', [
              { type: 'string', value: JSON.stringify(files) }
            ])
          })
        },
        openFileByName: (filename) => {
          window.api.files.open(filename).then((result) => {
            if (result) applyPdfResult(result)
          })
        }
      })
    })
  }, [])

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
    await applyPdfResult(result)
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
          <OscControl
            filesEnabled={filesEnabled}
            filesFolderFullPath={filesFolderFullPath}
            onFilesEnabledChange={(enabled) => {
              setFilesEnabled(enabled)
              window.api.files.setEnabled(enabled)
            }}
            onChooseFilesFolder={() => {
              window.api.files.chooseFolder().then((config) => {
                setFilesFolderRelative(config.relativeToHome)
                setFilesFolderFullPath(config.folderPath)
              })
            }}
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
