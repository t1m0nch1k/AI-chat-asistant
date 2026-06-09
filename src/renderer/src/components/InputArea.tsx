import React, { useRef, useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Send, Square, Paperclip, X, FileText, Volume2, VolumeX, Terminal } from 'lucide-react'
import { useAppStore } from '../store/useAppStore'
import { cn } from '../utils/cn'
import { VoiceButton } from './VoiceButton'

interface InputAreaProps {
  onSend: (text: string, file?: { name: string; content: string }) => void
  onStop: () => void
  isTyping: boolean
  lastAssistantMessage?: string
  showTerminal?: boolean
  onToggleTerminal?: () => void
}

export const InputArea: React.FC<InputAreaProps> = ({
  onSend,
  onStop,
  isTyping,
  lastAssistantMessage,
  showTerminal,
  onToggleTerminal
}) => {
  const { settings } = useAppStore()
  const [value, setValue] = useState('')
  const [attachedFile, setAttachedFile] = useState<{ name: string; content: string } | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [autoSpeak, setAutoSpeak] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = `${Math.min(ta.scrollHeight, 160)}px`
  }, [value])

  useEffect(() => {
    textareaRef.current?.focus()
  }, [])

  const handleSend = useCallback(() => {
    if (!value.trim() || isTyping) return
    onSend(value.trim(), attachedFile ?? undefined)
    setValue('')
    setAttachedFile(null)
  }, [value, isTyping, attachedFile, onSend])

  // Голосовой ввод — вставляем транскрипт и сразу отправляем
  const handleVoiceTranscript = useCallback((text: string) => {
    onSend(text)
  }, [onSend])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter') {
      if (settings.sendOnEnter && !e.shiftKey) {
        e.preventDefault()
        handleSend()
      } else if (!settings.sendOnEnter && (e.ctrlKey || e.metaKey)) {
        e.preventDefault()
        handleSend()
      }
    }
  }

  // ── Drag & Drop ───────────────────────────────────────────────────────────

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => setIsDragging(false)

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) await readFileAsText(file)
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) await readFileAsText(file)
    e.target.value = ''
  }

  const readFileAsText = async (file: File) => {
    try {
      const text = await file.text()
      setAttachedFile({ name: file.name, content: text })
    } catch {
      setAttachedFile({ name: file.name, content: '[Binary file — cannot display]' })
    }
  }

  const canSend = value.trim().length > 0 && !isTyping

  return (
    <div
      className={cn('px-3 pb-3 pt-2 transition-colors', isDragging && 'bg-accent/5')}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Attached file badge */}
      <AnimatePresence>
        {attachedFile && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            className="flex items-center gap-2 mb-2 bg-white/5 rounded-lg px-3 py-1.5 border border-white/10"
          >
            <FileText size={12} className="text-accent shrink-0" />
            <span className="text-[11px] text-white/70 truncate flex-1">{attachedFile.name}</span>
            <button
              onClick={() => setAttachedFile(null)}
              className="text-white/30 hover:text-white/70 transition-colors"
            >
              <X size={12} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Drag overlay */}
      {isDragging && (
        <div className="absolute inset-0 flex items-center justify-center bg-accent/10 border-2 border-dashed border-accent/40 rounded-xl z-10 pointer-events-none">
          <p className="text-sm text-accent font-medium">Drop file to attach</p>
        </div>
      )}

      {/* Input container */}
      <div
        className={cn(
          'relative flex items-end gap-1.5 bg-white/5 border rounded-xl px-2 py-2 transition-colors',
          isDragging ? 'border-accent/50' : 'border-white/10 focus-within:border-white/20'
        )}
      >
        {/* Attach button */}
        <button
          onClick={() => fileInputRef.current?.click()}
          title="Attach file"
          className="p-1.5 text-white/30 hover:text-white/70 transition-colors rounded-md hover:bg-white/5 shrink-0"
        >
          <Paperclip size={15} />
        </button>

        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={handleFileSelect}
          accept=".txt,.md,.js,.ts,.tsx,.jsx,.py,.json,.yaml,.yml,.html,.css,.csv,.xml,.sh,.bat,.ps1"
        />

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            settings.sendOnEnter
              ? 'Ask anything… (Enter to send)'
              : 'Ask anything… (Ctrl+Enter to send)'
          }
          disabled={isTyping}
          className="flex-1 bg-transparent border-none outline-none text-[13px] py-1 resize-none max-h-[160px] placeholder:text-white/20 disabled:opacity-50"
          rows={1}
        />

        {/* Voice button */}
        <div className="shrink-0 pb-0.5">
          <VoiceButton
            onTranscript={handleVoiceTranscript}
            disabled={isTyping}
            autoSpeak={autoSpeak}
            lastAssistantMessage={lastAssistantMessage}
          />
        </div>

        {/* TTS toggle */}
        <button
          onClick={() => {
            if (autoSpeak) window.api?.stopSpeak?.()
            setAutoSpeak(!autoSpeak)
          }}
          title={autoSpeak ? 'Выключить озвучку' : 'Включить озвучку ответов'}
          className={cn(
            'p-1.5 rounded-md transition-colors shrink-0',
            autoSpeak
              ? 'text-accent bg-accent/15 hover:bg-accent/25'
              : 'text-white/25 hover:text-white/60 hover:bg-white/5'
          )}
        >
          {autoSpeak ? <Volume2 size={14} /> : <VolumeX size={14} />}
        </button>

        {/* Send / Stop button */}
        <AnimatePresence mode="wait">
          {isTyping ? (
            <motion.button
              key="stop"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              onClick={onStop}
              title="Stop generation"
              className="p-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/40 text-red-400 transition-colors shrink-0"
            >
              <Square size={15} />
            </motion.button>
          ) : (
            <motion.button
              key="send"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              onClick={handleSend}
              disabled={!canSend}
              title="Send message"
              className={cn(
                'p-1.5 rounded-lg transition-all shrink-0',
                canSend
                  ? 'bg-accent hover:bg-accent/80 text-white shadow-lg shadow-accent/20'
                  : 'text-white/20 cursor-not-allowed'
              )}
            >
              <Send size={15} />
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {/* Status hints */}
      <div className="flex justify-between items-center mt-1.5 px-1">
        <div className="flex items-center gap-2">
          <p className="text-[10px] text-white/15">
            {settings.agentEnabled ? '🤖 Agent mode' : ''}
          </p>
          {/* Terminal toggle button */}
          {onToggleTerminal && (
            <button
              onClick={onToggleTerminal}
              title={showTerminal ? 'Hide terminal' : 'Open terminal'}
              className={cn(
                'flex items-center gap-1 px-2 py-0.5 rounded text-[10px] transition-colors',
                showTerminal
                  ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                  : 'text-white/25 hover:text-white/50 hover:bg-white/5'
              )}
            >
              <Terminal size={10} />
              <span>Terminal</span>
            </button>
          )}
        </div>
        {autoSpeak && (
          <p className="text-[10px] text-accent/50">🔊 Auto-speak on</p>
        )}
      </div>
    </div>
  )
}
