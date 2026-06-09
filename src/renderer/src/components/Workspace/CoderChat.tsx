
import React, { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Send, Bot, User, Loader2, Copy, Check } from 'lucide-react'
import { useCoderStore } from '../../store/useCoderStore'
import { useAppStore } from '../../store/useAppStore'
import { cn } from '../../utils/cn'
import ReactMarkdown from 'react-markdown'

interface CoderMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
}

const CoderMessageItem: React.FC<{ msg: CoderMessage }> = ({ msg }) => {
  const [copied, setCopied] = useState(false)

  const copyToClipboard = async () => {
    await navigator.clipboard.writeText(msg.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className={cn('flex gap-2', msg.role === 'user' ? 'flex-row-reverse' : 'flex-row')}>
      <div className={cn('w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5', msg.role === 'user' ? 'bg-accent/30' : 'bg-white/10')}>
        {msg.role === 'user' ? <User size={10} className="text-accent" /> : <Bot size={10} className="text-white/60" />}
      </div>
      <div className={cn(
        'max-w-[85%] rounded-xl px-3 py-2 text-[11px] leading-relaxed relative group',
        msg.role === 'user' ? 'bg-accent text-white rounded-tr-sm' : 'bg-white/5 text-white/80 rounded-tl-sm border border-white/5'
      )}>
        <ReactMarkdown className="prose-invert">
          {msg.content}
        </ReactMarkdown>
        
        {msg.role === 'assistant' && (
          <button
            onClick={copyToClipboard}
            className="absolute top-1 right-1 p-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity bg-white/5 hover:bg-white/10 text-white/40 hover:text-white"
            title="Copy message"
          >
            {copied ? <Check size={10} className="text-green-400" /> : <Copy size={10} />}
          </button>
        )}
      </div>
    </div>
  )
}

export const CoderChat: React.FC = () => {
  const { rootPath } = useCoderStore()
  const { settings } = useAppStore()
  const [messages, setMessages] = useState<CoderMessage[]>([])
  const [input, setInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = async () => {
    if (!input.trim() || isTyping) return

    const userMsg: CoderMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: input,
      timestamp: Date.now()
    }

    setMessages(prev => [...prev, userMsg])
    setInput('')
    setIsTyping(true)

    try {
      const systemPrompt = `You are a specialized Coder Assistant.
You have access to the following repository at: ${rootPath}
You can read, create, and edit files in this directory.
When you want to perform an action, use tool calls like:
- read_file(path)
- create_file(path, content)
- edit_file(path, oldContent, newContent)
- list_directory(path)

Always provide a concise explanation of your changes.
Current root: ${rootPath}`

      const response = await window.api.chatSimple({
        provider: settings.provider,
        apiKey: settings.apiKey,
        model: settings.model,
        prompt: `System: ${systemPrompt}

User: ${userMsg.content}`,
        ollamaBaseUrl: settings.ollamaBaseUrl,
        openrouterBaseUrl: settings.openrouterBaseUrl
      })

      if (response.success) {
        const assistantMsg: CoderMessage = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: response.result || 'No response from AI.',
          timestamp: Date.now()
        }
        setMessages(prev => [...prev, assistantMsg])
      } else {
        setMessages(prev => [...prev, {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: `❌ Error: ${response.error}`,
          timestamp: Date.now()
        }])
      }
    } catch (e: any) {
      setMessages(prev => [...prev, {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: `❌ Fatal Error: ${e.message}`,
        timestamp: Date.now()
      }])
    } finally {
      setIsTyping(false)
    }
  }

  return (
    <div className="h-full flex flex-col">
      <div className="p-3 border-b border-slate-800 bg-slate-800/50">
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Coder Assistant</h3>
      </div>
      
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3 scrollbar-hide">
        {messages.length === 0 && (
          <div className="h-full flex items-center justify-center text-center p-4">
            <p className="text-[11px] text-slate-500">
              Ask the AI to help you with the code in <br/>
              <span className="text-slate-300 font-mono">{rootPath || 'no workspace selected'}</span>
            </p>
          </div>
        )}
        
        {messages.map((msg) => (
          <CoderMessageItem key={msg.id} msg={msg} />
        ))}
        
        {isTyping && (
          <div className="flex gap-2">
            <div className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center shrink-0 mt-0.5">
              <Bot size={10} className="text-white/60" />
            </div>
            <div className="bg-white/5 border border-white/5 rounded-xl px-3 py-2 text-[11px] text-white/40 italic animate-pulse">
              Thinking...
            </div>
          </div>
        )}
      </div>

      <div className="p-3 border-t border-slate-800">
        <div className="relative flex items-center gap-2">
          <input 
            type="text" 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Ask AI to code..." 
            className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-3 pr-10 py-2 text-xs text-white focus:outline-none focus:border-accent transition-colors"
          />
          <button 
            onClick={handleSend}
            disabled={!input.trim() || isTyping}
            className="absolute right-2 p-1 text-slate-500 hover:text-accent disabled:opacity-30 transition-colors"
          >
            <Send size={14} />
          </button>
        </div>
      </div>
    </div>
  )
}
