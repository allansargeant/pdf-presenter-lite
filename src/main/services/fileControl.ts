import { readdir, mkdir, readFile, writeFile } from 'fs/promises'
import { join, extname, relative } from 'path'
import { homedir } from 'os'
import { app } from 'electron'
import type { FileControlConfig } from '../../shared/files'

export type { FileControlConfig }

const DEFAULT_CONFIG: FileControlConfig = {
  folderPath: null,
  relativeToHome: null,
  enabled: false
}

const SUPPORTED_EXTENSIONS = ['.pdf']

function configPath(): string {
  return join(app.getPath('userData'), 'files-config.json')
}

class FileControlService {
  private config: FileControlConfig = { ...DEFAULT_CONFIG }

  async loadConfig(): Promise<FileControlConfig> {
    try {
      const raw = await readFile(configPath(), 'utf-8')
      this.config = { ...DEFAULT_CONFIG, ...JSON.parse(raw) }
    } catch {
      // No persisted config yet — defaults stand.
    }
    return { ...this.config }
  }

  getConfig(): FileControlConfig {
    return { ...this.config }
  }

  private async persist(): Promise<void> {
    await writeFile(configPath(), JSON.stringify(this.config, null, 2), 'utf-8')
  }

  async setFolderPath(absolutePath: string): Promise<FileControlConfig> {
    await mkdir(absolutePath, { recursive: true })
    this.config.folderPath = absolutePath
    this.config.relativeToHome = relative(homedir(), absolutePath)
    await this.persist()
    return { ...this.config }
  }

  /** Matches OSCPoint's own /oscpoint/files/setpath convention: the path is
   * relative to the user's home directory. */
  async setFolderPathRelativeToHome(relativePath: string): Promise<FileControlConfig> {
    return this.setFolderPath(join(homedir(), relativePath))
  }

  async setEnabled(enabled: boolean): Promise<FileControlConfig> {
    this.config.enabled = enabled
    await this.persist()
    return { ...this.config }
  }

  async listFiles(): Promise<string[]> {
    if (!this.config.folderPath) return []
    try {
      const entries = await readdir(this.config.folderPath)
      return entries.filter((f) => SUPPORTED_EXTENSIONS.includes(extname(f).toLowerCase())).sort()
    } catch {
      return []
    }
  }

  /** Resolves `filename` against the active folder and reads it, rejecting
   * anything that isn't a bare filename (no path traversal) or isn't one of
   * SUPPORTED_EXTENSIONS. Returns null rather than throwing for any
   * not-allowed/not-found case — callers treat "can't open this" as a
   * no-op, matching OSCPoint's own "will do nothing if X" behavior. */
  async openFile(filename: string): Promise<{ filePath: string; data: string } | null> {
    if (!this.config.folderPath) return null
    if (filename.includes('/') || filename.includes('\\') || filename.includes('..')) return null
    if (!SUPPORTED_EXTENSIONS.includes(extname(filename).toLowerCase())) return null
    const filePath = join(this.config.folderPath, filename)
    try {
      const data = await readFile(filePath)
      return { filePath, data: data.toString('base64') }
    } catch {
      return null
    }
  }
}

export const fileControl = new FileControlService()
