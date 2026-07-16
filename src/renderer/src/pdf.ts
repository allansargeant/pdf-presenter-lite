import * as pdfjsLib from 'pdfjs-dist'
import PdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?worker'
import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist'

pdfjsLib.GlobalWorkerOptions.workerPort = new PdfWorker()

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

export function loadPdf(base64: string): Promise<PDFDocumentProxy> {
  return pdfjsLib.getDocument({ data: base64ToUint8Array(base64) }).promise
}

const activeRenders = new WeakMap<HTMLCanvasElement, RenderTask>()
const renderQueues = new WeakMap<HTMLCanvasElement, Promise<void>>()
const renderGenerations = new WeakMap<HTMLCanvasElement, number>()

// Callers (SlideViewer's Now/Next canvases, ProgramOut) kick off renders from React
// effects without awaiting the previous call, so two renderAtScale calls for the same
// canvas can be in flight at once. Serialize per canvas and drop any queued call that's
// been superseded by a newer one before it ever touches the canvas — otherwise an
// in-flight pdf.js render can still be mutating the 2D context (mid save/restore) when
// the next one starts resizing the canvas out from under it, which has been observed to
// leave the context transform corrupted (manifesting as a rotated frame).
async function renderAtScale(
  doc: PDFDocumentProxy,
  pageNumber: number,
  canvas: HTMLCanvasElement,
  scale: number
): Promise<void> {
  activeRenders.get(canvas)?.cancel()

  const myGeneration = (renderGenerations.get(canvas) ?? 0) + 1
  renderGenerations.set(canvas, myGeneration)

  const previous = renderQueues.get(canvas) ?? Promise.resolve()
  const current = previous
    .catch(() => {})
    .then(() => {
      if (renderGenerations.get(canvas) !== myGeneration) return
      return renderAtScaleNow(doc, pageNumber, canvas, scale)
    })
  renderQueues.set(canvas, current)
  return current
}

async function renderAtScaleNow(
  doc: PDFDocumentProxy,
  pageNumber: number,
  canvas: HTMLCanvasElement,
  scale: number
): Promise<void> {
  const page = await doc.getPage(pageNumber)
  const viewport = page.getViewport({ scale })

  canvas.width = viewport.width
  canvas.height = viewport.height
  const context = canvas.getContext('2d')
  if (!context) return
  // Chromium's canvas.width/height setters are documented to implicitly reset the 2D
  // context transform, but some versions skip that reset when the new size numerically
  // matches the current size — leaving pdf.js's previous transform in place and
  // compounding with the next render's PDF-to-canvas flip into a 180° rotation.
  context.resetTransform()

  const task = page.render({ canvasContext: context, viewport })
  activeRenders.set(canvas, task)
  try {
    await task.promise
  } catch (err) {
    if (err instanceof Error && err.name === 'RenderingCancelledException') return
    throw err
  } finally {
    if (activeRenders.get(canvas) === task) activeRenders.delete(canvas)
  }
}

export async function renderPageToCanvas(
  doc: PDFDocumentProxy,
  pageNumber: number,
  canvas: HTMLCanvasElement,
  targetWidth: number
): Promise<void> {
  const page = await doc.getPage(pageNumber)
  const unscaledViewport = page.getViewport({ scale: 1 })
  await renderAtScale(doc, pageNumber, canvas, targetWidth / unscaledViewport.width)
}

/** Scales to fit entirely within maxWidth x maxHeight, preserving aspect ratio. */
export async function renderPageContain(
  doc: PDFDocumentProxy,
  pageNumber: number,
  canvas: HTMLCanvasElement,
  maxWidth: number,
  maxHeight: number
): Promise<void> {
  const page = await doc.getPage(pageNumber)
  const unscaledViewport = page.getViewport({ scale: 1 })
  const scale = Math.min(maxWidth / unscaledViewport.width, maxHeight / unscaledViewport.height)
  await renderAtScale(doc, pageNumber, canvas, scale)
}
