import { EventEmitter } from 'events'
import dgram from 'dgram'
import { readFile, writeFile } from 'fs/promises'
import { join } from 'path'
import { app } from 'electron'
import type * as OscMin from 'osc-min'
import type { OscMessageOutput } from 'osc-min'
import type { OscArg, OscAction, OscConfig } from '../../shared/osc'

export type { OscArg, OscAction, OscConfig }

// osc-min is an ESM-only package (no "require" export condition) while
// electron-vite's main-process bundle is CommonJS — a static import fails
// to resolve at runtime (ERR_PACKAGE_PATH_NOT_EXPORTED), confirmed live.
// A dynamic import works fine from CJS and is the standard interop path.
let oscMinPromise: Promise<typeof OscMin> | null = null
function getOscMin(): Promise<typeof OscMin> {
  if (!oscMinPromise) oscMinPromise = import('osc-min')
  return oscMinPromise
}

const DEFAULT_CONFIG: OscConfig = {
  localPort: 35551,
  remoteHost: '127.0.0.1',
  remotePort: 35550,
  autoStart: false
}

function configPath(): string {
  return join(app.getPath('userData'), 'osc-config.json')
}

/**
 * Generic OSC transport — deliberately has no idea what a "slide" is. Every
 * inbound message (bundles are unwrapped to their individual messages) is
 * emitted as a raw 'action' event; the actual protocol semantics live in
 * the renderer (src/renderer/src/osc/protocol.ts), which is where the real
 * app state (current page, etc.) already lives.
 */
class OscControlServerService extends EventEmitter {
  private socket: dgram.Socket | null = null
  private config: OscConfig = { ...DEFAULT_CONFIG }

  async loadConfig(): Promise<OscConfig> {
    try {
      const raw = await readFile(configPath(), 'utf-8')
      this.config = { ...DEFAULT_CONFIG, ...JSON.parse(raw) }
    } catch {
      // No persisted config yet — defaults stand.
    }
    return { ...this.config }
  }

  getConfig(): OscConfig {
    return { ...this.config }
  }

  private async persist(): Promise<void> {
    await writeFile(configPath(), JSON.stringify(this.config, null, 2), 'utf-8')
  }

  async setConfig(next: Partial<Omit<OscConfig, 'autoStart'>>): Promise<OscConfig> {
    this.config = { ...this.config, ...next }
    await this.persist()
    if (this.socket) {
      // Port/host changes only take effect on the next start — restart to
      // pick them up immediately rather than leaving the old bind live.
      this.stopSocket()
      await this.bind()
    }
    return { ...this.config }
  }

  isRunning(): boolean {
    return this.socket !== null
  }

  async start(): Promise<void> {
    await this.bind()
    this.config.autoStart = true
    await this.persist()
  }

  stop(): void {
    this.stopSocket()
    this.config.autoStart = false
    void this.persist()
  }

  /** Closes the socket without touching the persisted autoStart intent —
   * for process teardown (window-all-closed on non-mac platforms, where the
   * app is quitting but the user never explicitly toggled OSC off). */
  shutdown(): void {
    this.stopSocket()
  }

  private stopSocket(): void {
    this.socket?.close()
    this.socket = null
    this.emit('status-changed', false)
  }

  private async bind(): Promise<void> {
    if (this.socket) return
    const { fromBuffer } = await getOscMin()
    if (this.socket) return // a racing start()/setConfig() call already bound while we awaited

    const socket = dgram.createSocket('udp4')

    socket.on('message', (msg) => {
      try {
        const packet = fromBuffer(msg)
        if (packet.oscType === 'bundle') {
          for (const element of packet.elements) {
            if (element.oscType === 'message') this.emitAction(element)
          }
        } else {
          this.emitAction(packet)
        }
      } catch (err) {
        console.error('[osc] Failed to parse incoming packet', err)
      }
    })

    socket.on('error', (err) => {
      console.error('[osc] Socket error', err)
    })

    socket.bind(this.config.localPort)
    this.socket = socket
    this.emit('status-changed', true)
  }

  private emitAction(message: OscMessageOutput): void {
    this.emit('action', { address: message.address, args: message.args } satisfies OscAction)
  }

  async send(address: string, args: OscArg[] = []): Promise<void> {
    if (!this.socket) return
    try {
      const { toBuffer } = await getOscMin()
      const view = toBuffer({ address, args })
      const buf = Buffer.from(view.buffer, view.byteOffset, view.byteLength)
      this.socket?.send(buf, this.config.remotePort, this.config.remoteHost)
    } catch (err) {
      console.error(`[osc] Failed to send feedback ${address}`, err)
    }
  }
}

export const oscControlServer = new OscControlServerService()
