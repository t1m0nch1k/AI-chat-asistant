/**
 * AgentOrchestrator - Manages the Tool-AI loop in the Main process.
 * This is the 'Brain' that coordinates between the AI provider and ToolManager.
 */

import { ipcMain, IpcMainInvokeEvent, webContents } from 'electron'
import { toolManager, ToolResult } from './tool-manager'
import { aiService, ChatRequest, ChatMessage } from './ai'
import { parseToolCalls, AgentToolCall } from './utils/agent-parser'

interface OrchestratorState {
  isExecuting: boolean
  currentChatId: string | null
  abortController: AbortController | null
}

export class AgentOrchestrator {
  private static instance: AgentOrchestrator
  private state: OrchestratorState = {
    isExecuting: false,
    currentChatId: null,
    abortController: null
  }

  private constructor() {}

  public static getInstance(): AgentOrchestrator {
    if (!AgentOrchestrator.instance) {
      AgentOrchestrator.instance = new AgentOrchestrator()
    }
    return AgentOrchestrator.instance
  }

  public init(): void {
    ipcMain.handle('agent:run-loop', async (event, {
      chatId,
      provider,
      settings,
      messages,
      allowedPaths
    }: {
      chatId: string
      provider: string
      settings: any
      messages: any[]
      allowedPaths: string[]
    }) => {
      return await this.runLoop(event, { chatId, provider, settings, messages, allowedPaths })
    })

    ipcMain.handle('agent:abort', () => {
      if (this.state.abortController) {
        this.state.abortController.abort()
        this.state.isExecuting = false
        this.state.abortController = null
      }
      return { success: true }
    })
  }

  /**
   * The core Agent Loop: AI Response -> Parse Tools -> Execute -> Feed Back -> AI Response
   */
  private async runLoop(
    event: IpcMainInvokeEvent,
    params: {
      chatId: string
      provider: string
      settings: any
      messages: any[]
      allowedPaths: string[]
    }
  ): Promise<{ success: boolean; error?: string }> {
    const { chatId, provider, settings, messages, allowedPaths } = params
    this.state.isExecuting = true
    this.state.currentChatId = chatId
    this.state.abortController = new AbortController()
    const signal = this.state.abortController.signal

    try {
      let currentMessages: ChatMessage[] = [...messages]
      let iterations = 0
      const MAX_ITERATIONS = 10

      while (iterations < MAX_ITERATIONS) {
        if (signal.aborted) {
          throw new Error('Agent loop aborted by user')
        }

        // 1. Call AI with streaming to the renderer
        const aiResponse = await aiService.executeStreaming(
          { provider, settings, messages: currentMessages },
          (chunk) => {
            if (!signal.aborted) {
              event.sender.send('ai:chunk', chunk)
            }
          },
          signal
        )

        // 2. Add AI response to history
        currentMessages.push({ role: 'assistant', content: aiResponse })

        // 3. Parse tool calls from the response
        const toolCalls = parseToolCalls(aiResponse)
        if (toolCalls.length === 0) {
          // No tools called, we are done
          break
        }

        // 4. Execute tools sequentially
        for (const toolCall of toolCalls) {
          const result = await toolManager.execute(toolCall.name, toolCall.args, allowedPaths)
          
          const resultMsg = result.success 
            ? `✅ Tool ${toolCall.name} result: ${result.content || 'Success'}` 
            : `❌ Tool ${toolCall.name} failed: ${result.error}`

          // Send the tool result to renderer so user sees it
          if (!signal.aborted) {
            event.sender.send('ai:chunk', `

${resultMsg}

`)
          }
          
          // Add to history
          currentMessages.push({ role: 'user', content: resultMsg })
        }

        iterations++
      }

      // Signal completion
      if (!signal.aborted) {
        event.sender.send('ai:done')
      }
      return { success: true }
    } catch (err: any) {
      console.error('[AgentOrchestrator] Loop error:', err)
      return { success: false, error: err.message }
    } finally {
      this.state.isExecuting = false
      this.state.abortController = null
    }
  }
}

export const agentOrchestrator = AgentOrchestrator.getInstance()
