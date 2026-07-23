import type { OscArg, OscAction } from '../../../shared/osc'
import type { ScreenBlank } from '../../../shared/output'

export interface OscMessage {
  address: string
  args: OscArg[]
}

/** Everything the dispatcher/feedback-builders need to know about current
 * app state — a plain snapshot, not a live subscription, so callers can
 * read it from a ref without worrying about stale closures. pdf-presenter-lite
 * has no notes concept by design, unlike presentation-commander-client. */
export interface OscSnapshot {
  currentPage: number
  totalPages: number
  fileName: string | null
  screenBlank: ScreenBlank
  outputOpen: boolean
  actionsEnabled: boolean
  feedbacksEnabled: boolean
}

export interface OscHandlers {
  goToPage(page: number): void
  nextPage(): void
  previousPage(): void
  setScreenBlank(next: ScreenBlank): void
  openOutput(): void
  closeOutput(): void
  setActionsEnabled(enabled: boolean): void
  setFeedbacksEnabled(enabled: boolean): void
  /** Resend the full current feedback state right now — used both for the
   * explicit /oscpoint/feedbacks/refresh action and the "also triggers a
   * refresh" behavior /oscpoint/feedbacks/enable documents. Always sends,
   * regardless of the feedbacksEnabled flag, since it's an explicit,
   * deliberate request. */
  refreshFeedback(): void
}

function argInt(value: number): OscArg {
  return { type: 'integer', value }
}

function argStr(value: string): OscArg {
  return { type: 'string', value }
}

function argToNumber(arg: OscArg | undefined): number | undefined {
  if (!arg || Array.isArray((arg as { value?: unknown }).value)) return undefined
  if (arg.type === 'integer' || arg.type === 'float' || arg.type === 'double') return arg.value
  if (arg.type === 'bigint') return Number(arg.value)
  return undefined
}

function argToBoolean(arg: OscArg | undefined): boolean | undefined {
  const n = argToNumber(arg)
  if (n !== undefined) return n !== 0
  if (arg?.type === 'true') return true
  if (arg?.type === 'false') return false
  return undefined
}

function clampPage(page: number, totalPages: number): number {
  return Math.min(Math.max(Math.round(page), 1), Math.max(totalPages, 1))
}

function resolveBlankToggle(
  arg: OscArg | undefined,
  color: 'black' | 'white',
  current: ScreenBlank
): ScreenBlank {
  const on = argToBoolean(arg)
  if (on === undefined) return current === color ? 'none' : color
  return on ? color : 'none'
}

/** Builds the /oscpoint/v2/presentation + presentation/* feedback messages. */
export function presentationFeedback(s: OscSnapshot): OscMessage[] {
  const presentationJson = JSON.stringify({
    name: s.fileName ?? '',
    path: '',
    slideCount: s.totalPages,
    saved: true,
    active: s.totalPages > 0,
    slideshow: s.outputOpen,
    sections: null
  })
  return [
    { address: '/oscpoint/v2/presentation', args: [argStr(presentationJson)] },
    { address: '/oscpoint/presentation/name', args: [argStr(s.fileName ?? '')] },
    { address: '/oscpoint/presentation/slides/count', args: [argInt(s.totalPages)] },
    { address: '/oscpoint/presentation/slides/count/visible', args: [argInt(s.totalPages)] },
    { address: '/oscpoint/slideshow/state', args: [argStr(s.outputOpen ? 'running' : 'edit')] }
  ]
}

/** Builds the slideshow/currentslide + slidesremaining feedback messages —
 * only meaningful once a PDF is loaded. */
export function slideFeedback(s: OscSnapshot): OscMessage[] {
  if (s.totalPages === 0) return []
  return [
    { address: '/oscpoint/slideshow/currentslide', args: [argInt(s.currentPage)] },
    {
      address: '/oscpoint/slideshow/slidesremaining',
      args: [argInt(Math.max(s.totalPages - s.currentPage, 0))]
    }
  ]
}

export function allFeedback(s: OscSnapshot): OscMessage[] {
  return [...presentationFeedback(s), ...slideFeedback(s)]
}

/**
 * Dispatches one inbound OSC message to the app. Addresses this app can't
 * fulfill (notes — pdf-presenter-lite has none by design; sections, media,
 * wallpaper, laser pointer, auto-advance — see the OSCPoint plan's phased
 * roadmap) fall through the switch's default case and are silently
 * ignored, exactly like OSCPoint itself ignores malformed/unknown
 * messages — not an error, just a no-op.
 */
export function handleOscAction(
  action: OscAction,
  snapshot: OscSnapshot,
  handlers: OscHandlers
): void {
  const { address, args } = action

  // Per OSCPoint's own documented behavior: every message except this one
  // is ignored while actions are disabled.
  if (address === '/oscpoint/actions/enable') {
    handlers.setActionsEnabled(true)
    return
  }
  if (!snapshot.actionsEnabled) return

  switch (address) {
    case '/oscpoint/actions/disable':
      handlers.setActionsEnabled(false)
      return
    case '/oscpoint/feedbacks/enable':
      handlers.setFeedbacksEnabled(true)
      handlers.refreshFeedback()
      return
    case '/oscpoint/feedbacks/disable':
      handlers.setFeedbacksEnabled(false)
      return
    case '/oscpoint/feedbacks/refresh':
      handlers.refreshFeedback()
      return
    case '/oscpoint/next':
      handlers.nextPage()
      return
    case '/oscpoint/previous':
      handlers.previousPage()
      return
    case '/oscpoint/goto/slide/first':
      handlers.goToPage(1)
      return
    case '/oscpoint/goto/slide/last':
      handlers.goToPage(snapshot.totalPages)
      return
    case '/oscpoint/goto/slide': {
      const n = argToNumber(args[0])
      if (n === undefined) return
      handlers.goToPage(clampPage(n, snapshot.totalPages))
      return
    }
    case '/oscpoint/slideshow/start': {
      handlers.openOutput()
      const n = argToNumber(args[0])
      handlers.goToPage(n !== undefined ? clampPage(n, snapshot.totalPages) : 1)
      return
    }
    case '/oscpoint/slideshow/start/current':
      handlers.openOutput()
      return
    case '/oscpoint/slideshow/end':
      handlers.closeOutput()
      return
    case '/oscpoint/slideshow/black':
      handlers.setScreenBlank(resolveBlankToggle(args[0], 'black', snapshot.screenBlank))
      return
    case '/oscpoint/slideshow/white':
      handlers.setScreenBlank(resolveBlankToggle(args[0], 'white', snapshot.screenBlank))
      return
    default:
      return
  }
}
