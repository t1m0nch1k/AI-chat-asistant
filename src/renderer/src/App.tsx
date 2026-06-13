import React, { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useAppStore } from './store/useAppStore'
import { useCoderStore } from './store/useCoderStore'
import { ChatWindow } from './components/ChatWindow'
import { SettingsWindow } from './components/SettingsWindow'
import { Sidebar } from './components/Sidebar'
import { Scheduler } from './components/Scheduler'
import { WorkspacePanel } from './components/Workspace/WorkspacePanel'
import { QuitConfirmation } from './components/QuitConfirmation'

const App: React.FC = () => {
  const {
    settings,
    currentPage,
    setCurrentPage,
    loadSettings,
    loadUserPaths,
  } = useAppStore()

  const { isCoderMode, setCoderMode } = useCoderStore()

  useEffect(() => {
    const unsubscribe = window.api.onCoderModeChange((enabled: boolean) => {
      setCoderMode(enabled)
    })
    return () => unsubscribe()
  }, [setCoderMode])

  const [showScheduler, setShowScheduler] = useState(false)
  const [showQuitModal, setShowQuitModal] = useState(false)

  useEffect(() => {
    loadSettings()
    loadUserPaths()
  }, [loadSettings, loadUserPaths])

  const currentSettings = useAppStore((state) => state.settings)

  useEffect(() => {
    const theme = currentSettings.theme === 'system'
      ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
      : currentSettings.theme
    document.documentElement.classList.remove('dark', 'light')
    document.documentElement.classList.add(theme)
  }, [currentSettings.theme])

  useEffect(() => {
    const unsubscribe = window.api.onQuitConfirmation(() => {
      setShowQuitModal(true)
    })
    return () => unsubscribe()
  }, [])

  const handleQuit = () => {
    setShowQuitModal(false)
    window.api.quitApp()
  }

  const handleHide = () => {
    setShowQuitModal(false)
    window.api.hideWindow()
  }

  const handleCloseModal = () => {
    setShowQuitModal(false)
  }

  return (
    <div className="h-screen w-screen bg-base text-on-surface font-body-base overflow-hidden flex flex-col">
      {/* ── TopAppBar ───────────────────────────────────────────────────── */}
      <header className="h-[32px] min-h-[32px] bg-surface/70 backdrop-blur-xl border-b border-outline-variant flex items-center justify-between px-md drag z-50">
        {/* Left: Brand */}
        <div className="flex items-center gap-md no-drag">
          <div className="flex items-center gap-sm">
            <span className="w-2 h-2 rounded-full bg-primary shadow-[0_0_8px_rgba(77,142,255,0.6)]" />
            <span className="font-headline-md text-headline-md font-bold text-primary">Nexus AI</span>
          </div>
          {isCoderMode && (
            <div className="flex items-center gap-xs px-sm py-[2px] bg-secondary-container/20 rounded-full border border-secondary/30">
              <div className="w-2 h-2 rounded-full bg-secondary animate-pulse" />
              <span className="font-label-caps text-label-caps text-secondary">Coder Mode</span>
            </div>
          )}
        </div>

        {/* Center: Search (Coder Mode only) */}
        {isCoderMode && (
          <div className="flex-1 max-w-md mx-auto relative group no-drag">
            <div className="absolute inset-y-0 left-0 pl-sm flex items-center pointer-events-none">
              <span className="material-symbols-outlined text-[16px] text-on-surface-variant group-focus-within:text-secondary transition-colors">search</span>
            </div>
            <input
              className="w-full bg-surface-container-high border-none rounded-md py-[4px] pl-[28px] pr-sm text-body-sm text-on-surface placeholder:text-on-surface-variant focus:ring-1 focus:ring-secondary focus:outline-none transition-all"
              placeholder="Search files, symbols, or commands (Ctrl+P)"
              type="text"
            />
          </div>
        )}

        {/* Right: Window controls */}
        <div className="flex items-center no-drag">
          <button
            onClick={() => setCurrentPage('settings')}
            className="w-[32px] h-[32px] flex items-center justify-center text-on-surface-variant hover:bg-surface-container-highest transition-colors duration-150 cursor-pointer active:scale-95"
            aria-label="settings"
          >
            <span className="material-symbols-outlined text-[16px]">settings</span>
          </button>
          <button
            onClick={() => setCoderMode(!isCoderMode)}
            className="w-[32px] h-[32px] flex items-center justify-center text-on-surface-variant hover:bg-surface-container-highest transition-colors duration-150 cursor-pointer active:scale-95"
            aria-label="toggle coder mode"
          >
            <span className="material-symbols-outlined text-[16px]">{isCoderMode ? 'smart_toy' : 'code'}</span>
          </button>
          <button
            onClick={() => window.api.minimizeWindow()}
            className="w-[32px] h-[32px] flex items-center justify-center text-on-surface-variant hover:bg-surface-container-highest transition-colors duration-150 cursor-pointer active:scale-95"
            aria-label="minimize"
          >
            <span className="material-symbols-outlined text-[16px]">minimize</span>
          </button>
          <button
            onClick={() => window.api.maximizeWindow()}
            className="w-[32px] h-[32px] flex items-center justify-center text-on-surface-variant hover:bg-surface-container-highest transition-colors duration-150 cursor-pointer active:scale-95"
            aria-label="fullscreen"
          >
            <span className="material-symbols-outlined text-[16px]">fullscreen</span>
          </button>
          <button
            onClick={() => setShowQuitModal(true)}
            className="w-[32px] h-[32px] flex items-center justify-center text-on-surface-variant hover:bg-error/20 hover:text-error transition-colors duration-150 cursor-pointer active:scale-95"
            aria-label="close"
          >
            <span className="material-symbols-outlined text-[16px]">close</span>
          </button>
        </div>
      </header>

      {/* ── Main Content ──────────────────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0">
        <Sidebar onOpenScheduler={() => setShowScheduler(true)} />
        {currentPage === 'settings' ? (
          <main className="flex-1 relative overflow-hidden">
            <SettingsWindow />
          </main>
        ) : isCoderMode ? (
          <WorkspacePanel />
        ) : (
          <main className="flex-1 relative overflow-hidden">
            {currentPage === 'chat' ? <ChatWindow /> : <SettingsWindow />}
          </main>
        )}
      </div>

      {/* ── Modals ────────────────────────────────────────────────────────── */}
      {showScheduler && <Scheduler onClose={() => setShowScheduler(false)} />}
      <QuitConfirmation
        isOpen={showQuitModal}
        onClose={handleCloseModal}
        onQuit={handleQuit}
        onHide={handleHide}
      />
    </div>
  )
}

export default App
