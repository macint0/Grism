export type Engine = 'pdflatex' | 'xelatex' | 'lualatex' | 'tectonic'

// ── Compile ──────────────────────────────────────────────────────────────────

export interface CompileRequest {
  projectId: string
  engine: Engine
  mainFile: string
  content?: string // current editor content; saved to disk before compile
}

export interface CompileSuccess {
  ok: true
  pdf: string // base64-encoded PDF bytes
  log: string
}

export interface CompileFailure {
  ok: false
  log: string
}

export type CompileResult = CompileSuccess | CompileFailure

// ── Projects ─────────────────────────────────────────────────────────────────

export interface Project {
  id: string
  name: string
}

export interface ProjectCreateRequest {
  name: string
}

export interface ProjectDeleteRequest {
  id: string
}

// ── Files ─────────────────────────────────────────────────────────────────────

export interface FileSaveRequest {
  projectId: string
  file: string
  content: string
}

export interface FileCreateRequest {
  projectId: string
  file: string
}

export interface FileDeleteRequest {
  projectId: string
  file: string
}
