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

export interface PageLink {
  /** Position/size as a percentage of the page's own box — scale-invariant,
   * so these line up with the rendered canvas regardless of how large it's
   * currently displayed. */
  xPct: number
  yPct: number
  widthPct: number
  heightPct: number
  /** 1-indexed, matching the rest of this app's page numbering. */
  targetPage: number
}

export interface PageLinksResult {
  /** Page width / height, for sizing a same-aspect-ratio overlay container. */
  aspectRatio: number
  links: PageLink[]
}

/**
 * Internal "jump to page" links authored into the PDF (e.g. a table of
 * contents, or "back to agenda" links exported from PowerPoint/Keynote/Google
 * Slides). Only resolves links that point at another page in this same
 * document — external URLs and other action types are skipped. Rects come
 * back through the page's own viewport at scale 1, so `xPct`/`yPct`/etc. are
 * plain percentages of the page box, independent of render scale or page
 * rotation (`convertToViewportRectangle` accounts for rotation).
 */
export async function getPageLinks(
  doc: PDFDocumentProxy,
  pageNumber: number
): Promise<PageLinksResult> {
  const page = await doc.getPage(pageNumber)
  const viewport = page.getViewport({ scale: 1 })
  const annotations = await page.getAnnotations({ intent: 'display' })

  const links: PageLink[] = []
  for (const annotation of annotations) {
    if (annotation.subtype !== 'Link' || !annotation.dest) continue
    try {
      const destArray =
        typeof annotation.dest === 'string'
          ? await doc.getDestination(annotation.dest)
          : annotation.dest
      if (!Array.isArray(destArray) || !destArray[0]) continue

      const targetPage = (await doc.getPageIndex(destArray[0])) + 1
      const [vx1, vy1, vx2, vy2] = viewport.convertToViewportRectangle(annotation.rect)
      const x = Math.min(vx1, vx2)
      const y = Math.min(vy1, vy2)

      links.push({
        xPct: (x / viewport.width) * 100,
        yPct: (y / viewport.height) * 100,
        widthPct: (Math.abs(vx2 - vx1) / viewport.width) * 100,
        heightPct: (Math.abs(vy2 - vy1) / viewport.height) * 100,
        targetPage
      })
    } catch {
      // Malformed or unsupported destination (e.g. an embedded-file target)
      // — skip this link rather than failing the whole page.
    }
  }

  return { aspectRatio: viewport.width / viewport.height, links }
}

export interface PdfSection {
  name: string
  firstSlide: number
  lastSlide: number
  slideCount: number
}

/**
 * Maps a PDF's top-level outline (bookmarks/table of contents) onto
 * OSCPoint's "section" concept — the closest analogue a PDF has, since
 * PDFs have no native section feature of their own. Only the top level is
 * used (nested sub-bookmarks would make "which section is slide N in"
 * ambiguous); entries with an unresolvable destination are skipped rather
 * than failing the whole list.
 */
export async function getSections(doc: PDFDocumentProxy): Promise<PdfSection[]> {
  const outline = await doc.getOutline()
  if (!outline || outline.length === 0) return []

  const resolved: { name: string; page: number }[] = []
  for (const item of outline) {
    if (!item.dest) continue
    try {
      const destArray =
        typeof item.dest === 'string' ? await doc.getDestination(item.dest) : item.dest
      if (!Array.isArray(destArray) || !destArray[0]) continue
      const page = (await doc.getPageIndex(destArray[0])) + 1
      resolved.push({ name: item.title, page })
    } catch {
      // Malformed or unsupported destination — skip this entry.
    }
  }
  if (resolved.length === 0) return []

  const totalPages = doc.numPages
  return resolved.map((entry, i) => {
    const lastSlide = i + 1 < resolved.length ? resolved[i + 1].page - 1 : totalPages
    return {
      name: entry.name,
      firstSlide: entry.page,
      lastSlide: Math.max(lastSlide, entry.page),
      slideCount: Math.max(lastSlide, entry.page) - entry.page + 1
    }
  })
}
