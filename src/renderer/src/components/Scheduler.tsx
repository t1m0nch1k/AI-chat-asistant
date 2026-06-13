/**
 * Scheduler UI — будильники, таймеры, напоминания, события.
 */

import React, { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { AlarmClock, Timer, Bell, Calendar, Plus, X, Trash2, Play, Square, Check } from 'lucide-react'
import { cn } from '../utils/cn'

type ScheduleType = 'alarm' | 'timer' | 'reminder' | 'event'
type ScheduleStatus = 'pending' | 'active' | 'fired' | 'cancelled'

interface ScheduleItem {
  id: string
  type: ScheduleType
  title: string
  message?: string
  fireAt?: number
  durationSeconds?: number
  date?: string
  time?: string
  repeat?: 'none' | 'daily' | 'weekly'
  createdAt: number
  status: ScheduleStatus
  startedAt?: number
}

const TYPE_ICONS: Record<ScheduleType, React.ReactNode> = {
  alarm: <AlarmClock size={13} />,
  timer: <Timer size={13} />,
  reminder: <Bell size={13} />,
  event: <Calendar size={13} />
}

const TYPE_COLORS: Record<ScheduleType, string> = {
  alarm: 'text-red-400 bg-red-500/15',
  timer: 'text-blue-400 bg-blue-500/15',
  reminder: 'text-yellow-400 bg-yellow-500/15',
  event: 'text-green-400 bg-green-500/15'
}

interface SchedulerProps {
  onClose: () => void
}

export const Scheduler: React.FC<SchedulerProps> = ({ onClose }) => {
  const [items, setItems] = useState<ScheduleItem[]>([])
  const [showAdd, setShowAdd] = useState(false)
  const [addType, setAddType] = useState<ScheduleType>('reminder')
  const [tick, setTick] = useState(0)

  // Тик каждую секунду для обновления таймеров
  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), 1000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    loadItems()
  }, [])

  // Слушаем уведомления от main process
  useEffect(() => {
    const unsub = window.api.onSchedulerFired((item: ScheduleItem) => {
      setItems(prev => prev.map(i => i.id === item.id ? { ...i, status: item.status } : i))
    })
    return unsub
  }, [])

  const loadItems = async () => {
    const active = await window.api.schedulerGetActive()
    setItems(active)
  }

  const deleteItem = async (id: string) => {
    await window.api.schedulerDelete(id)
    setItems(prev => prev.filter(i => i.id !== id))
  }

  const cancelItem = async (id: string) => {
    await window.api.schedulerCancel(id)
    setItems(prev => prev.map(i => i.id === id ? { ...i, status: 'cancelled' as ScheduleStatus } : i))
  }

  const startTimer = async (id: string) => {
    await window.api.schedulerStartTimer(id)
    setItems(prev => prev.map(i =>
      i.id === id ? { ...i, status: 'active' as ScheduleStatus, startedAt: Date.now() } : i
    ))
  }

  const getTimeLeft = useCallback((item: ScheduleItem): string => {
    const now = Date.now()

    if (item.type === 'timer') {
      if (item.status === 'pending') {
        const total = item.durationSeconds || 0
        return formatDuration(total)
      }
      if (item.status === 'active' && item.startedAt && item.durationSeconds) {
        const elapsed = Math.floor((now - item.startedAt) / 1000)
        const left = Math.max(0, item.durationSeconds - elapsed)
        return left > 0 ? formatDuration(left) : '⏰ Done!'
      }
    }

    if (item.fireAt) {
      const diff = item.fireAt - now
      if (diff <= 0) return '⏰ Now!'
      return `in ${formatDuration(Math.floor(diff / 1000))}`
    }

    return ''
  }, [tick])

  const activeItems = items.filter(i => i.status === 'pending' || i.status === 'active')

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      className="absolute inset-2 bg-[#1a1a1a]/98 backdrop-blur-xl rounded-xl border border-white/10 flex flex-col z-50 shadow-2xl"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
        <div className="flex items-center gap-2">
          <AlarmClock size={15} className="text-accent" />
          <span className="text-sm font-semibold">Scheduler</span>
          {activeItems.length > 0 && (
            <span className="text-[10px] bg-accent/20 text-accent px-1.5 py-0.5 rounded-full">
              {activeItems.length} active
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-1 px-2 py-1 rounded-lg bg-accent/20 hover:bg-accent/30 text-accent text-[11px] transition-colors"
          >
            <Plus size={11} /> New
          </button>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 text-white/30 hover:text-white transition-colors">
            <X size={13} />
          </button>
        </div>
      </div>

      {/* Type filter tabs */}
      <div className="flex gap-1 px-3 pt-2">
        {(['alarm', 'timer', 'reminder', 'event'] as ScheduleType[]).map(type => (
          <button
            key={type}
            onClick={() => { setShowAdd(true); setAddType(type) }}
            className={cn(
              'flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] transition-colors',
              TYPE_COLORS[type]
            )}
          >
            {TYPE_ICONS[type]}
            <span className="capitalize">{type}</span>
          </button>
        ))}
      </div>

      {/* Items list */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {activeItems.length === 0 && (
          <div className="text-center py-12">
            <AlarmClock size={32} className="text-white/10 mx-auto mb-3" />
            <p className="text-white/30 text-[12px]">No active alarms or reminders</p>
            <p className="text-white/20 text-[11px] mt-1">
              Ask the assistant: "поставь будильник на 8:00"
            </p>
          </div>
        )}

        <AnimatePresence>
          {activeItems.map(item => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white/3 border border-white/5 rounded-xl p-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2 flex-1 min-w-0">
                  <div className={cn('p-1.5 rounded-lg mt-0.5 shrink-0', TYPE_COLORS[item.type])}>
                    {TYPE_ICONS[item.type]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium text-white/90 truncate">{item.title}</p>
                    {item.message && (
                      <p className="text-[11px] text-white/40 truncate">{item.message}</p>
                    )}
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[11px] font-mono text-accent/80">
                        {getTimeLeft(item)}
                      </span>
                      {item.repeat && item.repeat !== 'none' && (
                        <span className="text-[10px] text-white/25">↻ {item.repeat}</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {item.type === 'timer' && item.status === 'pending' && (
                    <button
                      onClick={() => startTimer(item.id)}
                      className="p-1.5 rounded-lg bg-green-500/20 hover:bg-green-500/30 text-green-400 transition-colors"
                      title="Start timer"
                    >
                      <Play size={11} />
                    </button>
                  )}
                  {item.status === 'active' && (
                    <button
                      onClick={() => cancelItem(item.id)}
                      className="p-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-400 transition-colors"
                      title="Stop"
                    >
                      <Square size={11} />
                    </button>
                  )}
                  <button
                    onClick={() => deleteItem(item.id)}
                    className="p-1.5 rounded-lg hover:bg-red-500/20 text-white/20 hover:text-red-400 transition-colors"
                    title="Delete"
                  >
                    <Trash2 size={11} />
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Add dialog */}
      <AnimatePresence>
        {showAdd && (
          <AddScheduleDialog
            defaultType={addType}
            onSave={async (data) => {
              const result = await window.api.schedulerCreate(data)
              if (result.success) {
                setItems(prev => [...prev, result.item])
              }
              setShowAdd(false)
            }}
            onClose={() => setShowAdd(false)}
          />
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ── Add Dialog ────────────────────────────────────────────────────────────────

const AddScheduleDialog: React.FC<{
  defaultType: ScheduleType
  onSave: (data: any) => void
  onClose: () => void
}> = ({ defaultType, onSave, onClose }) => {
  const [type, setType] = useState<ScheduleType>(defaultType)
  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [time, setTime] = useState('')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [duration, setDuration] = useState({ h: 0, m: 5, s: 0 })
  const [repeat, setRepeat] = useState<'none' | 'daily' | 'weekly'>('none')

  const handleSave = () => {
    if (!title.trim()) return

    const base = { title: title.trim(), message: message.trim() || undefined, repeat, type }

    if (type === 'timer') {
      const secs = duration.h * 3600 + duration.m * 60 + duration.s
      onSave({ ...base, durationSeconds: secs })
    } else {
      // alarm, reminder, event — нужно время
      const [h, m] = time.split(':').map(Number)
      const d = new Date(date)
      d.setHours(h || 0, m || 0, 0, 0)
      onSave({ ...base, fireAt: d.getTime(), date, time })
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 bg-black/60 backdrop-blur-sm rounded-xl flex items-center justify-center p-4 z-10"
    >
      <motion.div
        initial={{ scale: 0.9, y: 10 }}
        animate={{ scale: 1, y: 0 }}
        className="bg-[#222] border border-white/10 rounded-xl p-4 w-full space-y-3"
      >
        <h3 className="text-[13px] font-semibold text-white/80">New Schedule</h3>

        {/* Type */}
        <div className="grid grid-cols-4 gap-1">
          {(['alarm', 'timer', 'reminder', 'event'] as ScheduleType[]).map(t => (
            <button
              key={t}
              onClick={() => setType(t)}
              className={cn(
                'flex flex-col items-center gap-1 py-2 rounded-lg text-[10px] transition-all border',
                type === t
                  ? cn('border-accent/50', TYPE_COLORS[t])
                  : 'border-white/5 text-white/30 hover:text-white/60'
              )}
            >
              {TYPE_ICONS[t]}
              <span className="capitalize">{t}</span>
            </button>
          ))}
        </div>

        {/* Title */}
        <input
          type="text"
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder={type === 'timer' ? 'Timer name...' : 'Title...'}
          className="w-full bg-white/5 border border-white/10 rounded-lg py-2 px-3 text-[12px] outline-none focus:border-accent/50"
          autoFocus
        />

        {/* Message */}
        <input
          type="text"
          value={message}
          onChange={e => setMessage(e.target.value)}
          placeholder="Message (optional)..."
          className="w-full bg-white/5 border border-white/10 rounded-lg py-2 px-3 text-[12px] outline-none focus:border-accent/50"
        />

        {/* Time settings */}
        {type === 'timer' ? (
          <div className="space-y-1">
            <label className="text-[10px] text-white/40 uppercase tracking-wider">Duration</label>
            <div className="flex items-center gap-2">
              {(['h', 'm', 's'] as const).map(unit => (
                <div key={unit} className="flex-1">
                  <input
                    type="number"
                    min={0}
                    max={unit === 'h' ? 23 : 59}
                    value={duration[unit]}
                    onChange={e => setDuration(prev => ({ ...prev, [unit]: parseInt(e.target.value) || 0 }))}
                    className="w-full bg-white/5 border border-white/10 rounded-lg py-1.5 px-2 text-[12px] outline-none text-center"
                  />
                  <p className="text-[10px] text-white/30 text-center mt-0.5">{unit}</p>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-[10px] text-white/40 uppercase tracking-wider">Date</label>
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg py-1.5 px-2 text-[12px] outline-none focus:border-accent/50"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] text-white/40 uppercase tracking-wider">Time</label>
              <input
                type="time"
                value={time}
                onChange={e => setTime(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg py-1.5 px-2 text-[12px] outline-none focus:border-accent/50"
              />
            </div>
          </div>
        )}

        {/* Repeat (не для таймера) */}
        {type !== 'timer' && (
          <div className="space-y-1">
            <label className="text-[10px] text-white/40 uppercase tracking-wider">Repeat</label>
            <div className="flex gap-1">
              {(['none', 'daily', 'weekly'] as const).map(r => (
                <button
                  key={r}
                  onClick={() => setRepeat(r)}
                  className={cn(
                    'flex-1 py-1.5 rounded-lg text-[11px] border transition-all',
                    repeat === r ? 'border-accent/50 bg-accent/10 text-accent' : 'border-white/5 text-white/30 hover:text-white/60'
                  )}
                >
                  {r === 'none' ? 'Once' : r.charAt(0).toUpperCase() + r.slice(1)}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-2 pt-1">
          <button onClick={onClose} className="flex-1 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-[12px] text-white/60 transition-colors">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!title.trim() || (type !== 'timer' && !time)}
            className="flex-1 py-2 rounded-lg bg-accent hover:bg-accent/80 text-[12px] text-white transition-colors disabled:opacity-40"
          >
            Create
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDuration(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}
