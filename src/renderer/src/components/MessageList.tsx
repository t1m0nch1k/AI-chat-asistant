import React, { useEffect, useRef, memo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { Message } from '../types'
import { cn } from '../utils/cn'

interface MessageListProps {
  messages: Message[]
  streamingContent?: string
}

export const MessageList: React.FC<MessageListProps> = ({ messages, streamingContent }) => {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length, streamingContent])

  const visibleMessages = messages.filter((m) => m.role !== 'system')
  const showTypingIndicator = messages.some((m) => m.streaming && !m.content) && !streamingContent
  const lastStreamingIdx = visibleMessages.reduce((last, msg, i) => (msg.streaming ? i : last), -1)

  return (
    <div className="flex-1 overflow-y-auto p-lg flex flex-col gap-lg pb-[120px]">
      {visibleMessages.length === 0 && !streamingContent && <EmptyState />}

      <AnimatePresence initial={false}>
        {visibleMessages.map((msg, i) => (
          <MessageBubble
            key={msg.id}
            message={msg}
            overrideContent={i === lastStreamingIdx && streamingContent !== undefined ? streamingContent : undefined}
          />
        ))}
      </AnimatePresence>

      {showTypingIndicator && <TypingIndicator />}
      <div ref={bottomRef} />
    </div>
  )
}

// ── Empty State ─────────────────────────────────────────────────────────────

const EmptyState: React.FC = () => (
  <div className="flex flex-col items-center justify-center h-full text-center py-xl">
    <div className="w-12 h-12 rounded-2xl bg-primary-container/20 flex items-center justify-center mb-md">
      <span className="material-symbols-outlined text-[24px] text-primary-container" style={{ fontVariationSettings: "'FILL' 1" }}>smart_toy</span>
    </div>
    <h3 className="text-body-base font-semibold text-on-surface mb-xs">How can I help?</h3>
    <p className="text-body-sm text-on-surface-variant/50 max-w-[200px]">Ask me anything. I can write code, answer questions, and more.</p>
  </div>
)

// ── Typing Indicator ─────────────────────────────────────────────────────────

const TypingIndicator: React.FC = () => (
  <div className="flex items-center gap-sm">
    <span className="material-symbols-outlined text-[16px] text-primary">smart_toy</span>
    <div className="flex gap-1">
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          className="w-1.5 h-1.5 rounded-full bg-on-surface/40"
          animate={{ opacity: [0.3, 1, 0.3], y: [0, -3, 0] }}
          transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.15 }}
        />
      ))}
    </div>
  </div>
)

// ── Message Bubble ──────────────────────────────────────────────────────────

interface MessageBubbleProps {
  message: Message
  overrideContent?: string
}

const MessageBubble: React.FC<MessageBubbleProps> = memo(({ message, overrideContent }) => {
  const isUser = message.role === 'user'
  const displayContent = overrideContent !== undefined ? overrideContent : message.content

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={cn('flex flex-col w-full max-w-4xl mx-auto', isUser ? 'items-end' : 'items-start')}
    >
      {/* Header */}
      <div className={cn('flex items-center gap-sm mb-xs', isUser ? 'text-on-surface-variant' : 'text-primary')}>
        {!isUser && <span className="material-symbols-outlined text-[16px] text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>smart_toy</span>}
        <span className={cn('font-body-sm text-body-sm', !isUser && 'font-semibold')}>
          {isUser ? 'You' : 'Nexus Assistant'}
        </span>
      </div>

      {/* Content */}
      <div className={cn(
        'w-full font-body-base text-body-base',
        isUser
          ? 'text-on-surface max-w-[85%] border-r-2 border-outline-variant pr-md py-xs text-right'
          : 'bg-surface-container/40 border-l-2 border-primary pl-md py-sm pr-sm rounded-r-lg',
        message.streaming && displayContent && 'animate-pulse-subtle',
      )}>
        <MarkdownContent content={displayContent} isUser={isUser} />
      </div>
    </motion.div>
  )
})

MessageBubble.displayName = 'MessageBubble'

// ── Markdown Renderer ───────────────────────────────────────────────────────

const MarkdownContent: React.FC<{ content: string; isUser?: boolean }> = ({ content, isUser }) => {
  if (isUser) {
    return <p className="whitespace-pre-wrap break-words leading-relaxed text-body-base">{content}</p>
  }

  const safeContent = content
    .replace(/```tool_call[\s\S]*?```/g, '')
    .replace(/```tool\b[\s\S]*?```/g, '')
    .replace(/```tool_call[\s\S]*$/g, '')
    .replace(/```tool\b[\s\S]*$/g, '')
    .replace(/\{\s*"name"\s*:\s*"[^"]*"[\s\S]*$/g, '')
    .trim()

  if (!safeContent) {
    return <div className="text-on-surface-variant/50 italic text-body-sm animate-pulse">Thinking...</div>
  }

  return (
    <div className="markdown-body text-body-base leading-relaxed">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code({ node, className, children, ...props }: any) {
            const match = /language-(\w+)/.exec(className || '')
            const codeString = String(children).replace(/\n$/, '')
            const isBlock = !!match || codeString.includes('\n')

            if (isBlock) {
              return (
                <div className="rounded-lg border border-outline-variant/50 overflow-hidden mb-md mt-sm bg-[#000000]/80 backdrop-blur-md">
                  <div className="flex items-center justify-between px-md py-xs bg-surface-container-high border-b border-outline-variant/50">
                    <span className="font-code-sm text-code-sm text-on-surface-variant">{match ? match[1] : 'code'}</span>
                    <CopyButton text={codeString} />
                  </div>
                  <SyntaxHighlighter
                    style={vscDarkPlus as any}
                    language={match ? match[1] : 'text'}
                    PreTag="div"
                    customStyle={{ margin: 0, padding: '12px', background: 'rgba(0,0,0,0.3)', fontSize: '12px', borderRadius: 0 }}
                    {...props}
                  >
                    {codeString}
                  </SyntaxHighlighter>
                </div>
              )
            }

            return (
              <code className="bg-surface-container-high text-primary-container px-1 py-0.5 rounded text-code-sm font-code-base" {...props}>
                {children}
              </code>
            )
          },
          table({ children }) { return <div className="overflow-x-auto my-2"><table className="w-full text-body-sm border-collapse">{children}</table></div> },
          th({ children }) { return <th className="border border-outline-variant/50 px-2 py-1 bg-surface-container-high text-left font-semibold">{children}</th> },
          td({ children }) { return <td className="border border-outline-variant/50 px-2 py-1">{children}</td> },
          blockquote({ children }) { return <blockquote className="border-l-2 border-primary/50 pl-sm my-sm text-on-surface-variant italic">{children}</blockquote> },
          a({ href, children }) {
            return (
              <a href={href} onClick={(e) => { e.preventDefault(); if (href) window.api?.openUrl?.(href) }} className="text-primary-container hover:underline cursor-pointer">
                {children}
              </a>
            )
          },
          h1: ({ children }) => <h1 className="text-headline-md font-bold mt-md mb-sm">{children}</h1>,
          h2: ({ children }) => <h2 className="text-body-base font-bold mt-md mb-sm">{children}</h2>,
          h3: ({ children }) => <h3 className="text-body-sm font-semibold mt-sm mb-xs">{children}</h3>,
          ul: ({ children }) => <ul className="list-disc list-inside space-y-0.5 my-sm">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal list-inside space-y-0.5 my-sm">{children}</ol>,
          li: ({ children }) => <li className="text-body-base">{children}</li>,
          p: ({ children }) => <p className="mb-sm last:mb-0">{children}</p>,
          hr: () => <hr className="border-outline-variant/30 my-md" />,
        }}
      >
        {safeContent}
      </ReactMarkdown>
    </div>
  )
}

// ── Copy Button ─────────────────────────────────────────────────────────────

const CopyButton: React.FC<{ text: string }> = ({ text }) => {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={async () => { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000) }}
      className="flex items-center gap-xs text-on-surface-variant hover:text-on-surface transition-colors"
    >
      <span className="material-symbols-outlined text-[14px]">{copied ? 'check' : 'content_copy'}</span>
      <span className="font-body-sm text-body-sm">{copied ? 'Copied' : 'Copy'}</span>
    </button>
  )
}
