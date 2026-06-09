import React, { useEffect, useState } from 'react'
import { useAppStore } from './store/useAppStore'
import { Sidebar } from './components/Sidebar'
import { ChatWindow } from './components/ChatWindow'
import { SettingsWindow } from './components/SettingsWindow'
import { QuitConfirmation } from './components/QuitConfirmation'
import { WorkspacePanel } from './components/Workspace/WorkspacePanel'
import { Scheduler } from './components/Scheduler'
import { X, Minus, Maximize, Settings } from 'lucide-react'

const App: React.FC = () => {
  const currentPage = useAppStore((state) => state.currentPage)
  const setCurrentPage = useAppStore((state) => state.setCurrentPage)
  const loadSettings = useAppStore((state) => state.loadSettings)
  const loadUserPaths = useAppStore((state) => state.loadUserPaths)
  
  const [showQuitModal, setShowQuitModal] = useState(false)
  const [showScheduler, setShowScheduler] = useState(false)

  useEffect(() => {
    loadSettings()
    loadUserPaths()
  }, [loadSettings, loadUserPaths])

  const settings = useAppStore((state) => state.settings)

  useEffect(() => {
    const theme = settings.theme === 'system' 
      ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
      : settings.theme
    document.documentElement.setAttribute('data-theme', theme)
  }, [settings.theme])

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
    <div className="flex h-screen w-screen glass text-white overflow-hidden font-sans selection:bg-accent/30">
      <div className="fixed top-0 left-0 right-0 h-10 flex items-center justify-between px-4 z-50 drag select-none">
        <div className="flex items-center gap-2 opacity-60 hover:opacity-100 transition-opacity cursor-default no-drag">
          <button 
            onClick={() => setCurrentPage('settings')}
            className="p-1 hover:bg-white/10 rounded-md transition-colors"
          >
            <Settings 
              size={16} 
              className="cursor-pointer hover:text-blue-400 transition-colors" 
            />
          </button>
          <span className="text-xs font-medium">AI Assistant</span>
        </div>
        <div className="flex items-center gap-2 no-drag">
          <button 
            onClick={() => window.api.minimizeWindow()} 
            className="p-1.5 hover:bg-white/10 rounded-md transition-colors"
          >
            <Minus size={14} />
          </button>
          <button 
            onClick={() => window.api.maximizeWindow()} 
            className="p-1.5 hover:bg-white/10 rounded-md transition-colors"
          >
            <Maximize size={14} />
          </button>
          <button 
            onClick={() => setShowQuitModal(true)} 
            className="p-1.5 hover:bg-red-500/80 rounded-md transition-colors"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      <div className="flex h-full w-full pt-10">
        <Sidebar onOpenScheduler={() => setShowScheduler(true)} />
        <main className="flex-1 relative overflow-hidden">
          {currentPage === 'chat' ? <ChatWindow /> : <SettingsWindow />}
        </main>
        <WorkspacePanel />
      </div>

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
