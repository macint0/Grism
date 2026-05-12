'use client'

import { useRef, useState } from 'react'

interface CompileLogProps {
  log: string
  ok: boolean
  onLineClick?: (line: number) => void
}

// ── Parser ────────────────────────────────────────────────────────────────────

interface LogError {
  message: string
  context?: string   // the l.N line content
  line?: number
  file?: string
}

interface LogWarning {
  message: string
  line?: number
  type: 'citation' | 'reference' | 'overfull' | 'underfull' | 'package' | 'other'
}

function isSystemPath(p: string) {
  const l = p.toLowerCase()
  return l.includes('texlive') || l.includes('texmf') || l.includes('/usr/') || l.includes('\\usr\\')
}

function parseLatexLog(log: string): { errors: LogError[]; warnings: LogWarning[] } {
  const lines = log.split('\n')
  const errors: LogError[] = []
  const warnings: LogWarning[] = []

  // Best-effort current project file at each line index
  let currentFile: string | undefined
  const fileAtLine: (string | undefined)[] = []
  for (const line of lines) {
    const m = line.match(/\(([^()\s]+\.tex)/)
    if (m && !isSystemPath(m[1])) {
      currentFile = m[1].replace(/\\/g, '/').split('/').pop()
    }
    fileAtLine.push(currentFile)
  }

  const SKIP = /^(See |Type |<recently|<to be|<inserted|<\*>|\s*\.\.\.|^\s*$)/

  let i = 0
  while (i < lines.length) {
    const line = lines[i]

    // ── Errors ────────────────────────────────────────────────────────────────
    if (line.startsWith('!')) {
      const message = line.slice(1).trim()
      let lineNum: number | undefined
      let context: string | undefined
      const file = fileAtLine[i]

      for (let j = i + 1; j < Math.min(i + 25, lines.length); j++) {
        const lm = lines[j].match(/^l\.(\d+)\s*(.*)/)
        if (lm) {
          lineNum = parseInt(lm[1], 10)
          // Combine the two halves that pdflatex shows split across two lines
          const nextLine = lines[j + 1] ?? ''
          context = (lm[2] + (nextLine.match(/^\s+\S/) ? nextLine.trim() : '')).trim()
          i = j + 1
          break
        }
      }

      // Deduplicate: same message+line already seen
      if (!errors.some(e => e.message === message && e.line === lineNum)) {
        errors.push({ message, line: lineNum, context: context || undefined, file })
      }
    }

    // ── Warnings ─────────────────────────────────────────────────────────────
    const wm = line.match(/^(?:LaTeX|Package \w+|Class \w+) Warning:\s*(.+)/)
    if (wm) {
      let msg = wm[1]
      // Collect continuation lines (indented)
      let j = i + 1
      while (j < lines.length && /^\s+\S/.test(lines[j])) {
        msg += ' ' + lines[j].trim()
        j++
      }
      msg = msg.trim().replace(/\.\s*$/, '')
      const lm = msg.match(/input line (\d+)/)
      const lineNum = lm ? parseInt(lm[1], 10) : undefined
      const type: LogWarning['type'] = msg.toLowerCase().includes('citation') ? 'citation'
        : msg.toLowerCase().includes('reference') || msg.toLowerCase().includes('label') ? 'reference'
        : 'package'

      if (!warnings.some(w => w.message === msg)) {
        warnings.push({ message: msg, line: lineNum, type })
      }
    }

    // Overfull / Underfull
    const bm = line.match(/^(Overfull|Underfull) \\([hv])box \(([^)]+)\)[^0-9]*(\d+)/)
    if (bm) {
      const msg = `${bm[1]} \\${bm[2]}box (${bm[3]})`
      const lineNum = parseInt(bm[4], 10)
      if (!warnings.some(w => w.message === msg && w.line === lineNum)) {
        warnings.push({ message: msg, line: lineNum, type: bm[1].toLowerCase() as 'overfull' | 'underfull' })
      }
    }

    i++
  }

  return { errors, warnings }
}

function filteredLog(log: string): string {
  return log
    .split('\n')
    .filter(line => {
      if (!line.trim()) return false
      if (/^\s*[\(\)]+\s*$/.test(line)) return false
      if (/^\s*\(c:[\\/]texlive/.test(line)) return false
      if (/^\s*\(\/usr/.test(line)) return false
      if (/^This is (pdf|Xe|Lua)TeX/.test(line)) return false
      if (/^LaTeX2e </.test(line)) return false
      if (/^L3 programming layer/.test(line)) return false
      if (/^\s*Document Class:/.test(line)) return false
      if (/^For additional information/.test(line)) return false
      if (/^Output written/.test(line)) return false
      if (/^Transcript written/.test(line)) return false
      if (/^<[a-z0-9:/\\. -]+\.(?:pfb|enc|map)>/.test(line)) return false
      return true
    })
    .join('\n')
}

// ── Component ─────────────────────────────────────────────────────────────────

const MIN_H = 28
const MAX_H = 600
const DEFAULT_H = 160

export default function CompileLog({ log, ok, onLineClick }: CompileLogProps) {
  const [height, setHeight] = useState(DEFAULT_H)
  const [showFull, setShowFull] = useState(false)
  const [expandWarnings, setExpandWarnings] = useState(false)
  const dragRef = useRef<{ startY: number; startH: number } | null>(null)

  const { errors, warnings } = parseLatexLog(log)
  const boxWarnings = warnings.filter(w => w.type === 'overfull' || w.type === 'underfull')
  const otherWarnings = warnings.filter(w => w.type !== 'overfull' && w.type !== 'underfull')

  function onDragStart(e: React.MouseEvent) {
    e.preventDefault()
    dragRef.current = { startY: e.clientY, startH: height }
    const onMove = (ev: MouseEvent) => {
      if (!dragRef.current) return
      setHeight(Math.min(MAX_H, Math.max(MIN_H, dragRef.current.startH + dragRef.current.startY - ev.clientY)))
    }
    const onUp = () => {
      dragRef.current = null
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  const borderColor = ok ? 'border-zinc-700' : 'border-red-900'
  const bgColor = ok ? 'bg-zinc-900' : 'bg-zinc-950'

  return (
    <div
      className={`shrink-0 border-t ${borderColor} ${bgColor} flex flex-col text-xs font-mono`}
      style={{ height }}
    >
      {/* Drag handle */}
      <div
        onMouseDown={onDragStart}
        className="h-1 shrink-0 cursor-row-resize hover:bg-indigo-500/40 transition-colors"
      />

      {/* Scrollable content */}
      <div className="flex-1 overflow-auto px-3 py-2 flex flex-col gap-2">

        {/* ── Errors ───────────────────────────────────────────────────────── */}
        {errors.length > 0 && (
          <div className="flex flex-col gap-1.5">
            {errors.map((err, idx) => (
              <div
                key={idx}
                className={`rounded border border-red-800 bg-red-950/60 px-3 py-2 flex flex-col gap-0.5 ${err.line && onLineClick ? 'cursor-pointer hover:border-red-600 transition-colors' : ''}`}
                onClick={() => err.line && onLineClick?.(err.line)}
              >
                <div className="flex items-start gap-2">
                  <span className="text-red-400 font-bold shrink-0">Error</span>
                  {err.file && <span className="text-zinc-500">{err.file}</span>}
                  {err.line && (
                    <span className="ml-auto text-red-500 shrink-0">line {err.line}</span>
                  )}
                </div>
                <div className="text-red-200">{err.message}</div>
                {err.context && (
                  <div className="text-zinc-500 truncate mt-0.5">{err.context}</div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* ── Success ──────────────────────────────────────────────────────── */}
        {ok && errors.length === 0 && (
          <div className="text-emerald-400 font-sans">
            Compiled successfully ✓
          </div>
        )}

        {/* ── Other warnings ───────────────────────────────────────────────── */}
        {otherWarnings.length > 0 && (
          <div className="flex flex-col gap-0.5">
            {otherWarnings.slice(0, expandWarnings ? undefined : 4).map((w, idx) => (
              <div
                key={idx}
                className={`flex gap-2 items-start text-amber-300/80 ${w.line && onLineClick ? 'cursor-pointer hover:text-amber-200 transition-colors' : ''}`}
                onClick={() => w.line && onLineClick?.(w.line)}
              >
                <span className="text-amber-500 shrink-0">⚠</span>
                <span className="flex-1 leading-relaxed">{w.message}</span>
                {w.line && <span className="text-zinc-500 shrink-0">:{w.line}</span>}
              </div>
            ))}
            {!expandWarnings && otherWarnings.length > 4 && (
              <button
                onClick={() => setExpandWarnings(true)}
                className="text-zinc-500 hover:text-zinc-300 text-left mt-0.5 transition-colors"
              >
                +{otherWarnings.length - 4} more warnings
              </button>
            )}
          </div>
        )}

        {/* ── Box warnings (collapsed by default) ──────────────────────────── */}
        {boxWarnings.length > 0 && (
          <div className="text-zinc-600">
            {boxWarnings.length} overfull/underfull box{boxWarnings.length !== 1 ? 'es' : ''}
            {' '}
            <button
              onClick={() => setExpandWarnings(v => !v)}
              className="underline hover:text-zinc-400 transition-colors"
            >
              {expandWarnings ? 'hide' : 'show'}
            </button>
            {expandWarnings && (
              <div className="mt-1 flex flex-col gap-0.5">
                {boxWarnings.map((w, idx) => (
                  <div
                    key={idx}
                    className={`flex gap-2 text-zinc-500 ${w.line && onLineClick ? 'cursor-pointer hover:text-zinc-300' : ''}`}
                    onClick={() => w.line && onLineClick?.(w.line)}
                  >
                    <span className="flex-1">{w.message}</span>
                    {w.line && <span>:{w.line}</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Full log toggle ───────────────────────────────────────────────── */}
        <div>
          <button
            onClick={() => setShowFull(v => !v)}
            className="text-zinc-600 hover:text-zinc-400 transition-colors"
          >
            {showFull ? '▲ hide' : '▼ full log'}
          </button>
          {showFull && (
            <pre className="mt-2 whitespace-pre-wrap text-zinc-500 leading-relaxed text-[11px]">
              {filteredLog(log)}
            </pre>
          )}
        </div>

      </div>
    </div>
  )
}
