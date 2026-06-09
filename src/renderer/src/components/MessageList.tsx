import React, { useEffect, useRef, memo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { Copy, Check, Bot, User } from 'lucide-react'
import { Message } from '../types'
import { cn } from '../utils/cn'

interface MessageListProps {
  messages: Message[]
  streamingContent?: string
}

export const MessageList: React.FC<MessageListProps> = ({ messages, streamingContent }) => {
  const scrollRef = useRef<HTMLDivElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length, streamingContent])

  const visibleMessages = messages.filter((m) => m.role !== 'system')

  // Показываем typing indicator только когда streaming-сообщение есть, но контент ещё пустой
  const showTypingIndicator = messages.some((m) => m.streaming && !m.content) && !streamingContent

  // Индекс последнего streaming-сообщения — оно получает streamingContent вместо message.content
  const lastStreamingIdx = visibleMessages.reduce(
    (last, msg, i) => (msg.streaming ? i : last),
    -1
  )

  return (
    <div
      ref={scrollRef}
      className="flex-1 overflow-y-auto px-3 py-4 space-y-3"
    >
      {visibleMessages.length === 0 && !streamingContent && (
        <EmptyState />
      )}

      <AnimatePresence initial={false}>
        {visibleMessages.map((msg, i) => (
          <MessageBubble
            key={msg.id}
            message={msg}
            // Для последнего streaming-сообщения используем streamingContent из пропа
            // чтобы отображать уже очищенный от tool_call текст
            overrideContent={i === lastStreamingIdx && streamingContent !== undefined
              ? streamingContent
              : undefined
            }
          />
        ))}
      </AnimatePresence>

      {/* Typing indicator — только пока нет контента */}
      {showTypingIndicator && (
        <TypingIndicator />
      )}

      <div ref={bottomRef} />
    </div>
  )
}

// ── Empty State ───────────────────────────────────────────────────────────────

const EmptyState: React.FC = () => (
  <div className="flex flex-col items-center justify-center h-full py-12 text-center">
    <div className="w-12 h-12 rounded-2xl bg-accent/20 flex items-center justify-center mb-4">
      <Bot size={24} className="text-accent" />
    </div>
    <h3 className="text-sm font-semibold text-white/70 mb-1">How can I help?</h3>
    <p className="text-xs text-white/30 max-w-[200px]">
      Ask me anything. I can write code, answer questions, and more.
    </p>
  </div>
)

// ── Typing Indicator ──────────────────────────────────────────────────────────

const TypingIndicator: React.FC = () => (
  <div className="flex items-center gap-2 px-1">
    <div className="w-6 h-6 rounded-full bg-accent/20 flex items-center justify-center">
      <Bot size={12} className="text-accent" />
    </div>
    <div className="flex gap-1">
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          className="w-1.5 h-1.5 rounded-full bg-white/40"
          animate={{ opacity: [0.3, 1, 0.3], y: [0, -3, 0] }}
          transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.15 }}
        />
      ))}
    </div>
  </div>
)

// ── Message Bubble ────────────────────────────────────────────────────────────

interface MessageBubbleProps {
  message: Message
  overrideContent?: string
}

const MessageBubble: React.FC<MessageBubbleProps> = memo(({ message, overrideContent }) => {
  const isUser = message.role === 'user'
  // Используем overrideContent если передан (для streaming — уже очищенный от tool_call)
  const displayContent = overrideContent !== undefined ? overrideContent : message.content

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={cn('flex gap-2', isUser ? 'flex-row-reverse' : 'flex-row')}
    >
      {/* Avatar */}
      <div
        className={cn(
          'w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5',
          isUser ? 'bg-accent/30' : 'bg-white/10'
        )}
      >
        {isUser ? (
          <User size={12} className="text-accent" />
        ) : (
          <Bot size={12} className="text-white/60" />
        )}
      </div>

      {/* Bubble */}
      <div
        className={cn(
          'group relative max-w-[82%] rounded-2xl px-3 py-2.5 text-sm',
          isUser
            ? 'bg-accent text-white rounded-tr-sm'
            : 'bg-white/8 text-white/90 rounded-tl-sm border border-white/5',
          message.streaming && displayContent && 'animate-pulse-subtle'
        )}
      >
        <MarkdownContent content={displayContent} isUser={isUser} />

        {/* Copy button */}
        {!isUser && displayContent && !message.streaming && (
          <CopyButton text={displayContent} />
        )}
      </div>
    </motion.div>
  )
})

MessageBubble.displayName = 'MessageBubble'

// ── Copy Button ───────────────────────────────────────────────────────────────

const CopyButton: React.FC<{ text: string }> = ({ text }) => {
  const [copied, setCopied] = React.useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button
      onClick={handleCopy}
      className="absolute -top-2 -right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-white/10 hover:bg-white/20 rounded-md p-1"
      title="Copy"
    >
      {copied ? (
        <Check size={11} className="text-green-400" />
      ) : (
        <Copy size={11} className="text-white/50" />
      )}
    </button>
  )
}

// ── Markdown Renderer ─────────────────────────────────────────────────────────

interface MarkdownContentProps {
  content: string
  isUser?: boolean
}

const MarkdownContent: React.FC<MarkdownContentProps> = ({ content, isUser }) => {
  if (isUser) {
    return (
      <p className="whitespace-pre-wrap break-words leading-relaxed text-[13px]">{content}</p>
    )
  }

  // Последний рубеж защиты — убираем tool_call блоки перед рендерингом
  const safeContent = content
    .replace(/```tool_call[\s\S]*?```/g, '')
    .replace(/```tool\b[\s\S]*?```/g, '')
    .replace(/```tool_call[\s\S]*$/g, '')
    .replace(/```tool\b[\s\S]*$/g, '')
    .replace(/\{\s*"name"\s*:\s*"[^"]*"[\s\S]*$/g, '')
    .trim()

  if (!safeContent) {
    return <div className="text-white/30 italic text-[12px] animate-pulse">Thinking...</div>
  }

  return (
    <div className="markdown-body text-[13px] leading-relaxed">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code({ node, className, children, ...props }: any) {
            const match = /language-(\w+)/.exec(className || '')
            const codeString = String(children).replace(/\n$/, '')
            // Block code: has a language class OR contains newlines
            const isBlock = !!match || codeString.includes('\n')

            if (isBlock) {
              return (
                <div className="relative group/code my-2 rounded-lg overflow-hidden">
                  <div className="flex items-center justify-between px-3 py-1.5 bg-white/5 border-b border-white/5">
                    <span className="text-[10px] text-white/30 font-mono">
                      {match ? match[1] : 'code'}
                    </span>
                    <CopyButton text={codeString} />
                  </div>
                  <SyntaxHighlighter
                    style={vscDarkPlus as any}
                    language={match ? match[1] : 'text'}
                    PreTag="div"
                    customStyle={{
                      margin: 0,
                      padding: '12px',
                      background: 'rgba(0,0,0,0.3)',
                      fontSize: '12px',
                      borderRadius: 0
                    }}
                    {...props}
                  >
                    {codeString}
                  </SyntaxHighlighter>
                </div>
              )
            }

            return (
              <code
                className="bg-white/10 text-accent px-1 py-0.5 rounded text-[12px] font-mono"
                {...props}
              >
                {children}
              </code>
            )
          },

          // Tables
          table({ children }) {
            return (
              <div className="overflow-x-auto my-2">
                <table className="w-full text-[12px] border-collapse">{children}</table>
              </div>
            )
          },
          th({ children }) {
            return (
              <th className="border border-white/10 px-2 py-1 bg-white/5 text-left font-semibold">
                {children}
              </th>
            )
          },
          td({ children }) {
            return <td className="border border-white/10 px-2 py-1">{children}</td>
          },

          // Blockquote
          blockquote({ children }) {
            return (
              <blockquote className="border-l-2 border-accent/50 pl-3 my-2 text-white/60 italic">
                {children}
              </blockquote>
            )
          },

          // Links — open in default browser
          a({ href, children }) {
            return (
              <a
                href={href}
                onClick={(e) => {
                  e.preventDefault()
                  if (href) window.api?.openUrl?.(href)
                }}
                className="text-accent hover:underline cursor-pointer"
              >
                {children}
              </a>
            )
          },

          // Headings
          h1: ({ children }) => <h1 className="text-base font-bold mt-3 mb-1">{children}</h1>,
          h2: ({ children }) => <h2 className="text-sm font-bold mt-2 mb-1">{children}</h2>,
          h3: ({ children }) => <h3 className="text-sm font-semibold mt-2 mb-1">{children}</h3>,

          // Lists
          ul: ({ children }) => <ul className="list-disc list-inside space-y-0.5 my-1">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal list-inside space-y-0.5 my-1">{children}</ol>,
          li: ({ children }) => <li className="text-[13px]">{children}</li>,

          // Paragraph
          p: ({ children }) => <p className="mb-1.5 last:mb-0">{children}</p>,

          // Horizontal rule
          hr: () => <hr className="border-white/10 my-3" />
        }}
      >
        {safeContent}
      </ReactMarkdown>
    </div>
  )
}
