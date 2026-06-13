/**
 * Coder Agent Loop Utilities — specialized for codebase manipulation.
 */

export interface CoderAgentStep {
  id: string
  description: string
  toolCall?: { name: string; args: Record<string, unknown> }
  status: 'pending' | 'running' | 'done' | 'failed'
  result?: string
  attempts: number
}

export interface CoderAgentPlan {
  goal: string
  steps: CoderAgentStep[]
  currentStep: number
  status: 'planning' | 'running' | 'done' | 'failed' | 'stopped'
  startedAt: number
}

export function buildCoderPlannerPrompt(goal: string, currentFiles: string[]): string {
  const filesContext = currentFiles.length > 0 
    ? `Relevant files in context:
${currentFiles.map(f => `- ${f}`).join('\\n')}`
    : 'No specific files provided in context.'

  return `You are an expert AI software engineer. Your goal is to help the user with their codebase.

Your goal: "${goal}"
${filesContext}

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
- read_file: { path } — read content of a file
- write_file: { path, content } — overwrite a file with new content
- search_codebase: { query } — search for symbols/text across the project
- run_terminal: { command } — execute a shell command
- get_structure: { maxDepth } — get the directory tree
- read_multiple: { paths: [] } — read several files at once

Rules:
- Always read a file before editing it.
- Use search_codebase to find where a function or class is defined.
- If you need to check if code compiles, use run_terminal.
- Keep steps minimal (max 10 steps).
- Return ONLY the JSON array, no other text.`
}

export function parseCoderPlan(response: string, goal: string): CoderAgentPlan | null {
  try {
    const match = response.match(/\[[\s\S]*\]/)
    if (!match) return null

    const steps = JSON.parse(match[0])
    if (!Array.isArray(steps) || steps.length === 0) return null

    return {
      goal,
      steps: steps.slice(0, 10).map((s: any, i: number) => ({
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

export function buildCoderRetryPrompt(step: CoderAgentStep, error: string): string {
  return `A coding step failed. Suggest an alternative approach.

Failed step: "${step.description}"
Error: ${error}

Respond with a single alternative tool call JSON:
{
  "description": "Alternative approach",
  "tool": "tool_name", 
  "args": { "param": "value" }
}
Or respond with {"skip": true} if this step should be skipped.`
}
