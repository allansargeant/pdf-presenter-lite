import type { OscArgOutputOrArray } from 'osc-min'

/** A single OSC argument, in osc-min's parsed representation — reused
 * verbatim rather than inventing our own shape, since it already covers
 * every type this protocol uses (string/integer/float/blob/bool). */
export type OscArg = OscArgOutputOrArray

export interface OscAction {
  address: string
  args: OscArg[]
}

export interface OscConfig {
  /** Port this app listens on for incoming actions. */
  localPort: number
  /** Where outbound feedback is sent. */
  remoteHost: string
  remotePort: number
  /** Whether OSC was running last time the app closed — used to restore
   * that state on the next launch. */
  autoStart: boolean
}
