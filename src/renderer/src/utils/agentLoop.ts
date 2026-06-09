/**
 * Autonomous Agent Loop — улучшенная версия.
 *
 * Новые возможности:
 * - Проверка результата через скриншот после каждого шага
 * - Retry logic — до 3 попыток при ошибке
 * - Память — контекст предыдущих задач
 */

export interface AgentStep {
  id: string
  description: string
  toolCall?: { name: string; args: Record<string, unknown> }
  status: 'pending' | 'running' | 'done' | 'failed'
  result?: string
  attempts: number
}

export interface AgentPlan {
  goal: string
  steps: AgentStep[]
  currentStep: number
  status: 'planning' | 'running' | 'done' | 'failed' | 'stopped'
  startedAt: number
}

// ── Agent Memory ──────────────────────────────────────────────────────────────

export interface AgentMemoryEntry {
  id: string
  goal: string
  summary: string
  steps: number
  success: boolean
  timestamp: number
}

const MEMORY_KEY = 'agent_memory'
const MAX_MEMORY = 20

export function loadAgentMemory(): AgentMemoryEntry[] {
  try {
    const raw = localStorage.getItem(MEMORY_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function saveAgentMemory(entry: AgentMemoryEntry): void {
  try {
    const memory = loadAgentMemory()
    memory.unshift(entry)
    localStorage.setItem(MEMORY_KEY, JSON.stringify(memory.slice(0, MAX_MEMORY)))
  } catch {}
}

export function getRecentMemoryContext(): string {
  const memory = loadAgentMemory()
  if (memory.length === 0) return ''
  const recent = memory.slice(0, 5)
  return `\nRecent tasks completed:\n${recent.map(m =>
    `- "${m.goal}" (${m.success ? 'success' : 'failed'}, ${m.steps} steps)`
  ).join('\n')}\n`
}

// ── System prompt для планировщика ────────────────────────────────────────────

export function buildPlannerPrompt(goal: string, screenDescription?: string): string {
  const memoryContext = getRecentMemoryContext()

  return `You are an autonomous AI agent that controls a Windows computer.

Your goal: "${goal}"
${memoryContext}
${screenDescription ? `Current screen state:\n${screenDescription}\n` : ''}

Create a step-by-step plan to achieve this goal. Each step should be a single tool call.

Respond with ONLY a JSON array of steps:
[
  {
    "description": "Brief description of what this step does",
    "tool": "tool_name",
    "args": { "param": "value" }
  }
]

Available tools:
- open_url: { url } — open website in browser
- launch_app: { app } — launch application  
- move_cursor: { x, y } — move mouse to coordinates
- mouse_click: { x, y, button?, double? } — click mouse
- type_text: { text } — type text with keyboard
- press_key: { key } — press keyboard key (enter, tab, ctrl+c, etc.)
- scroll: { direction, amount? } — scroll up/down
- search_web: { query } — search internet
- search_youtube: { query } — search YouTube
- analyze_screen: { prompt } — take screenshot and analyze with AI
- find_element: { description } — find UI element and get coordinates
- run_command: { command } — run PowerShell command
- create_file: { path, content } — create file
- get_datetime: {} — get current time

Rules:
- Keep steps minimal (max 8 steps)
- For clicking UI elements: use find_element first to get coordinates, then mouse_click
- For web tasks: open_url → wait → analyze_screen to see result
- Return ONLY the JSON array, no other text`
}

// ── Парсер плана ──────────────────────────────────────────────────────────────

export function parsePlan(response: string, goal: string): AgentPlan | null {
  try {
    const match = response.match(/\[[\s\S]*\]/)
    if (!match) return null

    const steps = JSON.parse(match[0])
    if (!Array.isArray(steps) || steps.length === 0) return null

    return {
      goal,
      steps: steps.slice(0, 8).map((s: any, i: number) => ({
        id: `step-${i}`,
        description: s.description || `Step ${i + 1}`,
        toolCall: s.tool ? { name: s.tool, args: s.args || {} } : undefined,
        status: 'pending',
        attempts: 0
      })),
      currentStep: 0,
      status: 'running',
      startedAt: Date.now()
    }
  } catch {
    return null
  }
}

// ── Retry prompt ──────────────────────────────────────────────────────────────

export function buildRetryPrompt(
  step: AgentStep,
  error: string,
  screenDescription?: string
): string {
  return `A step in an automation task failed. Suggest an alternative approach.

Failed step: "${step.description}"
Error: ${error}
Attempt: ${step.attempts + 1}/3
${screenDescription ? `Current screen: ${screenDescription}` : ''}

Respond with a single alternative tool call JSON:
{
  "description": "Alternative approach",
  "tool": "tool_name", 
  "args": { "param": "value" }
}
Or respond with {"skip": true} if this step should be skipped.`
}

// ── Verify completion ─────────────────────────────────────────────────────────

export function buildVerifyPrompt(goal: string, executedSteps: AgentStep[], screenDescription?: string): string {
  const stepsText = executedSteps.map((s, i) =>
    `${i + 1}. ${s.description}: ${s.status === 'done' ? '✅' : '❌'} ${s.result?.slice(0, 80) || ''}`
  ).join('\n')

  return `Verify if this task was completed successfully.

Goal: "${goal}"

Steps executed:
${stepsText}

${screenDescription ? `Current screen: ${screenDescription}` : ''}

Respond with JSON only:
{"completed": true/false, "reason": "brief explanation"}`
}
