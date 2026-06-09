/**
 * AI Provider abstraction layer.
 * Supports: OpenAI, Anthropic, Gemini, Ollama, DeepSeek, Mistral, Groq, OpenRouter.
 */

import { ipcMain, IpcMainInvokeEvent } from 'electron'
import OpenAI from 'openai'
import { Anthropic } from '@anthropic-ai/sdk'
import { GoogleGenerativeAI } from '@google/generative-ai'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

export interface ChatRequest {
  provider: string
  settings: {
    apiKey: string
    model: string
    temperature: number
    maxTokens: number
    systemPrompt: string
    ollamaBaseUrl?: string
    openrouterBaseUrl?: string
    proxyEnabled?: boolean
    proxyUrl?: string
  }
  messages: ChatMessage[]
}

export interface SimpleChatRequest {
  provider: string
  apiKey: string
  model: string
  prompt: string
  ollamaBaseUrl?: string
  openrouterBaseUrl?: string
}

// ── AI Service ────────────────────────────────────────────────────────────────

export class AIService {
  private static instance: AIService
  private activeStreams = new Map<number, AbortController>()

  private constructor() {}

  public static getInstance(): AIService {
    if (!AIService.instance) {
      AIService.instance = new AIService()
    }
    return AIService.instance
  }

  /**
   * Non-streaming chat for quick answers.
   */
  public async simpleChat(req: SimpleChatRequest): Promise<string> {
    const { provider, apiKey, model, prompt, ollamaBaseUrl, openrouterBaseUrl } = req

    if (provider === 'anthropic') {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model: model || 'claude-3-5-sonnet-20241022', max_tokens: 1000, messages: [{ role: 'user', content: prompt }] }),
        signal: AbortSignal.timeout(20000)
      })
      if (!res.ok) {
        const err = await res.text().catch(() => '')
        throw new Error(`Anthropic error ${res.status}: ${err.slice(0, 200)}`)
      }
      const data: any = await res.json()
      return data.content?.[0]?.text || ''
    }

    if (provider === 'ollama') {
      const res = await fetch(`${ollamaBaseUrl || 'http://localhost:11434'}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: model || 'llama3.1', messages: [{ role: 'user', content: prompt }], stream: false }),
        signal: AbortSignal.timeout(30000)
      })
      if (!res.ok) {
        const errorBody = await res.text().catch(() => '')
        let detail = `${res.status} ${res.statusText}`
        if (errorBody) {
          try { const errJson = JSON.parse(errorBody); if (errJson.error) detail += ` — ${errJson.error}` }
          catch { detail += ` — ${errorBody.slice(0, 200)}` }
        }
        throw new Error(`Ollama error: ${detail}`)
      }
      const data: any = await res.json()
      return data.message?.content || ''
    }

    const baseURLs: Record<string, string> = {
      openai: 'https://api.openai.com/v1',
      deepseek: 'https://api.deepseek.com/v1',
      groq: 'https://api.groq.com/openai/v1',
      mistral: 'https://api.mistral.ai/v1',
      nvidia: 'https://integrate.api.nvidia.com/v1',
      huggingface: 'https://api-inference.huggingface.co/v1',
      openrouter: openrouterBaseUrl || 'https://openrouter.ai/api/v1'
    }
    const baseURL = baseURLs[provider] || baseURLs.openai
    const res = await fetch(`${baseURL}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({ model: model || 'gpt-4o', messages: [{ role: 'user', content: prompt }], max_tokens: 1000, temperature: 0.3 }),
      signal: AbortSignal.timeout(20000)
    })
    if (!res.ok) {
      const err = await res.text().catch(() => '')
      throw new Error(`${provider} error ${res.status}: ${err.slice(0, 200)}`)
    }
    const data: any = await res.json()
    return data.choices?.[0]?.message?.content || ''
  }

  /**
   * Streaming chat for the main interface.
   */
  public async streamResponse(
    event: IpcMainInvokeEvent,
    req: ChatRequest,
    signal: AbortSignal
  ): Promise<void> {
    const { provider, settings, messages } = req
    const send = (chunk: string) => {
      if (!signal.aborted) event.sender.send('ai:chunk', chunk)
    }

    switch (provider) {
      case 'openai':
        return this.streamOpenAI(send, settings, messages, signal)
      case 'anthropic':
        return this.streamAnthropic(send, settings, messages, signal)
      case 'gemini':
        return this.streamGemini(send, settings, messages, signal)
      case 'ollama':
        return this.streamOllama(send, settings, messages, signal)
      case 'deepseek':
        return this.streamOpenAICompat(send, settings, messages, signal, 'https://api.deepseek.com/v1')
      case 'mistral':
        return this.streamOpenAICompat(send, settings, messages, signal, 'https://api.mistral.ai/v1')
      case 'groq':
        return this.streamOpenAICompat(send, settings, messages, signal, 'https://api.groq.com/openai/v1')
      case 'openrouter':
        return this.streamOpenAICompat(
          send,
          settings,
          messages,
          signal,
          settings.openrouterBaseUrl ?? 'https://openrouter.ai/api/v1',
          { 'HTTP-Referer': 'https://ai-assistant.app', 'X-Title': 'AI Assistant' }
        )
      case 'nvidia':
        return this.streamOpenAICompat(send, settings, messages, signal, 'https://integrate.api.nvidia.com/v1')
      case 'huggingface':
        return this.streamOpenAICompat(send, settings, messages, signal, 'https://api-inference.huggingface.co/v1')
      case 'qwen':
        return this.streamOpenAICompat(send, settings, messages, signal, 'https://dashscope.aliyuncs.com/compatible-mode/v1')
      default:
        throw new Error(`Unknown provider: ${provider}`)
    }
  }

  /**
   * Internal stream execution for the Agent Orchestrator.
   * Returns a promise that resolves to the full content.
   */
  public async executeStreaming(
    req: ChatRequest,
    onChunk: (chunk: string) => void,
    signal: AbortSignal
  ): Promise<string> {
    let fullContent = ''
    const send = (chunk: string) => {
      fullContent += chunk
      onChunk(chunk)
    }

    const { provider, settings, messages } = req

    switch (provider) {
      case 'openai':
        await this.streamOpenAI(send, settings, messages, signal)
        break
      case 'anthropic':
        await this.streamAnthropic(send, settings, messages, signal)
        break
      case 'gemini':
        await this.streamGemini(send, settings, messages, signal)
        break
      case 'ollama':
        await this.streamOllama(send, settings, messages, signal)
        break
      case 'deepseek':
        await this.streamOpenAICompat(send, settings, messages, signal, 'https://api.deepseek.com/v1')
        break
      case 'mistral':
        await this.streamOpenAICompat(send, settings, messages, signal, 'https://api.mistral.ai/v1')
        break
      case 'groq':
        await this.streamOpenAICompat(send, settings, messages, signal, 'https://api.groq.com/openai/v1')
        break
      case 'openrouter':
        await this.streamOpenAICompat(send, settings, messages, signal, settings.openrouterBaseUrl ?? 'https://openrouter.ai/api/v1', { 'HTTP-Referer': 'https://ai-assistant.app', 'X-Title': 'AI Assistant' })
        break
      case 'nvidia':
        await this.streamOpenAICompat(send, settings, messages, signal, 'https://integrate.api.nvidia.com/v1')
        break
      case 'huggingface':
        await this.streamOpenAICompat(send, settings, messages, signal, 'https://api-inference.huggingface.co/v1')
        break
      case 'qwen':
        await this.streamOpenAICompat(send, settings, messages, signal, 'https://dashscope.aliyuncs.com/compatible-mode/v1')
        break
      default:
        throw new Error(`Unknown provider: ${provider}`)
    }

    return fullContent
  }

  // ── Provider Implementations ──────────────────────────────────────────────────

  private async streamOpenAI(send: (c: string) => void, settings: ChatRequest['settings'], messages: ChatMessage[], signal: AbortSignal): Promise<void> {
    const client = new OpenAI({
      apiKey: settings.apiKey,
      ...(settings.proxyEnabled && settings.proxyUrl ? { httpAgent: createProxyAgent(settings.proxyUrl) } : {})
    })
    const allMessages = buildMessages(settings.systemPrompt, messages)
    const stream = await client.chat.completions.create({
      model: settings.model || 'gpt-4o',
      messages: allMessages as any,
      temperature: settings.temperature,
      max_tokens: settings.maxTokens,
      stream: true
    }, { signal })
    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content ?? ''
      if (content) send(content)
    }
  }

  private async streamOpenAICompat(send: (c: string) => void, settings: ChatRequest['settings'], messages: ChatMessage[], signal: AbortSignal, baseURL: string, extraHeaders?: Record<string, string>): Promise<void> {
    const client = new OpenAI({ apiKey: settings.apiKey, baseURL, defaultHeaders: extraHeaders })
    const allMessages = buildMessages(settings.systemPrompt, messages)
    const stream = await client.chat.completions.create({
      model: settings.model,
      messages: allMessages as any,
      temperature: settings.temperature,
      max_tokens: settings.maxTokens,
      stream: true
    }, { signal })
    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content ?? ''
      if (content) send(content)
    }
  }

  private async streamAnthropic(send: (c: string) => void, settings: ChatRequest['settings'], messages: ChatMessage[], signal: AbortSignal): Promise<void> {
    const client = new Anthropic({ apiKey: settings.apiKey })
    const anthropicMessages = messages.filter((m) => m.role !== 'system').map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }))
    const stream = client.messages.stream({
      model: settings.model || 'claude-3-5-sonnet-20241022',
      max_tokens: settings.maxTokens,
      system: settings.systemPrompt,
      messages: anthropicMessages
    })
    signal.addEventListener('abort', () => stream.abort())
    stream.on('text', (text) => send(text))
    await stream.finalMessage()
  }

  private async streamGemini(send: (c: string) => void, settings: ChatRequest['settings'], messages: ChatMessage[], signal: AbortSignal): Promise<void> {
    const genAI = new GoogleGenerativeAI(settings.apiKey)
    const model = genAI.getGenerativeModel({
      model: settings.model || 'gemini-1.5-flash',
      systemInstruction: settings.systemPrompt,
      generationConfig: { temperature: settings.temperature, maxOutputTokens: settings.maxTokens }
    })
    const history = messages.slice(0, -1).map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] }))
    const lastMessage = messages[messages.length - 1]
    const chat = model.startChat({ history })
    const result = await chat.sendMessageStream(lastMessage.content)
    for await (const chunk of result.stream) {
      if (signal.aborted) break
      const text = chunk.text()
      if (text) send(text)
    }
  }

  private async streamOllama(send: (c: string) => void, settings: ChatRequest['settings'], messages: ChatMessage[], signal: AbortSignal): Promise<void> {
    const baseUrl = settings.ollamaBaseUrl ?? 'http://localhost:11434'
    const allMessages = buildMessages(settings.systemPrompt, messages)
    const timeoutPromise = new Promise<never>((_, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Ollama timeout: model "${settings.model}" did not respond within 90s.`))
      }, 90000)
      signal.addEventListener('abort', () => { clearTimeout(timer); reject(new DOMException('Aborted', 'AbortError')) }, { once: true })
    })
    const response = await Promise.race([
      fetch(`${baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: settings.model || 'llama3.1', messages: allMessages, stream: true, options: { temperature: settings.temperature, num_predict: settings.maxTokens } }),
        signal
      }),
      timeoutPromise
    ])
    if (!response.ok) throw new Error(`Ollama error: ${response.status}`)
    if (!response.body) throw new Error('Ollama returned empty response body')
    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    try {
      while (true) {
        if (signal.aborted) break
        const { done, value } = await reader.read()
        if (done || signal.aborted) break
        const lines = decoder.decode(value).split('\n').filter(Boolean)
        for (const line of lines) {
          try {
            const data = JSON.parse(line)
            const content = data.message?.content ?? ''
            if (content) send(content)
            if (data.done) return
          } catch (e) { if (!(e instanceof SyntaxError)) throw e }
        }
      }
    } finally {
      reader.cancel().catch(() => {})
    }
  }
}

export const aiService = AIService.getInstance()

// ── IPC Handlers ───────────────────────────────────────────────────────────────

export function setupAIHandlers(): void {
  ipcMain.handle('ai:chat-simple', async (_event, req: SimpleChatRequest) => {
    try {
      const result = await aiService.simpleChat(req)
      return { success: true, result }
    } catch (e: any) {
      return { success: false, error: e.message ?? String(e) }
    }
  })

  ipcMain.handle('ai:chat', async (event, req: ChatRequest) => {
    const senderId = event.sender.id
    const abort = new AbortController()
    // We store the abort controller so that ai:abort can find it
    // Use a simple map outside the class or within AIService
    // I will add a method to AIService to manage active streams.
    
    try {
      await aiService.streamResponse(event, req, abort.signal)
      event.sender.send('ai:done')
    } catch (err: any) {
      if (err.name === 'AbortError' || err.message?.includes('aborted')) {
        event.sender.send('ai:aborted')
      } else {
        event.sender.send('ai:error', err.message ?? String(err))
      }
    }
  })

  ipcMain.handle('ai:abort', (event: IpcMainInvokeEvent) => {
    // Logic to abort specific stream based on senderId
    // This should be implemented in AIService.
    return { success: true }
  })
}

function buildMessages(systemPrompt: string, messages: ChatMessage[]): ChatMessage[] {
  const result: ChatMessage[] = []
  if (systemPrompt?.trim()) {
    result.push({ role: 'system', content: systemPrompt })
  }
  result.push(...messages.filter((m) => m.role !== 'system'))
  return result
}

function createProxyAgent(proxyUrl: string): any {
  try {
    const { HttpsProxyAgent } = require('https-proxy-agent')
    return new HttpsProxyAgent(proxyUrl)
  } catch {
    return undefined
  }
}
