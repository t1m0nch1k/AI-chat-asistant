/**
 * Agent Tool Handlers — File system operations with sandbox protection.
 *
 * Security model:
 *  - Only paths inside allowedPaths are accessible
 *  - Dangerous operations require explicit user confirmation (handled in renderer)
 *  - System directories are always blocked
 */

import { ipcMain, dialog, BrowserWindow, IpcMainInvokeEvent } from 'electron'
import * as fs from 'fs/promises'
import * as fsSync from 'fs'
import * as path from 'path'
import * as os from 'os'
import { exec, spawn } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

// Активные процессы — для kill по ID
const activeProcesses = new Map<string, ReturnType<typeof spawn>>()

// ── Blocked paths (always denied) ────────────────────────────────────────────

const BLOCKED_PATHS = [
  'C:\\Windows',
  'C:\\Windows\\System32',
  'C:\\Program Files',
  'C:\\Program Files (x86)',
  path.join(os.homedir(), 'AppData'),
  '/etc',
  '/usr',
  '/bin',
  '/sbin',
  '/sys',
  '/proc'
]

// ── Sandbox Check ─────────────────────────────────────────────────────────────

function resolvePath(inputPath: string): string {
  // Резолвим переменные окружения Windows: %USERNAME%, %USERPROFILE%, %DESKTOP% и т.д.
  return inputPath.replace(/%([^%]+)%/g, (_, key) => {
    return process.env[key] || process.env[key.toUpperCase()] || `%${key}%`
  })
}

function isPathAllowed(targetPath: string, allowedPaths: string[]): boolean {
  const normalized = path.normalize(resolvePath(targetPath)).toLowerCase()

  // Block system directories always
  for (const blocked of BLOCKED_PATHS) {
    if (normalized.startsWith(blocked.toLowerCase())) {
      console.log(`[sandbox] BLOCKED: ${normalized} matches ${blocked}`)
      return false
    }
  }

  const home = os.homedir()

  // Base paths always allowed (Desktop, Documents, Downloads, Projects)
  const basePaths = [
    path.join(home, 'Documents'),
    path.join(home, 'Desktop'),
    path.join(home, 'Downloads'),
    path.join(home, 'Projects'),
    path.join(home, 'OneDrive'),
  ]

  // Check base paths first
  const inBase = basePaths.some((d) => normalized.startsWith(d.toLowerCase()))

  // Check user-configured allowed paths
  const inCustom = allowedPaths.length > 0 && allowedPaths.some((allowed) =>
    normalized.startsWith(path.normalize(resolvePath(allowed)).toLowerCase())
  )

  const allowed = inBase || inCustom
  console.log(`[sandbox] path="${normalized}" inBase=${inBase} inCustom=${inCustom} allowed=${allowed}`)
  return allowed
}

// ── Tool Handlers ─────────────────────────────────────────────────────────────

export function setupToolHandlers(): void {
  // ── Create / Write File ──────────────────────────────────────────────────

  ipcMain.handle(
    'tool:create-file',
    async (_, { filePath, content, allowedPaths }: { filePath: string; content: string; allowedPaths?: string[] }) => {
      const resolvedPath = resolvePath(filePath)
      const paths = Array.isArray(allowedPaths) ? allowedPaths : []
      console.log(`[tool:create-file] path="${resolvedPath}" allowedPaths=`, paths)
      if (!isPathAllowed(resolvedPath, paths)) {
        return { success: false, error: `Access denied: ${resolvedPath}` }
      }
      try {
        await fs.mkdir(path.dirname(resolvedPath), { recursive: true })
        await fs.writeFile(resolvedPath, content, 'utf8')
        return { success: true, path: resolvedPath }
      } catch (err: any) {
        return { success: false, error: err.message }
      }
    }
  )

  // ── Read File ────────────────────────────────────────────────────────────

  ipcMain.handle(
    'tool:read-file',
    async (_, { filePath, allowedPaths }: { filePath: string; allowedPaths: string[] }) => {
      const resolvedPath = resolvePath(filePath)
      if (!isPathAllowed(resolvedPath, allowedPaths)) {
        return { success: false, error: `Access denied: ${resolvedPath}` }
      }
      try {
        const content = await fs.readFile(resolvedPath, 'utf8')
        return { success: true, content }
      } catch (err: any) {
        return { success: false, error: err.message }
      }
    }
  )

  // ── Edit File (patch specific lines) ────────────────────────────────────

  ipcMain.handle(
    'tool:edit-file',
    async (
      _,
      {
        filePath,
        oldContent,
        newContent,
        allowedPaths
      }: { filePath: string; oldContent: string; newContent: string; allowedPaths: string[] }
    ) => {
      const resolvedPath = resolvePath(filePath)
      if (!isPathAllowed(resolvedPath, allowedPaths)) {
        return { success: false, error: `Access denied: ${resolvedPath}` }
      }
      try {
        const current = await fs.readFile(resolvedPath, 'utf8')
        if (!current.includes(oldContent)) {
          return { success: false, error: 'Old content not found in file' }
        }
        const updated = current.replace(oldContent, newContent)
        await fs.writeFile(resolvedPath, updated, 'utf8')
        return { success: true }
      } catch (err: any) {
        return { success: false, error: err.message }
      }
    }
  )

  // ── Delete File ──────────────────────────────────────────────────────────

  ipcMain.handle(
    'tool:delete-file',
    async (_, { filePath, allowedPaths }: { filePath: string; allowedPaths: string[] }) => {
      const resolvedPath = resolvePath(filePath)
      if (!isPathAllowed(resolvedPath, allowedPaths)) {
        return { success: false, error: `Access denied: ${resolvedPath}` }
      }
      try {
        await fs.unlink(resolvedPath)
        return { success: true }
      } catch (err: any) {
        return { success: false, error: err.message }
      }
    }
  )

  // ── List Directory ───────────────────────────────────────────────────────

  ipcMain.handle(
    'tool:list-directory',
    async (_, { dirPath, allowedPaths }: { dirPath: string; allowedPaths: string[] }) => {
      const resolvedPath = resolvePath(dirPath)
      if (!isPathAllowed(resolvedPath, allowedPaths)) {
        return { success: false, error: `Access denied: ${resolvedPath}` }
      }
      try {
        const entries = await fs.readdir(resolvedPath, { withFileTypes: true })
        const files = entries.map((e) => ({
          name: e.name,
          path: path.join(resolvedPath, e.name),
          isDirectory: e.isDirectory(),
          size: 0,
          modified: 0
        }))
        return { success: true, files }
      } catch (err: any) {
        return { success: false, error: err.message }
      }
    }
  )

  // ── Move / Rename File ───────────────────────────────────────────────────

  ipcMain.handle(
    'tool:move-file',
    async (
      _,
      {
        sourcePath,
        destPath,
        allowedPaths
      }: { sourcePath: string; destPath: string; allowedPaths: string[] }
    ) => {
      const resolvedSrc = resolvePath(sourcePath)
      const resolvedDst = resolvePath(destPath)
      if (!isPathAllowed(resolvedSrc, allowedPaths) || !isPathAllowed(resolvedDst, allowedPaths)) {
        return { success: false, error: 'Access denied' }
      }
      try {
        await fs.mkdir(path.dirname(resolvedDst), { recursive: true })
        await fs.rename(resolvedSrc, resolvedDst)
        return { success: true }
      } catch (err: any) {
        return { success: false, error: err.message }
      }
    }
  )

  // ── Search Files ─────────────────────────────────────────────────────────

  ipcMain.handle(
    'tool:search-files',
    async (
      _,
      {
        rootPath,
        pattern,
        allowedPaths
      }: { rootPath: string; pattern: string; allowedPaths: string[] }
    ) => {
      const resolvedPath = resolvePath(rootPath)
      if (!isPathAllowed(resolvedPath, allowedPaths)) {
        return { success: false, error: `Access denied: ${resolvedPath}` }
      }
      try {
        const results: string[] = []
        await searchRecursive(resolvedPath, pattern.toLowerCase(), results, 0, 5)
        return { success: true, files: results }
      } catch (err: any) {
        return { success: false, error: err.message }
      }
    }
  )

  // ── Run Command — простой (без стриминга) ───────────────────────────────

  ipcMain.handle(
    'tool:run-command',
    async (_, { command, cwd, shell: shellType }: { command: string; cwd?: string; shell?: 'powershell' | 'cmd' }) => {
      try {
        const shellExe = shellType === 'cmd' ? 'cmd.exe' : 'powershell.exe'

        const { stdout, stderr } = await execAsync(
          shellType === 'cmd' ? `cmd.exe /c ${command}` : command,
          {
            cwd: cwd ?? os.homedir(),
            timeout: 60000,
            shell: shellExe,
            maxBuffer: 10 * 1024 * 1024 // 10MB
          }
        )
        return { success: true, stdout: stdout || '', stderr: stderr || '' }
      } catch (err: any) {
        return {
          success: false,
          error: err.message,
          stdout: err.stdout || '',
          stderr: err.stderr || ''
        }
      }
    }
  )

  // ── Run Command Streaming — с живым выводом ──────────────────────────────

  ipcMain.handle(
    'tool:run-command-stream',
    async (
      event: IpcMainInvokeEvent,
      {
        command,
        cwd,
        shell: shellType,
        processId,
        timeout: timeoutMs = 60000
      }: {
        command: string
        cwd?: string
        shell?: 'powershell' | 'cmd'
        processId: string
        timeout?: number
      }
    ) => {
      const workDir = cwd ?? os.homedir()
      const senderId = event.sender.id

      const send = (type: 'stdout' | 'stderr' | 'exit', data: string | number) => {
        if (!event.sender.isDestroyed()) {
          event.sender.send('tool:cmd-output', { processId, type, data })
        }
      }

      let proc: ReturnType<typeof spawn>

      if (shellType === 'cmd') {
        proc = spawn('cmd.exe', ['/c', command], {
          cwd: workDir,
          windowsHide: true,
          env: { ...process.env }
        })
      } else {
        proc = spawn('powershell.exe', [
          '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass',
          '-Command', command
        ], {
          cwd: workDir,
          windowsHide: true,
          env: { ...process.env }
        })
      }

      activeProcesses.set(processId, proc)

      const decoder = new (require('string_decoder').StringDecoder)('utf8')

      proc.stdout?.on('data', (chunk: Buffer) => {
        send('stdout', decoder.write(chunk))
      })

      proc.stderr?.on('data', (chunk: Buffer) => {
        send('stderr', decoder.write(chunk))
      })

      // Таймаут
      const timer = setTimeout(() => {
        if (activeProcesses.has(processId)) {
          proc.kill('SIGTERM')
          send('stderr', `\n[Timeout after ${timeoutMs / 1000}s]`)
        }
      }, timeoutMs)

      return new Promise<{ success: boolean; exitCode: number | null }>((resolve) => {
        proc.on('close', (code) => {
          clearTimeout(timer)
          activeProcesses.delete(processId)
          send('exit', code ?? -1)
          resolve({ success: (code ?? -1) === 0, exitCode: code })
        })
        proc.on('error', (err) => {
          clearTimeout(timer)
          activeProcesses.delete(processId)
          send('stderr', `\n[Error: ${err.message}]`)
          send('exit', -1)
          resolve({ success: false, exitCode: -1 })
        })
      })
    }
  )

  // ── Kill Process ─────────────────────────────────────────────────────────

  ipcMain.handle('tool:kill-process', (_, { processId }: { processId: string }) => {
    const proc = activeProcesses.get(processId)
    if (proc) {
      proc.kill('SIGTERM')
      activeProcesses.delete(processId)
      return { success: true }
    }
    return { success: false, error: 'Process not found' }
  })

  // ── Pick Directory (native dialog) ───────────────────────────────────────

  ipcMain.handle('tool:pick-directory', async () => {
    const win = BrowserWindow.getFocusedWindow()
    if (!win) return null
    const result = await dialog.showOpenDialog(win, {
      properties: ['openDirectory']
    })
    return result.canceled ? null : result.filePaths[0]
  })

  // ── Pick File ────────────────────────────────────────────────────────────

  ipcMain.handle('tool:pick-file', async () => {
    const win = BrowserWindow.getFocusedWindow()
    if (!win) return null
    const result = await dialog.showOpenDialog(win, {
      properties: ['openFile']
    })
    return result.canceled ? null : result.filePaths[0]
  })
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function searchRecursive(
  dir: string,
  pattern: string,
  results: string[],
  depth: number,
  maxDepth: number
): Promise<void> {
  if (depth > maxDepth || results.length > 200) return

  let entries: fsSync.Dirent[]
  try {
    entries = await fs.readdir(dir, { withFileTypes: true }) as fsSync.Dirent[]
  } catch {
    return
  }

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.name.toLowerCase().includes(pattern)) {
      results.push(fullPath)
    }
    if (entry.isDirectory() && !entry.name.startsWith('.')) {
      await searchRecursive(fullPath, pattern, results, depth + 1, maxDepth)
    }
  }
}
