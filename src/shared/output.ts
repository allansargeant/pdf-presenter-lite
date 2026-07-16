/** What the fullscreen Output window should currently show. */
export interface OutputState {
  /** Base64-encoded PDF bytes, or null if nothing is loaded yet. */
  data: string | null
  currentPage: number
}
