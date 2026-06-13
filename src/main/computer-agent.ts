/**
 * Computer Agent — intelligent orchestrator for screen-based PC control.
 *
 * Architecture:
 *  1. Vision (Qwen2.5-VL) → structured JSON of screen elements
 *  2. Planner (Mistral / any LLM) → step-by-step plan
 *  3. Executor (PyAutoGUI bridge) → mouse/keyboard actions
 *  4. Verifier (Vision again) → did the action succeed?
 *  5. Memory (session store) → short-term, action history, error log
 *  6. Safety manager → confirmation prompts for dangerous ops
 */

import { ipcMain, BrowserWindow, IpcMainInvokeEvent } from 'electron'
import { readFileSync, unlinkSync, existsSync, writeFileSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { exec } from 'child_process'
import { promisify } from 'util'
import { analyzeScreen } from './screenanalysis'

const execAsync = promisify(exec)

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ScreenElement {
  type: 'button' | 'input' | 'menu' | 'link' | 'icon' | 'text' | 'image' | 'dialog' | 'scrollbar' | 'tab' | 'checkbox' | 'radio' | 'dropdown'
  text: string
  x: number
  y: number
  width?: number
  height?: number
  confidence?: number
}

export interface ScreenAnalysis {
  elements: ScreenElement[]
  textBlocks?: Array<{ text: string; x: number; y: number }>
  description?: string
  resolution?: { width: number; height: number }
}

export interface AgentAction {
  id: string
  type: 'move_mouse' | 'click' | 'double_click' | 'type_text' | 'press_key' | 'scroll' | 'screenshot' | 'analyze_screen' | 'open_url' | 'launch_app' | 'wait' | 'custom'
  params: Record<string, unknown>
  description: string
  dependencies?: string[]
}

export interface AgentStep {
  id: string
  description: string
  action: AgentAction
  status: 'pending' | 'running' | 'done' | 'failed' | 'skipped'
  result?: string
  error?: string
  attempts: number
  screenshotBefore?: string
  screenshotAfter?: string
}

export interface AgentTask {
  id: string
  goal: string
  steps: AgentStep[]
  currentStep: number
  status: 'idle' | 'planning' | 'running' | 'waiting_confirmation' | 'done' | 'failed' | 'stopped'
  startedAt: number
  completedAt?: number
  errorLog: string[]
  planSummary?: string
  context?: string
}

// ── Memory ────────────────────────────────────────────────────────────────────

interface MemoryEntry {
  type: 'action' | 'error' | 'observation' | 'user_command'
  content: string
  timestamp: number
  taskId?: string
  metadata?: Record<string, unknown>
}

const MAX_MEMORY_ENTRIES = 200
const sessionMemory: MemoryEntry[] = []
let actionCounter = 0

function addMemory(entry: Omit<MemoryEntry, 'timestamp'>): void {
  sessionMemory.push({ ...entry, timestamp: Date.now() })
  if (sessionMemory.length > MAX_MEMORY_ENTRIES) {
    sessionMemory.splice(0, sessionMemory.length - MAX_MEMORY_ENTRIES)
  }
}

function getRecentMemory(count = 20): MemoryEntry[] {
  return sessionMemory.slice(-count)
}

function getErrorLog(): MemoryEntry[] {
  return sessionMemory.filter(e => e.type === 'error')
}

function getActionHistory(count = 50): MemoryEntry[] {
  return sessionMemory.filter(e => e.type === 'action').slice(-count)
}

function clearSessionMemory(): void {
  sessionMemory.length = 0
  actionCounter = 0
}

// ── Safety Manager ────────────────────────────────────────────────────────────

const DANGEROUS_ACTIONS = [
  'delete_file',
  'run_command',
  'format_drive',
  'shutdown',
  'restart',
  'modify_registry',
  'change_system_settings',
  'install_software',
  'uninstall_software',
  'execute_file',
  'type_password',
  'financial_transaction',
  'send_email',
  'modify_startup',
  'change_firewall',
  'manage_users',
  'encrypt_files',
  'modify_boot_config',
]

const DANGEROUS_KEYWORDS = [
  'format', 'delete', 'remove', 'uninstall', 'shutdown', 'restart',
  'regedit', 'reg add', 'net user', 'net localgroup',
  'del /f', 'rd /s', 'rmdir', 'cipher', 'bcdedit',
  'schtasks', 'sc config', 'wmic', 'diskpart',
]

type SafetyCallback = (action: string, params: Record<string, unknown>) => Promise<boolean>

let safetyConfirmCallback: SafetyCallback | null = null

export function setSafetyConfirmCallback(cb: SafetyCallback): void {
  safetyConfirmCallback = cb
}

function isDangerous(name: string, args: Record<string, unknown>): { dangerous: boolean; reason: string } {
  const actionStr = `${name} ${JSON.stringify(args)}`.toLowerCase()

  for (const keyword of DANGEROUS_KEYWORDS) {
    if (actionStr.includes(keyword.toLowerCase())) {
      return { dangerous: true, reason: `Contains dangerous keyword: "${keyword}"` }
    }
  }

  if (args.text && typeof args.text === 'string') {
    const text = args.text as string
    if (args.command === 'type_password' || text.toLowerCase().includes('password') || text.toLowerCase().includes('пароль')) {
      return { dangerous: true, reason: 'Possible password input detected' }
    }
  }

  if (args.url && typeof args.url === 'string') {
    const url = args.url as string
    if (url.includes('bank') || url.includes('pay') || url.includes('payment') || url.includes('transfer') || url.includes('оплата') || url.includes('перевод')) {
      return { dangerous: true, reason: 'Possible financial transaction' }
    }
  }

  // run_command is always potentially dangerous
  if (name === 'run_command') {
    return { dangerous: true, reason: 'Shell command execution' }
  }

  return { dangerous: false, reason: '' }
}

async function requireSafetyConfirmation(action: AgentAction): Promise<boolean> {
  const { dangerous, reason } = isDangerous(action.type, action.params)
  if (!dangerous) return true

  if (safetyConfirmCallback) {
    return await safetyConfirmCallback(action.type, action.params)
  }

  return false
}

// ── Screenshot ────────────────────────────────────────────────────────────────

interface ScreenshotCache {
  base64: string
  timestamp: number
  hash: string
}

let lastScreenshot: ScreenshotCache | null = null
const SCREENSHOT_CACHE_TTL = 2000
let isFullScreenshotPending = false
let fullScreenshotPromise: Promise<string> | null = null

async function captureScreenshot(region?: { x: number; y: number; width: number; height: number }): Promise<string> {
  const outPath = join(tmpdir(), `agent-ss-${Date.now()}.png`)
  const psPath = outPath.replace(/\\/g, '/')

  // DPI awareness — без него координаты кликов не совпадают со скриншотом при масштабе >100%
  const dpiHeader = `
    Add-Type -AssemblyName System.Windows.Forms
    Add-Type -AssemblyName System.Drawing
    $sig = '[DllImport("user32.dll")] public static extern bool SetProcessDPIAware();'
    $t = Add-Type -MemberDefinition $sig -Name DPI -Namespace Win32 -PassThru
    try { $t::SetProcessDPIAware() | Out-Null } catch {}
  `

  const script = region ? `
      ${dpiHeader}
      $bmp = New-Object System.Drawing.Bitmap(${region.width}, ${region.height})
      $g = [System.Drawing.Graphics]::FromImage($bmp)
      $g.CopyFromScreen(${region.x}, ${region.y}, 0, 0, (New-Object System.Drawing.Size(${region.width}, ${region.height})))
      $bmp.Save('${psPath}')
      $g.Dispose(); $bmp.Dispose()
    ` : `
      ${dpiHeader}
      $vs = [System.Windows.Forms.SystemInformation]::VirtualScreen
      $bmp = New-Object System.Drawing.Bitmap($vs.Width, $vs.Height)
      $g = [System.Drawing.Graphics]::FromImage($bmp)
      $g.CopyFromScreen($vs.X, $vs.Y, 0, 0, (New-Object System.Drawing.Size($vs.Width, $vs.Height)))
      $bmp.Save('${psPath}')
      $g.Dispose(); $bmp.Dispose()
    `
  const scriptPath = join(tmpdir(), `agent-ss-script-${Date.now()}.ps1`)
  writeFileSync(scriptPath, script, 'utf8')
  try {
    await execAsync(`powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "${scriptPath}"`, { timeout: 10000, windowsHide: true })
  } finally {
    try { unlinkSync(scriptPath) } catch {}
  }

  if (!existsSync(outPath)) throw new Error('Screenshot not created')
  const base64 = readFileSync(outPath).toString('base64')
  try { unlinkSync(outPath) } catch {}

  return base64
}

async function getScreenshot(region?: { x: number; y: number; width: number; height: number }, force = false): Promise<string> {
  if (region) return captureScreenshot(region)

  const now = Date.now()
  if (!force && lastScreenshot && (now - lastScreenshot.timestamp) < SCREENSHOT_CACHE_TTL) {
    return lastScreenshot.base64
  }

  const base64 = await captureScreenshot()
  lastScreenshot = { base64, timestamp: now, hash: '' }
  return base64
}

export function clearScreenshotCache(): void {
  lastScreenshot = null
}

// ── Task Planner ──────────────────────────────────────────────────────────────

function buildReActPrompt(goal: string, screenAnalysis: ScreenAnalysis, memoryContext: string): string {
  const elementsStr = screenAnalysis.elements.slice(0, 30).map(e =>
    `  - ${e.type} "${e.text}" at (${e.x}, ${e.y})${e.width ? ` size ${e.width}x${e.height}` : ''}`
  ).join('\n')

  const textBlocksStr = (screenAnalysis.textBlocks || []).slice(0, 20).map(t =>
    `  - "${t.text}" at (${t.x}, ${t.y})`
  ).join('\n')

  return `You are a Windows computer control agent operating in a ReAct (Reason + Act) loop.
Your ultimate goal: "${goal}"

Current screen state:
${screenAnalysis.description || 'No description available'}
Resolution: ${screenAnalysis.resolution?.width || '?'}x${screenAnalysis.resolution?.height || '?'}

Visible UI elements:
${elementsStr || '  (no elements detected)'}

Visible text:
${textBlocksStr || '  (no text detected)'}

Recent History:
${memoryContext}

Analyze the current screen and history, then decide the NEXT SINGLE action to take.

Respond with exactly this format:
THOUGHT: <your reasoning about what to do next and why>
ACTION: <JSON_ACTION>

If the goal has been achieved, use:
ACTION: {"type": "complete", "description": "Goal achieved"}

Action types and their params:
- move_mouse: { x: number, y: number }
- click: { x?: number, y?: number, button?: "left"|"right", double?: boolean }
- double_click: { x?: number, y?: number }
- type_text: { text: string }
- press_key: { key: string }
- scroll: { direction: "up"|"down", amount?: number }
- open_url: { url: string }
- launch_app: { name: string }
- wait: { ms: number }

Rules:
- Only one action per turn.
- Use coordinates from the screen analysis.
- For clicking: you may use move_mouse then click, or just click if the tool supports it.
- Wait 500-1000ms after opening apps or URLs.
- Be concise in THOUGHT.`
}

async function decideNextStep(
  goal: string,
  screenAnalysis: ScreenAnalysis,
  memoryContext: string,
  apiConfig: { provider: string; apiKey: string; model: string; baseURL?: string }
): Promise<{ thought: string; action: AgentAction }> {
  const prompt = buildReActPrompt(goal, screenAnalysis, memoryContext)
  const response = await callLLM(
    [{ role: 'user', content: prompt }],
    apiConfig
  )

  const thoughtMatch = response.match(/THOUGHT:\s*([\s\S]*?)(?=\nACTION:|$)/i)
  const actionMatch = response.match(/ACTION:\s*(\{[\s\S]*\})/i)

  const thought = thoughtMatch ? thoughtMatch[1].trim() : 'No thought provided'
  
  if (!actionMatch) {
    throw new Error(`LLM failed to provide a valid ACTION. Response: ${response}`)
  }

  try {
    const action = JSON.parse(actionMatch[1]) as AgentAction
    return { thought, action }
  } catch (e) {
    throw new Error(`Failed to parse ACTION JSON: ${actionMatch[1]}`)
  }
}

function parsePlannerResponse(response: string): PlannerStep[] {
  try {
    const match = response.match(/\[[\s\S]*\]/)
    if (!match) return []
    const steps = JSON.parse(match[0])
    if (!Array.isArray(steps)) return []
    return steps.slice(0, 12)
  } catch {
    return []
  }
}

// ── LLM Call for planner ──────────────────────────────────────────────────────

async function callLLM(
  messages: Array<{ role: string; content: string }>,
  apiConfig: { provider: string; apiKey: string; model: string; baseURL?: string }
): Promise<string> {
  const { provider, apiKey, model, baseURL } = apiConfig

  if (provider === 'ollama') {
    const url = baseURL || 'http://localhost:11434'
    const res = await fetch(`${url}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: model || 'llama3.1',
        messages,
        stream: false,
        options: { temperature: 0.3 }
      }),
      signal: AbortSignal.timeout(30000)
    })
    if (!res.ok) {
      const errBody = await res.text().catch(() => '')
      let detail = `${res.status}`
      if (errBody) { try { const e = JSON.parse(errBody); if (e.error) detail += ` — ${e.error}` } catch { detail += ` — ${errBody.slice(0, 200)}` } }
      throw new Error(`Ollama error ${detail}`)
    }
    const data = await res.json() as any
    return data.message?.content || ''
  }

  if (provider === 'anthropic') {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: model || 'claude-3-5-sonnet-20241022',
        max_tokens: 1500,
        messages: messages.map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content }))
      }),
      signal: AbortSignal.timeout(30000)
    })
    if (!res.ok) throw new Error(`Anthropic error ${res.status}`)
    const data = await res.json() as any
    return data.content?.[0]?.text || ''
  }

  // OpenAI-compatible (Mistral, Qwen, Groq, DeepSeek, OpenRouter)
  const baseURLs: Record<string, string> = {
    openai: 'https://api.openai.com/v1',
    mistral: 'https://api.mistral.ai/v1',
    groq: 'https://api.groq.com/openai/v1',
    deepseek: 'https://api.deepseek.com/v1',
    qwen: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    nvidia: 'https://integrate.api.nvidia.com/v1',
    huggingface: 'https://api-inference.huggingface.co/v1',
  }

  const apiBase = baseURL || baseURLs[provider] || baseURLs.openai
  const res = await fetch(`${apiBase}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: model || 'gpt-4o',
      messages,
      max_tokens: 1500,
      temperature: 0.3
    }),
    signal: AbortSignal.timeout(30000)
  })
  if (!res.ok) throw new Error(`LLM error ${res.status}`)
  const data = await res.json() as any
  return data.choices?.[0]?.message?.content || ''
}

// ── Action Executor ────────────────────────────────────────────────────────────

async function executeAction(action: AgentAction): Promise<string> {
  addMemory({ type: 'action', content: `Executing ${action.type}: ${action.description}`, metadata: action.params })

  const { type, params } = action

  switch (type) {
    case 'move_mouse': {
      const x = params.x as number
      const y = params.y as number
      if (x === undefined || y === undefined) return '❌ Missing coordinates'
      const script = `
        Add-Type -AssemblyName System.Windows.Forms
        [System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point(${Math.round(x)}, ${Math.round(y)})
      `
      const scriptPath = join(tmpdir(), `agent-action-${Date.now()}.ps1`)
      writeFileSync(scriptPath, script, 'utf8')
      try {
        await execAsync(`powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "${scriptPath}"`, { timeout: 5000, windowsHide: true })
      } finally {
        try { unlinkSync(scriptPath) } catch {}
      }
      return `✅ Moved to (${Math.round(x)}, ${Math.round(y)})`
    }

    case 'click': {
      const x = params.x as number | undefined
      const y = params.y as number | undefined
      const button = (params.button as string) || 'left'
      const double = params.double === true

      let script = `Add-Type -AssemblyName System.Windows.Forms\n`
      if (x !== undefined && y !== undefined) {
        script += `[System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point(${Math.round(x)}, ${Math.round(y)})\n`
        script += `Start-Sleep -Milliseconds 80\n`
      }

      const btnDown = button === 'right' ? '[System.Windows.Forms.MouseButtons]::Right' : '[System.Windows.Forms.MouseButtons]::Left'
      script += `[System.Windows.Forms]::SendKeys('{Click}')` // placeholder
      // Use the C# input server approach for reliable clicks
      const clickScript = `
        Add-Type -AssemblyName System.Windows.Forms
        ${x !== undefined && y !== undefined ? `[System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point(${Math.round(x)}, ${Math.round(y)}); Start-Sleep -Milliseconds 80` : ''}
        \$sig = @'
[DllImport("user32.dll")] public static extern void mouse_event(uint f, int x, int y, int d, System.IntPtr e);
'@
        Add-Type -MemberDefinition \$sig -Name Mouse -Namespace Win32
        [Win32.Mouse]::mouse_event(${button === 'right' ? 0x0008 : 0x0002}, 0, 0, 0, [System.IntPtr]::Zero)
        Start-Sleep -Milliseconds 30
        [Win32.Mouse]::mouse_event(${button === 'right' ? 0x0010 : 0x0004}, 0, 0, 0, [System.IntPtr]::Zero)
        ${double ? `
        Start-Sleep -Milliseconds 80
        [Win32.Mouse]::mouse_event(0x0002, 0, 0, 0, [System.IntPtr]::Zero)
        Start-Sleep -Milliseconds 30
        [Win32.Mouse]::mouse_event(0x0004, 0, 0, 0, [System.IntPtr]::Zero)
        ` : ''}
      `
      const scriptPath = join(tmpdir(), `agent-action-${Date.now()}.ps1`)
      writeFileSync(scriptPath, clickScript, 'utf8')
      try {
        await execAsync(`powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "${scriptPath}"`, { timeout: 5000, windowsHide: true })
      } finally {
        try { unlinkSync(scriptPath) } catch {}
      }
      return `✅ ${double ? 'Double-' : ''}${button === 'right' ? 'Right-' : ''}click${x !== undefined && y !== undefined ? ` at (${Math.round(x)}, ${Math.round(y)})` : ''}`
    }

    case 'double_click': {
      const x = params.x as number | undefined
      const y = params.y as number | undefined
      return executeAction({ id: '', type: 'click', params: { x, y, button: 'left', double: true }, description: 'double click' })
    }

    case 'type_text': {
      const text = params.text as string
      if (!text) return '❌ No text to type'
      const escaped = text.replace(/'/g, "''").replace(/[{}[\]()^+%~]/g, '{$&}')
      const script = `
        Add-Type -AssemblyName System.Windows.Forms
        [System.Windows.Forms.SendKeys]::SendWait('${escaped}')
      `
      const scriptPath = join(tmpdir(), `agent-type-${Date.now()}.ps1`)
      writeFileSync(scriptPath, script, 'utf8')
      try {
        await execAsync(`powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "${scriptPath}"`, { timeout: 10000, windowsHide: true })
      } finally {
        try { unlinkSync(scriptPath) } catch {}
      }
      return `✅ Typed: "${text.slice(0, 50)}${text.length > 50 ? '...' : ''}"`
    }

    case 'press_key': {
      const key = params.key as string
      if (!key) return '❌ No key specified'

      if (key === 'win+d') {
        await execAsync(`powershell.exe -NoProfile -NonInteractive -Command "(New-Object -ComObject Shell.Application).MinimizeAll()"`, { timeout: 5000, windowsHide: true })
        return '✅ Pressed Win+D'
      }

      const keyMap: Record<string, string> = {
        'enter': '{ENTER}', 'tab': '{TAB}', 'escape': '{ESC}', 'esc': '{ESC}',
        'backspace': '{BACKSPACE}', 'delete': '{DELETE}', 'del': '{DELETE}',
        'space': ' ',
        'up': '{UP}', 'down': '{DOWN}', 'left': '{LEFT}', 'right': '{RIGHT}',
        'home': '{HOME}', 'end': '{END}', 'pageup': '{PGUP}', 'pagedown': '{PGDN}',
        'f1': '{F1}', 'f2': '{F2}', 'f3': '{F3}', 'f4': '{F4}', 'f5': '{F5}',
        'f6': '{F6}', 'f7': '{F7}', 'f8': '{F8}', 'f9': '{F9}', 'f10': '{F10}',
        'f11': '{F11}', 'f12': '{F12}',
        'ctrl+c': '^c', 'ctrl+v': '^v', 'ctrl+a': '^a', 'ctrl+z': '^z', 'ctrl+y': '^y',
        'ctrl+s': '^s', 'ctrl+t': '^t', 'ctrl+w': '^w', 'ctrl+r': '^r',
        'ctrl+f': '^f', 'ctrl+n': '^n', 'ctrl+p': '^p', 'ctrl+x': '^x',
        'ctrl+shift+t': '^+t', 'ctrl+shift+n': '^+n',
        'alt+f4': '%{F4}', 'alt+tab': '%{TAB}', 'alt+f': '%f',
        'printscreen': '{PRTSC}',
      }
      const sendKey = keyMap[key.toLowerCase()] || `{${key.toUpperCase()}}`
      const script = `
        Add-Type -AssemblyName System.Windows.Forms
        [System.Windows.Forms.SendKeys]::SendWait('${sendKey}')
      `
      const scriptPath = join(tmpdir(), `agent-key-${Date.now()}.ps1`)
      writeFileSync(scriptPath, script, 'utf8')
      try {
        await execAsync(`powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "${scriptPath}"`, { timeout: 5000, windowsHide: true })
      } finally {
        try { unlinkSync(scriptPath) } catch {}
      }
      return `✅ Pressed: ${key}`
    }

    case 'scroll': {
      const direction = params.direction as string
      const amount = (params.amount as number) || 3
      const delta = direction === 'up' ? 120 * amount : -120 * amount
      const scrollScript = `
        Add-Type -MemberDefinition @'
[DllImport("user32.dll")] public static extern void mouse_event(uint f, int x, int y, int d, System.IntPtr e);
'@ -Name Mouse -Namespace Win32
        [Win32.Mouse]::mouse_event(0x0800, 0, 0, ${delta}, [System.IntPtr]::Zero)
      `
      const scriptPath = join(tmpdir(), `agent-scroll-${Date.now()}.ps1`)
      writeFileSync(scriptPath, scrollScript, 'utf8')
      try {
        await execAsync(`powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "${scriptPath}"`, { timeout: 5000, windowsHide: true })
      } finally {
        try { unlinkSync(scriptPath) } catch {}
      }
      return `✅ Scrolled ${direction}`
    }

    case 'open_url': {
      const url = params.url as string
      if (!url) return '❌ No URL'
      const fullUrl = url.startsWith('http') ? url : `https://${url}`
      await execAsync(`start "" "${fullUrl}"`, { timeout: 5000, windowsHide: true })
      return `✅ Opened: ${fullUrl}`
    }

    case 'launch_app': {
      const name = params.name as string || params.app as string
      if (!name) return '❌ No app name'
      await execAsync(`powershell.exe -NoProfile -NonInteractive -Command "Start-Process '${name}'"`, { timeout: 10000, windowsHide: true })
      return `✅ Launched: ${name}`
    }

    case 'wait': {
      const ms = (params.ms as number) || 1000
      await new Promise(r => setTimeout(r, ms))
      return `⏱️ Waited ${ms}ms`
    }

    case 'screenshot': {
      const base64 = await captureScreenshot()
      return `📸 Screenshot captured (${Math.round(base64.length * 0.75 / 1024)}KB)`
    }

    case 'analyze_screen': {
      const base64 = await captureScreenshot()
      const prompt = (params.prompt as string) || 'Describe what is on screen'
      const analysis = await analyzeScreenWithVision(base64, prompt, params.apiKey as string || '')
      return `👁️ ${analysis}`
    }

    default:
      return `❓ Unknown action: ${type}`
  }
}

// ── Agent Loop ────────────────────────────────────────────────────────────────

let currentAgentTask: AgentTask | null = null
let isAgentRunning = false
let stopRequested = false
let activeWindow: BrowserWindow | null = null

export function setAgentWindow(win: BrowserWindow): void {
  activeWindow = win
}

function sendStatus(update: Partial<AgentTask>): void {
  if (activeWindow && !activeWindow.isDestroyed()) {
    activeWindow.webContents.send('agent:status-update', update)
  }
}

export async function startAgentTask(
  goal: string,
  apiConfig: { provider: string; apiKey: string; model: string; baseURL?: string },
  visionConfig: { apiKey: string; model?: string }
): Promise<AgentTask> {
  if (isAgentRunning) {
    throw new Error('Agent is already running')
  }

  stopRequested = false
  isAgentRunning = true

  const task: AgentTask = {
    id: crypto.randomUUID(),
    goal,
    steps: [],
    currentStep: 0,
    status: 'planning',
    startedAt: Date.now(),
    errorLog: []
  }
  currentAgentTask = task
  sendStatus({ status: 'planning' })

  try {
    // 1. Capture screenshot
    addMemory({ type: 'observation', content: `Starting task: "${goal}"`, taskId: task.id })
    const screenshotBase64 = await captureScreenshot()

    // 2. Analyze screen with Qwen2.5-VL
    sendStatus({ status: 'planning', planSummary: 'Analyzing screen...' })
    addMemory({ type: 'observation', content: 'Analyzing screen with Qwen2.5-VL', taskId: task.id })

    let screenAnalysis: ScreenAnalysis
    try {
      screenAnalysis = await analyzeScreenStructured(screenshotBase64, visionConfig.apiKey, visionConfig.model)
    } catch (e: any) {
      screenAnalysis = { elements: [], description: `Vision analysis unavailable: ${e.message}` }
      task.errorLog.push(`Vision analysis failed: ${e.message}`)
    }

    // 3. Create plan using LLM
    sendStatus({ status: 'planning', planSummary: 'Creating plan...' })
    const memoryContext = getRecentMemory(10).map(m =>
      `[${m.type}] ${m.content}`
    ).join('\n')

    const plannerPrompt = buildPlannerPrompt(goal, screenAnalysis, memoryContext ? `Recent context:\n${memoryContext}` : '')
    addMemory({ type: 'observation', content: 'Creating execution plan', taskId: task.id })

    const planResponse = await callLLM(
      [{ role: 'user', content: plannerPrompt }],
      apiConfig
    )

    const planSteps = parsePlannerResponse(planResponse)
    if (planSteps.length === 0) {
      throw new Error('Could not create a valid plan')
    }

    task.steps = planSteps.map((s, i) => ({
      id: `step-${i}`,
      description: s.description,
      action: {
        id: `action-${i}`,
        type: s.action.type as AgentAction['type'],
        params: s.action.params,
        description: s.action.description
      },
      status: 'pending' as const,
      attempts: 0
    }))
    task.status = 'running'
    task.planSummary = planSteps.map((s, i) => `${i + 1}. ${s.description}`).join('\n')
    sendStatus({ status: 'running', steps: task.steps, planSummary: task.planSummary })

    // 4. Execute steps
    for (let i = 0; i < task.steps.length; i++) {
      if (stopRequested) {
        task.status = 'stopped'
        task.errorLog.push('Task stopped by user')
        sendStatus({ status: 'stopped' })
        break
      }

      const step = task.steps[i]
      task.currentStep = i
      step.status = 'running'
      sendStatus({ currentStep: i, steps: task.steps })

      // Screenshot before action
      try {
        const ss = await captureScreenshot()
        step.screenshotBefore = ss
      } catch {}

      addMemory({ type: 'action', content: `Step ${i + 1}/${task.steps.length}: ${step.description}`, taskId: task.id })

      // Safety check
      const safe = await requireSafetyConfirmation(step.action)
      if (!safe) {
        step.status = 'skipped'
        step.result = '⛔ Blocked by safety confirmation'
        task.errorLog.push(`Safety blocked: ${step.description}`)
        sendStatus({ steps: task.steps })
        continue
      }

      // Execute with retry
      let lastError = ''
      for (let attempt = 0; attempt < 3; attempt++) {
        if (stopRequested) break

        step.attempts = attempt + 1
        try {
          const result = await executeAction(step.action)
          step.status = 'done'
          step.result = result

          // Capture result screenshot
          try {
            const ss = await captureScreenshot()
            step.screenshotAfter = ss
          } catch {}

          addMemory({ type: 'observation', content: `Step ${i + 1} done: ${result}`, taskId: task.id })
          sendStatus({ steps: task.steps })
          break
        } catch (e: any) {
          lastError = e.message
          step.error = e.message
          task.errorLog.push(`Step ${i + 1} attempt ${attempt + 1}: ${e.message}`)

          if (attempt < 2) {
            addMemory({ type: 'error', content: `Retry ${attempt + 1} for step ${i + 1}: ${e.message}`, taskId: task.id })
            await new Promise(r => setTimeout(r, 1000))
          }
        }
      }

      if (step.status === 'running') {
        step.status = 'failed'
        step.error = lastError
        addMemory({ type: 'error', content: `Step ${i + 1} failed: ${lastError}`, taskId: task.id })
        sendStatus({ steps: task.steps })
      }

      // Pause between steps
      if (i < task.steps.length - 1 && !stopRequested) {
        await new Promise(r => setTimeout(r, 500))
      }
    }

    // 5. Final verification screenshot
    if (!stopRequested) {
      try {
        const finalSS = await captureScreenshot()
        // Could do verification analysis here
      } catch {}
    }

    // Finalize
    if (task.status === 'running') {
      task.status = 'done'
    }
    task.completedAt = Date.now()
    addMemory({ type: 'observation', content: `Task completed: ${task.status}`, taskId: task.id })
    sendStatus({ status: task.status, steps: task.steps })

  } catch (e: any) {
    task.status = 'failed'
    task.errorLog.push(`Fatal: ${e.message}`)
    addMemory({ type: 'error', content: `Task failed: ${e.message}`, taskId: task.id })
    sendStatus({ status: 'failed', errorLog: task.errorLog })
  } finally {
    isAgentRunning = false
  }

  return task
}

export function stopAgentTask(): void {
  if (isAgentRunning) {
    stopRequested = true
    addMemory({ type: 'observation', content: 'Stop requested by user' })
  }
}

export function getAgentStatus(): { running: boolean; task: AgentTask | null } {
  return { running: isAgentRunning, task: currentAgentTask }
}

// ── IPC Handlers ──────────────────────────────────────────────────────────────

export function setupAgentHandlers(): void {
  ipcMain.handle('agent:start', async (event: IpcMainInvokeEvent, {
    goal,
    apiConfig,
    visionConfig
  }: {
    goal: string
    apiConfig: { provider: string; apiKey: string; model: string; baseURL?: string }
    visionConfig: { apiKey: string; model?: string }
  }) => {
    try {
      const task = await startAgentTask(goal, apiConfig, visionConfig)
      return task
    } catch (e: any) {
      return { error: e.message }
    }
  })

  ipcMain.handle('agent:stop', () => {
    stopAgentTask()
    return { success: true }
  })

  ipcMain.handle('agent:status', () => {
    return getAgentStatus()
  })

  ipcMain.handle('agent:memory', (_event: IpcMainInvokeEvent, { type }: { type?: string }) => {
    if (type === 'errors') return getErrorLog()
    if (type === 'actions') return getActionHistory()
    if (type === 'all') return getRecentMemory(100)
    return getRecentMemory(20)
  })

  ipcMain.handle('agent:clear-memory', () => {
    clearSessionMemory()
    return { success: true }
  })

  ipcMain.handle('agent:analyze-screen-structured', async (_event: IpcMainInvokeEvent, {
    apiKey,
    model,
    region
  }: {
    apiKey: string
    model?: string
    region?: { x: number; y: number; width: number; height: number }
  }) => {
    try {
      const base64 = await getScreenshot(region)
      const analysis = await analyzeScreenStructured(base64, apiKey, model)
      return { success: true, analysis }
    } catch (e: any) {
      return { success: false, error: e.message }
    }
  })

  // Confirm dangerous action from renderer
  ipcMain.handle('agent:confirm-action', async (_event: IpcMainInvokeEvent, {
    actionType,
    params,
    confirmed
  }: {
    actionType: string
    params: Record<string, unknown>
    confirmed: boolean
  }) => {
    return { success: true, confirmed }
  })

  // Ask for safety confirmation via renderer
  ipcMain.handle('agent:request-confirmation', async (_event: IpcMainInvokeEvent, {
    actionType,
    params
  }: {
    actionType: string
    params: Record<string, unknown>
  }) => {
    if (activeWindow && !activeWindow.isDestroyed()) {
      activeWindow.webContents.send('agent:request-confirmation', { actionType, params })
    }
    return { sent: true }
  })
}
