/**
 * Agent Tool Parser - Shared logic for extracting tool calls from AI responses.
 */

export interface AgentToolCall {
  name: string
  args: Record<string, unknown>
}

export function parseToolCalls(response: string): AgentToolCall[] {
  const calls: AgentToolCall[] = []

  // Формат 1: все блоки ```tool_call { ... } ``` или ```tool { ... } ```
  const fencedMatches = response.matchAll(/```(?:tool_call|tool)\s*([\s\S]*?)```/g)
  for (const match of fencedMatches) {
    const result = tryParseJSON(match[1].trim())
    if (result) calls.push(result)
  }

  if (calls.length > 0) return calls

  // Формат 2: незакрытый последний блок ```tool_call { ... (стриминг оборвался)
  const partialFenced = response.match(/```(?:tool_call|tool)\s*(\{[\s\S]*)$/)
  if (partialFenced) {
    const result = tryParseJSONPartial(partialFenced[1])
    if (result) calls.push(result)
  }

  if (calls.length > 0) return calls

  // Формат 3: все голые JSON объекты {"name": "...", "args": {...}}
  const jsonMatches = response.matchAll(/\{[^{}]*"name"\s*:\s*"([^"]+)"[^{}]*"args"\s*:\s*(\{[^{}]*\})[^{}]*\}/g)
  for (const m of jsonMatches) {
    try {
      const parsed = JSON.parse(m[0])
      if (parsed.name && parsed.args !== undefined) {
        calls.push({ name: parsed.name, args: parsed.args })
      }
    } catch {}
  }

  if (calls.length > 0) return calls

  // Формат 4: голый незакрытый JSON {"name": "...", "args": {... (оборвался)
  const partialJson = response.match(/\{\s*"name"\s*:\s*"([^"]+)"\s*,\s*"args"\s*:\s*(\{[\s\S]*)$/)
  if (partialJson) {
    const result = tryParseJSONPartial(`{"name": "${partialJson[1]}", "args": ${partialJson[2]}`)
    if (result) calls.push(result)
  }

  return calls
}

function tryParseJSON(json: string): AgentToolCall | null {
  try {
    const parsed = JSON.parse(json)
    if (parsed.name && typeof parsed.name === 'string') {
      return { name: parsed.name, args: parsed.args || {} }
    }
  } catch {}
  return null
}

function tryParseJSONPartial(json: string): AgentToolCall | null {
  try {
    const opens = (json.match(/\{/g) || []).length
    const closes = (json.match(/\}/g) || []).length
    const closed = json + '}'.repeat(Math.max(0, opens - closes))
    const parsed = JSON.parse(closed)
    if (parsed.name && typeof parsed.name === 'string') {
      if (!parsed.args || Object.keys(parsed.args).length === 0) return null
      return { name: parsed.name, args: parsed.args }
    }
  } catch {}
  return null
}
