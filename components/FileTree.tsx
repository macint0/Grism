'use client'

import { useState } from 'react'

interface FileTreeProps {
  projectId: string
  files: string[]
  activeFile: string
  onFileSelect: (file: string) => void
  onFileCreate: (name: string) => void
  onFileDelete: (file: string) => void
}

function fileIcon(name: string) {
  if (name.endsWith('.tex')) return '📄'
  if (name.endsWith('.bib')) return '📚'
  if (name.endsWith('.pdf')) return '📕'
  if (name.match(/\.(png|jpg|jpeg|gif|svg)$/)) return '🖼'
  return '📃'
}

export default function FileTree({
  files,
  activeFile,
  onFileSelect,
  onFileCreate,
  onFileDelete,
}: FileTreeProps) {
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')

  function submitCreate() {
    const name = newName.trim()
    if (name) onFileCreate(name)
    setNewName('')
    setCreating(false)
  }

  return (
    <div className="flex flex-col h-full text-sm select-none">
      <div className="px-3 py-2 text-xs font-semibold text-zinc-500 uppercase tracking-wider flex items-center justify-between">
        <span>Files</span>
        <button
          onClick={() => setCreating(true)}
          className="text-zinc-400 hover:text-zinc-100 transition-colors"
          title="New file"
        >
          +
        </button>
      </div>

      <div className="flex-1 overflow-auto">
        {files.map((file) => (
          <FileRow
            key={file}
            file={file}
            active={file === activeFile}
            onSelect={() => onFileSelect(file)}
            onDelete={() => onFileDelete(file)}
          />
        ))}

        {files.length === 0 && (
          <div className="px-3 py-2 text-zinc-500 text-xs">No files</div>
        )}
      </div>

      {creating && (
        <div className="px-3 py-2 border-t border-zinc-700">
          <input
            autoFocus
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submitCreate()
              if (e.key === 'Escape') { setCreating(false); setNewName('') }
            }}
            onBlur={submitCreate}
            placeholder="filename.tex"
            className="w-full bg-zinc-700 border border-zinc-500 rounded px-2 py-1 text-xs text-zinc-100 focus:outline-none focus:border-indigo-500"
          />
        </div>
      )}
    </div>
  )
}

function FileRow({
  file,
  active,
  onSelect,
  onDelete,
}: {
  file: string
  active: boolean
  onSelect: () => void
  onDelete: () => void
}) {
  const [hovered, setHovered] = useState(false)
  const parts = file.split('/')
  const name = parts[parts.length - 1]
  const depth = parts.length - 1

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => e.key === 'Enter' && onSelect()}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={`flex items-center gap-1.5 px-3 py-1.5 cursor-pointer transition-colors group ${
        active
          ? 'bg-indigo-600/30 text-zinc-100'
          : 'text-zinc-300 hover:bg-zinc-700/50 hover:text-zinc-100'
      }`}
      style={{ paddingLeft: `${12 + depth * 12}px` }}
    >
      <span className="text-xs">{fileIcon(name)}</span>
      <span className="flex-1 truncate font-mono text-xs">{name}</span>
      {hovered && (
        <button
          onClick={(e) => { e.stopPropagation(); onDelete() }}
          className="text-zinc-500 hover:text-red-400 transition-colors text-xs ml-1"
          title="Delete file"
        >
          ✕
        </button>
      )}
    </div>
  )
}
