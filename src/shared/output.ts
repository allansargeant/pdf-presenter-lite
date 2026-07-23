/** Blanks the Output window to a solid color instead of the current slide —
 * matches PowerPoint's "B"/"W" presenter shortcuts, for hiding content
 * without losing your place. */
export type ScreenBlank = 'none' | 'black' | 'white'

/** What the fullscreen Output window should currently show. */
export interface OutputState {
  /** Base64-encoded PDF bytes, or null if nothing is loaded yet. */
  data: string | null
  currentPage: number
  screenBlank: ScreenBlank
  /** Hides the OS mouse cursor while it's over the Output window — there's
   * never a legitimate reason to see one on the audience-facing display. */
  hideCursor: boolean
  /** Toggled by /pdfpresenter/slideshow/laserpointer — whether the Output window
   * should render the laser-pointer overlay dot at all. Actual pointer
   * position is pushed separately (see LaserPosition below), since it
   * updates far more often than the rest of this state. */
  laserPointerEnabled: boolean
}

/** Normalized (0-100) position over the current slide's own box — lines up
 * with the rendered page regardless of how large the Output window's
 * canvas currently is. null means "not currently pointing at anything"
 * (the presenter's mouse isn't over the Now preview). */
export interface LaserPosition {
  xPct: number
  yPct: number
}
