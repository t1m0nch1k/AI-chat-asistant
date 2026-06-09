/**
 * Preload script — exposes a safe, typed API to the renderer via contextBridge.
 * nodeIntegration is OFF; all Node.js access goes through this bridge.
 */

import { contextBridge, ipcRenderer } from 'electron'

// ── Type-safe API surface ─────────────────────────────────────────────────────

const api = {
  // ── App ──────────────────────────────────────────────────────────────────
  quitApp: () => ipcRenderer.invoke('app:quit'),
  hideWindow: () => ipcRenderer.invoke('app:hide-window'),
  minimizeWindow: () => ipcRenderer.invoke('app:minimize-window'),
  maximizeWindow: () => ipcRenderer.invoke('app:maximize-window'),
  toggleWindow: () => ipcRenderer.invoke('app:toggle-window'),
  setAutoStart: (enabled: boolean) => ipcRenderer.invoke('app:set-auto-start', enabled),
  registerHotkey: (hotkey: string) => ipcRenderer.invoke('app:register-hotkey', hotkey),
  showNotification: (title: string, body: string) =>
    ipcRenderer.invoke('app:show-notification', { title, body }),
  getTheme: () => ipcRenderer.invoke('app:get-theme'),
  getUserInfo: () => ipcRenderer.invoke('app:get-user-info'),
  getWindowMode: () => ipcRenderer.invoke('app:get-window-mode'),
  setWindowMode: (windowMode: boolean) => ipcRenderer.invoke('app:set-window-mode', windowMode),
  onWindowModeChanged: (cb: (windowMode: boolean) => void) => {
    const handler = (_: unknown, mode: boolean) => cb(mode)
    ipcRenderer.on('window-mode-changed', handler)
    return () => ipcRenderer.removeListener('window-mode-changed', handler)
  },
  onQuitConfirmation: (cb: () => void) => {
    const handler = () => cb()
    ipcRenderer.on('app:show-quit-confirmation', handler)
    return () => ipcRenderer.removeListener('app:show-quit-confirmation', handler)
  },
  openPath: (filePath: string) => ipcRenderer.invoke('app:open-path', filePath),

  // ── Store ─────────────────────────────────────────────────────────────────
  getSettings: () => ipcRenderer.invoke('store:get'),
  saveSettings: (data: unknown) => ipcRenderer.invoke('store:save', data),
  clearSettings: () => ipcRenderer.invoke('store:clear'),

  // ── AI Streaming ─────────────────────────────────────────────────────────
  chatSimple: (data: { provider: string; apiKey: string; model: string; prompt: string; ollamaBaseUrl?: string; openrouterBaseUrl?: string }) =>
    ipcRenderer.invoke('ai:chat-simple', data),
  startChat: (data: unknown) => ipcRenderer.invoke('ai:chat', data),
  abortChat: () => ipcRenderer.invoke('ai:abort'),

  onChunk: (cb: (chunk: string) => void) => {
    const handler = (_: unknown, chunk: string) => cb(chunk)
    ipcRenderer.on('ai:chunk', handler)
    return () => ipcRenderer.removeListener('ai:chunk', handler)
  },
  onDone: (cb: () => void) => {
    const handler = () => cb()
    ipcRenderer.on('ai:done', handler)
    return () => ipcRenderer.removeListener('ai:done', handler)
  },
  onAborted: (cb: () => void) => {
    const handler = () => cb()
    ipcRenderer.on('ai:aborted', handler)
    return () => ipcRenderer.removeListener('ai:aborted', handler)
  },
  onError: (cb: (err: string) => void) => {
    const handler = (_: unknown, err: string) => cb(err)
    ipcRenderer.on('ai:error', handler)
    return () => ipcRenderer.removeListener('ai:error', handler)
  },

  // ── Navigation (from tray) ────────────────────────────────────────────────
  onNavigate: (cb: (page: string) => void) => {
    const handler = (_: unknown, page: string) => cb(page)
    ipcRenderer.on('navigate', handler)
    return () => ipcRenderer.removeListener('navigate', handler)
  },
  onNewChat: (cb: () => void) => {
    const handler = () => cb()
    ipcRenderer.on('tray:new-chat', handler)
    return () => ipcRenderer.removeListener('tray:new-chat', handler)
  },

  // ── Agent Orchestrator ────────────────────────────────────────────────────
  agentRunLoop: (data: { chatId: string; provider: string; settings: any; messages: any[]; allowedPaths: string[] }) =>
    ipcRenderer.invoke('agent:run-loop', data),
  agentAbort: () => ipcRenderer.invoke('agent:abort'),

  // ── System Tools ──────────────────────────────────────────────────────────
  openUrl: (url: string) => ipcRenderer.invoke('sys:open-url', { url }),
  launchApp: (app: string, args?: string) => ipcRenderer.invoke('sys:launch-app', { app, args }),
  getCursorPos: () => ipcRenderer.invoke('sys:get-cursor-pos'),
  moveCursor: (x: number, y: number) => ipcRenderer.invoke('sys:move-cursor', { x, y }),
  moveCursorSmooth: (x: number, y: number, steps?: number) => ipcRenderer.invoke('sys:move-cursor-smooth', { x, y, steps }),
  drag: (x1: number, y1: number, x2: number, y2: number) => ipcRenderer.invoke('sys:drag', { x1, y1, x2, y2 }),
  mouseClick: (x?: number, y?: number, button?: 'left' | 'right' | 'middle', double?: boolean) =>
    ipcRenderer.invoke('sys:mouse-click', { x, y, button, double }),
  scroll: (direction: 'up' | 'down', amount?: number) =>
    ipcRenderer.invoke('sys:scroll', { direction, amount }),
  typeText: (text: string) => ipcRenderer.invoke('sys:type-text', { text }),
  pressKey: (key: string) => ipcRenderer.invoke('sys:press-key', { key }),
  screenshot: (savePath?: string) => ipcRenderer.invoke('sys:screenshot', { savePath }),
  setVolume: (level: number) => ipcRenderer.invoke('sys:set-volume', { level }),
  mute: (mute: boolean) => ipcRenderer.invoke('sys:mute', { mute }),
  getProcesses: () => ipcRenderer.invoke('sys:get-processes'),
  closeApp: (name: string) => ipcRenderer.invoke('sys:close-app', { name }),
  getDatetime: () => ipcRenderer.invoke('sys:get-datetime'),
  lockScreen: () => ipcRenderer.invoke('sys:lock-screen'),

  // ── Screen Analysis ───────────────────────────────────────────────────────
  takeScreenshot: (region?: { x: number; y: number; width: number; height: number }) =>
    ipcRenderer.invoke('screen:screenshot', { region }),
  analyzeScreen: (prompt: string, provider: string, apiKey: string, model?: string, region?: any, ollamaBaseUrl?: string) =>
    ipcRenderer.invoke('screen:analyze', { prompt, provider, apiKey, model, region, ollamaBaseUrl }),
  findElement: (description: string, apiKey: string, provider?: string, model?: string, ollamaBaseUrl?: string) =>
    ipcRenderer.invoke('screen:find-element', { description, apiKey, provider, model, ollamaBaseUrl }),
  analyzeScreenStructured: (apiKey: string, provider?: string, model?: string, region?: any, ollamaBaseUrl?: string) =>
    ipcRenderer.invoke('screen:analyze-structured', { apiKey, provider, model, region, ollamaBaseUrl }),

  // ── Wake Word / Background Voice ─────────────────────────────────────────
  startBackgroundVoice: (wakeWords: string[]) =>
    ipcRenderer.invoke('voice:start-background', { wakeWords }),
  stopBackgroundVoice: () => ipcRenderer.invoke('voice:stop-background'),
  isVoiceListening: () => ipcRenderer.invoke('voice:is-listening'),
  updateWakeWords: (wakeWords: string[]) =>
    ipcRenderer.invoke('voice:update-wake-words', { wakeWords }),
  onSRStatus: (cb: (data: { status: string; error?: string }) => void) => {
    const handler = (_: unknown, data: any) => cb(data)
    ipcRenderer.on('voice:sr-status', handler)
    return () => ipcRenderer.removeListener('voice:sr-status', handler)
  },
  onWakeDetected: (cb: (data: { text: string }) => void) => {
    const handler = (_: unknown, data: any) => cb(data)
    ipcRenderer.on('voice:wake-detected', handler)
    return () => ipcRenderer.removeListener('voice:wake-detected', handler)
  },
  onVoiceCommand: (cb: (data: { command: string }) => void) => {
    const handler = (_: unknown, data: any) => cb(data)
    ipcRenderer.on('voice:command', handler)
    return () => ipcRenderer.removeListener('voice:command', handler)
  },

  // ── Voice (TTS) ───────────────────────────────────────────────────────────
  speak: (text: string, rate?: number, volume?: number) =>
    ipcRenderer.invoke('voice:speak', { text, rate, volume }),
  speakWithVoice: (text: string, voiceName: string, rate?: number, volume?: number) =>
    ipcRenderer.invoke('voice:speak-with-voice', { text, voiceName, rate, volume }),
  stopSpeak: () => ipcRenderer.invoke('voice:stop-speak'),
  getVoices: () => ipcRenderer.invoke('voice:get-voices'),

  // ── Web Tools ─────────────────────────────────────────────────────────────
  searchWeb: (query: string) => ipcRenderer.invoke('web:search-ddg', { query }),
  searchTavily: (query: string, apiKey: string) => ipcRenderer.invoke('web:search-tavily', { query, apiKey }),
  searchYouTube: (query: string) => ipcRenderer.invoke('web:search-youtube', { query }),
  fetchPage: (url: string) => ipcRenderer.invoke('web:fetch-page', { url }),
  openBrowser: (url: string, windowId: string) => ipcRenderer.invoke('web:open-browser', { url, windowId }),
  getPageText: (windowId: string) => ipcRenderer.invoke('web:get-page-text', { windowId }),
  closeBrowser: (windowId: string) => ipcRenderer.invoke('web:close-browser', { windowId }),

  // ── File Tools ────────────────────────────────────────────────────────────
  createFile: (filePath: string, content: string, allowedPaths: string[]) =>
    ipcRenderer.invoke('tool:create-file', { filePath, content, allowedPaths }),
  readFile: (filePath: string, allowedPaths: string[]) =>
    ipcRenderer.invoke('tool:read-file', { filePath, allowedPaths }),
  editFile: (filePath: string, oldContent: string, newContent: string, allowedPaths: string[]) =>
    ipcRenderer.invoke('tool:edit-file', { filePath, oldContent, newContent, allowedPaths }),
  deleteFile: (filePath: string, allowedPaths: string[]) =>
    ipcRenderer.invoke('tool:delete-file', { filePath, allowedPaths }),
  listDirectory: (dirPath: string, allowedPaths: string[]) =>
    ipcRenderer.invoke('tool:list-directory', { dirPath, allowedPaths }),
  moveFile: (sourcePath: string, destPath: string, allowedPaths: string[]) =>
    ipcRenderer.invoke('tool:move-file', { sourcePath, destPath, allowedPaths }),
  searchFiles: (rootPath: string, pattern: string, allowedPaths: string[]) =>
    ipcRenderer.invoke('tool:search-files', { rootPath, pattern, allowedPaths }),
  runCommand: (command: string, cwd?: string) =>
    ipcRenderer.invoke('tool:run-command', { command, cwd }),
  runCommandStream: (command: string, processId: string, options?: { cwd?: string; shell?: 'powershell' | 'cmd'; timeout?: number }) =>
    ipcRenderer.invoke('tool:run-command-stream', { command, processId, ...options }),
  killProcess: (processId: string) =>
    ipcRenderer.invoke('tool:kill-process', { processId }),
  onCmdOutput: (cb: (data: { processId: string; type: 'stdout' | 'stderr' | 'exit'; data: string | number }) => void) => {
    const handler = (_: unknown, data: any) => cb(data)
    ipcRenderer.on('tool:cmd-output', handler)
    return () => ipcRenderer.removeListener('tool:cmd-output', handler)
  },
  pickDirectory: () => ipcRenderer.invoke('tool:pick-directory'),
  pickFile: () => ipcRenderer.invoke('tool:pick-file'),

  // ── Knowledge Base ────────────────────────────────────────────────────────
  knowledgeGetAll: () => ipcRenderer.invoke('knowledge:get-all'),
  knowledgeSearch: (query: string) => ipcRenderer.invoke('knowledge:search', { query }),
  knowledgeSave: (entry: any) => ipcRenderer.invoke('knowledge:save', entry),
  knowledgeMarkUsed: (id: string) => ipcRenderer.invoke('knowledge:mark-used', { id }),
  knowledgeDelete: (id: string) => ipcRenderer.invoke('knowledge:delete', { id }),
  knowledgeClear: () => ipcRenderer.invoke('knowledge:clear'),

  // ── Scheduler ─────────────────────────────────────────────────────────────
  schedulerCreate: (item: any) => ipcRenderer.invoke('scheduler:create', item),
  schedulerStartTimer: (id: string) => ipcRenderer.invoke('scheduler:start-timer', { id }),
  schedulerGetAll: () => ipcRenderer.invoke('scheduler:get-all'),
  schedulerGetActive: () => ipcRenderer.invoke('scheduler:get-active'),
  schedulerCancel: (id: string) => ipcRenderer.invoke('scheduler:cancel', { id }),
  schedulerDelete: (id: string) => ipcRenderer.invoke('scheduler:delete', { id }),
  schedulerClearFired: () => ipcRenderer.invoke('scheduler:clear-fired'),
  schedulerParseTime: (expr: string) => ipcRenderer.invoke('scheduler:parse-time', { expr }),
  onSchedulerFired: (cb: (item: any) => void) => {
    const handler = (_: unknown, item: any) => cb(item)
    ipcRenderer.on('scheduler:fired', handler)
    return () => ipcRenderer.removeListener('scheduler:fired', handler)
  },

  // ── Computer Agent ────────────────────────────────────────────────────────
  agentStart: (goal: string, apiConfig: { provider: string; apiKey: string; model: string; baseURL?: string }, visionConfig: { apiKey: string; model?: string }) =>
    ipcRenderer.invoke('agent:start', { goal, apiConfig, visionConfig }),
  agentStop: () => ipcRenderer.invoke('agent:stop'),
  agentStatus: () => ipcRenderer.invoke('agent:status'),
  agentMemory: (type?: string) => ipcRenderer.invoke('agent:memory', { type }),
  agentClearMemory: () => ipcRenderer.invoke('agent:clear-memory'),
  agentAnalyzeScreenStructured: (apiKey: string, model?: string, region?: any) =>
    ipcRenderer.invoke('agent:analyze-screen-structured', { apiKey, model, region }),
  agentConfirmAction: (actionType: string, params: any, confirmed: boolean) =>
    ipcRenderer.invoke('agent:confirm-action', { actionType, params, confirmed }),
  onAgentStatusUpdate: (cb: (data: any) => void) => {
    const handler = (_: unknown, data: any) => cb(data)
    ipcRenderer.on('agent:status-update', handler)
    return () => ipcRenderer.removeListener('agent:status-update', handler)
  },

  // ── Logs ─────────────────────────────────────────────────────────────────
  getLogs: () => ipcRenderer.invoke('logs:get'),
  clearLogs: () => ipcRenderer.invoke('logs:clear'),
  addLog: (level: 'log' | 'warn' | 'error', message: string) =>
    ipcRenderer.invoke('logs:add', { level, message }),

  // ── Coder Mode ───────────────────────────────────────────────────────────
  coderSetWorkspace: (rootPath: string) =>
    ipcRenderer.invoke('coder:set-workspace', { rootPath }),
  coderGetWorkspace: () => ipcRenderer.invoke('coder:get-workspace'),
  coderPickWorkspace: () => ipcRenderer.invoke('coder:pick-workspace'),
  coderScan: (force?: boolean) => ipcRenderer.invoke('coder:scan', { force }),
  coderRead: (path: string) => ipcRenderer.invoke('coder:read', { path }),
  coderWrite: (path: string, content: string) =>
    ipcRenderer.invoke('coder:write', { path, content }),
  coderPatch: (path: string, search: string, replace: string) =>
    ipcRenderer.invoke('coder:patch', { path, search, replace }),
  coderTerminal: (command: string) => ipcRenderer.invoke('coder:terminal', { command }),
  coderInvalidateCache: () => ipcRenderer.invoke('coder:invalidate-cache'),
  coderGetStructure: (maxDepth?: number) => ipcRenderer.invoke('coder:get-structure', { maxDepth }),
  coderReadMultiple: (paths: string[]) => ipcRenderer.invoke('coder:read-multiple', { paths }),
}

// ── Expose to renderer ────────────────────────────────────────────────────────

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error('contextBridge error:', error)
  }
} else {
  // @ts-ignore — fallback for non-isolated context (dev only)
  window.api = api
}

// ── Type declaration (used by renderer TypeScript) ────────────────────────────

export type ElectronAPI = typeof api
