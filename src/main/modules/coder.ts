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

  let entries: fs.Dirent[]
  try {
    entries = await fs.readdir(dirPath, { withFileTypes: true })
  } catch {
    return []
  }

  entries.sort((a, b) => {
    if (a.isDirectory() !== b.isDirectory()) return a.isDirectory() ? -1 : 1
    return String(a.name).localeCompare(String(b.name), undefined, { sensitivity: 'base' })
  })

  const nodes: CoderFileNode[] = []

  for (const entry of entries) {
    if (counter.count >= MAX_SCAN_FILES) break
    const entryName = String(entry.name)
    if (entry.isDirectory() && isExcludedDir(entryName)) continue

    const absPath = path.join(dirPath, entryName)
    const relPath = relativePrefix ? `${relativePrefix}/${entryName}` : entryName

    try {
      const stat = await fs.stat(absPath)
      counter.count++

      const node: CoderFileNode = {
        name: entryName,
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

// ── Git Operations ──────────────────────────────────────────────────────────────

async function getGitStatus(): Promise<CoderResult<{ status: any }>> {
  if (!workspaceRoot) {
    return { success: false, error: 'No workspace open' }
  }

  try {
    // Check if git repo
    const gitDir = path.join(workspaceRoot, '.git')
    const stat = await fs.stat(gitDir).catch(() => null)
    const isRepo = stat?.isDirectory() ?? false

    if (!isRepo) {
      return { success: true, data: { status: { isRepo: false, branch: '', ahead: 0, behind: 0, files: [] } } }
    }

    // Get branch
    const { stdout: branchOut } = await execAsync('git rev-parse --abbrev-ref HEAD', {
      cwd: workspaceRoot,
      timeout: 5000,
      shell: 'cmd',
      windowsHide: true
    })
    const branch = branchOut.trim()

    // Get ahead/behind
    let ahead = 0, behind = 0
    try {
      const { stdout: abOut } = await execAsync(`git rev-list --left-right --count origin/${branch}...HEAD`, {
        cwd: workspaceRoot,
        timeout: 5000,
        shell: 'cmd',
        windowsHide: true
      })
      const [b, a] = abOut.trim().split(/\s+/).map(Number)
      behind = b || 0
      ahead = a || 0
    } catch {
      // No remote or error — ignore
    }

    // Get file status
    const { stdout: statusOut } = await execAsync('git status --porcelain', {
      cwd: workspaceRoot,
      timeout: 5000,
      shell: 'cmd',
      windowsHide: true
    })

    const files: Array<{ path: string; status: string; staged: boolean }> = []
    for (const line of statusOut.split('\n').filter(Boolean)) {
      const staged = line[0] !== ' ' && line[0] !== '?'
      const statusCode = staged ? line[0] : line[1]
      const filePath = line.slice(3).trim()
      
      let status = 'modified'
      if (statusCode === 'A') status = 'added'
      else if (statusCode === 'D') status = 'deleted'
      else if (statusCode === 'R') status = 'renamed'
      else if (statusCode === 'U' || statusCode === 'C') status = 'conflict'
      else if (statusCode === '?') status = 'untracked'

      files.push({ path: filePath, status, staged })
    }

    return {
      success: true,
      data: {
        status: { isRepo: true, branch, ahead, behind, files }
      }
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return { success: false, error: message }
  }
}

async function getGitDiff(filePath?: string): Promise<CoderResult<{ diff: string }>> {
  if (!workspaceRoot) {
    return { success: false, error: 'No workspace open' }
  }

  try {
    const cmd = filePath
      ? `git diff -- "${filePath}"`
      : 'git diff'
    const { stdout } = await execAsync(cmd, {
      cwd: workspaceRoot,
      timeout: 10000,
      shell: 'cmd',
      windowsHide: true
    })
    return { success: true, data: { diff: stdout } }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return { success: false, error: message }
  }
}

async function gitCommit(message: string): Promise<CoderResult<{ hash: string }>> {
  if (!workspaceRoot) {
    return { success: false, error: 'No workspace open' }
  }

  try {
    const { stdout } = await execAsync(`git commit -m "${message.replace(/"/g, '\\"')}"`, {
      cwd: workspaceRoot,
      timeout: 10000,
      shell: 'cmd',
      windowsHide: true
    })
    const hashMatch = stdout.match(/\[.+\s([a-f0-9]+)\]/)
    return { success: true, data: { hash: hashMatch?.[1] || 'unknown' } }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return { success: false, error: message }
  }
}

// ── Apply Diff ────────────────────────────────────────────────────────────────

async function applyDiff(filePath: string, diffContent: string): Promise<CoderResult<{ path: string }>> {
  try {
    const absPath = resolveWorkspacePath(filePath)
    const current = await fs.readFile(absPath, 'utf8')
    const lines = current.split('\n')
    
    // Simple unified diff parser
    const diffLines = diffContent.split('\n')
    let result: string[] = []
    let inHunk = false
    let sourceIdx = 0
    
    for (const dline of diffLines) {
      if (dline.startsWith('@@')) {
        // Parse hunk header: @@ -start,count +start,count @@
        const match = dline.match(/@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/)
        if (match) {
          const startLine = parseInt(match[1]) - 1 // 0-based
          // Copy lines before hunk
          while (sourceIdx < startLine && sourceIdx < lines.length) {
            result.push(lines[sourceIdx])
            sourceIdx++
          }
          inHunk = true
        }
      } else if (inHunk) {
        if (dline.startsWith('-')) {
          // Skip removed line
          sourceIdx++
        } else if (dline.startsWith('+')) {
          // Add new line
          result.push(dline.slice(1))
        } else if (dline.startsWith(' ')) {
          // Context line
          result.push(dline.slice(1))
          sourceIdx++
        } else if (dline === '') {
          // Empty context line
          result.push('')
          sourceIdx++
        } else if (dline.startsWith('\\')) {
          // "\ No newline at end of file" — ignore
        }
      }
    }
    
    // Copy remaining lines
    while (sourceIdx < lines.length) {
      result.push(lines[sourceIdx])
      sourceIdx++
    }
    
    const newContent = result.join('\n')
    const tmpPath = `${absPath}.coder.tmp.${process.pid}`
    await fs.writeFile(tmpPath, newContent, 'utf8')
    await fs.rename(tmpPath, absPath)
    
    invalidateCache()
    logCoder(`Applied diff to ${filePath}`)
    return { success: true, data: { path: absPath } }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return { success: false, error: message }
  }
}

// ── File Symbols (simple regex-based) ─────────────────────────────────────────

interface FileSymbol {
  name: string
  kind: string
  line: number
  column: number
  signature?: string
}

async function getFileSymbols(filePath: string): Promise<CoderResult<{ symbols: FileSymbol[] }>> {
  try {
    const absPath = resolveWorkspacePath(filePath)
    const content = await fs.readFile(absPath, 'utf8')
    const lines = content.split('\n')
    const symbols: FileSymbol[] = []
    
    const ext = path.extname(filePath).toLowerCase()
    
    if (ext === '.ts' || ext === '.tsx' || ext === '.js' || ext === '.jsx') {
      // TypeScript/JavaScript patterns
      const patterns = [
        { regex: /^(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\(/, kind: 'function' },
        { regex: /^(?:export\s+)?(?:async\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>/, kind: 'function' },
        { regex: /^(?:export\s+)?class\s+(\w+)(?:\s+extends\s+\w+)?/, kind: 'class' },
        { regex: /^(?:export\s+)?interface\s+(\w+)/, kind: 'interface' },
        { regex: /^(?:export\s+)?type\s+(\w+)\s*=/, kind: 'type' },
        { regex: /^(?:export\s+)?enum\s+(\w+)/, kind: 'enum' },
        { regex: /^(?:export\s+)?(?:const|let|var)\s+(\w+)\s*[:=]/, kind: 'variable' },
        { regex: /^(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s*\*?\s*(\w+)\s*\(/, kind: 'function' },
      ]
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        for (const p of patterns) {
          const match = line.match(p.regex)
          if (match) {
            symbols.push({
              name: match[1],
              kind: p.kind,
              line: i + 1,
              column: line.indexOf(match[1]) + 1,
              signature: line.trim().slice(0, 80)
            })
            break
          }
        }
      }
    } else if (ext === '.py') {
      // Python patterns
      const patterns = [
        { regex: /^(?:async\s+)?def\s+(\w+)\s*\(/, kind: 'function' },
        { regex: /^class\s+(\w+)(?:\s*\([^)]*\))?\s*:/, kind: 'class' },
        { regex: /^(\w+)\s*=\s*/, kind: 'variable' },
      ]
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        for (const p of patterns) {
          const match = line.match(p.regex)
          if (match) {
            symbols.push({
              name: match[1],
              kind: p.kind,
              line: i + 1,
              column: line.indexOf(match[1]) + 1,
              signature: line.trim().slice(0, 80)
            })
            break
          }
        }
      }
    }
    
    return { success: true, data: { symbols } }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return { success: false, error: message }
  }
}

// ── Codebase Search (simple text search) ──────────────────────────────────────

async function searchCodebase(query: string): Promise<CoderResult<{ results: Array<{ filePath: string; relativePath: string; line: number; text: string }> }>> {
  if (!workspaceRoot) {
    return { success: false, error: 'No workspace open' }
  }

  try {
    const results: Array<{ filePath: string; relativePath: string; line: number; text: string }> = []
    const lowerQuery = query.toLowerCase()
    
    // Use ripgrep if available, otherwise fallback to node fs
    try {
      const { stdout } = await execAsync(
        `rg -n -i --type-add 'code:*.{ts,tsx,js,jsx,py,java,go,rs,c,cpp,h,hpp,rb,php,swift,kt}' -tcode "${query.replace(/"/g, '\\"')}"`,
        {
          cwd: workspaceRoot,
          timeout: 30000,
          shell: 'cmd',
          windowsHide: true
        }
      )
      
      for (const line of stdout.split('\n').filter(Boolean)) {
        const match = line.match(/^(.+?):(\d+):(.*)$/)
        if (match) {
          const relPath = path.relative(workspaceRoot, match[1]).replace(/\\/g, '/')
          results.push({
            filePath: match[1],
            relativePath: relPath,
            line: parseInt(match[2]),
            text: match[3].trim()
          })
        }
      }
    } catch {
      // Fallback: manual file search
      const scan = await scanWorkspace()
      if (scan.success && scan.data) {
        const files = flattenFiles(scan.data.tree)
        for (const file of files) {
          if (isBinaryFile(file.path)) continue
          try {
            const content = await fs.readFile(file.path, 'utf8')
            const lines = content.split('\n')
            for (let i = 0; i < lines.length; i++) {
              if (lines[i].toLowerCase().includes(lowerQuery)) {
                results.push({
                  filePath: file.path,
                  relativePath: file.relativePath,
                  line: i + 1,
                  text: lines[i].trim()
                })
                if (results.length >= 50) break
              }
            }
            if (results.length >= 50) break
          } catch {}
        }
      }
    }
    
    return { success: true, data: { results: results.slice(0, 50) } }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return { success: false, error: message }
  }
}

function flattenFiles(nodes: CoderFileNode[]): CoderFileNode[] {
  const result: CoderFileNode[] = []
  for (const node of nodes) {
    if (!node.isDirectory) {
      result.push(node)
    } else if (node.children) {
      result.push(...flattenFiles(node.children))
    }
  }
  return result
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
    console.log('[Coder] Received request to pick workspace')
    const win = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0]
    
    if (!win) {
      console.error('[Coder] No window available to attach the dialog to')
      return { success: false, error: 'No window available' }
    }

    console.log(`[Coder] Attaching dialog to window: ${win.id}`)
    try {
      const result = await dialog.showOpenDialog(win, {
        properties: ['openDirectory'],
        title: 'Select Project Folder',
        buttonLabel: 'Select Folder'
      })

      if (result.canceled || !result.filePaths[0]) {
        console.log('[Coder] User cancelled the folder selection')
        return { success: false, error: 'Cancelled' }
      }

      const pickedPath = path.normalize(result.filePaths[0])
      console.log(`[Coder] Folder picked: ${pickedPath}`)
      
      workspaceRoot = pickedPath
      invalidateCache()
      
      return { success: true, data: { path: pickedPath } }
    } catch (err: any) {
      console.error('[Coder] Error showing open dialog:', err)
      return { success: false, error: err.message }
    }
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

  // ── Git ─────────────────────────────────────────────────────────────────────

  ipcMain.handle('coder:git-status', async () => {
    const result = await getGitStatus()
    if (!result.success) return result
    return { success: true, status: result.data!.status }
  })

  ipcMain.handle('coder:git-diff', async (_, { filePath }: { filePath?: string } = {}) => {
    const result = await getGitDiff(filePath)
    if (!result.success) return result
    return { success: true, diff: result.data!.diff }
  })

  ipcMain.handle('coder:git-commit', async (_, { message }: { message: string }) => {
    const result = await gitCommit(message)
    if (!result.success) return result
    return { success: true, hash: result.data!.hash }
  })

  // ── Diff / Symbols / Search ─────────────────────────────────────────────────

  ipcMain.handle('coder:apply-diff', async (_, { filePath, diff }: { filePath: string; diff: string }) => {
    const result = await applyDiff(filePath, diff)
    if (!result.success) return result
    return { success: true, path: result.data!.path }
  })

  ipcMain.handle('coder:get-symbols', async (_, { filePath }: { filePath: string }) => {
    const result = await getFileSymbols(filePath)
    if (!result.success) return result
    return { success: true, symbols: result.data!.symbols }
  })

  ipcMain.handle('coder:search-codebase', async (_, { query }: { query: string }) => {
    const result = await searchCodebase(query)
    if (!result.success) return result
    return { success: true, results: result.data!.results }
  })

  logCoder('Handlers registered (v2 — Cursor-style)')
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
