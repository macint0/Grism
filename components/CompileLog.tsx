'use client'

import { useRef, useState } from 'react'

interface CompileLogProps {
  log: string
  ok: boolean
}

function parseLog(log: string) {
  const errors: string[] = []
  const warnings: string[] = []
  const filtered: string[] = []
  const lines = log.split('\n')

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    if (line.startsWith('!')) {
      errors.push(line)
      if (lines[i + 1]?.match(/^l\.\d+/)) errors.push(lines[i + 1])
    } else if (line.match(/LaTeX Warning:|Package \w+ Warning:|Class \w+ Warning:/)) {
      warnings.push(line)
    }

    // Keep only meaningful lines; skip file-loading noise and font encoding detail
    const isFileNoise = /^\s*[\(\)]/.test(line) || /^[)( ]*$/.test(line)
    const isFontNoise = /^\s*(\[\]|\[\d+\]|\\[A-Z]|[A-Z][A-Z0-9]+\/[a-z]\/[a-z]\/\d+)/.test(line)
    if (!isFileNoise && !isFontNoise && line.trim()) filtered.push(line)
  }

  // Insert blank line between warning groups for readability
  const grouped: string[] = []
  for (let i = 0; i < filtered.length; i++) {
    grouped.push(filtered[i])
    const next = filtered[i + 1]
    if (next && (next.startsWith('!') || next.match(/Warning:|Overfull|Underfull/))) {
      grouped.push('')
    }
  }

  return { errors, warnings, filtered: grouped }
}

const MIN_H = 32
const MAX_H = 600
const DEFAULT_H = 120

export default function CompileLog({ log, ok }: CompileLogProps) {
  const [height, setHeight] = useState(DEFAULT_H)
  const [expanded, setExpanded] = useState(false)
  const dragRef = useRef<{ startY: number; startH: number } | null>(null)
  const { errors, warnings, filtered } = parseLog(log)

  function onDragStart(e: React.MouseEvent) {
    e.preventDefault()
    dragRef.current = { startY: e.clientY, startH: height }
    const onMove = (ev: MouseEvent) => {
      if (!dragRef.current) return
      const delta = dragRef.current.startY - ev.clientY
      setHeight(Math.min(MAX_H, Math.max(MIN_H, dragRef.current.startH + delta)))
    }
    const onUp = () => {
      dragRef.current = null
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  return (
    <div
      className={`shrink-0 border-t text-xs font-mono flex flex-col ${ok ? 'border-zinc-700 bg-zinc-900' : 'border-red-800 bg-red-950'}`}
      style={{ height }}
    >
      {/* Drag handle */}
      <div
        onMouseDown={onDragStart}
        className="h-1 cursor-row-resize hover:bg-indigo-500/40 transition-colors shrink-0"
      />

      {/* Header bar */}
      <div
        className={`flex items-center gap-3 px-3 py-1 cursor-pointer select-none shrink-0 ${ok ? 'text-zinc-400' : 'text-red-300'}`}
        onClick={() => setExpanded((e) => !e)}
      >
        {!ok && errors.length > 0 && (
          <span className="text-red-400 font-semibold">
            {errors.length} error{errors.length !== 1 ? 's' : ''}
          </span>
        )}
        {warnings.length > 0 && (
          <span className="text-amber-400">
            {warnings.length} warning{warnings.length !== 1 ? 's' : ''}
          </span>
        )}
        {ok && errors.length === 0 && warnings.length === 0 && (
          <span className="text-emerald-400">Compiled successfully ✓</span>
        )}
        <span className="ml-auto text-zinc-600">{expanded ? '▲' : '▼'} full log</span>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-auto px-3 pb-2">
        {/* Errors */}
        {!ok && errors.length > 0 && (
          <div className="space-y-1 mb-2">
            {errors.map((e, i) => (
              <div key={i} className="text-red-300 whitespace-pre-wrap">{e}</div>
            ))}
          </div>
        )}

        {/* Warnings summary (collapsed) */}
        {!expanded && warnings.length > 0 && (
          <div className="space-y-0.5">
            {warnings.slice(0, 5).map((w, i) => (
              <div key={i} className="text-amber-300/80 truncate">{w}</div>
            ))}
            {warnings.length > 5 && (
              <div className="text-zinc-500">…and {warnings.length - 5} more — click to expand</div>
            )}
          </div>
        )}

        {/* Full log (expanded) */}
        {expanded && (
          <pre className="whitespace-pre-wrap text-zinc-400 leading-relaxed">
            {filtered.join('\n')}
          </pre>
        )}
      </div>
    </div>
  )
}
