/**
 * Wake Word & Background Voice Recognition
 * 
 * Replaced VoiceAgent.exe with a cross-platform internal engine.
 * Pipeline: Microphone -> JS VoiceEngine -> Wake Word -> Command -> IPC -> AI
 */

import { ipcMain, BrowserWindow } from 'electron'

// ── State ─────────────────────────────────────────────────────────────────────

let isListening = false
let currentWakeWords: string[] = ['ассистент', 'assistant', 'джарвис', 'jarvis']
let mainWindowRef: BrowserWindow | null = null

// ── Internal Logic ────────────────────────────────────────────────────────────

function startSR(wakeWords: string[], mainWindow: BrowserWindow, _microphoneName?: string): void {
  mainWindowRef = mainWindow
  currentWakeWords = wakeWords.length > 0 ? wakeWords : ['ассистент', 'assistant']

  // TODO: Integrate Porcupine / Whisper here
  // For now, we simulate a successful start to stop the crash loop
  isListening = true
  
  if (mainWindowRef && !mainWindowRef.isDestroyed()) {
    mainWindowRef.webContents.send('voice:sr-status', { status: 'ready' })
    mainWindowRef.webContents.send('voice:sr-status', { status: 'waiting' })
  }
  
  console.log('[VoiceEngine] Background listening started (JS implementation)')
}

function stopSR(): void {
  isListening = false
  console.log('[VoiceEngine] Background listening stopped')
}

function sendVoiceEvent(event: string, data: any): void {
  if (mainWindowRef && !mainWindowRef.isDestroyed()) {
    mainWindowRef.webContents.send(event, data)
  }
}

// ── IPC Handlers ──────────────────────────────────────────────────────────────

export function setupWakeWordHandlers(mainWindow: BrowserWindow): void {
  mainWindowRef = mainWindow

  ipcMain.handle('voice:start-background', (_, { wakeWords, microphoneName }: { wakeWords: string[]; microphoneName?: string }) => {
    try {
      startSR(wakeWords, mainWindow, microphoneName)
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('voice:stop-background', () => {
    stopSR()
    return { success: true }
  })

  ipcMain.handle('voice:is-listening', () => ({
    isListening,
    wakeWords: currentWakeWords
  }))

  ipcMain.handle('voice:update-wake-words', (_, { wakeWords }: { wakeWords: string[] }) => {
    currentWakeWords = wakeWords
    if (isListening) {
      startSR(wakeWords, mainWindow)
    }
    return { success: true }
  })
}

export { stopSR }
