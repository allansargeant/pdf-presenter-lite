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
}
