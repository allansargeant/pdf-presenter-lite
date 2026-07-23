import type { OscArgOutputOrArray } from 'osc-min'

/** A single OSC argument, in osc-min's parsed representation — reused
 * verbatim rather than inventing our own shape, since it already covers
 * every type OSCPoint's protocol uses (string/integer/float/blob/bool). */
export type OscArg = OscArgOutputOrArray

export interface OscAction {
  address: string
  args: OscArg[]
}

export interface OscConfig {
  /** Port this app listens on for incoming OSCPoint-style actions — matches
   * OSCPoint's own "local port" terminology and default (35551), so an
   * existing Companion "Zinc: OSCPoint" connection works against us with
   * zero reconfiguration. */
  localPort: number
  /** Where outbound feedback is sent — OSCPoint's default remote host/port
   * (127.0.0.1:35550). */
  remoteHost: string
  remotePort: number
  /** Whether OSC was running last time the app closed — used to restore
   * that state on the next launch, matching OSCPoint's own
   * persists-between-sessions ribbon setting. */
  autoStart: boolean
}
