'use client'

import { useEffect, useRef } from 'react'
import { EditorState } from '@codemirror/state'
import { EditorView, basicSetup } from 'codemirror'
import { StreamLanguage } from '@codemirror/language'
import { stex } from '@codemirror/legacy-modes/mode/stex'
import { oneDark } from '@codemirror/theme-one-dark'

interface EditorProps {
  value: string
  onChange: (value: string) => void
  jumpLine?: { line: number; key: number } | null
}

export default function Editor({ value, onChange, jumpLine }: EditorProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  useEffect(() => {
    if (!containerRef.current) return

    const state = EditorState.create({
      doc: value,
      extensions: [
        basicSetup,
        StreamLanguage.define(stex),
        oneDark,
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            onChangeRef.current(update.state.doc.toString())
          }
        }),
        EditorView.lineWrapping,
        EditorView.theme({
          '&': { height: '100%' },
          '.cm-scroller': { overflow: 'auto' },
        }),
      ],
    })

    const view = new EditorView({ state, parent: containerRef.current })
    viewRef.current = view

    return () => {
      view.destroy()
      viewRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    const current = view.state.doc.toString()
    if (current !== value) {
      view.dispatch({
        changes: { from: 0, to: current.length, insert: value },
      })
    }
  }, [value])

  useEffect(() => {
    const view = viewRef.current
    if (!view || !jumpLine) return
    const safeLineNo = Math.min(Math.max(1, jumpLine.line), view.state.doc.lines)
    const lineInfo = view.state.doc.line(safeLineNo)
    view.dispatch({
      selection: { anchor: lineInfo.from, head: lineInfo.to },
      effects: EditorView.scrollIntoView(lineInfo.from, { y: 'center' }),
    })
    view.focus()
  }, [jumpLine])

  return <div ref={containerRef} className="h-full w-full overflow-hidden" />
}
