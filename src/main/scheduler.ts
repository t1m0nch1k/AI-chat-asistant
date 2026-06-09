/**
 * Scheduler — будильники, таймеры, напоминания, события.
 * Хранится в JSON. Уведомления через Electron Notification + Windows SAPI TTS.
 */

import { ipcMain, app, Notification, BrowserWindow } from 'electron'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import { exec } from 'child_process'

// ── Types ─────────────────────────────────────────────────────────────────────

export type ScheduleType = 'alarm' | 'timer' | 'reminder' | 'event'

export interface ScheduleItem {
  id: string
  type: ScheduleType
  title: string
  message?: string
  // Для alarm/reminder/event — абсолютный timestamp
  fireAt?: number
  // Для timer — секунды от момента старта
  durationSeconds?: number
  // Для event — дата (YYYY-MM-DD) и время (HH:MM)
  date?: string
  time?: string
  // Повтор: daily, weekly, none
  repeat?: 'none' | 'daily' | 'weekly'
  createdAt: number
  // Статус
  status: 'pending' | 'active' | 'fired' | 'cancelled'
  // Для таймера — когда стартовал
  startedAt?: number
}

interface SchedulerDB {
  items: ScheduleItem[]
  updatedAt: number
}

// ── State ─────────────────────────────────────────────────────────────────────

let checkInterval: ReturnType<typeof setInterval> | null = null
let mainWindowRef: BrowserWindow | null = null

// ── Storage ───────────────────────────────────────────────────────────────────

function getDBPath(): string {
  return join(app.getPath('userData'), 'scheduler.json')
}

function loadDB(): SchedulerDB {
  const path = getDBPath()
  if (!existsSync(path)) return { items: [], updatedAt: Date.now() }
  try { return JSON.parse(readFileSync(path, 'utf8')) } catch { return { items: [], updatedAt: Date.now() } }
}

function saveDB(db: SchedulerDB): void {
  db.updatedAt = Date.now()
  writeFileSync(getDBPath(), JSON.stringify(db, null, 2), 'utf8')
}

// ── Notification ──────────────────────────────────────────────────────────────

function fireNotification(item: ScheduleItem): void {
  const icons: Record<ScheduleType, string> = {
    alarm: '⏰', timer: '⏱️', reminder: '🔔', event: '📅'
  }
  const title = `${icons[item.type]} ${item.title}`
  const body = item.message || ''

  // Windows notification
  if (Notification.isSupported()) {
    const n = new Notification({ title, body, silent: false })
    n.show()
    n.on('click', () => {
      mainWindowRef?.show()
      mainWindowRef?.focus()
      mainWindowRef?.webContents.send('scheduler:notification-click', item.id)
    })
  }

  // Показываем окно и отправляем событие в renderer
  if (mainWindowRef && !mainWindowRef.isDestroyed()) {
    mainWindowRef.webContents.send('scheduler:fired', item)
    mainWindowRef.flashFrame(true)
    setTimeout(() => mainWindowRef?.flashFrame(false), 3000)
  }

  // TTS через Windows SAPI
  const text = `${item.title}${item.message ? '. ' + item.message : ''}`
  const escaped = text.replace(/'/g, "''").slice(0, 200)
  exec(
    `powershell.exe -NoProfile -NonInteractive -Command "` +
    `Add-Type -AssemblyName System.Speech; ` +
    `$s = New-Object System.Speech.Synthesis.SpeechSynthesizer; ` +
    `$s.Speak('${escaped}'); $s.Dispose()"`,
    { windowsHide: true }
  )
}

// ── Scheduler Loop ────────────────────────────────────────────────────────────

function startSchedulerLoop(): void {
  if (checkInterval) return

  checkInterval = setInterval(() => {
    const db = loadDB()
    const now = Date.now()
    let changed = false

    for (const item of db.items) {
      if (item.status !== 'pending' && item.status !== 'active') continue

      let shouldFire = false

      if (item.type === 'timer' && item.status === 'active' && item.startedAt && item.durationSeconds) {
        shouldFire = now >= item.startedAt + item.durationSeconds * 1000
      } else if (item.fireAt && now >= item.fireAt) {
        shouldFire = true
      }

      if (shouldFire) {
        fireNotification(item)

        if (item.repeat === 'daily' && item.fireAt) {
          item.fireAt += 24 * 60 * 60 * 1000
          item.status = 'pending'
        } else if (item.repeat === 'weekly' && item.fireAt) {
          item.fireAt += 7 * 24 * 60 * 60 * 1000
          item.status = 'pending'
        } else {
          item.status = 'fired'
        }
        changed = true
      }
    }

    if (changed) saveDB(db)
  }, 1000) // Проверяем каждую секунду
}

function stopSchedulerLoop(): void {
  if (checkInterval) {
    clearInterval(checkInterval)
    checkInterval = null
  }
}

// ── Parse natural language time ───────────────────────────────────────────────

export function parseTimeExpression(expr: string): number | null {
  const now = Date.now()
  const s = expr.toLowerCase().trim()

  // Через N минут/часов/секунд
  const inMatch = s.match(/через\s+(\d+)\s*(сек|мин|час|минут|секунд|часов|h|m|s)/i)
  if (inMatch) {
    const n = parseInt(inMatch[1])
    const unit = inMatch[2].toLowerCase()
    if (unit.startsWith('сек') || unit === 's') return now + n * 1000
    if (unit.startsWith('мин') || unit === 'm') return now + n * 60 * 1000
    if (unit.startsWith('час') || unit === 'h') return now + n * 3600 * 1000
  }

  // In N minutes/hours/seconds (English)
  const inMatchEn = s.match(/in\s+(\d+)\s*(second|minute|hour|sec|min|h|m|s)/i)
  if (inMatchEn) {
    const n = parseInt(inMatchEn[1])
    const unit = inMatchEn[2].toLowerCase()
    if (unit.startsWith('sec') || unit === 's') return now + n * 1000
    if (unit.startsWith('min') || unit === 'm') return now + n * 60 * 1000
    if (unit.startsWith('hour') || unit === 'h') return now + n * 3600 * 1000
  }

  // HH:MM формат (сегодня или завтра)
  const timeMatch = s.match(/(\d{1,2}):(\d{2})/)
  if (timeMatch) {
    const d = new Date()
    d.setHours(parseInt(timeMatch[1]), parseInt(timeMatch[2]), 0, 0)
    if (d.getTime() <= now) d.setDate(d.getDate() + 1) // завтра
    return d.getTime()
  }

  // Завтра в HH:MM
  const tomorrowMatch = s.match(/завтра.*?(\d{1,2}):(\d{2})|tomorrow.*?(\d{1,2}):(\d{2})/)
  if (tomorrowMatch) {
    const h = parseInt(tomorrowMatch[1] || tomorrowMatch[3])
    const m = parseInt(tomorrowMatch[2] || tomorrowMatch[4])
    const d = new Date()
    d.setDate(d.getDate() + 1)
    d.setHours(h, m, 0, 0)
    return d.getTime()
  }

  return null
}

// ── IPC Handlers ──────────────────────────────────────────────────────────────

export function setupSchedulerHandlers(mainWindow: BrowserWindow): void {
  mainWindowRef = mainWindow
  startSchedulerLoop()

  // Создать элемент расписания
  ipcMain.handle('scheduler:create', (_, item: Omit<ScheduleItem, 'id' | 'createdAt' | 'status'>) => {
    const db = loadDB()
    const newItem: ScheduleItem = {
      ...item,
      id: crypto.randomUUID(),
      createdAt: Date.now(),
      status: item.type === 'timer' ? 'pending' : 'pending'
    }
    db.items.push(newItem)
    saveDB(db)
    return { success: true, item: newItem }
  })

  // Старт таймера
  ipcMain.handle('scheduler:start-timer', (_, { id }: { id: string }) => {
    const db = loadDB()
    const item = db.items.find(i => i.id === id)
    if (!item || item.type !== 'timer') return { success: false, error: 'Timer not found' }
    item.status = 'active'
    item.startedAt = Date.now()
    saveDB(db)
    return { success: true }
  })

  // Получить все элементы
  ipcMain.handle('scheduler:get-all', () => {
    return loadDB()
  })

  // Получить активные (pending + active)
  ipcMain.handle('scheduler:get-active', () => {
    const db = loadDB()
    return db.items.filter(i => i.status === 'pending' || i.status === 'active')
  })

  // Отменить/удалить
  ipcMain.handle('scheduler:cancel', (_, { id }: { id: string }) => {
    const db = loadDB()
    const item = db.items.find(i => i.id === id)
    if (item) item.status = 'cancelled'
    saveDB(db)
    return { success: true }
  })

  ipcMain.handle('scheduler:delete', (_, { id }: { id: string }) => {
    const db = loadDB()
    db.items = db.items.filter(i => i.id !== id)
    saveDB(db)
    return { success: true }
  })

  // Очистить выполненные
  ipcMain.handle('scheduler:clear-fired', () => {
    const db = loadDB()
    db.items = db.items.filter(i => i.status !== 'fired' && i.status !== 'cancelled')
    saveDB(db)
    return { success: true }
  })

  // Парсить время из текста
  ipcMain.handle('scheduler:parse-time', (_, { expr }: { expr: string }) => {
    const ts = parseTimeExpression(expr)
    return { success: ts !== null, timestamp: ts }
  })
}

export { stopSchedulerLoop }
