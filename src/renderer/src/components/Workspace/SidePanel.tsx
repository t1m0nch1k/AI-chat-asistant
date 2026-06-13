import React from 'react'
import { useCoderStore } from '../../store/useCoderStore'
import { FileExplorer } from './FileExplorer'
import { CodebaseSearch } from './CodebaseSearch'
import { GitPanel } from './GitPanel'
import { ComposerPanel } from './ComposerPanel'
import { cn } from '../../utils/cn'
import { useAppStore } from '../../store/useAppStore'

export const SidePanel: React.FC = () => {
  const { activeSidePanel, setActiveSidePanel } = useCoderStore()
  const { chats } = useAppStore()

  const tabs = [
    { id: 'explorer' as const, icon: 'folder', label: 'Explorer' },
    { id: 'search' as const, icon: 'search', label: 'Search' },
    { id: 'git' as const, icon: 'commit', label: 'Git' },
    { id: 'composer' as const, icon: 'edit_note', label: 'Composer' },
    { id: 'chats' as const, icon: 'chat', label: 'Chats' },
    { id: 'history' as const, icon: 'history', label: 'History' },
    { id: 'extensions' as const, icon: 'extension', label: 'Extensions' },
  ]

  return (
    <div className="flex flex-col h-full">
      {/* Tabs Header */}
      <div className="flex items-center justify-between border-b border-outline-variant/30 bg-surface-container-low shrink-0">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveSidePanel(tab.id as any)}
            className={cn(
              'flex-1 flex items-center justify-center gap-xs py-2 text-[11px] font-medium transition-colors min-w-0',
              activeSidePanel === tab.id
                ? 'text-secondary border-b-2 border-secondary bg-secondary/5'
                : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container'
            )}
            title={tab.label}
          >
            <span className="material-symbols-outlined text-[16px] shrink-0">{tab.icon}</span>
            <span className="truncate hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Dynamic Content */}
      <div className="flex-1 overflow-hidden">
        {activeSidePanel === 'explorer' && <FileExplorer />}
        {activeSidePanel === 'search' && <CodebaseSearch />}
        {activeSidePanel === 'git' && <GitPanel />}
        {activeSidePanel === 'composer' && <ComposerPanel />}
        {activeSidePanel === 'chats' && (
          <div className="flex-1 overflow-y-auto px-sm py-sm flex flex-col gap-[2px]">
            <div className="font-label-caps text-label-caps text-on-surface-variant px-md py-sm">RECENT CHATS</div>
            {chats.length === 0 && <p className="text-body-sm text-on-surface-variant/50 text-center py-md">No chats yet</p>}
            {chats.slice(0, 20).map((c) => (
              <div key={c.id} className="flex items-center gap-sm px-md py-[6px] rounded-lg hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface cursor-pointer transition-colors">
                <span className="material-symbols-outlined text-[14px]">chat</span>
                <span className="text-body-sm truncate">{c.title}</span>
              </div>
            ))}
          </div>
        )}
        {activeSidePanel === 'history' && (
          <div className="flex-1 overflow-y-auto px-sm py-sm">
            <div className="font-label-caps text-label-caps text-on-surface-variant px-md py-sm">VERSION HISTORY</div>
            <p className="text-body-sm text-on-surface-variant/50 text-center py-md">Git integration coming soon</p>
          </div>
        )}
        {activeSidePanel === 'extensions' && (
          <div className="flex-1 overflow-y-auto px-sm py-sm">
            <div className="font-label-caps text-label-caps text-on-surface-variant px-md py-sm">EXTENSIONS</div>
            <p className="text-body-sm text-on-surface-variant/50 text-center py-md">Browse extensions via the command palette.</p>
          </div>
        )}
      </div>
    </div>
  )
}
