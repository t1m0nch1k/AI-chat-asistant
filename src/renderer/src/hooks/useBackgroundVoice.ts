/**
 * Хук для управления фоновым голосовым ассистентом.
 * Слушает wake word, получает команды, отправляет в AI.
 */

import { useEffect, useRef, useState, useCallback } from 'react'
import { useAppStore } from '../store/useAppStore'
export type VoiceStatus = 'stopped' | 'waiting' | 'listening' | 'processing' | 'error'

interface UseBackgroundVoiceOptions {
  onCommand: (command: string) => void
}

export function useBackgroundVoice({ onCommand }: UseBackgroundVoiceOptions) {
  const { settings } = useAppStore()
  const [status, setStatus] = useState<VoiceStatus>('stopped')
  const [lastWakeWord, setLastWakeWord] = useState<string>('')
  const [lastCommand, setLastCommand] = useState<string>('')
  const cleanupRef = useRef<(() => void)[]>([])

  const start = useCallback(async () => {
    if (!window.api?.startBackgroundVoice) return
    const wakeWords = settings.wakeWords?.length > 0
      ? settings.wakeWords
      : ['ассистент', 'assistant']
    const r = await window.api.startBackgroundVoice(wakeWords, settings.microphoneName)
    if (r.success) {
      setStatus('waiting')
    } else {
      setStatus('error')
      console.error('[Voice] Failed to start:', r.error)
    }
  }, [settings.wakeWords, settings.microphoneName])

  const stop = useCallback(async () => {
    if (!window.api?.stopBackgroundVoice) return
    await window.api.stopBackgroundVoice()
    setStatus('stopped')
  }, [])

  // Подписываемся на события от main process
  useEffect(() => {
    if (!window.api?.onSRStatus) return

    const unsubStatus = window.api.onSRStatus(({ status: s }) => {
      if (s === 'ready' || s === 'waiting') setStatus('waiting')
      else if (s === 'listening') setStatus('listening')
      else if (s === 'restarting') setStatus('waiting')
      else if (s === 'stopped') setStatus('stopped')
      else if (s === 'error') setStatus('error')
    })

    const unsubWake = window.api.onWakeDetected(({ text }) => {
      setLastWakeWord(text)
      setStatus('listening')
      // Озвучиваем подтверждение выбранным голосом
      const { settings } = useAppStore.getState()
      const voice = settings.ttsVoice
      if (voice && window.api.speakWithVoice) {
        window.api.speakWithVoice('Слушаю', voice, 0, 80)
      } else {
        window.api.speak?.('Слушаю', 0, 80)
      }
    })

    const unsubCommand = window.api.onVoiceCommand(({ command }) => {
      setLastCommand(command)
      setStatus('processing')
      onCommand(command)
    })

    cleanupRef.current = [unsubStatus, unsubWake, unsubCommand]

    return () => {
      cleanupRef.current.forEach(fn => fn())
    }
  }, [onCommand])

  // Автозапуск если включён в настройках
  useEffect(() => {
    if (settings.backgroundVoiceEnabled) {
      start()
    } else {
      stop()
    }
  }, [settings.backgroundVoiceEnabled])

  // Обновляем wake words при изменении настроек
  useEffect(() => {
    if (status !== 'stopped' && settings.wakeWords) {
      window.api?.updateWakeWords?.(settings.wakeWords)
    }
  }, [settings.wakeWords])

  return { status, lastWakeWord, lastCommand, start, stop }
}
