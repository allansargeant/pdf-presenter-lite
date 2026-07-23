export interface FileControlConfig {
  /** Absolute path — resolved once, whether set via the native folder
   * picker (already absolute) or an OSC setpath command (relative to
   * home). null until first configured. */
  folderPath: string | null
  /** folderPath expressed relative to the user's home directory, matching
   * /pdfpresenter/files/activefolder's documented shape — computed
   * main-side (path/os modules aren't available in the renderer). */
  relativeToHome: string | null
  /** Gates every OSC-driven file action (setpath/list/open) — off by
   * default, since this lets an unauthenticated UDP sender read files off
   * disk. */
  enabled: boolean
}
