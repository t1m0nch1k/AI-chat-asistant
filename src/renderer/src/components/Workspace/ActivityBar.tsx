import React, { useState } from 'react'
import { useCoderStore } from '../../store/useCoderStore'
import { cn } from '../../utils/cn'

export const ActivityBar: React.FC = () => {
  const { activeSidePanel, setActiveSidePanel } = useCoderStore()
  const [projectLoading, setProjectLoading] = useState(false)

  const handleNewProject = async () => {
    if (projectLoading) return
    setProjectLoading(true)
    try {
      const result = await window.api.coderPickWorkspace()
      if (result && result.success && result.data) {
        const path = result.data.path
        if (path) {
          await window.api.coderSetWorkspace(path)
          useCoderStore.getState().setWorkspaceRoot(path)
          const scanResult = await window.api.coderScan(true)
          if (scanResult && scanResult.success && scanResult.data) {
            useCoderStore.getState().setTree(scanResult.data.tree)
          }
        }
      }
    } catch (e) {
      console.error('Project selection failed:', e)
    } finally {
      setProjectLoading(false)
    }
  }

  const items = [
    { id: 'explorer', icon: 'folder', label: 'Explorer' },
    { id: 'search', icon: 'search', label: 'Search' },
    { id: 'git', icon: 'commit', label: 'Git' },
    { id: 'composer', icon: 'edit_note', label: 'Composer' },
    { id: 'chats', icon: 'chat', label: 'Recent Chats' },
    { id: 'history', icon: 'history', label: 'Version History' },
    { id: 'extensions', icon: 'extension', label: 'Extensions' },
  ] as const

  return (
    <div className="w-[48px] bg-surface-container-low border-r border-outline-variant/30 flex flex-col items-center py-sm gap-sm shrink-0 z-50">
      {/* Top: Project Action */}
      <button
        onClick={handleNewProject}
        disabled={projectLoading}
        className="p-2 rounded-md text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition-all active:scale-90 disabled:opacity-50"
        title="Open Project"
      >
        <span className="material-symbols-outlined text-[20px]">
          {projectLoading ? 'sync' : 'folder_open'}
        </span>
      </button>

      <div className="w-full flex flex-col items-center gap-sm">
        {items.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveSidePanel(item.id as any)}
            className={cn(
              'p-2 rounded-md transition-all duration-150 relative group cursor-pointer',
              activeSidePanel === item.id
                ? 'bg-secondary-container/20 text-secondary'
                : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high'
            )}
            title={item.label}
          >
            {activeSidePanel === item.id && (
              <div className="absolute left-[-8px] top-1/2 -translate-y-1/2 w-[3px] h-[16px] bg-secondary rounded-r-full" />
            )}
            <span className="material-symbols-outlined text-[20px]" style={activeSidePanel === item.id ? { fontVariationSettings: "'FILL' 1" } : undefined}>
              {item.icon}
            </span>
          </button>
        ))}
      </div>

      <div className="mt-auto flex flex-col items-center gap-sm">
        <button
          onClick={() => window.api.openUrl('https://opencode.ai')}
          className="p-2 rounded-md text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition-all"
          title="Help"
        >
          <span className="material-symbols-outlined text-[20px]">help</span>
        </button>
        <button
          onClick={() => window.api.openUrl('https://docs.google.com/forms/d/e/1FAIpQLSesBH7_FYbgCepuPATAw_qhehV3656bm4akXKLHGN8EgVVwBNA/viewform?usp=dialog')}
          className="p-2 rounded-md text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition-all"
          title="Feedback"
        >
          <span className="material-symbols-outlined text-[20px]">feedback</span>
        </button>
      </div>
    </div>
  )
}
