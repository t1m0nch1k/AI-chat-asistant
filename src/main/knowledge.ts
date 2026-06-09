/**
 * Agent Knowledge Base — персональная база знаний агента.
 * Хранится в JSON файле рядом с настройками приложения.
 * Агент записывает сюда ответы пользователя на уточняющие вопросы.
 */

import { ipcMain, app } from 'electron'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'

// ── Типы ─────────────────────────────────────────────────────────────────────

export interface KnowledgeEntry {
  id: string
  category: 'app' | 'website' | 'file' | 'person' | 'command' | 'preference' | 'other'
  key: string          // Что искали: "speedrun", "моя музыка", "рабочий проект"
  value: string        // Что нашли: "C:\\Games\\speedrun.exe", "https://...", "D:\\Music"
  description?: string // Дополнительный контекст
  learnedAt: number
  usedCount: number
  lastUsed?: number
}

export interface KnowledgeDB {
  version: number
  entries: KnowledgeEntry[]
  updatedAt: number
}

// ── Путь к файлу ──────────────────────────────────────────────────────────────

function getKnowledgePath(): string {
  const userDataPath = app.getPath('userData')
  return join(userDataPath, 'agent-knowledge.json')
}

// ── Чтение/запись ─────────────────────────────────────────────────────────────

function loadDB(): KnowledgeDB {
  const path = getKnowledgePath()
  if (!existsSync(path)) {
    return { version: 1, entries: [], updatedAt: Date.now() }
  }
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    return { version: 1, entries: [], updatedAt: Date.now() }
  }
}

function saveDB(db: KnowledgeDB): void {
  const path = getKnowledgePath()
  db.updatedAt = Date.now()
  writeFileSync(path, JSON.stringify(db, null, 2), 'utf8')
}

// ── Поиск по базе ─────────────────────────────────────────────────────────────

function searchEntries(db: KnowledgeDB, query: string): KnowledgeEntry[] {
  const q = query.toLowerCase().trim()
  return db.entries.filter(e =>
    e.key.toLowerCase().includes(q) ||
    e.value.toLowerCase().includes(q) ||
    e.description?.toLowerCase().includes(q)
  ).sort((a, b) => b.usedCount - a.usedCount)
}

// ── Форматирование для system prompt ─────────────────────────────────────────

export function formatKnowledgeForPrompt(entries: KnowledgeEntry[]): string {
  if (entries.length === 0) return ''

  const byCategory: Record<string, KnowledgeEntry[]> = {}
  for (const e of entries) {
    if (!byCategory[e.category]) byCategory[e.category] = []
    byCategory[e.category].push(e)
  }

  const categoryLabels: Record<string, string> = {
    app: 'Applications',
    website: 'Websites',
    file: 'Files & Folders',
    person: 'People',
    command: 'Commands',
    preference: 'User Preferences',
    other: 'Other'
  }

  let result = '\nPERSONAL KNOWLEDGE BASE (learned from user):\n'
  for (const [cat, items] of Object.entries(byCategory)) {
    result += `\n${categoryLabels[cat] || cat}:\n`
    for (const item of items) {
      result += `  - "${item.key}" → ${item.value}`
      if (item.description) result += ` (${item.description})`
      result += '\n'
    }
  }
  result += '\nUse this knowledge when the user refers to these items by name.\n'
  return result
}

// ── IPC Handlers ──────────────────────────────────────────────────────────────

export function setupKnowledgeHandlers(): void {

  // Получить все записи
  ipcMain.handle('knowledge:get-all', () => {
    return loadDB()
  })

  // Поиск записей
  ipcMain.handle('knowledge:search', (_, { query }: { query: string }) => {
    const db = loadDB()
    return searchEntries(db, query)
  })

  // Добавить/обновить запись
  ipcMain.handle('knowledge:save', (_, entry: Omit<KnowledgeEntry, 'id' | 'learnedAt' | 'usedCount'> & { id?: string }) => {
    const db = loadDB()

    // Ищем существующую запись с таким же key
    const existingIdx = db.entries.findIndex(
      e => e.key.toLowerCase() === entry.key.toLowerCase()
    )

    if (existingIdx >= 0) {
      // Обновляем существующую
      db.entries[existingIdx] = {
        ...db.entries[existingIdx],
        ...entry,
        id: db.entries[existingIdx].id,
        learnedAt: db.entries[existingIdx].learnedAt,
        usedCount: db.entries[existingIdx].usedCount
      }
    } else {
      // Создаём новую
      db.entries.push({
        ...entry,
        id: entry.id || crypto.randomUUID(),
        learnedAt: Date.now(),
        usedCount: 0
      })
    }

    saveDB(db)
    return { success: true, count: db.entries.length }
  })

  // Пометить запись как использованную
  ipcMain.handle('knowledge:mark-used', (_, { id }: { id: string }) => {
    const db = loadDB()
    const entry = db.entries.find(e => e.id === id)
    if (entry) {
      entry.usedCount++
      entry.lastUsed = Date.now()
      saveDB(db)
    }
    return { success: true }
  })

  // Удалить запись
  ipcMain.handle('knowledge:delete', (_, { id }: { id: string }) => {
    const db = loadDB()
    db.entries = db.entries.filter(e => e.id !== id)
    saveDB(db)
    return { success: true }
  })

  // Очистить всё
  ipcMain.handle('knowledge:clear', () => {
    saveDB({ version: 1, entries: [], updatedAt: Date.now() })
    return { success: true }
  })
}
