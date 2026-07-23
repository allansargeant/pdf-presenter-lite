import { useEffect, useRef, useState } from 'react'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import type { OutputState, LaserPosition } from '../../shared/output'
import { loadPdf, renderPageContain } from './pdf'

function Output(): React.JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null)
  const [state, setState] = useState<OutputState | null>(null)
  const [laserPosition, setLaserPosition] = useState<LaserPosition | null>(null)
  const lastDataRef = useRef<string | null>(null)

  useEffect(() => {
    const applyState = (next: OutputState): void => {
      setState(next)
      if (next.data && next.data !== lastDataRef.current) {
        lastDataRef.current = next.data
        loadPdf(next.data).then(setDoc)
      }
    }
    // Pull whatever the presenter last pushed before this window's own
    // listener existed to register — a push sent while this window was
    // still loading is otherwise silently dropped (confirmed live).
    window.api.output.getState().then((current) => {
      if (current) applyState(current)
    })
    return window.api.output.onState(applyState)
  }, [])

  useEffect(() => {
    return window.api.output.onLaserPosition(setLaserPosition)
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!doc || !canvas || !state || state.screenBlank !== 'none') return
    renderPageContain(doc, state.currentPage, canvas, window.innerWidth, window.innerHeight).catch(
      (err) => console.error('Failed to render output page', err)
    )
  }, [doc, state])

  const blank = state?.screenBlank ?? 'none'
  const showLaser = state?.laserPointerEnabled && blank === 'none' && laserPosition

  return (
    <div
      className={`output-shell${state?.hideCursor ? ' output-shell--no-cursor' : ''}`}
      style={
        blank === 'black'
          ? { background: '#000' }
          : blank === 'white'
            ? { background: '#fff' }
            : undefined
      }
    >
      {blank === 'none' &&
        (doc && state ? (
          <div className="output-canvas-frame">
            <canvas ref={canvasRef} />
            {showLaser && (
              <div
                className="laser-dot"
                style={{ left: `${laserPosition.xPct}%`, top: `${laserPosition.yPct}%` }}
              />
            )}
          </div>
        ) : (
          <div className="output-empty">No signal</div>
        ))}
    </div>
  )
}

export default Output
