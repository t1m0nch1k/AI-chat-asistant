import { ipcMain } from 'electron'
import fs from 'fs'
import path from 'path'
import { app } from 'electron'
import Store from 'electron-store'

interface LogEntry {
  timestamp: number
  level: 'log' | 'warn' | 'error'
  message: string
  source: 'main' | 'renderer'
}

const MAX_LOGS = 500
const logs: LogEntry[] = []
const store = new Store({ name: 'ai-assistant-config' })

function getLogPath() {
  return path.join(app.getPath('userData'), 'debug_logs.txt')
}

function writeToLogFile(entry: LogEntry): void {
  try {
    const settings = store.get('settings') as any
    if (settings?.logToFile === false) return

    const date = new Date(entry.timestamp).toISOString()
    const line = `[${date}] [${entry.source.toUpperCase()}] [${entry.level.toUpperCase()}] ${entry.message}\n`
    fs.appendFileSync(getLogPath(), line, 'utf8')
  } catch (e) {
    console.error('Failed to write to log file:', e)
  }
}

function addLog(level: LogEntry['level'], message: string, source: LogEntry['source']): void {
  const entry = { timestamp: Date.now(), level, message, source }
  logs.push(entry)
  if (logs.length > MAX_LOGS) {
    logs.splice(0, logs.length - MAX_LOGS)
  }
  writeToLogFile(entry)
}

export function setupLogHandlers(): void {
  // Clear log file on start if enabled
  try {
    const settings = store.get('settings') as any
    if (settings?.logToFile !== false) {
      fs.writeFileSync(getLogPath(), '--- App Start ---\n', 'utf8')
    }
  } catch (e) {}

  // Intercept main process console
  const origLog = console.log
  const origWarn = console.warn
  const origError = console.error

  console.log = (...args: unknown[]) => {
    addLog('log', args.map(String).join(' '), 'main')
    origLog.apply(console, args)
  }
  console.warn = (...args: unknown[]) => {
    addLog('warn', args.map(String).join(' '), 'main')
    origWarn.apply(console, args)
  }
  console.error = (...args: unknown[]) => {
    addLog('error', args.map(String).join(' '), 'main')
    origError.apply(console, args)
  }

  // Global exception handlers
  process.on('uncaughtException', (err) => {
    addLog('error', `UNCUGHT EXCEPTION: ${err.stack || err.message}`, 'main')
  })
  process.on('unhandledRejection', (reason) => {
    addLog('error', `UNHANDLED REJECTION: ${reason}`, 'main')
  })

  ipcMain.handle('logs:get', () => {
    return logs
  })

  ipcMain.handle('logs:clear', () => {
    logs.length = 0
    return { success: true }
  })

  ipcMain.handle('logs:add', (_event, entry: { level: LogEntry['level']; message: string }) => {
    addLog(entry.level, entry.message, 'renderer')
    return { success: true }
  })
}
  // Global exception handlers
  process.on('uncaughtException', (err) => {
    addLog('error', `UNCUGHT EXCEPTION: ${err.stack || err.message}`, 'main')
  })
  process.on('unhandledRejection', (reason) => {
    addLog('error', `UNHANDLED REJECTION: ${reason}`, 'main')
  })

  ipcMain.handle('logs:get', () => {
    return logs
  })

  ipcMain.handle('logs:clear', () => {
    logs.length = 0
    return { success: true }
  })

  ipcMain.handle('logs:add', (_event, entry: { level: LogEntry['level']; message: string }) => {
    addLog(entry.level, entry.message, 'renderer')
    return { success: true }
  })
}
