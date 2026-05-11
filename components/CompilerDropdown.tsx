'use client'

import type { Engine } from '@/lib/types'

const ENGINES: { value: Engine; label: string }[] = [
  { value: 'pdflatex', label: 'pdflatex' },
  { value: 'xelatex', label: 'xelatex' },
  { value: 'lualatex', label: 'lualatex' },
  { value: 'tectonic', label: 'tectonic' },
]

interface CompilerDropdownProps {
  value: Engine
  onChange: (engine: Engine) => void
  disabled?: boolean
}

export default function CompilerDropdown({ value, onChange, disabled }: CompilerDropdownProps) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as Engine)}
      disabled={disabled}
      className="bg-zinc-800 border border-zinc-600 text-zinc-200 text-sm rounded px-2 py-1.5 focus:outline-none focus:border-indigo-500 disabled:opacity-50 font-mono"
    >
      {ENGINES.map((e) => (
        <option key={e.value} value={e.value}>
          {e.label}
        </option>
      ))}
    </select>
  )
}
