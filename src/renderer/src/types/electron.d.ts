/**
 * Type declarations for the Electron API exposed via contextBridge.
 * This gives full TypeScript autocomplete in the renderer process.
 */

interface FileInfo {
  name: string
  path: string
  isDirectory: boolean
  size: number
  modified: number
}

interface ToolResult {
  success: boolean
  error?: string
  content?: string
  files?: FileInfo[]
  stdout?: string
  stderr?: string
  path?: string
}

interface CoderFileNode {
  name: string
  path: string
  relativePath: string
  isDirectory: boolean
  size: number
  modified: number
  children?: CoderFileNode[]
}

interface CoderWorkspaceResult {
  success: boolean
  data?: { path: string | null }
  path?: string
  error?: string
}

interface CoderScanResult {
  success: boolean
  data?: { tree: CoderFileNode[]; fromCache: boolean }
  fromCache?: boolean
  error?: string
}

interface CoderReadResult {
  success: boolean
  content?: string
  path?: string
  error?: string
}

interface CoderWriteResult {
  success: boolean
  path?: string
  error?: string
}

interface CoderTerminalResult {
  success: boolean
  stdout?: string
  stderr?: string
  exitCode?: number
  error?: string
}

interface CoderStructureResult {
  success: boolean
  structure?: string
  error?: string
}

interface CoderReadMultipleResult {
  success: boolean
  files?: Array<{ path: string; content: string; error?: string }>
  error?: string
}

interface SearchResult {
  title: string
  url: string
  snippet: string
  source: string
}

interface SearchResponse {
  success: boolean
  results: SearchResult[]
  answer?: string
  query?: string
  error?: string
}

interface PageResponse {
  success: boolean
  url?: string
  title?: string
  text?: string
  error?: string
}

interface ElectronAPI {
  // App
  quit: () => Promise<void>
  hideWindow: () => Promise<void>
  toggleWindow: () => Promise<void>
  setAutoStart: (enabled: boolean) => Promise<void>
  registerHotkey: (hotkey: string) => Promise<void>
  showNotification: (title: string, body: string) => Promise<void>
  getTheme: () => Promise<'dark' | 'light'>
  getUserInfo: () => Promise<{ username: string; homedir: string; desktop: string; documents: string }>
  getWindowMode: () => Promise<boolean>
  setWindowMode: (windowMode: boolean) => Promise<void>
  onWindowModeChanged: (cb: (windowMode: boolean) => void) => () => void
  openPath: (filePath: string) => Promise<void>

  // Store
  getSettings: () => Promise<{ settings: any; chats: any[] } | null>
  saveSettings: (data: { settings?: any; chats?: any[] }) => Promise<{ success: boolean }>
  clearSettings: () => Promise<{ success: boolean }>

  // AI Streaming
  chatSimple: (data: { provider: string; apiKey: string; model: string; prompt: string; ollamaBaseUrl?: string; openrouterBaseUrl?: string }) => Promise<{ success: boolean; result?: string; error?: string }>
  startChat: (data: any) => Promise<void>
  abortChat: () => Promise<void>
  onChunk: (cb: (chunk: string) => void) => () => void
  onDone: (cb: () => void) => () => void
  onAborted: (cb: () => void) => () => void
  onError: (cb: (err: string) => void) => () => void

  // Navigation
  onNavigate: (cb: (page: string) => void) => () => void
  onNewChat: (cb: () => void) => () => void

  // Screen Analysis
  takeScreenshot: (region?: { x: number; y: number; width: number; height: number }) => Promise<{ success: boolean; base64?: string; dataUrl?: string; error?: string }>
  analyzeScreen: (prompt: string, provider: string, apiKey: string, model?: string, region?: any, ollamaBaseUrl?: string) => Promise<{ success: boolean; result?: string; base64?: string; error?: string }>
  findElement: (description: string, apiKey: string, provider?: string, model?: string, ollamaBaseUrl?: string) => Promise<{ success: boolean; found?: boolean; x?: number; y?: number; description?: string; error?: string }>
  analyzeScreenStructured: (apiKey: string, provider?: string, model?: string, region?: any, ollamaBaseUrl?: string) => Promise<{ success: boolean; analysis?: any; error?: string }>

  // System Tools
  openUrl: (url: string) => Promise<{ success: boolean; url?: string; error?: string }>
  launchApp: (app: string, args?: string) => Promise<{ success: boolean; error?: string }>
  getCursorPos: () => Promise<{ success: boolean; x?: number; y?: number; error?: string }>
  moveCursor: (x: number, y: number) => Promise<{ success: boolean; error?: string }>
  moveCursorSmooth: (x: number, y: number, steps?: number) => Promise<{ success: boolean; error?: string }>
  drag: (x1: number, y1: number, x2: number, y2: number) => Promise<{ success: boolean; error?: string }>
  mouseClick: (x?: number, y?: number, button?: 'left' | 'right' | 'middle', double?: boolean) => Promise<{ success: boolean; error?: string }>
  scroll: (direction: 'up' | 'down', amount?: number) => Promise<{ success: boolean; error?: string }>
  typeText: (text: string) => Promise<{ success: boolean; error?: string }>
  pressKey: (key: string) => Promise<{ success: boolean; error?: string }>
  screenshot: (savePath?: string) => Promise<{ success: boolean; path?: string; error?: string }>
  setVolume: (level: number) => Promise<{ success: boolean; level?: number; error?: string }>
  mute: (mute: boolean) => Promise<{ success: boolean; error?: string }>
  getProcesses: () => Promise<{ success: boolean; processes: any[]; error?: string }>
  closeApp: (name: string) => Promise<{ success: boolean; error?: string }>
  getDatetime: () => Promise<{ success: boolean; datetime: string; date: string; time: string; timestamp: number }>
  lockScreen: () => Promise<{ success: boolean; error?: string }>

  // Wake Word
  startBackgroundVoice: (wakeWords: string[]) => Promise<{ success: boolean; error?: string }>
  stopBackgroundVoice: () => Promise<{ success: boolean }>
  isVoiceListening: () => Promise<{ isListening: boolean; wakeWords: string[] }>
  updateWakeWords: (wakeWords: string[]) => Promise<{ success: boolean }>
  onSRStatus: (cb: (data: { status: string; error?: string }) => void) => () => void
  onWakeDetected: (cb: (data: { text: string }) => void) => () => void
  onVoiceCommand: (cb: (data: { command: string }) => void) => () => void

  // Voice TTS
  speak: (text: string, rate?: number, volume?: number) => Promise<{ success: boolean; error?: string }>
  speakWithVoice: (text: string, voiceName: string, rate?: number, volume?: number) => Promise<{ success: boolean; error?: string }>
  stopSpeak: () => Promise<{ success: boolean }>
  getVoices: () => Promise<{ success: boolean; voices: Array<{ name: string; culture: string; gender: string }> }>

  // Web Tools
  searchWeb: (query: string) => Promise<SearchResponse>
  searchTavily: (query: string, apiKey: string) => Promise<SearchResponse>
  searchYouTube: (query: string) => Promise<SearchResponse>
  fetchPage: (url: string) => Promise<PageResponse>
  openBrowser: (url: string, windowId: string) => Promise<{ success: boolean; title?: string; url?: string }>
  getPageText: (windowId: string) => Promise<PageResponse>
  closeBrowser: (windowId: string) => Promise<{ success: boolean }>

  // File Tools
  createFile: (filePath: string, content: string, allowedPaths: string[]) => Promise<ToolResult>
  readFile: (filePath: string, allowedPaths: string[]) => Promise<ToolResult>
  editFile: (filePath: string, oldContent: string, newContent: string, allowedPaths: string[]) => Promise<ToolResult>
  deleteFile: (filePath: string, allowedPaths: string[]) => Promise<ToolResult>
  listDirectory: (dirPath: string, allowedPaths: string[]) => Promise<ToolResult>
  moveFile: (sourcePath: string, destPath: string, allowedPaths: string[]) => Promise<ToolResult>
  searchFiles: (rootPath: string, pattern: string, allowedPaths: string[]) => Promise<ToolResult>
  runCommand: (command: string, cwd?: string) => Promise<ToolResult>
  runCommandStream: (command: string, processId: string, options?: { cwd?: string; shell?: 'powershell' | 'cmd'; timeout?: number }) => Promise<{ success: boolean; exitCode: number | null }>
  killProcess: (processId: string) => Promise<{ success: boolean; error?: string }>
  onCmdOutput: (cb: (data: { processId: string; type: 'stdout' | 'stderr' | 'exit'; data: string | number }) => void) => () => void
  pickDirectory: () => Promise<string | null>
  pickFile: () => Promise<string | null>

  // Knowledge Base
  knowledgeGetAll: () => Promise<{ version: number; entries: any[]; updatedAt: number }>
  knowledgeSearch: (query: string) => Promise<any[]>
  knowledgeSave: (entry: any) => Promise<{ success: boolean; count: number }>
  knowledgeMarkUsed: (id: string) => Promise<{ success: boolean }>
  knowledgeDelete: (id: string) => Promise<{ success: boolean }>
  knowledgeClear: () => Promise<{ success: boolean }>

  // Scheduler
  schedulerCreate: (item: any) => Promise<{ success: boolean; item: any }>
  schedulerStartTimer: (id: string) => Promise<{ success: boolean }>
  schedulerGetAll: () => Promise<{ items: any[]; updatedAt: number }>
  schedulerGetActive: () => Promise<any[]>
  schedulerCancel: (id: string) => Promise<{ success: boolean }>
  schedulerDelete: (id: string) => Promise<{ success: boolean }>
  schedulerClearFired: () => Promise<{ success: boolean }>
  schedulerParseTime: (expr: string) => Promise<{ success: boolean; timestamp: number | null }>
  onSchedulerFired: (cb: (item: any) => void) => () => void

  // Computer Agent
  agentStart: (goal: string, apiConfig: { provider: string; apiKey: string; model: string; baseURL?: string }, visionConfig: { apiKey: string; model?: string }) => Promise<any>
  agentStop: () => Promise<{ success: boolean }>
  agentStatus: () => Promise<{ running: boolean; task: any | null }>
  agentMemory: (type?: string) => Promise<any[]>
  agentClearMemory: () => Promise<{ success: boolean }>
  agentAnalyzeScreenStructured: (apiKey: string, model?: string, region?: any) => Promise<{ success: boolean; analysis?: any; error?: string }>
  agentConfirmAction: (actionType: string, params: any, confirmed: boolean) => Promise<{ success: boolean; confirmed: boolean }>
  onAgentStatusUpdate: (cb: (data: any) => void) => () => void

  // Logs
  getLogs: () => Promise<Array<{ timestamp: number; level: 'log' | 'warn' | 'error'; message: string; source: 'main' | 'renderer' }>>
  clearLogs: () => Promise<{ success: boolean }>
  addLog: (level: 'log' | 'warn' | 'error', message: string) => Promise<{ success: boolean }>

  // Coder Mode
  coderSetWorkspace: (rootPath: string) => Promise<CoderWorkspaceResult>
  coderGetWorkspace: () => Promise<CoderWorkspaceResult>
  coderPickWorkspace: () => Promise<CoderWorkspaceResult>
  coderScan: (force?: boolean) => Promise<CoderScanResult>
  coderRead: (path: string) => Promise<CoderReadResult>
  coderWrite: (path: string, content: string) => Promise<CoderWriteResult>
  coderPatch: (path: string, search: string, replace: string) => Promise<CoderWriteResult>
  coderTerminal: (command: string) => Promise<CoderTerminalResult>
  coderInvalidateCache: () => Promise<{ success: boolean }>
  coderGetStructure: (maxDepth?: number) => Promise<CoderStructureResult>
  coderReadMultiple: (paths: string[]) => Promise<CoderReadMultipleResult>
}

declare global {
  interface Window {
    api: ElectronAPI
  }
}

export {}
