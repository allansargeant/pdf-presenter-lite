import { app, BrowserWindow, ipcMain, dialog, screen, shell } from 'electron'
import { join } from 'path'
import { readFile } from 'fs/promises'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import type { OutputState } from '../shared/output'

interface DisplayInfo {
  id: number
  label: string
  width: number
  height: number
  internal: boolean
  primary: boolean
}

let outputWindow: BrowserWindow | null = null
let latestOutputState: OutputState | null = null

function listDisplays(): DisplayInfo[] {
  const primary = screen.getPrimaryDisplay()
  return screen.getAllDisplays().map((d, i) => ({
    id: d.id,
    label: d.label || (d.internal ? 'Built-in Display' : `Display ${i + 1}`),
    width: d.bounds.width,
    height: d.bounds.height,
    internal: d.internal ?? false,
    primary: d.id === primary.id
  }))
}

function loadRenderer(win: BrowserWindow, mode?: string): void {
  const search = mode ? `mode=${mode}` : undefined
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    const url = new URL(process.env['ELECTRON_RENDERER_URL'])
    if (mode) url.searchParams.set('mode', mode)
    win.loadURL(url.toString())
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'), search ? { search } : undefined)
  }
}

function createWindow(): BrowserWindow {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 820,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#0f1013',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => mainWindow.show())

  if (is.dev) {
    mainWindow.webContents.on('console-message', (event) => {
      console.log(`[renderer:${event.level}] ${event.message}`)
    })
  }

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  loadRenderer(mainWindow)

  return mainWindow
}

function closeOutput(): void {
  outputWindow?.close()
}

function openOutput(mainWindow: BrowserWindow, displayId?: number): void {
  if (outputWindow) return

  const displays = screen.getAllDisplays()
  const primary = screen.getPrimaryDisplay()
  const chosen = displayId !== undefined ? displays.find((d) => d.id === displayId) : undefined
  const target = chosen ?? displays.find((d) => d.id !== primary.id) ?? primary

  const win = new BrowserWindow({
    x: target.bounds.x,
    y: target.bounds.y,
    width: target.bounds.width,
    height: target.bounds.height,
    show: false,
    frame: false,
    backgroundColor: '#000000',
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  // Setting fullscreen at construction time can leave the window invisible
  // to the OS window server on macOS; show it plain first, then transition.
  win.once('ready-to-show', () => {
    win.show()
    win.setFullScreen(true)
  })

  win.webContents.on('before-input-event', (_event, input) => {
    if (input.key === 'Escape') closeOutput()
  })

  if (is.dev) {
    win.webContents.on('console-message', (event) => {
      console.log(`[output:${event.level}] ${event.message}`)
    })
  }

  win.on('closed', () => {
    outputWindow = null
    mainWindow.webContents.send('output:open-changed', false)
  })

  win.webContents.once('did-finish-load', () => {
    if (latestOutputState) win.webContents.send('output:state', latestOutputState)
  })

  loadRenderer(win, 'output')
  outputWindow = win
  mainWindow.webContents.send('output:open-changed', true)
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.allansargeant.pdf-presenter-lite')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  const mainWindow = createWindow()

  screen.on('display-added', () =>
    mainWindow.webContents.send('output:displays-changed', listDisplays())
  )
  screen.on('display-removed', () =>
    mainWindow.webContents.send('output:displays-changed', listDisplays())
  )

  ipcMain.handle('pdf:open', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      filters: [{ name: 'PDF', extensions: ['pdf'] }]
    })
    if (result.canceled || result.filePaths.length === 0) return null
    const filePath = result.filePaths[0]
    const data = await readFile(filePath)
    return { filePath, data: data.toString('base64') }
  })

  ipcMain.handle('output:list-displays', () => listDisplays())
  ipcMain.handle('output:open', (_e, displayId?: number) => openOutput(mainWindow, displayId))
  ipcMain.handle('output:close', () => closeOutput())
  ipcMain.handle('output:is-open', () => outputWindow !== null)
  // Pulled by the Output window itself once its listener is mounted, rather
  // than relying only on the push below — confirmed live that a push sent
  // while the new window is still loading (before its 'output:state'
  // listener is registered) is silently dropped by Electron, and the
  // window's own 'did-finish-load' fallback can itself lose the race if the
  // page finishes loading before the presenter-side push effect runs.
  ipcMain.handle('output:get-state', () => latestOutputState)
  ipcMain.handle('output:push-state', (_e, state: OutputState) => {
    latestOutputState = state
    outputWindow?.webContents.send('output:state', state)
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
