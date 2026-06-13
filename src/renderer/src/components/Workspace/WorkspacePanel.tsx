import React from 'react'
import { useCoderStore } from '../../store/useCoderStore'
import { FileExplorer } from './FileExplorer'
import { CodeEditor } from './CodeEditor'
import { CoderChat } from './CoderChat'
import { CoderTerminal } from './CoderTerminal'
import { InlineEditor } from './InlineEditor'
import { SidePanel } from './SidePanel'
import { ActivityBar } from './ActivityBar'

export const WorkspacePanel: React.FC = () => {
  const { showChatPanel, activeSidePanel } = useCoderStore()

  return (
    <main className="flex-1 flex min-w-0 bg-surface overflow-hidden">
      {/* Far Left: Activity Bar (Global Navigation) */}
      <ActivityBar />

      {/* Left: Dynamic Side Panel (Explorer / Search / Git / Chats / etc) */}
      {activeSidePanel !== 'none' && (
        <aside className="w-[260px] min-w-[200px] max-w-[400px] border-r border-outline-variant/30 bg-surface-container-low flex flex-col shrink-0 resize-x">
          <SidePanel />
        </aside>
      )}

      {/* Center: Editor + Terminal */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex-1 flex flex-col min-h-0 relative">
          <CodeEditor />
          <InlineEditor />
        </div>
        <CoderTerminal />
      </div>

      {/* Right: AI Chat Panel */}
      {showChatPanel && (
        <aside className="w-[380px] min-w-[320px] max-w-[500px] border-l border-outline-variant/30 bg-surface-container-low flex flex-col shrink-0 resize-x">
          <CoderChat />
        </aside>
      )}
    </main>
  )
}
