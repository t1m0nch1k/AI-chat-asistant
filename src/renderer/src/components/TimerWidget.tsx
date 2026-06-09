/**
 * TimerWidget — живой виджет таймеров и будильников в чате.
 * Показывается над полем ввода когда есть активные таймеры.
 */

import React, { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Timer, AlarmClock, Bell, Calendar, X, Square, ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '../utils/cn'

interface ScheduleItem {
  id: string
  type: 'alarm' | 'timer' | 'reminder' | 'event'
  title: string
  message?: string
  fireAt?: number
  durationSeconds?: number
  startedAt?: number
  status: 'pending' | 'active' | 'fired' | 'cancelled'
}

const TYPE_ICONS = {
  alarm: AlarmClock,
  timer: Timer,
  reminder: Bell,
  event: Calendar
}

const TYPE_COLORS = {
  alarm:    'text-red-400 border-red-500/30 bg-red-500/5',
  timer:    'text-blue-400 border-blue-500/30 bg-blue-500/5',
  reminder: 'text-yellow-400 border-yellow-500/30 bg-yellow-500/5',
  event:    'text-green-400 border-green-500/30 bg-green-500/5'
}

export const TimerWidget: React.FC = () => {
  const [items, setItems] = useState<ScheduleItem[]>([])
  const [collapsed, setCollapsed] = useState(false)
  const [tick, setTick] = useState(0)

  // Тик каждую секунду
  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), 1000)
    return () => clearInterval(t)
  }, [])

  // Загружаем активные элементы
  useEffect(() => {
    loadActive()
  }, [])

  // Обновляем при срабатывании
  useEffect(() => {
    if (!window.api?.onSchedulerFired) return
    const unsub = window.api.onSchedulerFired((firedItem: any) => {
      setItems(prev => prev.filter(i => i.id !== firedItem.id))
    })
    return unsub
  }, [])

  const loadActive = async () => {
    try {
      const active = await window.api.schedulerGetActive()
      setItems(active)
    } catch {}
  }

  const cancelItem = async (id: string) => {
    await window.api.schedulerCancel(id)
    setItems(prev => prev.filter(i => i.id !== id))
  }

  const startTimer = async (id: string) => {
    await window.api.schedulerStartTimer(id)
    setItems(prev => prev.map(i =>
      i.id === id ? { ...i, status: 'active' as const, startedAt: Date.now() } : i
    ))
  }

  const getDisplay = useCallback((item: ScheduleItem): { time: string; progress: number; urgent: boolean } => {
    const now = Date.now()

    if (item.type === 'timer') {
      if (!item.durationSeconds) return { time: '00:00', progress: 0, urgent: false }
      const total = item.durationSeconds * 1000

      if (item.status === 'pending') {
        return { time: formatMs(total), progress: 0, urgent: false }
      }
      if (item.status === 'active' && item.startedAt) {
        const elapsed = now - item.startedAt
        const left = Math.max(0, total - elapsed)
        const progress = Math.min(1, elapsed / total)
        return { time: formatMs(left), progress, urgent: left < 30000 }
      }
    }

    if (item.fireAt) {
      const left = Math.max(0, item.fireAt - now)
      const urgent = left < 60000 // менее минуты
      return { time: left < 60000 ? formatMs(left) : formatTimeLeft(left), progress: 0, urgent }
    }

    return { time: '', progress: 0, urgent: false }
  }, [tick])

  // Показываем только активные таймеры и ближайшие будильники
  const visible = items.filter(i => {
    if (i.type === 'timer') return true
    if (i.fireAt) {
      const left = i.fireAt - Date.now()
      return left > 0 && left < 60 * 60 * 1000 // показываем если меньше часа
    }
    return false
  })

  if (visible.length === 0) return null

  return (
    <div className="px-3 pb-1">
      <div className="rounded-xl border border-white/8 bg-white/3 overflow-hidden">
        {/* Header */}
        <button
          onClick={() => setCollapsed(v => !v)}
          className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-white/5 transition-colors"
        >
          <div className="flex items-center gap-1.5">
            <Timer size={11} className="text-white/40" />
            <span className="text-[10px] text-white/40">
              {visible.length} active {visible.length === 1 ? 'timer' : 'timers'}
            </span>
          </div>
          {collapsed ? <ChevronDown size={11} className="text-white/30" /> : <ChevronUp size={11} className="text-white/30" />}
        </button>

        <AnimatePresence>
          {!collapsed && (
            <motion.div
              initial={{ height: 0 }}
              animate={{ height: 'auto' }}
              exit={{ height: 0 }}
              className="overflow-hidden"
            >
              <div className="px-2 pb-2 space-y-1.5">
                {visible.map(item => {
                  const { time, progress, urgent } = getDisplay(item)
                  const Icon = TYPE_ICONS[item.type]

                  return (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className={cn(
                        'relative flex items-center gap-2 px-2.5 py-2 rounded-lg border overflow-hidden',
                        TYPE_COLORS[item.type],
                        urgent && 'animate-pulse-subtle'
                      )}
                    >
                      {/* Progress bar для таймера */}
                      {item.type === 'timer' && item.status === 'active' && progress > 0 && (
                        <div className="absolute inset-0 pointer-events-none">
                          <div
                            className="h-full bg-blue-500/10 transition-all duration-1000"
                            style={{ width: `${progress * 100}%` }}
                          />
                        </div>
                      )}

                      <Icon size={12} className="shrink-0 z-10" />

                      <div className="flex-1 min-w-0 z-10">
                        <p className="text-[11px] font-medium truncate">{item.title}</p>
                        {item.message && (
                          <p className="text-[10px] opacity-60 truncate">{item.message}</p>
                        )}
                      </div>

                      {/* Время */}
                      <span className={cn(
                        'font-mono text-[12px] font-bold shrink-0 z-10 tabular-nums',
                        urgent ? 'text-red-400' : ''
                      )}>
                        {time}
                      </span>

                      {/* Кнопки */}
                      <div className="flex items-center gap-1 z-10">
                        {item.type === 'timer' && item.status === 'pending' && (
                          <button
                            onClick={() => startTimer(item.id)}
                            className="p-1 rounded hover:bg-white/10 opacity-60 hover:opacity-100 transition-all"
                            title="Start"
                          >
                            ▶
                          </button>
                        )}
                        <button
                          onClick={() => cancelItem(item.id)}
                          className="p-1 rounded hover:bg-white/10 opacity-40 hover:opacity-80 transition-all"
                          title="Cancel"
                        >
                          <X size={10} />
                        </button>
                      </div>
                    </motion.div>
                  )
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatMs(ms: number): string {
  const totalSec = Math.floor(ms / 1000)
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function formatTimeLeft(ms: number): string {
  const totalMin = Math.floor(ms / 60000)
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  if (h > 0) return `${h}ч ${m}м`
  return `${m}м`
}
