import { writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { execFile } from 'child_process'
import { promisify } from 'util'

const execFileAsync = promisify(execFile)

function encodePowerShellCommand(script: string): string {
  return Buffer.from(script, 'utf16le').toString('base64')
}

/**
 * Sets `pngBuffer` as the desktop wallpaper on every connected monitor.
 * Source-agnostic — the caller already rendered whatever's currently on
 * screen (PDF page, Keynote/PowerPoint frame, etc.) to a PNG; this only
 * deals with getting that image onto the desktop background.
 *
 * - macOS: AppleScript `tell every desktop to set picture to` — a single
 *   command natively covers every display.
 * - Windows: `SystemParametersInfoW(SPI_SETDESKWALLPAPER, ...)` via a
 *   PowerShell P/Invoke — the standard, well-documented technique.
 * - Linux: GNOME only, via `gsettings`. KDE/XFCE/other desktop
 *   environments each have their own separate mechanism and aren't
 *   covered — a deliberate, disclosed gap rather than an attempt to
 *   handle every desktop environment's own API.
 */
export async function setWallpaper(pngBuffer: Buffer): Promise<void> {
  const filePath = join(tmpdir(), `pdf-presenter-lite-wallpaper-${Date.now()}.png`)
  await writeFile(filePath, pngBuffer)

  if (process.platform === 'darwin') {
    const escapedPath = filePath.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
    await execFileAsync('osascript', [
      '-e',
      `tell application "System Events" to tell every desktop to set picture to "${escapedPath}"`
    ])
  } else if (process.platform === 'win32') {
    const escapedPath = filePath.replace(/'/g, "''")
    const script = `
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public class PdfPresenterLiteWallpaper {
  [DllImport("user32.dll", CharSet = CharSet.Auto)]
  public static extern int SystemParametersInfo(int uAction, int uParam, string lpvParam, int fuWinIni);
}
'@
[PdfPresenterLiteWallpaper]::SystemParametersInfo(20, 0, '${escapedPath}', 3) | Out-Null
`
    await execFileAsync('powershell.exe', [
      '-NoProfile',
      '-NonInteractive',
      '-EncodedCommand',
      encodePowerShellCommand(script)
    ])
  } else {
    const uri = `file://${filePath}`
    await execFileAsync('gsettings', ['set', 'org.gnome.desktop.background', 'picture-uri', uri])
    // Best-effort — older GNOME/non-GNOME sessions may not have this key at all.
    await execFileAsync('gsettings', [
      'set',
      'org.gnome.desktop.background',
      'picture-uri-dark',
      uri
    ]).catch(() => {})
  }
}
