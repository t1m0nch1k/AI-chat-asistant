import React, { useState, useRef, useEffect } from 'react'
import { useCoderStore } from '../../store/useCoderStore'
import { useAppStore } from '../../store/useAppStore'
import { cn } from '../../utils/cn'

export const InlineEditor: React.FC = () => {
  const { inlineEdit, setInlineEdit, activeFile } = useCoderStore()
  const { settings } = useAppStore()
  const [prompt, setPrompt] = useState('')
  const [generating, setGenerating] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (inlineEdit?.status === 'input') {
      setPrompt('')
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [inlineEdit?.status])

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && inlineEdit) {
        useCoderStore.getState().rejectInlineEdit()
      }
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && inlineEdit?.status === 'suggested') {
        e.preventDefault()
        useCoderStore.getState().applyInlineEdit()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [inlineEdit])

  if (!inlineEdit || inlineEdit.status === 'applied' || inlineEdit.status === 'rejected') return null

  const handleSubmit = async () => {
    if (!prompt.trim() || !activeFile || generating) return
    setGenerating(true)
    setInlineEdit({ ...inlineEdit, status: 'generating', prompt })

    try {
      const systemPrompt = `You are an expert code editor. The user has selected code and wants you to modify it.

Original code (lines ${inlineEdit.startLine}-${inlineEdit.endLine}):
\`\`\`
${inlineEdit.originalCode}
\`\`\`

User request: ${prompt}

Respond with ONLY the modified code. Do not include explanations, markdown formatting, or code blocks. Just the raw code that should replace the selection.`

      const response = await window.api.chatSimple({
        provider: settings.provider,
        apiKey: settings.apiKey,
        model: settings.model,
        prompt: systemPrompt,
        ollamaBaseUrl: settings.ollamaBaseUrl,
        openrouterBaseUrl: settings.openrouterBaseUrl,
      })

      if (response.success && response.result) {
        // Clean up the response — remove markdown code blocks if present
        let suggestedCode = response.result
          .replace(/```[\w]*\n?/g, '')
          .replace(/```/g, '')
          .trim()

        setInlineEdit({
          ...inlineEdit,
          status: 'suggested',
          prompt,
          suggestedCode,
        })
      } else {
        setInlineEdit({
          ...inlineEdit,
          status: 'input',
          error: response.error || 'Failed to generate code',
        })
      }
    } catch (e: any) {
      setInlineEdit({
        ...inlineEdit,
        status: 'input',
        error: e.message,
      })
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="absolute bottom-[80px] left-1/2 -translate-x-1/2 z-30 w-[500px] max-w-[90vw]">
      <div className="bg-surface-container border border-outline-variant/50 rounded-xl shadow-2xl shadow-black/40 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-md py-sm border-b border-outline-variant/30 bg-surface-container-high">
          <div className="flex items-center gap-xs">
            <span className="material-symbols-outlined text-[16px] text-secondary">auto_fix</span>
            <span className="text-[12px] font-medium text-on-surface">AI Inline Edit</span>
          </div>
          <span className="text-[10px] text-on-surface-variant/50">
            Lines {inlineEdit.startLine}-{inlineEdit.endLine}
          </span>
        </div>

        {/* Selected code preview */}
        <div className="px-md py-sm bg-surface-container-low">
          <div className="text-[10px] text-on-surface-variant/50 uppercase tracking-wider mb-xs">Selected</div>
          <pre className="font-code-sm text-code-sm text-on-surface-variant/70 bg-surface/50 rounded-md p-sm max-h-[120px] overflow-auto whitespace-pre-wrap">
            {inlineEdit.originalCode}
          </pre>
        </div>

        {/* Input */}
        {inlineEdit.status === 'input' || inlineEdit.status === 'generating' ? (
          <div className="p-md">
            <div className="relative">
              <input
                ref={inputRef}
                type="text"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    handleSubmit()
                  }
                  if (e.key === 'Escape') {
                    useCoderStore.getState().rejectInlineEdit()
                  }
                }}
                placeholder="Describe the change you want... (e.g., 'add error handling', 'convert to async/await')"
                disabled={generating}
                className="w-full bg-surface-container-high border border-outline-variant/50 rounded-lg py-sm px-md text-[13px] text-on-surface placeholder:text-on-surface-variant/40 focus:ring-1 focus:ring-secondary focus:outline-none disabled:opacity-50"
              />
              {generating && (
                <div className="absolute right-sm top-1/2 -translate-y-1/2">
                  <div className="w-4 h-4 border-2 border-secondary border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </div>

            {inlineEdit.error && (
              <div className="mt-sm text-[11px] text-error">{inlineEdit.error}</div>
            )}

            <div className="flex items-center justify-between mt-sm">
              <span className="text-[10px] text-on-surface-variant/40">Enter to submit · Esc to cancel</span>
              <button
                onClick={handleSubmit}
                disabled={!prompt.trim() || generating}
                className="px-md py-[4px] bg-secondary text-on-secondary rounded-md text-[11px] font-medium hover:bg-secondary/80 transition-colors disabled:opacity-30"
              >
                {generating ? 'Generating...' : 'Generate'}
              </button>
            </div>
          </div>
        ) : null}

        {/* Suggested code preview */}
        {inlineEdit.status === 'suggested' && inlineEdit.suggestedCode && (
          <div className="px-md py-sm">
            <div className="text-[10px] text-success/70 uppercase tracking-wider mb-xs">Suggested</div>
            <pre className="font-code-sm text-code-sm text-on-surface bg-success/5 border border-success/20 rounded-md p-sm max-h-[200px] overflow-auto whitespace-pre-wrap">
              {inlineEdit.suggestedCode}
            </pre>
            <div className="flex items-center justify-end gap-xs mt-sm">
              <span className="text-[10px] text-on-surface-variant/40 mr-auto">Ctrl+Enter to accept · Esc to reject</span>
              <button
                onClick={() => useCoderStore.getState().rejectInlineEdit()}
                className="px-sm py-[4px] bg-surface-container-high text-on-surface-variant rounded-md text-[11px] hover:bg-surface-container transition-colors"
              >
                Reject
              </button>
              <button
                onClick={() => useCoderStore.getState().applyInlineEdit()}
                className="px-sm py-[4px] bg-success/20 text-success rounded-md text-[11px] hover:bg-success/30 transition-colors"
              >
                Accept
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
