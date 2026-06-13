import {
  app,
  shell,
  BrowserWindow,
  ipcMain,
  screen,
  globalShortcut,
  Notification,
  nativeTheme,
  dialog
} from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { createTray } from './tray'
import { setupAIHandlers } from './ai'
import { toolManager } from './tool-manager'
import { setupToolHandlers } from './tools'
import { agentOrchestrator } from './agent-orchestrator'
import { setupStoreHandlers } from './store'
import { setupWebToolHandlers } from './webtools'
import { setupVoiceHandlers } from './voice'
import { setupSystemToolHandlers } from './systemtools'
import { setupWakeWordHandlers, stopSR } from './wakeword'
import { setupScreenAnalysisHandlers } from './screenanalysis'
import { setupKnowledgeHandlers } from './knowledge'
import { setupSchedulerHandlers, stopSchedulerLoop } from './scheduler'
import { setupAgentHandlers, setAgentWindow } from './computer-agent'
import { setupLogHandlers } from './logger'
import { setupCoderHandlers } from './modules/coder'
import updaterPkg from 'electron-updater'
const { autoUpdater } = updaterPkg

// ── Globals ──────────────────────────────────────────────────────────────────

let mainWindow: BrowserWindow | null = null
let isWindowMode = true  // false = tray popup, true = full window

// ── Window Factory ────────────────────────────────────────────────────────────

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: isWindowMode ? 900 : 420,
    height: isWindowMode ? 700 : 680,
    minWidth: 360,
    minHeight: 500,
    maxWidth: isWindowMode ? 0 : 800,
    maxHeight: isWindowMode ? 0 : 900,
    show: true,
    autoHideMenuBar: true,
    frame: !isWindowMode,
    resizable: true,
    skipTaskbar: true,
    alwaysOnTop: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,       // Security: disabled
      webSecurity: true,
      allowRunningInsecureContent: false
    },
    transparent: true,
    backgroundColor: '#00000000',
    roundedCorners: true            // Windows 11 rounded corners
  })

  // Open external links in default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (is.dev) {
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  }

  // Hide on blur (tray-style behaviour — only in tray mode)
  mainWindow.on('blur', () => {
    if (!isWindowMode && mainWindow && !mainWindow.webContents.isDevToolsOpened()) {
      mainWindow.hide()
    }
  })

  // Close confirmation dialog
  mainWindow.on('close', async (e) => {
    if (!isQuitting) {
      e.preventDefault()
      mainWindow?.webContents.send('app:show-quit-confirmation')
    }
  })

  // Apply window-mode settings on first launch
  if (isWindowMode) {
    mainWindow.setSkipTaskbar(false)
    mainWindow.setResizable(true)
    mainWindow.setAlwaysOnTop(false)
    const { workArea } = screen.getPrimaryDisplay()
    const x = Math.round(workArea.x + (workArea.width - 900) / 2)
    const y = Math.round(workArea.y + (workArea.height - 700) / 2)
    mainWindow.setPosition(x, y, true)
    mainWindow.show()
    mainWindow.focus()
  } else {
    // Даже в режиме трея, при самом первом запуске, стоит показать окно, чтобы пользователь знал, что программа работает
    positionAndShow()
  }
}

function loadMainWindow(): void {
  if (!mainWindow) return

  // Load app
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// Флаг — реальный выход или просто скрытие
let isQuitting = false

export function setQuitting(value: boolean) {
  isQuitting = value
}

// ── Toggle Window ─────────────────────────────────────────────────────────────

export function toggleWindow(): void {
  if (!mainWindow) return

  if (mainWindow.isVisible() && mainWindow.isFocused()) {
    mainWindow.hide()
  } else {
    positionAndShow()
  }
}

function positionAndShow(): void {
  if (!mainWindow) return

  const cursorPoint = screen.getCursorScreenPoint()
  const display = screen.getDisplayNearestPoint(cursorPoint)
  const { width, height } = mainWindow.getBounds()
  const { workArea } = display

  // Bottom-right corner (near system tray)
  const x = workArea.x + workArea.width - width - 16
  const y = workArea.y + workArea.height - height - 16

  mainWindow.setPosition(x, y, false)
  mainWindow.show()
  mainWindow.focus()
}

// ── App Lifecycle ─────────────────────────────────────────────────────────────

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.artem.ai-chat-assistant')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  createWindow()
  createTray(mainWindow!, toggleWindow, () => {
    isQuitting = true
    app.quit()
  })
  setupStoreHandlers()
  setupAIHandlers()
  toolManager.init()
  agentOrchestrator.init()
  setupWebToolHandlers()
  setupVoiceHandlers()
  setupWakeWordHandlers(mainWindow!)
  setupScreenAnalysisHandlers()
  setupKnowledgeHandlers()
  setupSchedulerHandlers(mainWindow!)
  setupLogHandlers()
  setupCoderHandlers()
  setupAgentHandlers()
  setAgentWindow(mainWindow!)
  registerHotkey()


  // Auto-start with Windows
  setupAutoLaunch()

  // Auto-updater (production only)
  if (!is.dev) {
    autoUpdater.checkForUpdatesAndNotify()

    autoUpdater.on('update-available', () => {
      mainWindow?.webContents.send('app:update-available')
    })

    autoUpdater.on('update-downloaded', () => {
      mainWindow?.webContents.send('app:update-downloaded')
    })
  }

  loadMainWindow()
})

app.on('window-all-closed', () => {
  // Keep running in tray — do nothing
})

app.on('before-quit', () => {
  isQuitting = true
  stopSR()
  stopSchedulerLoop()
})

// ── Global Hotkey ─────────────────────────────────────────────────────────────

function registerHotkey(hotkey = 'Alt+Shift+G'): void {
  globalShortcut.unregisterAll()
  try {
    globalShortcut.register(hotkey, toggleWindow)
  } catch {
    console.warn(`Failed to register hotkey: ${hotkey}`)
  }
}

// ── Auto Launch ───────────────────────────────────────────────────────────────

function setupAutoLaunch(): void {
  // electron-builder handles this via NSIS; for dev we use app.setLoginItemSettings
  if (!is.dev) {
    app.setLoginItemSettings({
      openAtLogin: false, // Controlled by user settings
      path: process.execPath
    })
  }
}

// ── IPC Handlers ─────────────────────────────────────────────────────────────

ipcMain.handle('app:quit', () => {
  isQuitting = true
  app.quit()
})

ipcMain.handle('app:toggle-window', () => toggleWindow())

ipcMain.handle('app:hide-window', () => mainWindow?.hide())
ipcMain.handle('app:minimize-window', () => mainWindow?.minimize())
ipcMain.handle('app:maximize-window', () => {
  if (!mainWindow) return
  if (mainWindow.isFullScreen()) {
    mainWindow.setFullScreen(false)
  } else {
    mainWindow.setFullScreen(true)
  }
})

ipcMain.handle('app:set-auto-start', (_, enabled: boolean) => {
  app.setLoginItemSettings({ openAtLogin: enabled, path: process.execPath })
})

ipcMain.handle('app:register-hotkey', (_, hotkey: string) => {
  registerHotkey(hotkey)
})

ipcMain.handle('app:show-notification', (_, { title, body }: { title: string; body: string }) => {
  if (Notification.isSupported()) {
    new Notification({ title, body, silent: false }).show()
  }
})

ipcMain.handle('app:get-theme', () => nativeTheme.shouldUseDarkColors ? 'dark' : 'light')

ipcMain.handle('app:get-user-info', () => ({
  username: process.env.USERNAME || process.env.USER || 'User',
  homedir: require('os').homedir(),
  desktop: require('path').join(require('os').homedir(), 'Desktop'),
  documents: require('path').join(require('os').homedir(), 'Documents')
}))

ipcMain.handle('app:open-path', (_, filePath: string) => {
  shell.showItemInFolder(filePath)
})

ipcMain.handle('app:get-window-mode', () => isWindowMode)

ipcMain.handle('app:set-window-mode', (_, windowMode: boolean) => {
  if (!mainWindow) return
  isWindowMode = windowMode

  if (windowMode) {
    // Полноценное окно — показываем в taskbar, убираем always-on-top
    mainWindow.setSkipTaskbar(false)
    mainWindow.setResizable(true)
    mainWindow.setAlwaysOnTop(false)
    mainWindow.setSize(900, 700, true)
    // Центрируем на экране
    const { workArea } = screen.getPrimaryDisplay()
    const x = Math.round(workArea.x + (workArea.width - 900) / 2)
    const y = Math.round(workArea.y + (workArea.height - 700) / 2)
    mainWindow.setPosition(x, y, true)
    mainWindow.show()
    mainWindow.focus()
    mainWindow.webContents.send('window-mode-changed', true)
  } else {
    // Tray popup — скрываем из taskbar
    mainWindow.setSkipTaskbar(true)
    mainWindow.setSize(420, 680, true)
    mainWindow.webContents.send('window-mode-changed', false)
    positionAndShow()
  }
})
