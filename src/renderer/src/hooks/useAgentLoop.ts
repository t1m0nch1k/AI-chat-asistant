/**
 * useAgentLoop — улучшенный autonomous agent hook.
 *
 * Новое:
 * - Retry logic: до 3 попыток на шаг с альтернативным подходом
 * - Screen verification: скриншот после каждого шага для проверки
 * - Memory: сохраняет результаты задач в localStorage
 */

import { useState, useRef, useCallback } from 'react'
import {
  AgentPlan,
  AgentStep,
  buildPlannerPrompt,
  buildRetryPrompt,
  buildVerifyPrompt,
  parsePlan,
  saveAgentMemory
} from '../utils/agentLoop'

const MAX_RETRIES = 3
const STEP_DELAY_MS = 600

interface UseAgentLoopOptions {
  settings: any
  userPaths: any
  onStepResult: (step: AgentStep, result: string) => void
  onPlanUpdate: (plan: AgentPlan) => void
  onComplete: (plan: AgentPlan, summary: string) => void
  executeToolCall: (name: string, args: Record<string, unknown>) => Promise<string>
}

export function useAgentLoop({
  settings,
  userPaths,
  onStepResult,
  onPlanUpdate,
  onComplete,
  executeToolCall
}: UseAgentLoopOptions) {
  const [plan, setPlan] = useState<AgentPlan | null>(null)
  const [isRunning, setIsRunning] = useState(false)
  const stopRef = useRef(false)

  const stop = useCallback(() => {
    stopRef.current = true
    setPlan(prev => prev ? { ...prev, status: 'stopped' } : null)
    setIsRunning(false)
  }, [])

  // ── Вспомогательные функции ───────────────────────────────────────────────

  const getScreenDescription = async (): Promise<string | undefined> => {
    if (!settings.apiKey && settings.provider !== 'ollama') {
      return undefined
    }
    try {
      const visionProvider = settings.provider === 'anthropic' ? 'anthropic' :
        settings.provider === 'gemini' ? 'gemini' :
        settings.provider === 'ollama' ? 'ollama' :
        settings.provider === 'nvidia' ? 'nvidia' :
        settings.provider === 'huggingface' ? 'huggingface' : 'openai'
      const visionModel = settings.provider === 'ollama'
        ? settings.model?.includes('vl') || settings.model?.includes('moondream') || settings.model?.includes('llava') || settings.model?.includes('minicpm-v')
          ? settings.model
          : 'llava'
        : settings.model
      const r = await Promise.race([
        window.api.analyzeScreen('Briefly describe what is on screen in 2-3 sentences.', visionProvider, settings.apiKey, visionModel, undefined, settings.ollamaBaseUrl),
        new Promise<any>(res => setTimeout(() => res({ success: false }), 8000))
      ])
      return r.success ? r.result : undefined
    } catch {
      return undefined
    }
  }

  const callLLM = async (prompt: string): Promise<string> => {
    const { provider, apiKey, model, ollamaBaseUrl, openrouterBaseUrl } = settings

    const res = await window.api.chatSimple({ provider, apiKey, model, prompt, ollamaBaseUrl, openrouterBaseUrl })
    if (!res.success) throw new Error(res.error || 'Unknown LLM error')
    return res.result || ''
  }

  // ── Выполнение шага с retry ───────────────────────────────────────────────

  const executeStepWithRetry = async (
    step: AgentStep,
    agentPlan: AgentPlan,
    stepIndex: number
  ): Promise<{ success: boolean; result: string }> => {
    let lastError = ''

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      if (stopRef.current) return { success: false, result: 'stopped' }

      agentPlan.steps[stepIndex] = { ...step, status: 'running', attempts: attempt }
      setPlan({ ...agentPlan })

      try {
        if (!step.toolCall) {
          return { success: true, result: 'Step completed (no action needed)' }
        }

        const result = await executeToolCall(step.toolCall.name, step.toolCall.args)
        return { success: true, result }

      } catch (e: any) {
        lastError = e.message
        console.warn(`[Agent] Step "${step.description}" failed (attempt ${attempt + 1}):`, e.message)

        if (attempt < MAX_RETRIES - 1 && !stopRef.current) {
          // Получаем скриншот для контекста retry
          const screenDesc = await getScreenDescription()

          // Просим LLM предложить альтернативу
          try {
            const retryResponse = await callLLM(buildRetryPrompt(step, lastError, screenDesc))
            const retryJson = retryResponse.match(/\{[\s\S]*\}/)

            if (retryJson) {
              const parsed = JSON.parse(retryJson[0])
              if (parsed.skip) {
                return { success: false, result: `Skipped: ${lastError}` }
              }
              if (parsed.tool) {
                // Обновляем tool call для следующей попытки
                step = { ...step, toolCall: { name: parsed.tool, args: parsed.args || {} }, attempts: attempt + 1 }
              }
            }
          } catch {
            // Если retry planning не удался — просто повторяем оригинальный шаг
          }

          // Пауза перед retry
          await new Promise(r => setTimeout(r, 1000))
        }
      }
    }

    return { success: false, result: `Failed after ${MAX_RETRIES} attempts: ${lastError}` }
  }

  // ── Основной цикл ─────────────────────────────────────────────────────────

  const run = useCallback(async (goal: string): Promise<string> => {
    stopRef.current = false
    setIsRunning(true)

    // 1. Анализируем экран
    const screenDescription = await getScreenDescription()

    // 2. Планируем
    let planResponse = ''
    try {
      planResponse = await callLLM(buildPlannerPrompt(goal, screenDescription))
    } catch (e: any) {
      setIsRunning(false)
      return `❌ Planning failed: ${e.message}`
    }

    const agentPlan = parsePlan(planResponse, goal)
    if (!agentPlan || agentPlan.steps.length === 0) {
      setIsRunning(false)
      return `❌ Could not create a plan for: "${goal}"`
    }

    setPlan(agentPlan)
    onPlanUpdate(agentPlan)

    // 3. Выполняем шаги
    const results: string[] = []
    let successCount = 0

    for (let i = 0; i < agentPlan.steps.length; i++) {
      if (stopRef.current) break

      agentPlan.currentStep = i
      const step = agentPlan.steps[i]

      const { success, result } = await executeStepWithRetry(step, agentPlan, i)

      agentPlan.steps[i] = { ...step, status: success ? 'done' : 'failed', result: result.slice(0, 150), attempts: step.attempts }
      setPlan({ ...agentPlan })
      onPlanUpdate({ ...agentPlan })
      onStepResult(agentPlan.steps[i], result)

      results.push(`${success ? '✅' : '❌'} ${step.description}`)
      if (success) successCount++

      // Пауза между шагами
      if (i < agentPlan.steps.length - 1 && !stopRef.current) {
        await new Promise(r => setTimeout(r, STEP_DELAY_MS))
      }
    }

    // 4. Проверяем результат через скриншот
    let verificationNote = ''
    if (!stopRef.current && successCount > 0 && settings.apiKey) {
      const finalScreen = await getScreenDescription()
      if (finalScreen) {
        try {
          const verifyResponse = await callLLM(buildVerifyPrompt(goal, agentPlan.steps, finalScreen))
          const verifyJson = verifyResponse.match(/\{[\s\S]*\}/)
          if (verifyJson) {
            const verified = JSON.parse(verifyJson[0])
            verificationNote = verified.completed
              ? `\n\n✅ **Verified:** ${verified.reason}`
              : `\n\n⚠️ **Verification:** ${verified.reason}`
          }
        } catch {}
      }
    }

    // 5. Финализируем
    const finalStatus = stopRef.current ? 'stopped' : 'done'
    agentPlan.status = finalStatus
    setPlan({ ...agentPlan })
    setIsRunning(false)

    // Сохраняем в память
    saveAgentMemory({
      id: crypto.randomUUID(),
      goal,
      summary: results.join('; '),
      steps: agentPlan.steps.length,
      success: successCount === agentPlan.steps.length,
      timestamp: Date.now()
    })

    const summary = stopRef.current
      ? `⏹️ **Agent stopped**\n\n${results.join('\n')}`
      : `✅ **Task: "${goal}"**\n\n${results.join('\n')}${verificationNote}`

    onComplete({ ...agentPlan }, summary)
    return summary
  }, [settings, executeToolCall, onStepResult, onPlanUpdate, onComplete])

  return { plan, isRunning, run, stop }
}
