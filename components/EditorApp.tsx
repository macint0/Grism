'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import dynamic from 'next/dynamic'
import FileTree from './FileTree'
import CompilerDropdown from './CompilerDropdown'
import CompileLog from './CompileLog'
import type { Project, Engine, CompileResult } from '@/lib/types'

const Editor = dynamic(() => import('./Editor'), { ssr: false })
const PdfPreview = dynamic(() => import('./PdfPreview'), { ssr: false })

const IMAGE_EXTS = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.bmp']
function isImageFile(file: string): boolean {
  const lower = file.toLowerCase()
  return IMAGE_EXTS.some(ext => lower.endsWith(ext))
}

interface EditorAppProps {
  initialProjects: Project[]
}

export default function EditorApp({ initialProjects }: EditorAppProps) {
  const [projects, setProjects] = useState<Project[]>(initialProjects)
  const [activeProjectId, setActiveProjectId] = useState<string>(
    initialProjects[0]?.id ?? 'demo'
  )
  const [files, setFiles] = useState<string[]>([])
  const [activeFile, setActiveFile] = useState<string>('main.tex')
  const [content, setContent] = useState('')
  const [engine, setEngine] = useState<Engine>('pdflatex')
  const [pdfData, setPdfData] = useState<string | null>(null)
  const [log, setLog] = useState('')
  const [compiling, setCompiling] = useState(false)
  const [compileError, setCompileError] = useState(false)
  const [newProjectName, setNewProjectName] = useState('')
  const [creatingProject, setCreatingProject] = useState(false)
  const [renamingProject, setRenamingProject] = useState(false)
  const [renameValue, setRenameValue] = useState('')

  const savedRef = useRef<string>('')
  const contentRef = useRef<string>('')
  const [diskChanged, setDiskChanged] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [jumpLine, setJumpLine] = useState<{ line: number; key: number } | null>(null)

  const showToast = useCallback((msg: string) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    setToast(msg)
    toastTimerRef.current = setTimeout(() => setToast(null), 3000)
  }, [])

  // ── Load files when project changes ─────────────────────────────────────────

  const loadFiles = useCallback(async (projectId: string) => {
    const res = await fetch(`/api/files?projectId=${encodeURIComponent(projectId)}`)
    const data = await res.json() as { files: string[] }
    const fileList = data.files ?? []
    setFiles(fileList)
    const saved = localStorage.getItem(`grism:openFile:${projectId}`)
    const initial = (saved && fileList.includes(saved)) ? saved
      : fileList.includes('main.tex') ? 'main.tex'
      : fileList[0]
    if (initial) loadFile(projectId, initial)
    else { setActiveFile(''); setContent('') }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const loadFile = useCallback(async (projectId: string, file: string) => {
    setActiveFile(file)
    setPdfData(null)
    setLog('')
    if (isImageFile(file)) {
      savedRef.current = ''
      setContent('')
      return
    }
    const res = await fetch(
      `/api/files?projectId=${encodeURIComponent(projectId)}&file=${encodeURIComponent(file)}`
    )
    const data = await res.json() as { content?: string }
    const loaded = data.content ?? ''
    savedRef.current = loaded
    setContent(loaded)
  }, [])

  useEffect(() => { contentRef.current = content }, [content])

  useEffect(() => {
    if (activeFile) localStorage.setItem(`grism:openFile:${activeProjectId}`, activeFile)
  }, [activeProjectId, activeFile])

  useEffect(() => {
    loadFiles(activeProjectId)
  }, [activeProjectId, loadFiles])

  // ── Poll open file for external changes ──────────────────────────────────────

  useEffect(() => {
    if (!activeProjectId || !activeFile) return
    setDiskChanged(false)

    const poll = async () => {
      if (isImageFile(activeFile)) return
      try {
        const res = await fetch(
          `/api/files?projectId=${encodeURIComponent(activeProjectId)}&file=${encodeURIComponent(activeFile)}`
        )
        const data = await res.json() as { content?: string }
        const diskContent = data.content ?? ''
        if (diskContent === savedRef.current) return
        const hasUnsavedEdits = contentRef.current !== savedRef.current
        savedRef.current = diskContent
        if (!hasUnsavedEdits) {
          setContent(diskContent)
          showToast('File updated')
        } else {
          setDiskChanged(true)
        }
      } catch { /* ignore */ }
    }

    const interval = setInterval(poll, 1500)
    return () => { clearInterval(interval); setDiskChanged(false) }
  }, [activeProjectId, activeFile])

  // ── File actions ─────────────────────────────────────────────────────────────

  const handleFileSelect = useCallback(async (file: string) => {
    // Auto-save current file
    if (activeFile && !isImageFile(activeFile) && content !== savedRef.current) {
      await fetch('/api/files', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: activeProjectId, file: activeFile, content }),
      })
      savedRef.current = content
    }
    loadFile(activeProjectId, file)
  }, [activeFile, activeProjectId, content, loadFile])

  const handleFileCreate = useCallback(async (name: string) => {
    await fetch('/api/files', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId: activeProjectId, file: name }),
    })
    await loadFiles(activeProjectId)
    loadFile(activeProjectId, name)
  }, [activeProjectId, loadFiles, loadFile])

  const handleFileDelete = useCallback(async (file: string) => {
    await fetch('/api/files', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId: activeProjectId, file }),
    })
    const newFiles = files.filter((f) => f !== file)
    setFiles(newFiles)
    if (activeFile === file) {
      const next = newFiles[0]
      if (next) loadFile(activeProjectId, next)
      else { setActiveFile(''); setContent('') }
    }
  }, [activeProjectId, activeFile, files, loadFile])

  // ── Project actions ──────────────────────────────────────────────────────────

  const handleCreateProject = useCallback(async () => {
    const name = newProjectName.trim()
    if (!name) return
    const res = await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
    const project = await res.json() as Project
    setProjects((prev) => [...prev, project])
    setActiveProjectId(project.id)
    setNewProjectName('')
    setCreatingProject(false)
  }, [newProjectName])

  const handleRenameProject = useCallback(async (id: string, name: string) => {
    if (!name.trim()) return
    await fetch('/api/projects', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, name: name.trim() }),
    })
    setProjects((prev) => prev.map((p) => p.id === id ? { ...p, name: name.trim() } : p))
    setRenamingProject(false)
  }, [])

  const handleDeleteProject = useCallback(async (id: string) => {
    await fetch('/api/projects', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    const remaining = projects.filter((p) => p.id !== id)
    setProjects(remaining)
    if (activeProjectId === id && remaining.length > 0) {
      setActiveProjectId(remaining[0].id)
    }
  }, [activeProjectId, projects])

  // ── Compile ──────────────────────────────────────────────────────────────────

  const handleCompile = useCallback(async () => {
    setCompiling(true)
    setCompileError(false)
    try {
      const res = await fetch('/api/compile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: activeProjectId,
          engine,
          mainFile: activeFile,
          content,
        }),
      })
      const result = await res.json() as CompileResult
      setLog(result.log ?? '')
      if (result.ok) {
        setPdfData(result.pdf)
        setCompileError(false)
        savedRef.current = content
      } else {
        setCompileError(true)
      }
    } catch (e) {
      setLog(String(e))
      setCompileError(true)
    } finally {
      setCompiling(false)
    }
  }, [activeProjectId, engine, activeFile, content])

  // ── SyncTeX inverse search ───────────────────────────────────────────────────

  const handlePageClick = useCallback(async (page: number, pdfX: number, pdfY: number) => {
    const res = await fetch('/api/synctex', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId: activeProjectId, mainFile: activeFile, page, x: pdfX, y: pdfY }),
    })
    const data = await res.json() as { ok: boolean; file?: string; line?: number; error?: string }
    if (!data.ok || !data.line) return
    if (data.file && data.file !== activeFile && files.includes(data.file)) {
      await handleFileSelect(data.file)
      setTimeout(() => setJumpLine(prev => ({ line: data.line!, key: (prev?.key ?? 0) + 1 })), 150)
    } else {
      setJumpLine(prev => ({ line: data.line!, key: (prev?.key ?? 0) + 1 }))
    }
  }, [activeProjectId, activeFile, files, handleFileSelect])

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-zinc-700 bg-zinc-900 shrink-0">
        <span className="text-zinc-100 font-semibold tracking-tight shrink-0">Prism</span>

        {/* Project selector */}
        {renamingProject ? (
          <input
            autoFocus
            type="text"
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleRenameProject(activeProjectId, renameValue)
              if (e.key === 'Escape') setRenamingProject(false)
            }}
            onBlur={() => handleRenameProject(activeProjectId, renameValue)}
            className="bg-zinc-700 border border-indigo-500 text-zinc-100 text-sm rounded px-2 py-1.5 focus:outline-none w-36"
          />
        ) : (
          <div className="flex items-center gap-1">
            <select
              value={activeProjectId}
              onChange={(e) => setActiveProjectId(e.target.value)}
              className="bg-zinc-800 border border-zinc-600 text-zinc-200 text-sm rounded px-2 py-1.5 focus:outline-none focus:border-indigo-500 max-w-[140px] truncate"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <button
              onClick={() => { setRenameValue(projects.find(p => p.id === activeProjectId)?.name ?? ''); setRenamingProject(true) }}
              className="text-zinc-500 hover:text-zinc-200 text-xs transition-colors"
              title="Rename project"
            >
              ✏
            </button>
          </div>
        )}

        {/* New project */}
        {creatingProject ? (
          <div className="flex items-center gap-1">
            <input
              autoFocus
              type="text"
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreateProject()
                if (e.key === 'Escape') { setCreatingProject(false); setNewProjectName('') }
              }}
              placeholder="Project name"
              className="bg-zinc-700 border border-zinc-500 rounded px-2 py-1 text-xs text-zinc-100 w-32 focus:outline-none focus:border-indigo-500"
            />
            <button
              onClick={handleCreateProject}
              className="text-xs text-zinc-400 hover:text-zinc-100 px-1"
            >
              ✓
            </button>
            <button
              onClick={() => { setCreatingProject(false); setNewProjectName('') }}
              className="text-xs text-zinc-400 hover:text-zinc-100 px-1"
            >
              ✕
            </button>
          </div>
        ) : (
          <button
            onClick={() => setCreatingProject(true)}
            className="text-zinc-500 hover:text-zinc-200 text-sm px-1 transition-colors"
            title="New project"
          >
            +
          </button>
        )}

        {/* Delete project (not demo) */}
        {activeProjectId !== 'demo' && (
          <button
            onClick={() => handleDeleteProject(activeProjectId)}
            className="text-zinc-600 hover:text-red-400 text-xs transition-colors"
            title="Delete project"
          >
            🗑
          </button>
        )}

        <div className="flex-1" />

        <CompilerDropdown value={engine} onChange={setEngine} disabled={compiling} />

        <button
          onClick={handleCompile}
          disabled={compiling || !activeFile || isImageFile(activeFile)}
          className="px-4 py-1.5 rounded bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-medium transition-colors shrink-0"
        >
          {compiling ? 'Compiling…' : 'Compile'}
        </button>

      </div>

      {/* 3-column body */}
      <div className="flex flex-1 min-h-0">
        {/* File tree */}
        <div className="w-44 shrink-0 bg-zinc-900 border-r border-zinc-700 flex flex-col min-h-0">
          <FileTree
            projectId={activeProjectId}
            files={files}
            activeFile={activeFile}
            onFileSelect={handleFileSelect}
            onFileCreate={handleFileCreate}
            onFileDelete={handleFileDelete}
            onFileUploaded={() => loadFiles(activeProjectId)}
          />
        </div>

        {/* Editor */}
        <div className="flex-1 flex flex-col min-h-0 border-r border-zinc-700">
          {!activeFile ? (
            <div className="flex h-full items-center justify-center text-zinc-500 text-sm">
              No file open
            </div>
          ) : isImageFile(activeFile) ? (
            <div className="flex h-full items-center justify-center overflow-auto bg-zinc-950 p-6">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/api/files?projectId=${encodeURIComponent(activeProjectId)}&file=${encodeURIComponent(activeFile)}&raw=1`}
                alt={activeFile}
                className="max-w-full max-h-full object-contain rounded shadow-lg"
              />
            </div>
          ) : (
            <Editor value={content} onChange={setContent} jumpLine={jumpLine} />
          )}
        </div>

        {/* PDF preview */}
        <div className="shrink-0 flex flex-col min-h-0 bg-zinc-800 w-[45%]">
          <PdfPreview pdfData={pdfData} onPageClick={handlePageClick} />
        </div>

      </div>

      {/* Disk-change banner */}
      {diskChanged && (
        <div className="shrink-0 flex items-center gap-3 px-4 py-2 bg-amber-900/60 border-t border-amber-700 text-amber-200 text-sm">
          <span>File changed on disk.</span>
          <button
            onClick={() => { loadFile(activeProjectId, activeFile); setDiskChanged(false) }}
            className="underline hover:text-white transition-colors"
          >
            Reload
          </button>
          <button
            onClick={() => setDiskChanged(false)}
            className="text-amber-400 hover:text-white transition-colors ml-auto"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Log panel */}
      {log && (
        <CompileLog
          log={log}
          ok={!compileError}
          onLineClick={(line) => setJumpLine(prev => ({ line, key: (prev?.key ?? 0) + 1 }))}
        />
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-5 right-5 z-50 bg-indigo-600 text-white text-sm px-4 py-2 rounded shadow-lg pointer-events-none">
          {toast}
        </div>
      )}
    </div>
  )
}
