'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import dynamic from 'next/dynamic'
import FileTree from './FileTree'
import CompilerDropdown from './CompilerDropdown'
import ChatPanel from './ChatPanel'
import type { Project, Engine, CompileResult } from '@/lib/types'

const Editor = dynamic(() => import('./Editor'), { ssr: false })
const PdfPreview = dynamic(() => import('./PdfPreview'), { ssr: false })

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
  const [chatOpen, setChatOpen] = useState(false)

  const savedRef = useRef<string>('')

  // ── Load files when project changes ─────────────────────────────────────────

  const loadFiles = useCallback(async (projectId: string) => {
    const res = await fetch(`/api/files?projectId=${encodeURIComponent(projectId)}`)
    const data = await res.json() as { files: string[] }
    const fileList = data.files ?? []
    setFiles(fileList)
    const main = fileList.includes('main.tex') ? 'main.tex' : fileList[0]
    if (main) loadFile(projectId, main)
    else { setActiveFile(''); setContent('') }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const loadFile = useCallback(async (projectId: string, file: string) => {
    const res = await fetch(
      `/api/files?projectId=${encodeURIComponent(projectId)}&file=${encodeURIComponent(file)}`
    )
    const data = await res.json() as { content?: string }
    const loaded = data.content ?? ''
    savedRef.current = loaded
    setActiveFile(file)
    setContent(loaded)
    setPdfData(null)
    setLog('')
  }, [])

  useEffect(() => {
    loadFiles(activeProjectId)
  }, [activeProjectId, loadFiles])

  // ── File actions ─────────────────────────────────────────────────────────────

  const handleFileSelect = useCallback(async (file: string) => {
    // Auto-save current file
    if (activeFile && content !== savedRef.current) {
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

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-zinc-700 bg-zinc-900 shrink-0">
        <span className="text-zinc-100 font-semibold tracking-tight shrink-0">Prism</span>

        {/* Project selector */}
        <select
          value={activeProjectId}
          onChange={(e) => setActiveProjectId(e.target.value)}
          className="bg-zinc-800 border border-zinc-600 text-zinc-200 text-sm rounded px-2 py-1.5 focus:outline-none focus:border-indigo-500 max-w-[160px] truncate"
        >
          {projects.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>

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
          disabled={compiling || !activeFile}
          className="px-4 py-1.5 rounded bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-medium transition-colors shrink-0"
        >
          {compiling ? 'Compiling…' : 'Compile'}
        </button>

        <button
          onClick={() => setChatOpen((o) => !o)}
          className={`px-3 py-1.5 rounded text-sm font-medium transition-colors shrink-0 ${
            chatOpen
              ? 'bg-violet-600 hover:bg-violet-500 text-white'
              : 'bg-zinc-700 hover:bg-zinc-600 text-zinc-200'
          }`}
        >
          Claude
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
          />
        </div>

        {/* Editor */}
        <div className="flex-1 flex flex-col min-h-0 border-r border-zinc-700">
          {activeFile ? (
            <Editor value={content} onChange={setContent} />
          ) : (
            <div className="flex h-full items-center justify-center text-zinc-500 text-sm">
              No file open
            </div>
          )}
        </div>

        {/* PDF preview */}
        <div className={`shrink-0 flex flex-col min-h-0 bg-zinc-800 ${chatOpen ? 'w-[35%]' : 'w-[45%]'}`}>
          <PdfPreview pdfData={pdfData} />
        </div>

        {/* Chat panel */}
        {chatOpen && (
          <div className="w-72 shrink-0 flex flex-col min-h-0 border-l border-zinc-700">
            <ChatPanel
              projectId={activeProjectId}
              openFile={activeFile}
              openFileContent={content}
            />
          </div>
        )}
      </div>

      {/* Log panel */}
      {log && (
        <div className={`shrink-0 max-h-40 overflow-auto font-mono text-xs p-3 border-t ${
          compileError
            ? 'bg-red-950 border-red-800 text-red-300'
            : 'bg-zinc-900 border-zinc-700 text-zinc-400'
        }`}>
          <pre className="whitespace-pre-wrap">{log}</pre>
        </div>
      )}
    </div>
  )
}
