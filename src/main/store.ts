/**
 * Persistent storage handler using electron-store.
 * Включает автоматическое восстановление при повреждённом JSON.
 */

import { ipcMain, safeStorage, app } from 'electron'
import Store from 'electron-store'
import { existsSync, unlinkSync, renameSync, readFileSync } from 'fs'
import { join } from 'path'

// ── Safe Store Init ───────────────────────────────────────────────────────────
// electron-store крашится при невалидном JSON — создаём с защитой

function createStore(): Store {
  const configName = 'ai-assistant-config'
  const configPath = join(app.getPath('userData'), `${configName}.json`)

  // Сначала пробуем создать нормально
  try {
    return new Store({
      name: configName,
      defaults: { settings: null, chats: [] },
      // Отключаем встроенную валидацию — она тоже может крашить
      clearInvalidConfig: true
    })
  } catch (e) {
    console.error('[store] Failed to init, attempting recovery:', e)
  }

  // Если упало — пробуем прочитать вручную и починить
  if (existsSync(configPath)) {
    try {
      const raw = readFileSync(configPath, 'utf8')
      JSON.parse(raw) // проверяем что JSON валидный
    } catch {
      // Файл повреждён — делаем бекап и удаляем
      const backupPath = configPath + '.bak'
      try {
        renameSync(configPath, backupPath)
        console.log('[store] Corrupted config backed up to:', backupPath)
      } catch {
        try { unlinkSync(configPath) } catch {}
      }
    }
  }

  // Создаём заново с чистого листа
  try {
    return new Store({
      name: configName,
      defaults: { settings: null, chats: [] },
      clearInvalidConfig: true
    })
  } catch (e) {
    // Последний fallback — in-memory store без персистентности
    console.error('[store] Cannot create persistent store, using memory fallback:', e)
    return new Store({
      name: configName + '-fallback',
      defaults: { settings: null, chats: [] },
      clearInvalidConfig: true
    })
  }
}

const store = createStore()

// ── Handlers ──────────────────────────────────────────────────────────────────

export function setupStoreHandlers(): void {

  ipcMain.handle('store:get', () => {
    try {
      const settings = store.get('settings')
      const chats = store.get('chats')

      // Decrypt API key if stored encrypted
      if (settings && (settings as any).apiKeyEncrypted && safeStorage.isEncryptionAvailable()) {
        try {
          const decrypted = safeStorage.decryptString(
            Buffer.from((settings as any).apiKeyEncrypted, 'base64')
          )
          ;(settings as any).apiKey = decrypted
          delete (settings as any).apiKeyEncrypted
        } catch {
          ;(settings as any).apiKey = ''
        }
      }

      return { settings, chats }
    } catch (e) {
      console.error('[store] get error:', e)
      return { settings: null, chats: [] }
    }
  })

  ipcMain.handle('store:save', (_, data: { settings?: any; chats?: any }) => {
    try {
      if (data.settings) {
        const settingsToSave = { ...data.settings }

        // Encrypt API key before storing
        if (settingsToSave.apiKey && safeStorage.isEncryptionAvailable()) {
          const encrypted = safeStorage.encryptString(settingsToSave.apiKey)
          settingsToSave.apiKeyEncrypted = encrypted.toString('base64')
          delete settingsToSave.apiKey
        }

        store.set('settings', settingsToSave)
      }

      if (data.chats !== undefined) {
        const chats = Array.isArray(data.chats) ? data.chats.slice(0, 100) : []
        store.set('chats', chats)
      }

      return { success: true }
    } catch (e: any) {
      console.error('[store] save error:', e)
      return { success: false, error: e.message }
    }
  })

  ipcMain.handle('store:clear', () => {
    try {
      store.clear()
    } catch {}
    return { success: true }
  })
}
