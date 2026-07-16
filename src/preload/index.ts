import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import type { OutputState } from '../shared/output'

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
