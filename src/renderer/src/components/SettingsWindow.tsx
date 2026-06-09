import React, { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import {
  Globe,
  Shield,
  Cpu,
  Sliders,
  Monitor,
  FolderOpen,
  Terminal,
  Save,
  CheckCircle,
  AlertCircle,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  Mic,
  RefreshCw,
  ScrollText,
  X,
  Code
} from 'lucide-react'
import { useAppStore } from '../store/useAppStore'
import { Provider, MODEL_CATALOG, PERSONAS } from '../types'
import { cn } from '../utils/cn'
import { KnowledgeTab } from './KnowledgeTab'
import { CoderTab } from './CoderTab'

type Tab = 'provider' | 'model' | 'ui' | 'agent' | 'voice' | 'system' | 'logs' | 'knowledge' | 'coder'

export const SettingsWindow: React.FC = () => {
  const { settings, setSettings, saveSettings } = useAppStore()
  const [activeTab, setActiveTab] = useState<Tab>('provider')
  const [saved, setSaved] = useState(false)
  const [showKey, setShowKey] = useState(false)

  const handleSave = async () => {
    await saveSettings()
    window.api.setAutoStart(settings.autoStart)
    window.api.registerHotkey(settings.globalHotkey)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'provider', label: 'Provider', icon: <Globe size={13} /> },
    { id: 'model', label: 'Model', icon: <Cpu size={13} /> },
    { id: 'ui', label: 'Interface', icon: <Monitor size={13} /> },
    { id: 'agent', label: 'Agent', icon: <Terminal size={13} /> },
    { id: 'voice', label: 'Voice', icon: <Mic size={13} /> },
    { id: 'system', label: 'System', icon: <Sliders size={13} /> },
    { id: 'logs', label: 'Logs', icon: <ScrollText size={13} /> },
    { id: 'knowledge', label: 'Knowledge', icon: <ScrollText size={13} /> },
    { id: 'coder', label: 'Coder', icon: <Code size={13} /> }
  ]

  return (
    <div className="flex flex-col h-full">
      {/* Tab Bar */}
      <div className="flex border-b border-white/5 px-3 pt-2 gap-1 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-2 text-[11px] font-medium rounded-t-lg transition-colors whitespace-nowrap',
              activeTab === tab.id
                ? 'bg-white/8 text-white border-b-2 border-accent'
                : 'text-white/40 hover:text-white/70'
            )}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.15 }}
        >
          {activeTab === 'provider' && (
            <ProviderTab settings={settings} setSettings={setSettings} showKey={showKey} setShowKey={setShowKey} />
          )}
          {activeTab === 'model' && (
            <ModelTab settings={settings} setSettings={setSettings} />
          )}
          {activeTab === 'ui' && (
            <UITab settings={settings} setSettings={setSettings} />
          )}
          {activeTab === 'agent' && (
            <AgentTab settings={settings} setSettings={setSettings} />
          )}
          {activeTab === 'voice' && (
            <VoiceTab settings={settings} setSettings={setSettings} />
          )}
          {activeTab === 'system' && (
            <SystemTab settings={settings} setSettings={setSettings} />
          )}
          {activeTab === 'logs' && <LogsTab />}
          {activeTab === 'knowledge' && <KnowledgeTab />}
          {activeTab === 'coder' && <CoderTab />}
        </motion.div>
      </div>

      {/* Save Button */}
      <div className="p-3 border-t border-white/5">
        <button
          onClick={handleSave}
          className={cn(
            'w-full py-2.5 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2',
            saved
              ? 'bg-green-500/20 text-green-400 border border-green-500/30'
              : 'bg-accent hover:bg-accent/80 text-white shadow-lg shadow-accent/20'
          )}
        >
          {saved ? (
            <><CheckCircle size={15} />Saved!</>
          ) : (
            <><Save size={15} />Save Settings</>
          )}
        </button>
      </div>
    </div>
  )
}

// ── Provider Tab ──────────────────────────────────────────────────────────────

const PROVIDERS: { id: Provider; label: string; color: string }[] = [
  { id: 'openai', label: 'OpenAI', color: '#10a37f' },
  { id: 'anthropic', label: 'Anthropic', color: '#d97706' },
  { id: 'gemini', label: 'Gemini', color: '#4285f4' },
  { id: 'deepseek', label: 'DeepSeek', color: '#6366f1' },
  { id: 'mistral', label: 'Mistral', color: '#f97316' },
  { id: 'groq', label: 'Groq', color: '#f43f5e' },
  { id: 'openrouter', label: 'OpenRouter', color: '#8b5cf6' },
  { id: 'qwen', label: 'Qwen (Alibaba)', color: '#6b21a8' },
  { id: 'ollama', label: 'Ollama (Local)', color: '#22c55e' },
  { id: 'nvidia', label: 'NVIDIA', color: '#76b900' },
  { id: 'huggingface', label: 'HuggingFace', color: '#fbbf24' }
]

const ProviderTab: React.FC<{
  settings: any; setSettings: any; showKey: boolean; setShowKey: (v: boolean) => void
}> = ({ settings, setSettings, showKey, setShowKey }) => (
  <div className="space-y-4">
    <Label>AI Provider</Label>
    <div className="grid grid-cols-2 gap-2">
      {PROVIDERS.map((p) => (
        <button
          key={p.id}
          onClick={() => setSettings({ provider: p.id, model: MODEL_CATALOG[p.id][0]?.id ?? '' })}
          className={cn(
            'flex items-center gap-2 px-3 py-2.5 rounded-xl border text-[12px] font-medium transition-all',
            settings.provider === p.id
              ? 'border-accent/60 bg-accent/10 text-white'
              : 'border-white/8 bg-white/3 text-white/50 hover:text-white hover:border-white/20'
          )}
        >
          <div className="w-2 h-2 rounded-full shrink-0" style={{ background: p.color }} />
          {p.label}
        </button>
      ))}
    </div>

    {settings.provider !== 'ollama' && (
      <div className="space-y-1.5">
        <Label>API Key</Label>
        <div className="relative">
          <Shield size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20" />
          <input
            type={showKey ? 'text' : 'password'}
            value={settings.apiKey}
            onChange={(e) => setSettings({ apiKey: e.target.value })}
            placeholder="Paste your API key..."
            className="w-full bg-white/5 border border-white/10 rounded-lg py-2 pl-9 pr-9 text-[13px] outline-none focus:border-accent/50 transition-colors"
          />
          <button
            onClick={() => setShowKey(!showKey)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-white/20 hover:text-white/50"
          >
            {showKey ? <EyeOff size={13} /> : <Eye size={13} />}
          </button>
        </div>
        <p className="text-[10px] text-white/25">
          🔒 Stored encrypted on your device.
          {settings.provider === 'qwen' && (
            <> Get key at <span className="text-accent">dashscope.console.aliyun.com</span></>
          )}
        </p>
      </div>
    )}

    {settings.provider === 'ollama' && (
      <div className="space-y-1.5">
        <Label>Ollama Base URL</Label>
        <input
          type="text"
          value={settings.ollamaBaseUrl}
          onChange={(e) => setSettings({ ollamaBaseUrl: e.target.value })}
          placeholder="http://localhost:11434"
          className="w-full bg-white/5 border border-white/10 rounded-lg py-2 px-3 text-[13px] outline-none focus:border-accent/50"
        />
      </div>
    )}

    {settings.provider === 'openrouter' && (
      <div className="space-y-1.5">
        <Label>OpenRouter Base URL</Label>
        <input
          type="text"
          value={settings.openrouterBaseUrl}
          onChange={(e) => setSettings({ openrouterBaseUrl: e.target.value })}
          placeholder="https://openrouter.ai/api/v1"
          className="w-full bg-white/5 border border-white/10 rounded-lg py-2 px-3 text-[13px] outline-none focus:border-accent/50"
        />
      </div>
    )}
  </div>
)

// ── Model Tab ─────────────────────────────────────────────────────────────────

const ModelTab: React.FC<{ settings: any; setSettings: any }> = ({ settings, setSettings }) => {
  const models = MODEL_CATALOG[settings.provider as Provider] ?? []
  const [customModel, setCustomModel] = useState('')

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label>Model</Label>
        <select
          value={models.some((m) => m.id === settings.model) ? settings.model : ''}
          onChange={(e) => { if (e.target.value) setSettings({ model: e.target.value }) }}
          className="w-full bg-white/5 border border-white/10 rounded-lg py-2 px-3 text-[13px] outline-none focus:border-accent/50"
        >
          {models.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name} {m.contextWindow ? `(${(m.contextWindow / 1000).toFixed(0)}k ctx)` : ''}
            </option>
          ))}
        </select>

        {/* Custom model ID — separate from dropdown */}
        <div className="flex gap-2">
          <input
            type="text"
            value={customModel}
            onChange={(e) => setCustomModel(e.target.value)}
            placeholder="Custom model ID (e.g. gpt-4o-2024-11-20)..."
            className="flex-1 bg-white/5 border border-white/10 rounded-lg py-2 px-3 text-[13px] outline-none focus:border-accent/50"
          />
          <button
            onClick={() => { if (customModel.trim()) { setSettings({ model: customModel.trim() }); setCustomModel('') } }}
            disabled={!customModel.trim()}
            className="px-3 py-2 bg-accent/20 hover:bg-accent/30 text-accent rounded-lg text-[12px] transition-colors disabled:opacity-40"
          >
            Use
          </button>
        </div>
        <p className="text-[10px] text-white/30">
          Current: <span className="font-mono text-white/60">{settings.model}</span>
        </p>
      </div>

      <div className="space-y-1.5">
        <Label>System Prompt</Label>
        <textarea
          value={settings.systemPrompt}
          onChange={(e) => setSettings({ systemPrompt: e.target.value })}
          rows={4}
          className="w-full bg-white/5 border border-white/10 rounded-lg py-2 px-3 text-[13px] outline-none focus:border-accent/50 resize-none"
        />
        <button
          onClick={() => setSettings({ systemPrompt: 'You are a helpful AI Assistant running on Windows 11. Be concise and helpful.' })}
          className="text-[10px] text-white/30 hover:text-accent transition-colors flex items-center gap-1"
        >
          <RefreshCw size={10} /> Reset to default
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Temperature: {settings.temperature}</Label>
          <input
            type="range" min="0" max="2" step="0.1"
            value={settings.temperature}
            onChange={(e) => setSettings({ temperature: parseFloat(e.target.value) })}
            className="w-full accent-accent"
          />
          <div className="flex justify-between text-[10px] text-white/25">
            <span>Precise</span><span>Creative</span>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Max Tokens</Label>
          <input
            type="number"
            value={settings.maxTokens}
            onChange={(e) => setSettings({ maxTokens: parseInt(e.target.value) || 2048 })}
            min={256} max={32000} step={256}
            className="w-full bg-white/5 border border-white/10 rounded-lg py-2 px-3 text-[13px] outline-none focus:border-accent/50"
          />
        </div>
      </div>
    </div>
  )
}

// ── UI Tab ────────────────────────────────────────────────────────────────────

const UITab: React.FC<{ settings: any; setSettings: any }> = ({ settings, setSettings }) => (
  <div className="space-y-4">
    <div className="space-y-1.5">
      <Label>Theme</Label>
      <div className="grid grid-cols-3 gap-2">
        {(['dark', 'light', 'system'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setSettings({ theme: t })}
            className={cn(
              'py-2 rounded-lg text-[12px] font-medium border transition-all capitalize',
              settings.theme === t
                ? 'border-accent/60 bg-accent/10 text-white'
                : 'border-white/8 text-white/40 hover:text-white'
            )}
          >
            {t === 'dark' ? '🌙' : t === 'light' ? '☀️' : '🖥️'} {t}
          </button>
        ))}
      </div>
    </div>

    <div className="space-y-1.5">
      <Label>Font Size</Label>
      <div className="grid grid-cols-3 gap-2">
        {(['sm', 'md', 'lg'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setSettings({ fontSize: s })}
            className={cn(
              'py-2 rounded-lg text-[12px] font-medium border transition-all',
              settings.fontSize === s
                ? 'border-accent/60 bg-accent/10 text-white'
                : 'border-white/8 text-white/40 hover:text-white'
            )}
          >
            {s === 'sm' ? 'Small' : s === 'md' ? 'Medium' : 'Large'}
          </button>
        ))}
      </div>
    </div>

    <ToggleRow
      label="Send on Enter"
      description="Press Enter to send (Shift+Enter for newline)"
      value={settings.sendOnEnter}
      onChange={(v) => setSettings({ sendOnEnter: v })}
    />

    <ToggleRow
      label="Show Notifications"
      description="Windows notifications for completed responses"
      value={settings.showNotifications}
      onChange={(v) => setSettings({ showNotifications: v })}
    />
  </div>
)

// ── Agent Tab ─────────────────────────────────────────────────────────────────

const AgentTab: React.FC<{ settings: any; setSettings: any }> = ({ settings, setSettings }) => {
  const addPath = async () => {
    const picked = await window.api.pickDirectory()
    if (picked) {
      setSettings({ allowedPaths: [...(settings.allowedPaths ?? []), picked] })
    }
  }

  const removePath = (idx: number) => {
    const paths = [...(settings.allowedPaths ?? [])]
    paths.splice(idx, 1)
    setSettings({ allowedPaths: paths })
  }

  return (
    <div className="space-y-4">
      <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
        <div className="flex items-start gap-2">
          <AlertCircle size={14} className="text-amber-400 mt-0.5 shrink-0" />
          <p className="text-[11px] text-amber-300/80 leading-relaxed">
            Agent mode allows AI to read/write files and control your computer.
            Only enable with trusted AI models.
          </p>
        </div>
      </div>

      <ToggleRow
        label="Enable Agent Mode"
        description="Allow AI to use file system and system tools"
        value={settings.agentEnabled}
        onChange={(v) => setSettings({ agentEnabled: v })}
      />

      {settings.agentEnabled && (
        <>
          <ToggleRow
            label="Require Confirmation"
            description="Ask before executing file operations"
            value={settings.requireConfirmation}
            onChange={(v) => setSettings({ requireConfirmation: v })}
          />

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Allowed Directories</Label>
              <button
                onClick={addPath}
                className="flex items-center gap-1 text-[11px] text-accent hover:text-accent/80 transition-colors"
              >
                <Plus size={12} />Add folder
              </button>
            </div>

            {(settings.allowedPaths ?? []).length === 0 && (
              <p className="text-[11px] text-white/25 italic">
                Defaults: Documents, Desktop, Downloads
              </p>
            )}

            <div className="space-y-1.5">
              {(settings.allowedPaths ?? []).map((p: string, i: number) => (
                <div key={i} className="flex items-center gap-2 bg-white/5 rounded-lg px-3 py-2 border border-white/8">
                  <FolderOpen size={12} className="text-accent shrink-0" />
                  <span className="text-[11px] text-white/70 flex-1 truncate">{p}</span>
                  <button onClick={() => removePath(i)} className="text-white/20 hover:text-red-400 transition-colors">
                    <Trash2 size={11} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ── System Tab ────────────────────────────────────────────────────────────────

const SystemTab: React.FC<{ settings: any; setSettings: any }> = ({ settings, setSettings }) => (
  <div className="space-y-4">
    <ToggleRow
      label="Log to File"
      description="Save all application logs to a .txt file"
      value={settings.logToFile}
      onChange={(v) => setSettings({ logToFile: v })}
    />

    <ToggleRow
      label="Start with Windows"
      description="Launch AI Assistant when Windows starts"
      value={settings.autoStart}
      onChange={(v) => setSettings({ autoStart: v })}
    />

    <ToggleRow
      label="Minimize to Tray"
      description="Keep running in background when closed"
      value={settings.minimizeToTray}
      onChange={(v) => setSettings({ minimizeToTray: v })}
    />

    <div className="space-y-1.5">
      <Label>Global Hotkey</Label>
      <input
        type="text"
        value={settings.globalHotkey}
        onChange={(e) => setSettings({ globalHotkey: e.target.value })}
        placeholder="Alt+Shift+G"
        className="w-full bg-white/5 border border-white/10 rounded-lg py-2 px-3 text-[13px] outline-none focus:border-accent/50 font-mono"
      />
      <p className="text-[10px] text-white/25">
        Electron accelerator format: Ctrl+Shift+A, Alt+Space, etc.
      </p>
    </div>

    <ToggleRow
      label="Proxy"
      description="Route requests through a proxy server"
      value={settings.proxyEnabled}
      onChange={(v) => setSettings({ proxyEnabled: v })}
    />

    {settings.proxyEnabled && (
      <div className="space-y-1.5">
        <Label>Proxy URL</Label>
        <input
          type="text"
          value={settings.proxyUrl}
          onChange={(e) => setSettings({ proxyUrl: e.target.value })}
          placeholder="http://proxy:8080"
          className="w-full bg-white/5 border border-white/10 rounded-lg py-2 px-3 text-[13px] outline-none focus:border-accent/50"
        />
      </div>
    )}

    <div className="pt-2 border-t border-white/5">
      <button
        onClick={async () => {
          if (confirm('Clear all settings and chat history?')) {
            await window.api.clearSettings()
            window.location.reload()
          }
        }}
        className="w-full py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-lg text-[12px] text-red-400 transition-colors"
      >
        Reset All Settings
      </button>
    </div>
  </div>
)

// ── Voice Tab ─────────────────────────────────────────────────────────────────

const VoiceTab: React.FC<{ settings: any; setSettings: any }> = ({ settings, setSettings }) => {
  const [newWakeWord, setNewWakeWord] = useState('')
  const [testStatus, setTestStatus] = useState<string | null>(null)
  const [voices, setVoices] = useState<Array<{ name: string; culture: string; gender: string }>>([])
  const [loadingVoices, setLoadingVoices] = useState(false)

  // Загружаем список голосов при открытии вкладки
  useEffect(() => {
    loadVoices()
  }, [])

  const loadVoices = async () => {
    setLoadingVoices(true)
    try {
      const r = await window.api.getVoices()
      if (r.success) setVoices(r.voices)
    } catch {}
    setLoadingVoices(false)
  }

  const addWakeWord = () => {
    const word = newWakeWord.trim().toLowerCase()
    if (!word) return
    const current = settings.wakeWords ?? ['ассистент', 'assistant']
    if (!current.includes(word)) {
      setSettings({ wakeWords: [...current, word] })
    }
    setNewWakeWord('')
  }

  const removeWakeWord = (idx: number) => {
    const words = [...(settings.wakeWords ?? [])]
    words.splice(idx, 1)
    setSettings({ wakeWords: words })
  }

  const testTTS = async () => {
    setTestStatus('speaking...')
    try {
      const voice = settings.ttsVoice
      if (voice) {
        await window.api.speakWithVoice?.('Привет! Я ваш голосовой ассистент.', voice, settings.ttsRate ?? 0, settings.ttsVolume ?? 100)
      } else {
        await window.api.speak?.('Привет! Я ваш голосовой ассистент.', settings.ttsRate ?? 0, settings.ttsVolume ?? 100)
      }
    } finally {
      setTestStatus(null)
    }
  }

  return (
    <div className="space-y-4">
      <ToggleRow
        label="Background Voice Assistant"
        description="Слушает wake word в фоне постоянно"
        value={settings.backgroundVoiceEnabled ?? false}
        onChange={(v) => setSettings({ backgroundVoiceEnabled: v })}
      />

      {/* Voice selector */}
      <div className="space-y-2">
        <Label>Голос ассистента (Windows SAPI)</Label>

        {loadingVoices ? (
          <p className="text-[11px] text-white/30">Загрузка голосов...</p>
        ) : voices.length === 0 ? (
          <p className="text-[11px] text-white/30 italic">
            Голоса не найдены. Установите дополнительные голоса в Windows Settings → Time & Language → Speech.
          </p>
        ) : (
          <div className="space-y-1.5">
            {/* Default option */}
            <button
              onClick={() => setSettings({ ttsVoice: '' })}
              className={cn(
                'w-full flex items-center justify-between px-3 py-2 rounded-lg border text-[12px] transition-all',
                !settings.ttsVoice
                  ? 'border-accent/50 bg-accent/10 text-white'
                  : 'border-white/8 text-white/50 hover:text-white hover:border-white/20'
              )}
            >
              <span>🔊 По умолчанию (системный)</span>
              {!settings.ttsVoice && <span className="text-accent text-[10px]">✓</span>}
            </button>

            {voices.map((v) => (
              <button
                key={v.name}
                onClick={() => setSettings({ ttsVoice: v.name })}
                className={cn(
                  'w-full flex items-center justify-between px-3 py-2 rounded-lg border text-[12px] transition-all',
                  settings.ttsVoice === v.name
                    ? 'border-accent/50 bg-accent/10 text-white'
                    : 'border-white/8 text-white/50 hover:text-white hover:border-white/20'
                )}
              >
                <div className="flex flex-col items-start">
                  <span>{v.gender === 'Female' ? '👩' : '👨'} {v.name}</span>
                  <span className="text-[10px] text-white/30">{v.culture}</span>
                </div>
                {settings.ttsVoice === v.name && <span className="text-accent text-[10px]">✓</span>}
              </button>
            ))}
          </div>
        )}

        <button
          onClick={loadVoices}
          className="text-[10px] text-white/30 hover:text-accent transition-colors flex items-center gap-1"
        >
          <RefreshCw size={10} /> Обновить список голосов
        </button>
      </div>

      {/* Wake Words */}
      <div className="space-y-2">
        <Label>Wake Words</Label>
        <p className="text-[11px] text-white/30">Скажи одно из этих слов чтобы активировать ассистента</p>

        <div className="space-y-1.5">
          {(settings.wakeWords ?? ['ассистент', 'assistant']).map((word: string, i: number) => (
            <div key={i} className="flex items-center gap-2 bg-white/5 rounded-lg px-3 py-2 border border-white/8">
              <Mic size={12} className="text-accent shrink-0" />
              <span className="text-[12px] text-white/80 flex-1 font-mono">"{word}"</span>
              <button onClick={() => removeWakeWord(i)} className="text-white/20 hover:text-red-400 transition-colors">
                <Trash2 size={11} />
              </button>
            </div>
          ))}
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            value={newWakeWord}
            onChange={(e) => setNewWakeWord(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addWakeWord()}
            placeholder="Добавить wake word..."
            className="flex-1 bg-white/5 border border-white/10 rounded-lg py-2 px-3 text-[13px] outline-none focus:border-accent/50"
          />
          <button
            onClick={addWakeWord}
            className="px-3 py-2 bg-accent/20 hover:bg-accent/30 text-accent rounded-lg text-[12px] transition-colors"
          >
            <Plus size={14} />
          </button>
        </div>
      </div>

      {/* TTS Settings */}
      <div className="space-y-3">
        <Label>Text-to-Speech</Label>

        <div className="space-y-1.5">
          <label className="text-[11px] text-white/40">Скорость речи: {settings.ttsRate ?? 0}</label>
          <input
            type="range" min="-10" max="10" step="1"
            value={settings.ttsRate ?? 0}
            onChange={(e) => setSettings({ ttsRate: parseInt(e.target.value) })}
            className="w-full accent-accent"
          />
          <div className="flex justify-between text-[10px] text-white/25">
            <span>Медленно</span><span>Быстро</span>
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-[11px] text-white/40">Громкость: {settings.ttsVolume ?? 100}%</label>
          <input
            type="range" min="0" max="100" step="5"
            value={settings.ttsVolume ?? 100}
            onChange={(e) => setSettings({ ttsVolume: parseInt(e.target.value) })}
            className="w-full accent-accent"
          />
        </div>

        <button
          onClick={testTTS}
          disabled={testStatus !== null}
          className="w-full py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-[12px] text-white/60 hover:text-white transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
        >
          <Mic size={13} />
          {testStatus ?? `Тест голоса${settings.ttsVoice ? ` (${settings.ttsVoice.split(' ').pop()})` : ''}`}
        </button>
      </div>

      <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20">
        <p className="text-[11px] text-blue-300/80 leading-relaxed">
          💡 Скажи wake word → ассистент активируется → говори команду.<br/>
          Например: <span className="font-mono">"Ассистент, открой YouTube"</span><br/>
          Добавить русские голоса: <span className="text-accent">Windows → Речь → Добавить голос</span>
        </p>
      </div>
    </div>
  )
}

// ── Logs Tab ──────────────────────────────────────────────────────────────────

const LogsTab: React.FC = () => {
  const [logs, setLogs] = useState<Array<{ timestamp: number; level: string; message: string; source: string }>>([])
  const [filter, setFilter] = useState<'all' | 'log' | 'warn' | 'error'>('all')
  const containerRef = useRef<HTMLDivElement>(null)

  const loadLogs = async () => {
    try {
      const data = await window.api.getLogs()
      setLogs(data)
    } catch {}
  }

  useEffect(() => {
    loadLogs()
    const interval = setInterval(loadLogs, 2000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight
    }
  }, [logs])

  const filtered = filter === 'all' ? logs : logs.filter(l => l.level === filter)

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Label>Application Logs</Label>
        <div className="flex gap-1 ml-auto">
          {(['all', 'error', 'warn', 'log'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                'px-2 py-1 rounded text-[10px] font-medium capitalize transition-colors',
                filter === f ? 'bg-accent/20 text-accent' : 'text-white/30 hover:text-white/60'
              )}
            >
              {f}
            </button>
          ))}
          <button
            onClick={async () => {
              await window.api.clearLogs()
              setLogs([])
            }}
            className="px-2 py-1 rounded text-[10px] text-white/30 hover:text-red-400 transition-colors flex items-center gap-1"
          >
            <X size={10} /> Clear
          </button>
        </div>
      </div>

      <div
        ref={containerRef}
        className="bg-black/40 rounded-xl border border-white/8 p-2 font-mono text-[11px] leading-relaxed overflow-y-auto"
        style={{ maxHeight: 400 }}
      >
        {filtered.length === 0 ? (
          <p className="text-white/20 italic p-2">No logs yet.</p>
        ) : (
          filtered.map((entry, i) => (
            <div key={i} className="flex gap-2 py-0.5 px-1.5 rounded hover:bg-white/5">
              <span className="text-white/20 shrink-0 w-14">
                {new Date(entry.timestamp).toLocaleTimeString()}
              </span>
              <span className={cn(
                'shrink-0 w-10 uppercase text-[9px] font-bold',
                entry.level === 'error' ? 'text-red-400' :
                entry.level === 'warn' ? 'text-amber-400' :
                'text-white/30'
              )}>
                {entry.level}
              </span>
              <span className={cn(
                'shrink-0 w-8 text-[9px]',
                entry.source === 'renderer' ? 'text-cyan-400/50' : 'text-white/20'
              )}>
                [{entry.source === 'renderer' ? 'R' : 'M'}]
              </span>
              <span className="text-white/70 break-all">{entry.message}</span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

// ── Shared Components ─────────────────────────────────────────────────────────

const Label: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <label className="block text-[11px] font-semibold text-white/50 uppercase tracking-wider mb-1">
    {children}
  </label>
)

interface ToggleRowProps {
  label: string
  description: string
  value: boolean
  onChange: (v: boolean) => void
}

const ToggleRow: React.FC<ToggleRowProps> = ({ label, description, value, onChange }) => (
  <div className="flex items-center justify-between gap-3">
    <div>
      <p className="text-[13px] font-medium text-white/80">{label}</p>
      <p className="text-[11px] text-white/30">{description}</p>
    </div>
    <button
      onClick={() => onChange(!value)}
      className={cn(
        'relative rounded-full transition-colors shrink-0',
        value ? 'bg-accent' : 'bg-white/15'
      )}
      style={{ height: 22, width: 40 }}
      role="switch"
      aria-checked={value}
    >
      <motion.div
        className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm"
        animate={{ left: value ? 20 : 2 }}
        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
      />
    </button>
  </div>
)
