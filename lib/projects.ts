import fs from 'fs'
import path from 'path'
import type { Project } from './types'

export const PROJECTS_DIR = path.join(process.cwd(), 'projects')

const DEMO_TEX = `\\documentclass{article}
\\usepackage{amsmath}

\\title{New Project}
\\author{You}
\\date{\\today}

\\begin{document}

\\maketitle

\\section{Introduction}
Start writing your document here.

\\end{document}
`

export function safeProjectDir(projectId: string): string | null {
  if (!projectId || projectId.includes('..') || path.isAbsolute(projectId)) return null
  const resolved = path.resolve(PROJECTS_DIR, projectId)
  const base = PROJECTS_DIR + path.sep
  if (!resolved.startsWith(base)) return null
  return resolved
}

export function safeFilePath(projectDir: string, filePath: string): string | null {
  if (!filePath || filePath.includes('..') || path.isAbsolute(filePath)) return null
  const resolved = path.resolve(projectDir, filePath)
  const base = projectDir + path.sep
  if (!resolved.startsWith(base)) return null
  return resolved
}

function readName(projectDir: string, id: string): string {
  try {
    const meta = JSON.parse(fs.readFileSync(path.join(projectDir, '.prism.json'), 'utf8'))
    return meta.name ?? id
  } catch {
    return id
  }
}

function writeName(projectDir: string, name: string): void {
  fs.writeFileSync(path.join(projectDir, '.prism.json'), JSON.stringify({ name }), 'utf8')
}

export function listProjects(): Project[] {
  fs.mkdirSync(PROJECTS_DIR, { recursive: true })
  return fs
    .readdirSync(PROJECTS_DIR, { withFileTypes: true })
    .filter((e) => e.isDirectory() && !e.name.startsWith('.'))
    .map((e) => {
      const dir = path.join(PROJECTS_DIR, e.name)
      return { id: e.name, name: readName(dir, e.name) }
    })
}

export function createProject(name: string): Project {
  const id = name
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .slice(0, 40)
    + '-' + Date.now()

  const projectDir = path.join(PROJECTS_DIR, id)
  fs.mkdirSync(projectDir, { recursive: true })
  writeName(projectDir, name)
  fs.writeFileSync(path.join(projectDir, 'main.tex'), DEMO_TEX, 'utf8')
  return { id, name }
}

export function deleteProject(id: string): void {
  const projectDir = safeProjectDir(id)
  if (!projectDir) throw new Error('Invalid project ID')
  fs.rmSync(projectDir, { recursive: true, force: true })
}

export function listProjectFiles(projectId: string): string[] {
  const projectDir = safeProjectDir(projectId)
  if (!projectDir || !fs.existsSync(projectDir)) return []
  return walkDir(projectDir, projectDir)
}

function walkDir(dir: string, root: string): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  const files: string[] = []
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue
    const full = path.join(dir, entry.name)
    const rel = path.relative(root, full)
    if (entry.isDirectory()) {
      files.push(...walkDir(full, root))
    } else {
      files.push(rel)
    }
  }
  return files.sort()
}
