/**
 * Coder Mode — workspace file operations (Main process only).
 *
 * Security: all paths are resolved relative to the active workspace root.
 * FS access never leaves the workspace boundary.
 */

import { ipcMain, dialog, BrowserWindow } from 'electron'
import * as fs from 'fs/promises'
import * as path from 'path'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CoderFileNode {
  name: string
  path: string
  relativePath: string
  isDirectory: boolean
  size: number
  modified: number
  children?: CoderFileNode[]
}

export interface CoderResult<T = unknown> {
  success: boolean
  data?: T
  error?: string
}

interface ScanCacheEntry {
  root: string
  tree: CoderFileNode[]
  scannedAt: number
}

// ── Constants ─────────────────────────────────────────────────────────────────

const EXCLUDED_DIRS = new Set([
  'node_modules',
  '.git',
  '.svn',
  '.hg',
  'dist',
  'out',
  'build',
  '.next',
  '.nuxt',
  'coverage',
  '__pycache__',
  '.venv',
  'venv',
  '.cache',
  '.turbo',
  '.idea',
  '.vscode'
])

const BINARY_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.bmp',
  '.zip', '.gz', '.tar', '.rar', '.7z',
  '.exe', '.dll', '.so', '.dylib',
  '.woff', '.woff2', '.ttf', '.eot',
  '.mp3', '.mp4', '.avi', '.mov', '.wav',
  '.pdf', '.doc', '.docx', '.xls', '.xlsx'
])

const MAX_READ_BYTES = 512 * 1024 // 512 KB per file
const MAX_SCAN_FILES = 5000
const CACHE_TTL_MS = 30_000
const DEFAULT_STRUCTURE_DEPTH = 4

// ── State ─────────────────────────────────────────────────────────────────────

let workspaceRoot: string | null = null
let scanCache: ScanCacheEntry | null = null

// ── Path Helpers ──────────────────────────────────────────────────────────────

function resolveWorkspacePath(inputPath: string): string {
  if (!workspaceRoot) {
    throw new Error('No workspace open. Call coder:set-workspace first.')
  }

  const root = path.normalize(workspaceRoot)
  const resolved = path.isAbsolute(inputPath)
    ? path.normalize(inputPath)
    : path.normalize(path.join(root, inputPath))

  const relative = path.relative(root, resolved)
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`Path escapes workspace: ${inputPath}`)
  }

  return resolved
}

function isExcludedDir(name: string): boolean {
  return EXCLUDED_DIRS.has(name)
}

function isBinaryFile(filePath: string): boolean {
  return BINARY_EXTENSIONS.has(path.extname(filePath).toLowerCase())
}

function invalidateCache(): void {
  scanCache = null
}

function logCoder(message: string): void {
  console.log(`[coder] ${message}`)
}

// ── Scan ──────────────────────────────────────────────────────────────────────

async function scanDirectory(
  dirPath: string,
  relativePrefix: string,
  counter: { count: number }
): Promise<CoderFileNode[]> {
  if (counter.count >= MAX_SCAN_FILES) return []

  let entries: Awaited<ReturnType<typeof fs.readdir>>
  try {
    entries = await fs.readdir(dirPath, { withFileTypes: true })
  } catch {
    return []
  }

  entries.sort((a, b) => {
    if (a.isDirectory() !== b.isDirectory()) return a.isDirectory() ? -1 : 1
    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
  })

  const nodes: CoderFileNode[] = []

  for (const entry of entries) {
    if (counter.count >= MAX_SCAN_FILES) break
    if (entry.isDirectory() && isExcludedDir(entry.name)) continue

    const absPath = path.join(dirPath, entry.name)
    const relPath = relativePrefix ? `${relativePrefix}/${entry.name}` : entry.name

    try {
      const stat = await fs.stat(absPath)
      counter.count++

      const node: CoderFileNode = {
        name: entry.name,
        path: absPath,
        relativePath: relPath.replace(/\\/g, '/'),
        isDirectory: entry.isDirectory(),
        size: stat.size,
        modified: stat.mtimeMs
      }

      if (entry.isDirectory()) {
        node.children = await scanDirectory(absPath, relPath, counter)
      }

      nodes.push(node)
    } catch {
      // Skip inaccessible entries
    }
  }

  return nodes
}

async function scanWorkspace(force = false): Promise<CoderResult<{ tree: CoderFileNode[]; fromCache: boolean }>> {
  if (!workspaceRoot) {
    return { success: false, error: 'No workspace open' }
  }

  const now = Date.now()
  if (
    !force &&
    scanCache &&
    scanCache.root === workspaceRoot &&
    now - scanCache.scannedAt < CACHE_TTL_MS
  ) {
    return { success: true, data: { tree: scanCache.tree, fromCache: true } }
  }

  try {
    const counter = { count: 0 }
    const tree = await scanDirectory(workspaceRoot, '', counter)
    scanCache = { root: workspaceRoot, tree, scannedAt: now }
    logCoder(`Scanned ${counter.count} entries in ${workspaceRoot}`)
    return { success: true, data: { tree, fromCache: false } }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return { success: false, error: message }
  }
}

// ── File Operations ───────────────────────────────────────────────────────────

async function readFile(inputPath: string): Promise<CoderResult<{ content: string; path: string }>> {
  try {
    const absPath = resolveWorkspacePath(inputPath)

    if (isBinaryFile(absPath)) {
      return { success: false, error: `Binary file skipped: ${inputPath}` }
    }

    const stat = await fs.stat(absPath)
    if (stat.size > MAX_READ_BYTES) {
      return { success: false, error: `File too large (${stat.size} bytes, max ${MAX_READ_BYTES})` }
    }

    const content = await fs.readFile(absPath, 'utf8')
    logCoder(`Read ${inputPath}`)
    return { success: true, data: { content, path: absPath } }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return { success: false, error: message }
  }
}

async function writeFile(inputPath: string, content: string): Promise<CoderResult<{ path: string }>> {
  try {
    const absPath = resolveWorkspacePath(inputPath)
    await fs.mkdir(path.dirname(absPath), { recursive: true })

    const tmpPath = `${absPath}.coder.tmp.${process.pid}`
    await fs.writeFile(tmpPath, content, 'utf8')
    await fs.rename(tmpPath, absPath)

    invalidateCache()
    logCoder(`Wrote ${inputPath}`)
    return { success: true, data: { path: absPath } }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return { success: false, error: message }
  }
}

async function patchFile(
  inputPath: string,
  search: string,
  replace: string
): Promise<CoderResult<{ path: string; replaced: boolean }>> {
  try {
    const absPath = resolveWorkspacePath(inputPath)

    if (isBinaryFile(absPath)) {
      return { success: false, error: `Cannot patch binary file: ${inputPath}` }
    }

    const current = await fs.readFile(absPath, 'utf8')
    if (!current.includes(search)) {
      return { success: false, error: 'Search block not found in file' }
    }

    const updated = current.replace(search, replace)
    const tmpPath = `${absPath}.coder.tmp.${process.pid}`
    await fs.writeFile(tmpPath, updated, 'utf8')
    await fs.rename(tmpPath, absPath)

    invalidateCache()
    logCoder(`Patched ${inputPath}`)
    return { success: true, data: { path: absPath, replaced: true } }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return { success: false, error: message }
  }
}

async function runTerminal(command: string): Promise<CoderResult<{ stdout: string; stderr: string; exitCode: number }>> {
  if (!workspaceRoot) {
    return { success: false, error: 'No workspace open' }
  }

  try {
    logCoder(`Terminal: ${command}`)
    const { stdout, stderr } = await execAsync(command, {
      cwd: workspaceRoot,
      timeout: 120_000,
      shell: 'powershell.exe',
      maxBuffer: 10 * 1024 * 1024,
      windowsHide: true
    })
    return {
      success: true,
      data: { stdout: stdout || '', stderr: stderr || '', exitCode: 0 }
    }
  } catch (err: unknown) {
    const execErr = err as { message?: string; stdout?: string; stderr?: string; code?: number }
    return {
      success: false,
      error: execErr.message || 'Command failed',
      data: {
        stdout: execErr.stdout || '',
        stderr: execErr.stderr || '',
        exitCode: typeof execErr.code === 'number' ? execErr.code : 1
      }
    }
  }
}

// ── Structure (for LLM context) ───────────────────────────────────────────────

function formatTree(nodes: CoderFileNode[], depth: number, maxDepth: number, prefix = ''): string {
  if (depth >= maxDepth) return ''

  const lines: string[] = []
  for (const node of nodes) {
    const icon = node.isDirectory ? '📁' : '📄'
    lines.push(`${prefix}${icon} ${node.relativePath}`)
    if (node.isDirectory && node.children?.length) {
      lines.push(formatTree(node.children, depth + 1, maxDepth, prefix + '  '))
    }
  }
  return lines.filter(Boolean).join('\n')
}

async function getStructure(maxDepth = DEFAULT_STRUCTURE_DEPTH): Promise<CoderResult<{ structure: string }>> {
  const scan = await scanWorkspace()
  if (!scan.success || !scan.data) {
    return { success: false, error: scan.error || 'Scan failed' }
  }

  const header = `Workspace: ${workspaceRoot}\n`
  const structure = header + formatTree(scan.data.tree, 0, maxDepth)
  return { success: true, data: { structure } }
}

async function readMultiple(inputPaths: string[]): Promise<CoderResult<{ files: Array<{ path: string; content: string; error?: string }> }>> {
  const files: Array<{ path: string; content: string; error?: string }> = []

  for (const p of inputPaths) {
    const result = await readFile(p)
    if (result.success && result.data) {
      files.push({ path: p, content: result.data.content })
    } else {
      files.push({ path: p, content: '', error: result.error })
    }
  }

  return { success: true, data: { files } }
}

// ── IPC Handlers ──────────────────────────────────────────────────────────────

export function setupCoderHandlers(): void {
  ipcMain.handle('coder:set-workspace', async (_, { rootPath }: { rootPath: string }) => {
    try {
      const normalized = path.normalize(rootPath)
      const stat = await fs.stat(normalized)
      if (!stat.isDirectory()) {
        return { success: false, error: 'Path is not a directory' }
      }
      workspaceRoot = normalized
      invalidateCache()
      logCoder(`Workspace set: ${workspaceRoot}`)
      return { success: true, data: { path: workspaceRoot } }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      return { success: false, error: message }
    }
  })

  ipcMain.handle('coder:get-workspace', () => ({
    success: true,
    data: { path: workspaceRoot }
  }))

  ipcMain.handle('coder:pick-workspace', async () => {
    const win = BrowserWindow.getFocusedWindow()
    if (!win) return { success: false, error: 'No focused window' }

    const result = await dialog.showOpenDialog(win, { properties: ['openDirectory'] })
    if (result.canceled || !result.filePaths[0]) {
      return { success: false, error: 'Cancelled' }
    }

    workspaceRoot = path.normalize(result.filePaths[0])
    invalidateCache()
    logCoder(`Workspace picked: ${workspaceRoot}`)
    return { success: true, data: { path: workspaceRoot } }
  })

  ipcMain.handle('coder:scan', async (_, { force }: { force?: boolean } = {}) => {
    const result = await scanWorkspace(force)
    if (!result.success) return result
    return { success: true, data: result.data, fromCache: result.data!.fromCache }
  })

  ipcMain.handle('coder:read', async (_, { path: filePath }: { path: string }) => {
    const result = await readFile(filePath)
    if (!result.success) return result
    return { success: true, content: result.data!.content, path: result.data!.path }
  })

  ipcMain.handle('coder:write', async (_, { path: filePath, content }: { path: string; content: string }) => {
    const result = await writeFile(filePath, content)
    if (!result.success) return result
    return { success: true, path: result.data!.path }
  })

  ipcMain.handle(
    'coder:patch',
    async (
      _,
      { path: filePath, search, replace }: { path: string; search: string; replace: string }
    ) => {
      const result = await patchFile(filePath, search, replace)
      if (!result.success) return result
      return { success: true, path: result.data!.path }
    }
  )

  ipcMain.handle('coder:terminal', async (_, { command }: { command: string }) => {
    const result = await runTerminal(command)
    if (result.data) {
      return {
        success: result.success,
        stdout: result.data.stdout,
        stderr: result.data.stderr,
        exitCode: result.data.exitCode,
        error: result.error
      }
    }
    return result
  })

  ipcMain.handle('coder:invalidate-cache', () => {
    invalidateCache()
    return { success: true }
  })

  ipcMain.handle('coder:get-structure', async (_, { maxDepth }: { maxDepth?: number } = {}) => {
    const result = await getStructure(maxDepth)
    if (!result.success) return result
    return { success: true, structure: result.data!.structure }
  })

  ipcMain.handle('coder:read-multiple', async (_, { paths }: { paths: string[] }) => {
    const result = await readMultiple(paths)
    if (!result.success) return result
    return { success: true, files: result.data!.files }
  })

  logCoder('Handlers registered')
}

// ── Exports for testing / agent loop ──────────────────────────────────────────

export function getWorkspaceRoot(): string | null {
  return workspaceRoot
}

export {
  scanWorkspace,
  readFile,
  writeFile,
  patchFile,
  runTerminal,
  getStructure,
  invalidateCache as invalidateCoderCache
}
