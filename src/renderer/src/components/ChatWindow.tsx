import React, { useState, useRef, useEffect, useCallback } from 'react'
import { useAppStore } from '../store/useAppStore'
import { useCoderStore } from '../store/useCoderStore'
import { MessageList } from './MessageList'
import { InputArea } from './InputArea'
import { Terminal } from './Terminal'
import { buildAgentSystemPrompt, parseToolCalls } from '../utils/agentTools'
import { useBackgroundVoice } from '../hooks/useBackgroundVoice'
import { useAgentLoop } from '../hooks/useAgentLoop'
import { TimerWidget } from './TimerWidget'

// Убирает все варианты tool call из текста для отображения пользователю.
// Поддерживает: ```tool_call```, ```tool```, ```json```, голый JSON {"name":...,"args":...}
function stripToolCallBlock(text: string): string {
  let result = text

  // 1. Закрытые fenced блоки
  result = result
    .replace(/```tool_call[\s\S]*?```/g, '')
    .replace(/```tool\b[\s\S]*?```/g, '')
    .replace(/```json[\s\S]*?"name"[\s\S]*?```/g, '')

  // 2. Незакрытые fenced блоки (стриминг ещё идёт)
  result = result
    .replace(/```tool_call[\s\S]*$/g, '')
    .replace(/```tool\b[\s\S]*$/g, '')

  // 3. Голый JSON с "name" и "args" (без обёртки в ```)
  result = result
    .replace(/\{[^{}]*"name"\s*:\s*"[^"]*"[^{}]*"args"\s*:\s*\{[\s\S]*?\}\s*\}/g, '')
    .replace(/\{[^{}]*"args"\s*:[^{}]*"name"\s*:\s*"[^"]*"[\s\S]*?\}/g, '')

  // 4. Незакрытый голый JSON — от { "name": до конца текста
  result = result.replace(/\{\s*"name"\s*:\s*"[^"]*"[\s\S]*$/g, '')

  return result.trim()
}

// ── Vision helpers ────────────────────────────────────────────────────────────

function getVisionParams(s: any): { vp: string; vm: string; ollamaUrl?: string } {
  const VISION_MODELS_OLLAMA = ['llava', 'moondream', 'minicpm-v', 'bakllava', 'qwen2-vl', 'qwen2.5vl', 'vl']

  if (s.provider === 'ollama') {
    const isVisionModel = VISION_MODELS_OLLAMA.some(v => s.model.toLowerCase().includes(v))
    return {
      vp: 'ollama',
      vm: isVisionModel ? s.model : 'llava',
      ollamaUrl: s.ollamaBaseUrl || 'http://localhost:11434'
    }
  }
  if (s.provider === 'qwen') {
    return { vp: 'qwen', vm: s.model.includes('vl') ? s.model : 'qwen-vl-max' }
  }
  if (s.provider === 'openrouter') {
    const isVisionModel = s.model.includes('vl') || s.model.includes('vision') || s.model.includes('gpt-4o') || s.model.includes('claude')
    return { vp: 'openrouter', vm: isVisionModel ? s.model : 'qwen/qwen2.5-vl-72b-instruct' }
  }
  if (s.provider === 'anthropic') return { vp: 'anthropic', vm: s.model }
  if (s.provider === 'gemini') return { vp: 'gemini', vm: s.model }
  if (s.provider === 'nvidia') return { vp: 'nvidia', vm: s.model || 'nvidia/llama-3.1-nemotron-70b-instruct' }
  if (s.provider === 'huggingface') return { vp: 'huggingface', vm: s.model || 'meta-llama/Llama-3.1-8B-Instruct' }
  return { vp: 'openai', vm: s.model || 'gpt-4o' }
}

function formatVisionError(error: string, model: string): string {
  const e = error || 'Unknown error'
  if (e.includes('401') || e.includes('invalid_api_key') || e.includes('Incorrect API key'))
    return '❌ Invalid API key. Check Settings → Provider.'
  if (e.includes('429') || e.includes('rate_limit'))
    return '❌ Rate limit exceeded. Wait a moment and retry.'
  if (e.includes('insufficient_quota'))
    return '❌ API quota exceeded. Check your billing.'
  if (e.includes('does not support') || (e.includes('model') && e.includes('vision')))
    return `❌ Model "${model}" does not support vision. Select a 👁️ model in Settings.`
  if (e.includes('ECONNREFUSED') || e.includes('fetch failed'))
    return '❌ Cannot connect to Ollama. Make sure it is running: `ollama serve`'
  if (e.includes('model') && e.includes('not found'))
    return `❌ Model not found in Ollama. Run: \`ollama pull ${model}\``
  return `❌ Vision error: ${e.slice(0, 200)}`
}

export const ChatWindow: React.FC = () => {  const {
    currentChatId,
    chats,
    addMessage,
    updateLastMessage,
    finalizeLastMessage,
    settings,
    setTyping,
    isTyping,
    saveSettings,
    userPaths,
    createNewChat
  } = useAppStore()

  const [streamingContent, setStreamingContent] = useState('')
  const [showTerminal, setShowTerminal] = useState(false)

  // Refs для актуальных значений без stale closure
  const settingsRef = useRef(settings)
  const userPathsRef = useRef(userPaths)
  const currentChatIdRef = useRef(currentChatId)

  useEffect(() => { settingsRef.current = settings }, [settings])
  useEffect(() => { userPathsRef.current = userPaths }, [userPaths])
  useEffect(() => { currentChatIdRef.current = currentChatId }, [currentChatId])

  // Один активный набор IPC слушателей — очищаем только при размонтировании
  const cleanupRef = useRef<(() => void) | null>(null)
  const fullResponseRef = useRef('')

  const currentChat = chats.find((c) => c.id === currentChatId)

  // Очищаем только при размонтировании компонента
  useEffect(() => {
    return () => {
      cleanupRef.current?.()
    }
  }, [])

  // ── executeToolCallDirect (для agent loop без добавления сообщений) ────────

  const executeToolCallDirect = useCallback(async (name: string, args: Record<string, unknown>): Promise<string> => {
    const allowedPaths = settingsRef.current.allowedPaths ?? []
    const s = settingsRef.current
    try {
      switch (name) {
        case 'open_url': { const r = await window.api.openUrl(args.url as string); return r.success ? `Opened ${r.url}` : r.error || 'failed' }
        case 'launch_app': { 
          const r = await window.api.launchApp(args.app as string, args.args as string)
          await new Promise(res => setTimeout(res, 1500)) // ждём запуска
          return r.success ? `Launched ${args.app}` : r.error || 'failed'
        }
        case 'move_cursor': { const r = await window.api.moveCursor(args.x as number, args.y as number); return r.success ? `Moved to (${args.x},${args.y})` : r.error || 'failed' }
        case 'move_cursor_smooth': { const r = await window.api.moveCursorSmooth(args.x as number, args.y as number, args.steps as number); return r.success ? `Moved smoothly to (${args.x},${args.y})` : r.error || 'failed' }
        case 'drag': { const r = await window.api.drag(args.x1 as number, args.y1 as number, args.x2 as number, args.y2 as number); return r.success ? `Dragged (${args.x1},${args.y1}) → (${args.x2},${args.y2})` : r.error || 'failed' }
        case 'mouse_click': { const r = await window.api.mouseClick(args.x as number, args.y as number, args.button as any, args.double as boolean); return r.success ? 'Clicked' : r.error || 'failed' }
        case 'type_text': { const r = await window.api.typeText(args.text as string); return r.success ? 'Typed' : r.error || 'failed' }
        case 'press_key': { const r = await window.api.pressKey(args.key as string); return r.success ? `Pressed ${args.key}` : r.error || 'failed' }
        case 'scroll': { const r = await window.api.scroll(args.direction as 'up'|'down', args.amount as number); return r.success ? 'Scrolled' : r.error || 'failed' }
        case 'search_web': { const r = await window.api.searchWeb(args.query as string); return r.success ? r.results.slice(0,3).map((x:any)=>x.title).join(', ') : 'no results' }
        case 'search_youtube': { const r = await window.api.searchYouTube(args.query as string); return r.success ? r.results.slice(0,3).map((x:any)=>x.title).join(', ') : 'no results' }
        case 'run_command': { 
          const processId = crypto.randomUUID()
          let stdout = ''
          let stderr = ''
          const unsub = window.api.onCmdOutput(({ processId: pid, type, data }) => {
            if (pid !== processId) return
            if (type === 'stdout' && typeof data === 'string') stdout += data
            if (type === 'stderr' && typeof data === 'string') stderr += data
          })
          try {
            await window.api.runCommandStream(args.command as string, processId, {
              cwd: args.cwd as string,
              shell: (args.shell as 'powershell' | 'cmd') || 'powershell',
              timeout: 60000
            })
          } finally { unsub() }
          return (stdout + stderr).trim() || 'done'
        }
        case 'create_file': { const r = await window.api.createFile(args.path as string, args.content as string, allowedPaths); return r.success ? `Created ${args.path}` : r.error || 'failed' }
        case 'get_datetime': { const r = await window.api.getDatetime(); return r.datetime }
        case 'analyze_screen': {
          if (!s.apiKey && s.provider !== 'ollama') return 'No API key — add it in Settings'
          const { vp, vm, ollamaUrl } = getVisionParams(s)
          const r = await Promise.race([
            window.api.analyzeScreen((args.prompt as string) || 'Describe screen', vp, s.apiKey, vm, undefined, ollamaUrl),
            new Promise<any>(res => setTimeout(() => res({ success: false, error: 'timeout' }), 60000))
          ])
          if (r.success) return r.result
          return formatVisionError(r.error, s.model)
        }
        case 'find_element': {
          const { vp, vm, ollamaUrl } = getVisionParams(s)
          if (!s.apiKey && vp !== 'ollama') return 'No API key'
          const r = await window.api.findElement(args.description as string, s.apiKey, vp, vm, ollamaUrl)
          return r.found ? `Found at (${r.x}, ${r.y})` : `Not found: ${r.description}`
        }
        default: return `Unknown tool: ${name}`
      }
    } catch (e: any) {
      return `Error: ${e.message}`
    }
  }, [])

  // ── Agent Loop ────────────────────────────────────────────────────────────

  const { plan: agentPlan, isRunning: agentRunning, run: runAgent, stop: stopAgent } = useAgentLoop({
    settings,
    userPaths,
    onStepResult: () => {},
    onPlanUpdate: () => {},
    onComplete: (_plan, summary) => {
      const chatId = currentChatIdRef.current
      if (!chatId) return
      addMessage(chatId, { id: crypto.randomUUID(), role: 'assistant', content: summary, timestamp: Date.now() })
      // Сохраняем только при завершении агента, не на каждое сообщение
      saveSettings()
    },
    executeToolCall: executeToolCallDirect
  })

  const handleSendRef = useRef<(text: string) => void>(() => {})

  const { status: voiceStatus } = useBackgroundVoice({
    onCommand: (command) => {
      handleSendRef.current(command)
    }
  })

  // ── Отправка сообщения ────────────────────────────────────────────────────

  const handleSend = useCallback(
    async (text: string, attachedFile?: { name: string; content: string }) => {
      if (!text.trim() || isTyping) return

      let activeChatId = currentChatId
      if (!activeChatId) {
        activeChatId = await createNewChat()
      }

      // Очищаем предыдущие слушатели перед новым запросом
      cleanupRef.current?.()
      cleanupRef.current = null

      let userContent = text
      if (attachedFile) {
        userContent += `\n\n**Attached file: ${attachedFile.name}**\n\`\`\`\n${attachedFile.content}\n\`\`\``
      }

      const userMsg: Message = {
        id: crypto.randomUUID(),
        role: 'user',
        content: userContent,
        timestamp: Date.now()
      }

      addMessage(activeChatId, userMsg)
      setTyping(true)
      setStreamingContent('')
      fullResponseRef.current = ''

      addMessage(activeChatId, {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: '',
        timestamp: Date.now(),
        streaming: true
      })

      const currentSettings = settingsRef.current
      const currentUserPaths = userPathsRef.current

      const systemPrompt = currentSettings.agentEnabled
        ? buildAgentSystemPrompt(currentSettings.systemPrompt, currentUserPaths ?? undefined)
        : currentSettings.systemPrompt

      // Берём историю из текущего чата (без streaming-сообщений)
      const currentChatMessages = chats.find((c) => c.id === activeChatId)?.messages ?? []
      const history = currentChatMessages
        .concat(userMsg)
        .filter((m) => !m.streaming)
        .map((m) => ({ role: m.role, content: m.content }))

      const chatId = activeChatId

      const unChunk = window.api.onChunk((chunk) => {
        fullResponseRef.current += chunk
        // Скрываем tool_call блок во время стриминга — показываем только текст до него
        const displayContent = settingsRef.current.agentEnabled
          ? stripToolCallBlock(fullResponseRef.current)
          : fullResponseRef.current
        setStreamingContent(displayContent)
        updateLastMessage(chatId, displayContent)
      })

      const unDone = window.api.onDone(async () => {
        doCleanup()
        const finalResponse = fullResponseRef.current
        setStreamingContent('')
        setTyping(false)

        const isCoder = useCoderStore.getState().isCoderMode

        if (isCoder && finalResponse) {
          const action = parseCoderAction(finalResponse)
          if (action) {
            const cleanResponse = stripCoderActions(finalResponse)
            finalizeLastMessage(chatId, cleanResponse || '*(executed action)*')
            await executeCoderAction(action, chatId)
          } else {
            finalizeLastMessage(chatId, finalResponse)
          }
        } else if (settingsRef.current.agentEnabled && finalResponse) {
          const agentChatId = activeChatId
          const agentSettings = settingsRef.current
          const agentUserPaths = userPathsRef.current

          // Finalize the initial response text
          const cleanResponse = stripToolCallBlock(finalResponse)
          finalizeLastMessage(agentChatId, cleanResponse)

          try {
            const currentChatMessages = chats.find((c) => c.id === agentChatId)?.messages ?? []
            const history = currentChatMessages
              .filter((m) => !m.streaming)
              .map((m) => ({ role: m.role, content: m.content }))

            await window.api.agentRunLoop({
              chatId: agentChatId,
              provider: agentSettings.provider,
              settings: agentSettings,
              messages: history,
              allowedPaths: agentUserPaths ?? []
            })
          } catch (e: any) {
            addMessage(agentChatId, {
              id: crypto.randomUUID(),
              role: 'assistant',
              content: `❌ Agent Orchestrator error: ${e.message}`,
              timestamp: Date.now()
            })
          }
        } else {
          finalizeLastMessage(chatId, finalResponse)
        }

        saveSettings()
      })

      const unAborted = window.api.onAborted(() => {
        doCleanup()
        const partial = fullResponseRef.current
        setStreamingContent('')
        setTyping(false)
        finalizeLastMessage(chatId, partial ? partial + ' *(stopped)*' : '*(stopped)*')
        saveSettings()
      })

      const unError = window.api.onError((err) => {
        doCleanup()
        setStreamingContent('')
        setTyping(false)
        finalizeLastMessage(chatId, `❌ Error: ${err}`)
      })

      const doCleanup = () => {
        unChunk()
        unDone()
        unAborted()
        unError()
        cleanupRef.current = null
      }

      cleanupRef.current = doCleanup

      try {
        await window.api.startChat({
          provider: currentSettings.provider,
          settings: { ...currentSettings, systemPrompt },
          messages: history
        })
      } catch (e: any) {
        // IPC invoke itself failed (not ai:error event)
        doCleanup()
        setStreamingContent('')
        setTyping(false)
        finalizeLastMessage(chatId, `❌ Connection error: ${e.message}`)
        saveSettings()
      }
    },
    [currentChatId, chats, isTyping, addMessage, updateLastMessage, finalizeLastMessage, setTyping, saveSettings, createNewChat]
  )

  // Обновляем ref при изменении handleSend
  useEffect(() => {
    handleSendRef.current = handleSend
  }, [handleSend])

  const handleStop = useCallback(() => {
    window.api.abortChat()
  }, [])

  // ── Выполнение Agent Tool ─────────────────────────────────────────────────

  const executeToolCall = async (
    toolCall: { name: string; args: Record<string, unknown> },
    chatId: string
  ) => {
    const { name, args } = toolCall
    const allowedPaths = settingsRef.current.allowedPaths ?? []
    let result = ''

    try {
      switch (name) {
        // ── File System ────────────────────────────────────────────────────
        case 'create_file': {
          const r = await window.api.createFile(args.path as string, args.content as string, allowedPaths)
          result = r.success ? `✅ Created: ${args.path}` : `❌ ${r.error}`
          break
        }
        case 'read_file': {
          const r = await window.api.readFile(args.path as string, allowedPaths)
          result = r.success ? `📄 **${args.path}**\n\`\`\`\n${r.content}\n\`\`\`` : `❌ ${r.error}`
          break
        }
        case 'edit_file': {
          const r = await window.api.editFile(args.path as string, args.oldContent as string, args.newContent as string, allowedPaths)
          result = r.success ? `✅ Edited: ${args.path}` : `❌ ${r.error}`
          break
        }
        case 'delete_file': {
          const r = await window.api.deleteFile(args.path as string, allowedPaths)
          result = r.success ? `✅ Deleted: ${args.path}` : `❌ ${r.error}`
          break
        }
        case 'list_directory': {
          const r = await window.api.listDirectory(args.path as string, allowedPaths)
          result = r.success
            ? `📁 **${args.path}**\n${r.files!.map((f: any) => `${f.isDirectory ? '📁' : '📄'} ${f.name}`).join('\n')}`
            : `❌ ${r.error}`
          break
        }
        case 'run_command': {
          const command = args.command as string
          const cmdCwd = args.cwd as string | undefined
          const shellType = (args.shell as 'powershell' | 'cmd') || 'powershell'
          if (!command) { result = `❌ run_command: missing command`; break }

          // Показываем что команда запущена
          addMessage(chatId, {
            id: crypto.randomUUID(),
            role: 'assistant',
            content: `\`\`\`${shellType}\n$ ${command}\n\`\`\``,
            timestamp: Date.now()
          })

          const processId = crypto.randomUUID()
          let stdout = ''
          let stderr = ''

          // Собираем вывод через стриминг
          const unsub = window.api.onCmdOutput(({ processId: pid, type, data }) => {
            if (pid !== processId) return
            if (type === 'stdout' && typeof data === 'string') stdout += data
            if (type === 'stderr' && typeof data === 'string') stderr += data
          })

          try {
            await window.api.runCommandStream(command, processId, {
              cwd: cmdCwd,
              shell: shellType,
              timeout: 60000
            })
          } finally {
            unsub()
          }

          const output = (stdout + (stderr ? '\n[stderr]\n' + stderr : '')).trim()
          result = output
            ? `\`\`\`\n${output.slice(0, 4000)}${output.length > 4000 ? '\n...[truncated]' : ''}\n\`\`\``
            : '*(no output)*'
          break
        }
        case 'search_files': {
          const r = await window.api.searchFiles(args.path as string, args.pattern as string, allowedPaths)
          result = r.success
            ? `🔍 Found ${r.files!.length} files:\n${r.files!.slice(0, 20).join('\n')}`
            : `❌ ${r.error}`
          break
        }
        case 'move_file': {
          const r = await window.api.moveFile(args.sourcePath as string, args.destPath as string, allowedPaths)
          result = r.success ? `✅ Moved to: ${args.destPath}` : `❌ ${r.error}`
          break
        }
        // ── Screen Analysis ────────────────────────────────────────────────
        case 'analyze_screen': {
          const s = settingsRef.current
          // Ollama не требует API ключ
          if (!s.apiKey && s.provider !== 'ollama') { result = `❌ API key required for screen analysis`; break }
          const { vp, vm, ollamaUrl } = getVisionParams(s)
          const r = await Promise.race([
            window.api.analyzeScreen(
              (args.prompt as string) || 'Describe what is on screen in detail.',
              vp, s.apiKey, vm, args.region as any, ollamaUrl
            ),
            new Promise<any>((res) => setTimeout(() => res({ success: false, error: 'Timeout (120s)' }), 120000))
          ])
          if (r.success) {
            result = `👁️ **Screen:**\n\n${r.result}`
          } else {
            result = formatVisionError(r.error, s.model)
          }
          break
        }
        case 'find_element': {
          const s = settingsRef.current
          if (!s.apiKey && s.provider !== 'ollama') { result = `❌ API key required`; break }
          const { vp, vm, ollamaUrl } = getVisionParams(s)
          const r = await window.api.findElement(args.description as string, s.apiKey, vp, vm, ollamaUrl)
          result = r.found ? `🎯 Found at (${r.x}, ${r.y}): ${r.description}` : `❌ Not found: ${r.description || r.error}`
          break
        }
        // ── Web Search ─────────────────────────────────────────────────────
        case 'search_web': {
          const r = await window.api.searchWeb(args.query as string)
          result = r.success && r.results.length > 0
            ? `🔍 **"${args.query}"**\n\n` + r.results.slice(0, 5).map((res: any, i: number) =>
                `**${i + 1}. ${res.title}**\n${res.snippet}\n🔗 ${res.url}`).join('\n\n')
            : `❌ No results for "${args.query}"`
          break
        }
        case 'search_youtube': {
          const r = await window.api.searchYouTube(args.query as string)
          result = r.success && r.results.length > 0
            ? `▶️ **YouTube: "${args.query}"**\n\n` + r.results.slice(0, 5).map((res: any, i: number) =>
                `**${i + 1}. ${res.title}**\n🔗 ${res.url}`).join('\n\n')
            : `❌ No YouTube results`
          break
        }
        case 'fetch_page': {
          const r = await window.api.fetchPage(args.url as string)
          result = r.success
            ? `📄 **${r.title}**\n🔗 ${r.url}\n\n${r.text?.slice(0, 2000)}${(r.text?.length ?? 0) > 2000 ? '\n*[truncated]*' : ''}`
            : `❌ ${r.error}`
          break
        }
        // ── Browser & Apps ─────────────────────────────────────────────────
        case 'open_url': {
          const url = args.url as string
          if (!url) { result = `❌ open_url: missing url argument`; break }
          // Fire-and-forget — не ждём, браузер открывается асинхронно
          window.api.openUrl(url).catch(() => {})
          result = `✅ Successfully opened the URL: ${url.startsWith('http') ? url : 'https://' + url}. The browser is now loading the page.`
          break
        }
        case 'launch_app': {
          const app = args.app as string
          if (!app) { result = `❌ launch_app: missing app argument`; break }
          // Запускаем и не ждём — приложение открывается асинхронно
          window.api.launchApp(app, args.args as string).catch(() => {})
          // Небольшая пауза чтобы процесс успел запуститься
          await new Promise(r => setTimeout(r, 1500))
          result = `✅ Successfully launched the application: ${app}. The app should now be open on the desktop.`
          break
        }
        case 'close_app': {
          const r = await window.api.closeApp(args.name as string)
          result = r.success ? `✅ Closed: ${args.name}` : `❌ ${r.error}`
          break
        }
        // ── Mouse ──────────────────────────────────────────────────────────
        case 'move_cursor': {
          const r = await window.api.moveCursor(args.x as number, args.y as number)
          result = r.success ? `🖱️ Moved to (${args.x}, ${args.y})` : `❌ ${r.error}`
          break
        }
        case 'move_cursor_smooth': {
          const r = await window.api.moveCursorSmooth(args.x as number, args.y as number, args.steps as number)
          result = r.success ? `🖱️ Moved smoothly to (${args.x}, ${args.y})` : `❌ ${r.error}`
          break
        }
        case 'drag': {
          const r = await window.api.drag(args.x1 as number, args.y1 as number, args.x2 as number, args.y2 as number)
          result = r.success ? `🖱️ Dragged (${args.x1},${args.y1}) → (${args.x2},${args.y2})` : `❌ ${r.error}`
          break
        }
        case 'mouse_click': {
          const r = await window.api.mouseClick(args.x as number, args.y as number, args.button as any, args.double as boolean)
          result = r.success ? `🖱️ Clicked` : `❌ ${r.error}`
          break
        }
        case 'scroll': {
          const r = await window.api.scroll(args.direction as 'up' | 'down', args.amount as number)
          result = r.success ? `🖱️ Scrolled ${args.direction}` : `❌ ${r.error}`
          break
        }
        // ── Keyboard ───────────────────────────────────────────────────────
        case 'type_text': {
          const r = await window.api.typeText(args.text as string)
          result = r.success ? `⌨️ Typed` : `❌ ${r.error}`
          break
        }
        case 'press_key': {
          const r = await window.api.pressKey(args.key as string)
          result = r.success ? `⌨️ Pressed: ${args.key}` : `❌ ${r.error}`
          break
        }
        // ── System ─────────────────────────────────────────────────────────
        case 'screenshot': {
          const r = await window.api.screenshot(args.savePath as string)
          result = r.success ? `📸 Saved: ${r.path}` : `❌ ${r.error}`
          break
        }
        case 'get_datetime': {
          const r = await window.api.getDatetime()
          result = `🕐 ${r.datetime}`
          break
        }
        case 'set_volume': {
          const r = await window.api.setVolume(args.level as number)
          result = r.success ? `🔊 Volume: ${args.level}%` : `❌ ${r.error}`
          break
        }
        case 'mute': {
          const r = await window.api.mute(args.mute as boolean)
          result = r.success ? `🔇 Toggled mute` : `❌ ${r.error}`
          break
        }
        case 'lock_screen': {
          const r = await window.api.lockScreen()
          result = r.success ? `🔒 Locked` : `❌ ${r.error}`
          break
        }
        case 'get_processes': {
          const r = await window.api.getProcesses()
          result = r.success
            ? `📋 Apps:\n${r.processes.slice(0, 15).map((p: any) => `• ${p.Name} — ${p.MainWindowTitle}`).join('\n')}`
            : `❌ ${r.error}`
          break
        }
        // ── Scheduler ──────────────────────────────────────────────────────
        case 'set_alarm': {
          const t = args.time as string
          const d = args.date as string || new Date().toISOString().slice(0, 10)
          const [h, m] = t.split(':').map(Number)
          const dt = new Date(d)
          dt.setHours(h, m, 0, 0)
          if (dt.getTime() <= Date.now()) dt.setDate(dt.getDate() + 1)
          const r = await window.api.schedulerCreate({
            type: 'alarm', title: args.title as string,
            message: args.message as string | undefined,
            fireAt: dt.getTime(), date: d, time: t,
            repeat: (args.repeat as string) || 'none'
          })
          result = r.success ? `⏰ Alarm set: **${args.title}** at ${t} ${d !== new Date().toISOString().slice(0, 10) ? d : ''}`.trim() : `❌ Failed`
          break
        }
        case 'set_timer': {
          const secs = args.duration_seconds as number
          const r = await window.api.schedulerCreate({
            type: 'timer', title: args.title as string,
            message: args.message as string | undefined,
            durationSeconds: secs, repeat: 'none'
          })
          if (r.success) {
            const autostart = args.autostart !== false
            if (autostart) await window.api.schedulerStartTimer(r.item.id)
            const mm = Math.floor(secs / 60), ss = secs % 60
            result = `⏱️ Timer started: **${args.title}** — ${mm > 0 ? mm + 'm ' : ''}${ss > 0 ? ss + 's' : ''}`
          } else result = `❌ Failed to create timer`
          break
        }
        case 'set_reminder': {
          const t = args.time as string
          const d = args.date as string || new Date().toISOString().slice(0, 10)
          const [h, m] = t.split(':').map(Number)
          const dt = new Date(d); dt.setHours(h, m, 0, 0)
          if (dt.getTime() <= Date.now() && d === new Date().toISOString().slice(0, 10)) dt.setDate(dt.getDate() + 1)
          const r = await window.api.schedulerCreate({
            type: 'reminder', title: args.title as string,
            message: args.message as string | undefined,
            fireAt: dt.getTime(), date: d, time: t,
            repeat: (args.repeat as string) || 'none'
          })
          result = r.success ? `🔔 Reminder set: **${args.title}** at ${t}` : `❌ Failed`
          break
        }
        case 'create_event': {
          const r = await window.api.schedulerCreate({
            type: 'event', title: args.title as string,
            message: args.message as string | undefined,
            date: args.date as string, time: args.time as string,
            fireAt: (() => { const dt = new Date(args.date as string); const [h,m] = (args.time as string).split(':').map(Number); dt.setHours(h,m,0,0); return dt.getTime() })(),
            repeat: 'none'
          })
          result = r.success ? `📅 Event created: **${args.title}** on ${args.date} at ${args.time}` : `❌ Failed`
          break
        }
        case 'list_schedule': {
          const active = await window.api.schedulerGetActive()
          if (active.length === 0) { result = '📅 No upcoming alarms or reminders'; break }
          const icons: Record<string, string> = { alarm: '⏰', timer: '⏱️', reminder: '🔔', event: '📅' }
          result = '**Upcoming:**\n' + active.map((i: any) => {
            const when = i.type === 'timer'
              ? `${Math.floor((i.durationSeconds||0)/60)}m ${(i.durationSeconds||0)%60}s`
              : i.time ? `${i.date || ''} ${i.time}`.trim() : ''
            return `${icons[i.type]} **${i.title}** — ${when}${i.status === 'active' ? ' ▶️' : ''}`
          }).join('\n')
          break
        }
        default:
          result = `❓ Unknown tool: ${name}`
      }
    } catch (e: any) {
      result = `❌ Tool error: ${e.message}`
    }

    addMessage(chatId, {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: result,
      timestamp: Date.now()
    })
  }

  return (
    <div className="flex flex-col h-full">
      {/* Voice status bar */}
      {voiceStatus !== 'stopped' && (
        <div className={`flex items-center gap-2 px-3 py-1.5 text-[11px] border-b border-white/5 ${
          voiceStatus === 'listening' ? 'bg-red-500/10 text-red-400' :
          voiceStatus === 'processing' ? 'bg-yellow-500/10 text-yellow-400' :
          'bg-white/3 text-white/30'
        }`}>
          <div className={`w-1.5 h-1.5 rounded-full ${
            voiceStatus === 'listening' ? 'bg-red-400 animate-pulse' :
            voiceStatus === 'processing' ? 'bg-yellow-400 animate-pulse' :
            'bg-white/20'
          }`} />
          {voiceStatus === 'waiting' && '🎤 Ожидание wake word...'}
          {voiceStatus === 'listening' && '🔴 Слушаю...'}
          {voiceStatus === 'processing' && '⚡ Обрабатываю...'}
        </div>
      )}

      <MessageList messages={currentChat?.messages ?? []} streamingContent={streamingContent} />

      {/* Agent Plan Panel — managed by App.tsx via main process agent */}

      {/* Timer Widget — живые таймеры и будильники */}
      <TimerWidget />

      {/* Terminal Panel */}
      {showTerminal && (
        <div className="mx-3 mb-2">
          <Terminal
            className="w-full"
            onClose={() => setShowTerminal(false)}
          />
        </div>
      )}

      <InputArea
        onSend={handleSend}
        onStop={() => { handleStop(); if (agentRunning) stopAgent() }}
        isTyping={isTyping || agentRunning}
        showTerminal={showTerminal}
        onToggleTerminal={() => setShowTerminal(v => !v)}
        lastAssistantMessage={
          [...(currentChat?.messages ?? [])].reverse()
            .find((m) => m.role === 'assistant' && !m.streaming)?.content
        }
      />
    </div>
  )
}
