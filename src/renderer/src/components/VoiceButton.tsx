/**
 * VoiceButton — кнопка голосового ввода.
 *
 * STT: Web Speech API (встроен в Chromium)
 * TTS: Windows SAPI через IPC
 */

import React, { useState, useRef, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Mic, Square } from 'lucide-react'
import { cn } from '../utils/cn'
import { useAppStore } from '../store/useAppStore'

interface VoiceButtonProps {
  onTranscript: (text: string) => void
  disabled?: boolean
  autoSpeak?: boolean
  lastAssistantMessage?: string
}

type VoiceState = 'idle' | 'listening' | 'processing'

// Проверяем поддержку Web Speech API
const SpeechRecognition =
  (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition

// Фиксированные высоты для waveform (без Math.random в render loop)
const WAVE_HEIGHTS = ['6px', '12px', '9px', '14px', '7px']

export const VoiceButton: React.FC<VoiceButtonProps> = ({
  onTranscript,
  disabled = false,
  autoSpeak = false,
  lastAssistantMessage
}) => {
  const [state, setState] = useState<VoiceState>('idle')
  const [transcript, setTranscript] = useState('')
  const [error, setError] = useState<string | null>(null)
  const recognitionRef = useRef<any>(null)
  const isSpeakingRef = useRef(false)
  const stateRef = useRef<VoiceState>('idle')

  // Синхронизируем ref со state для использования в колбэках
  useEffect(() => {
    stateRef.current = state
  }, [state])

  // Auto-speak когда приходит новый ответ ассистента
  useEffect(() => {
    if (autoSpeak && lastAssistantMessage && !isSpeakingRef.current) {
      speakText(lastAssistantMessage)
    }
  }, [lastAssistantMessage, autoSpeak])

  const speakText = async (text: string) => {
    if (!window.api?.speak) return
    const { settings } = useAppStore.getState()
    // Убираем markdown разметку перед озвучкой
    const clean = text
      .replace(/```[\s\S]*?```/g, 'код')
      .replace(/`[^`]+`/g, '')
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/\*([^*]+)\*/g, '$1')
      .replace(/#{1,6}\s/g, '')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/[❌✅📄📁🔍❓🎯🌐🚀🖱️⌨️📸🕐🔊🔇🔒📋▶️]/g, '')
      .trim()
      .slice(0, 500)

    if (!clean) return
    isSpeakingRef.current = true
    try {
      const voice = settings.ttsVoice
      const rate = settings.ttsRate ?? 0
      const volume = settings.ttsVolume ?? 100
      if (voice && window.api.speakWithVoice) {
        await window.api.speakWithVoice(clean, voice, rate, volume)
      } else {
        await window.api.speak(clean, rate, volume)
      }
    } finally {
      isSpeakingRef.current = false
    }
  }

  const startListening = useCallback(() => {
    if (!SpeechRecognition) {
      setError('Web Speech API не поддерживается')
      setTimeout(() => setError(null), 3000)
      return
    }

    setError(null)
    setTranscript('')

    const recognition = new SpeechRecognition()
    recognition.lang = 'ru-RU'
    recognition.interimResults = true
    recognition.maxAlternatives = 1
    recognition.continuous = false

    recognition.onstart = () => {
      setState('listening')
    }

    recognition.onresult = (event: any) => {
      let interim = ''
      let final = ''

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]
        if (result.isFinal) {
          final += result[0].transcript
        } else {
          interim += result[0].transcript
        }
      }

      setTranscript(final || interim)

      if (final) {
        setState('processing')
        recognition.stop()
        onTranscript(final.trim())
        setTimeout(() => {
          setState('idle')
          setTranscript('')
        }, 500)
      }
    }

    recognition.onerror = (event: any) => {
      setState('idle')
      if (event.error === 'no-speech') {
        setError('Речь не обнаружена')
      } else if (event.error === 'not-allowed') {
        setError('Нет доступа к микрофону')
      } else if (event.error !== 'aborted') {
        setError(`Ошибка: ${event.error}`)
      }
      setTimeout(() => setError(null), 3000)
    }

    recognition.onend = () => {
      // Используем ref чтобы избежать stale closure
      if (stateRef.current === 'listening') {
        setState('idle')
      }
    }

    recognitionRef.current = recognition
    recognition.start()
  }, [onTranscript])

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop()
    recognitionRef.current = null
    setState('idle')
    setTranscript('')
  }, [])

  const handleClick = () => {
    if (disabled) return
    if (state === 'listening') {
      stopListening()
    } else if (state === 'idle') {
      startListening()
    }
  }

  const isListening = state === 'listening'
  const isProcessing = state === 'processing'

  return (
    <div className="relative flex flex-col items-center">
      {/* Transcript preview */}
      <AnimatePresence>
        {transcript && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-black/80 text-white text-[11px] px-3 py-1.5 rounded-lg whitespace-nowrap max-w-[200px] truncate z-10"
          >
            {transcript}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-red-500/90 text-white text-[11px] px-3 py-1.5 rounded-lg whitespace-nowrap z-10"
          >
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main button */}
      <button
        onClick={handleClick}
        disabled={disabled || isProcessing}
        title={isListening ? 'Остановить запись' : 'Голосовой ввод (ru-RU)'}
        className={cn(
          'relative p-1.5 rounded-md transition-all',
          isListening
            ? 'text-red-400 bg-red-500/20 hover:bg-red-500/30'
            : isProcessing
            ? 'text-yellow-400 bg-yellow-500/20'
            : 'text-white/30 hover:text-white/70 hover:bg-white/5'
        )}
      >
        {/* Pulse ring when listening */}
        {isListening && (
          <motion.div
            className="absolute inset-0 rounded-md bg-red-500/20"
            animate={{ scale: [1, 1.4, 1], opacity: [0.5, 0, 0.5] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          />
        )}

        {isListening ? (
          <Square size={15} />
        ) : (
          <Mic size={15} />
        )}
      </button>

      {/* Waveform bars when listening — фиксированные высоты, без Math.random */}
      {isListening && (
        <div className="absolute -bottom-5 flex items-end gap-0.5 h-4">
          {WAVE_HEIGHTS.map((maxH, i) => (
            <motion.div
              key={i}
              className="w-0.5 bg-red-400 rounded-full"
              animate={{ height: ['3px', maxH, '3px'] }}
              transition={{
                duration: 0.5 + i * 0.08,
                repeat: Infinity,
                delay: i * 0.1,
                ease: 'easeInOut'
              }}
            />
          ))}
        </div>
      )}
    </div>
  )
}

