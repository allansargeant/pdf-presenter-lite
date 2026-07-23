import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import type { OutputState } from '../shared/output'
import type { OscArg, OscAction, OscConfig } from '../shared/osc'

interface OpenPdfResult {
  filePath: string
  data: string
}

interface DisplayInfo {
  id: number
  label: string
  width: number
  height: number
  internal: boolean
  primary: boolean
}

const api = {
  pdf: {
    open: (): Promise<OpenPdfResult | null> => ipcRenderer.invoke('pdf:open')
  },
  output: {
    listDisplays: (): Promise<DisplayInfo[]> => ipcRenderer.invoke('output:list-displays'),
    open: (displayId?: number): Promise<void> => ipcRenderer.invoke('output:open', displayId),
    close: (): Promise<void> => ipcRenderer.invoke('output:close'),
    isOpen: (): Promise<boolean> => ipcRenderer.invoke('output:is-open'),
    getState: (): Promise<OutputState | null> => ipcRenderer.invoke('output:get-state'),
    pushState: (state: OutputState): Promise<void> =>
      ipcRenderer.invoke('output:push-state', state),
    onOpenChanged: (callback: (open: boolean) => void) => {
      const listener = (_e: Electron.IpcRendererEvent, open: boolean): void => callback(open)
      ipcRenderer.on('output:open-changed', listener)
      return (): void => {
        ipcRenderer.removeListener('output:open-changed', listener)
      }
    },
    onDisplaysChanged: (callback: (displays: DisplayInfo[]) => void) => {
      const listener = (_e: Electron.IpcRendererEvent, displays: DisplayInfo[]): void =>
        callback(displays)
      ipcRenderer.on('output:displays-changed', listener)
      return (): void => {
        ipcRenderer.removeListener('output:displays-changed', listener)
      }
    },
    onState: (callback: (state: OutputState) => void) => {
      const listener = (_e: Electron.IpcRendererEvent, state: OutputState): void => callback(state)
      ipcRenderer.on('output:state', listener)
      return (): void => {
        ipcRenderer.removeListener('output:state', listener)
      }
    }
  },
  osc: {
    start: (): Promise<void> => ipcRenderer.invoke('osc:start'),
    stop: (): Promise<void> => ipcRenderer.invoke('osc:stop'),
    isRunning: (): Promise<boolean> => ipcRenderer.invoke('osc:is-running'),
    getConfig: (): Promise<OscConfig> => ipcRenderer.invoke('osc:get-config'),
    setConfig: (next: Partial<OscConfig>): Promise<OscConfig> =>
      ipcRenderer.invoke('osc:set-config', next),
    send: (address: string, args: OscArg[]): Promise<void> =>
      ipcRenderer.invoke('osc:send', address, args),
    onAction: (callback: (action: OscAction) => void) => {
      const listener = (_e: Electron.IpcRendererEvent, action: OscAction): void => callback(action)
      ipcRenderer.on('osc:action', listener)
      return (): void => {
        ipcRenderer.removeListener('osc:action', listener)
      }
    },
    onStatusChanged: (callback: (running: boolean) => void) => {
      const listener = (_e: Electron.IpcRendererEvent, running: boolean): void => callback(running)
      ipcRenderer.on('osc:status-changed', listener)
      return (): void => {
        ipcRenderer.removeListener('osc:status-changed', listener)
      }
    }
  }
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}

export type Api = typeof api
