import { useState, useRef, useCallback } from 'react'
import { useCoderStore } from '../store/useCoderStore'
import { 
  buildCoderPlannerPrompt, 
  parseCoderPlan, 
  buildCoderRetryPrompt,
  CoderAgentPlan,
  CoderAgentStep 
} from '../utils/coderAgentLoop'

const MAX_RETRIES = 3
const STEP_DELAY_MS = 400

interface UseCoderAgentLoopOptions {
  settings: any
  onStepResult: (step: CoderAgentStep, result: string) => void
  onComplete: (summary: string) => void
}

export function useCoderAgentLoop({
  settings,
  onStepResult,
  onComplete
}: UseCoderAgentLoopOptions) {
  const [plan, setPlan] = useState<CoderAgentPlan | null>(null)
  const [isRunning, setIsRunning] = useState(false)
  const stopRef = useRef(false)

  const stop = useCallback(() => {
    stopRef.current = true
    setIsRunning(false)
  }, [])

  const callLLM = async (prompt: string): Promise<string> => {
    const { provider, apiKey, model, ollamaBaseUrl, openrouterBaseUrl } = settings
    const res = await window.api.chatSimple({ 
      provider, apiKey, model, prompt, ollamaBaseUrl, openrouterBaseUrl 
    })
    if (!res.success) throw new Error(res.error || 'Unknown LLM error')
    return res.result || ''
  }

  const executeToolCall = async (name: string, args: Record<string, any>): Promise<string> => {
    const { agentState } = useCoderStore.getState()

    switch (name) {
      case 'read_file':
        const readRes = await window.api.coderRead(args.path)
        if (!readRes.success) throw new Error(readRes.error)
        return readRes.content || 'File is empty'
      
      case 'write_file':
        if (agentState.mode === 'composer') {
          useCoderStore.getState().openComposerFile(args.path, args.content)
          return `Proposed changes to ${args.path} in Composer. User must accept them.`
        }
        const writeRes = await window.api.coderWrite(args.path, args.content)
        if (!writeRes.success) throw new Error(writeRes.error)
        return `Successfully wrote to ${args.path}`
      
      case 'search_codebase':
        const searchRes = await window.api.coderSearchCodebase(args.query)
        if (!searchRes.success) throw new Error(searchRes.error)
        return JSON.stringify(searchRes.results)
      
      case 'run_terminal':
        const termRes = await window.api.coderTerminal(args.command)
        if (!termRes.success) throw new Error(termRes.error)
        return termRes.output
      
      case 'get_structure':
        const structRes = await window.api.coderGetStructure(args)
        if (!structRes.success) throw new Error(structRes.error)
        return JSON.stringify(structRes.data)
      
      case 'read_multiple':
        const multiRes = await window.api.coderReadMultiple(args.paths)
        if (!multiRes.success) throw new Error(multiRes.error)
        return JSON.stringify(multiRes.files)
      
      default:
        throw new Error(`Unknown tool: ${name}`)
    }
  }

  const executeStepWithRetry = async (
    step: CoderAgentStep,
    agentPlan: CoderAgentPlan,
    stepIndex: number
  ): Promise<{ success: boolean; result: string }> => {
    let lastError = ''

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      if (stopRef.current) return { success: false, result: 'stopped' }

      try {
        if (!step.toolCall) return { success: true, result: 'No action needed' }
        const result = await executeToolCall(step.toolCall.name, step.toolCall.args)
        return { success: true, result }
      } catch (e: any) {
        lastError = e.message
        if (attempt < MAX_RETRIES - 1 && !stopRef.current) {
          try {
            const retryResponse = await callLLM(buildCoderRetryPrompt(step, lastError))
            const retryJson = retryResponse.match(/\{.*\}/)
            if (retryJson) {
              const parsed = JSON.parse(retryJson[0])
              if (parsed.skip) return { success: false, result: `Skipped: ${lastError}` }
              if (parsed.tool) {
                step = { ...step, toolCall: { name: parsed.tool, args: parsed.args || {} }, attempts: attempt + 1 }
              }
            }
          } catch { /* continue to next retry */ }
          await new Promise(r => setTimeout(r, 500))
        }
      }
    }
    return { success: false, result: `Failed after ${MAX_RETRIES} attempts: ${lastError}` }
  }

  const run = useCallback(async (goal: string): Promise<string> => {
    stopRef.current = false
    setIsRunning(true)

    const { openFiles } = useCoderStore.getState()
    const planResponse = await callLLM(buildCoderPlannerPrompt(goal, openFiles))
    const agentPlan = parseCoderPlan(planResponse, goal)

    if (!agentPlan) {
      setIsRunning(false)
      return `❌ Planning failed for: "${goal}"`
    }

    setPlan(agentPlan)

    const results: string[] = []
    let successCount = 0

    for (let i = 0; i < agentPlan.steps.length; i++) {
      if (stopRef.current) break
      agentPlan.currentStep = i
      const step = agentPlan.steps[i]

      const { success, result } = await executeStepWithRetry(step, agentPlan, i)
      
      agentPlan.steps[i] = { ...step, status: success ? 'done' : 'failed', result: result.slice(0, 200), attempts: step.attempts }
      setPlan({ ...agentPlan })
      onStepResult(agentPlan.steps[i], result)

      results.push(`${success ? '✅' : '❌'} ${step.description}`)
      if (success) successCount++
      await new Promise(r => setTimeout(r, STEP_DELAY_MS))
    }

    const finalStatus = stopRef.current ? 'stopped' : 'done'
    agentPlan.status = finalStatus
    setPlan({ ...agentPlan })
    setIsRunning(false)

    const summary = stopRef.current
      ? `⏹️ **Agent stopped**\n\n${results.join('\\n')}`
      : `✅ **Task: "${goal}"**\n\n${results.join('\\n')}`

    onComplete(summary)
    return summary
    }, [settings, onStepResult, onComplete])

  return { plan, isRunning, run, stop }
}
