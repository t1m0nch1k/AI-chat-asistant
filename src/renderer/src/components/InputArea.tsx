import React, { useRef, useEffect, useState, useCallback } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
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
  onSend, onStop, isTyping, lastAssistantMessage, showTerminal, onToggleTerminal,
}) => {
  const { settings, setCurrentPage } = useAppStore()
  const [value, setValue] = useState('')
  const [attachedFile, setAttachedFile] = useState<{ name: string; content: string } | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [autoSpeak, setAutoSpeak] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const ta = textareaRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = `${Math.min(ta.scrollHeight, 200)}px`
  }, [value])

  useEffect(() => { textareaRef.current?.focus() }, [])

  const handleSend = useCallback(() => {
    if (!value.trim() || isTyping) return
    onSend(value.trim(), attachedFile ?? undefined)
    setValue('')
    setAttachedFile(null)
  }, [value, isTyping, attachedFile, onSend])

  const handleVoiceTranscript = useCallback((text: string) => { onSend(text) }, [onSend])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter') {
      if (settings.sendOnEnter && !e.shiftKey) { e.preventDefault(); handleSend() }
      else if (!settings.sendOnEnter && (e.ctrlKey || e.metaKey)) { e.preventDefault(); handleSend() }
    }
  }

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true) }
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
      setAttachedFile({ name: file.name, content: '[Binary file]' })
    }
  }

  const canSend = value.trim().length > 0 && !isTyping

  const providerName = settings.provider.charAt(0).toUpperCase() + settings.provider.slice(1)
  const modelDisplay = settings.model || `${providerName} Model`

  return (
    <div
      className={cn('px-lg pb-lg pt-sm', isDragging && 'bg-primary/5')}
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
            className="flex items-center gap-sm mb-sm bg-surface-container rounded-lg px-md py-sm border border-outline-variant/50"
          >
            <span className="material-symbols-outlined text-[14px] text-primary-container shrink-0">attach_file</span>
            <span className="text-body-sm text-on-surface-variant truncate flex-1">{attachedFile.name}</span>
            <button onClick={() => setAttachedFile(null)} className="text-on-surface-variant/50 hover:text-on-surface transition-colors">
              <span className="material-symbols-outlined text-[14px]">close</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input Container */}
      <div className="relative flex items-end gap-sm bg-surface-container rounded-xl border border-outline-variant/30 shadow-lg transition-all duration-200">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask Nexus..."
          disabled={isTyping}
          className="w-full bg-transparent border-none focus:ring-0 text-body-base text-on-surface placeholder:text-on-surface-variant/50 resize-none py-md pl-md pr-xl min-h-[56px] max-h-[200px] disabled:opacity-50"
          rows={1}
          style={{ fieldSizing: 'content' } as any}
        />

        {/* Input Controls */}
        <div className="absolute right-md bottom-sm flex items-center gap-xs">
          <VoiceButton
            onTranscript={handleVoiceTranscript}
            disabled={isTyping}
            autoSpeak={autoSpeak}
            lastAssistantMessage={lastAssistantMessage}
          />
          <AnimatePresence mode="wait">
            {isTyping ? (
              <motion.button
                key="stop"
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
                onClick={onStop}
                className="w-8 h-8 rounded-full flex items-center justify-center text-error hover:bg-error/20 transition-colors duration-150"
              >
                <span className="material-symbols-outlined text-[20px]">stop</span>
              </motion.button>
            ) : (
              <motion.button
                key="send"
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
                onClick={handleSend}
                disabled={!canSend}
                className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center transition-colors duration-150',
                  canSend ? 'text-primary hover:bg-primary/10' : 'text-on-surface-variant/30 cursor-not-allowed',
                )}
              >
                <span className="material-symbols-outlined text-[20px]">send</span>
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Bottom Toolbar */}
      <div className="flex items-center justify-between mt-sm px-xs">
        <div className="flex items-center gap-sm">
          <button
            onClick={() => setCurrentPage('settings')}
            className="flex items-center gap-xs text-on-surface-variant hover:text-on-surface font-body-sm text-body-sm transition-colors px-xs py-[2px] rounded hover:bg-surface-container-high"
          >
            <span className="material-symbols-outlined text-[14px]">psychology</span>
            <span className="text-on-surface-variant group-hover:text-on-surface">{modelDisplay.length > 20 ? modelDisplay.slice(0, 20) + '...' : modelDisplay}</span>
            <span className="material-symbols-outlined text-[14px]">expand_more</span>
          </button>
          <div className="w-px h-3 bg-outline-variant/50" />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-xs text-on-surface-variant hover:text-on-surface font-body-sm text-body-sm transition-colors px-xs py-[2px] rounded hover:bg-surface-container-high"
          >
            <span className="material-symbols-outlined text-[14px]">attach_file</span>
            <span>Attach</span>
          </button>
          <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileSelect} accept=".txt,.md,.js,.ts,.tsx,.jsx,.py,.json,.yaml,.yml,.html,.css,.csv,.xml,.sh,.bat,.ps1" />
          {/* TTS toggle */}
          <button
            onClick={() => { if (autoSpeak) window.api?.stopSpeak?.(); setAutoSpeak(!autoSpeak) }}
            className={cn(
              'flex items-center gap-xs text-body-sm transition-colors px-xs py-[2px] rounded',
              autoSpeak ? 'text-primary hover:bg-primary/10' : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high',
            )}
          >
            <span className="material-symbols-outlined text-[14px]">{autoSpeak ? 'volume_up' : 'volume_off'}</span>
          </button>
          {onToggleTerminal && (
            <button
              onClick={onToggleTerminal}
              className={cn(
                'flex items-center gap-xs text-body-sm transition-colors px-xs py-[2px] rounded',
                showTerminal ? 'text-secondary hover:bg-secondary/10' : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high',
              )}
            >
              <span className="material-symbols-outlined text-[14px]">terminal</span>
            </button>
          )}
        </div>
        <div className="font-body-sm text-body-sm text-on-surface-variant/50">
          Press <kbd className="font-code-sm px-1 rounded bg-surface-container-high border border-outline-variant/30 text-on-surface-variant">Enter</kbd> to send
        </div>
      </div>
    </div>
  )
}
