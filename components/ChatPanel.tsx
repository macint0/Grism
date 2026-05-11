'use client'

import { useState, useRef, useEffect, useCallback } from 'react'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

interface ChatPanelProps {
  projectId: string
  openFile: string
  openFileContent: string
}

export default function ChatPanel({ projectId, openFile, openFileContent }: ChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const send = useCallback(async () => {
    const text = input.trim()
    if (!text || streaming) return

    const userMessage: Message = { role: 'user', content: text }
    const nextMessages = [...messages, userMessage]
    setMessages(nextMessages)
    setInput('')
    setStreaming(true)

    const assistantPlaceholder: Message = { role: 'assistant', content: '' }
    setMessages([...nextMessages, assistantPlaceholder])

    const abort = new AbortController()
    abortRef.current = abort

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: abort.signal,
        body: JSON.stringify({
          messages: nextMessages,
          projectId,
          openFile,
          openFileContent,
        }),
      })

      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const payload = JSON.parse(line.slice(6)) as {
            text?: string
            done?: boolean
            error?: string
          }

          if (payload.error) {
            setMessages((prev) => {
              const copy = [...prev]
              copy[copy.length - 1] = { role: 'assistant', content: `Error: ${payload.error}` }
              return copy
            })
            break
          }

          if (payload.text) {
            setMessages((prev) => {
              const copy = [...prev]
              copy[copy.length - 1] = {
                role: 'assistant',
                content: copy[copy.length - 1].content + payload.text,
              }
              return copy
            })
          }
        }
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setMessages((prev) => {
          const copy = [...prev]
          copy[copy.length - 1] = {
            role: 'assistant',
            content: `Error: ${String(err)}`,
          }
          return copy
        })
      }
    } finally {
      setStreaming(false)
      abortRef.current = null
    }
  }, [input, messages, streaming, projectId, openFile, openFileContent])

  return (
    <div className="flex flex-col h-full bg-zinc-900">
      {/* Header */}
      <div className="px-3 py-2 border-b border-zinc-700 text-xs font-semibold text-zinc-400 uppercase tracking-wider shrink-0">
        Claude
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-auto p-3 flex flex-col gap-3">
        {messages.length === 0 && (
          <div className="text-zinc-500 text-xs text-center mt-8">
            Ask Claude about your document
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            className={`text-sm leading-relaxed ${
              msg.role === 'user'
                ? 'text-zinc-100 bg-zinc-800 rounded-lg px-3 py-2 self-end max-w-[90%]'
                : 'text-zinc-300 self-start max-w-[95%]'
            }`}
          >
            <MessageContent content={msg.content} />
            {msg.role === 'assistant' && streaming && i === messages.length - 1 && (
              <span className="inline-block w-1.5 h-3.5 bg-zinc-400 ml-0.5 animate-pulse align-middle" />
            )}
          </div>
        ))}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="shrink-0 border-t border-zinc-700 p-3 flex gap-2">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              send()
            }
          }}
          placeholder="Ask about your document… (Enter to send)"
          rows={2}
          className="flex-1 bg-zinc-800 border border-zinc-600 rounded px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 resize-none focus:outline-none focus:border-indigo-500"
        />
        <button
          onClick={streaming ? () => abortRef.current?.abort() : send}
          className={`px-3 py-2 rounded text-sm font-medium transition-colors self-end ${
            streaming
              ? 'bg-red-700 hover:bg-red-600 text-white'
              : 'bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-50'
          }`}
          disabled={!streaming && !input.trim()}
        >
          {streaming ? 'Stop' : 'Send'}
        </button>
      </div>
    </div>
  )
}

function MessageContent({ content }: { content: string }) {
  if (!content) return null

  // Split on code blocks and render them distinctly
  const parts = content.split(/(```[\s\S]*?```)/g)

  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('```')) {
          const firstNewline = part.indexOf('\n')
          const code = firstNewline >= 0 ? part.slice(firstNewline + 1, -3) : part.slice(3, -3)
          return (
            <pre key={i} className="bg-zinc-950 rounded p-2 text-xs overflow-auto my-1 text-zinc-200 font-mono">
              {code}
            </pre>
          )
        }
        return <span key={i} style={{ whiteSpace: 'pre-wrap' }}>{part}</span>
      })}
    </>
  )
}
