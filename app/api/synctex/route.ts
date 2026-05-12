import { NextRequest, NextResponse } from 'next/server'
import path from 'path'
import { spawnSync } from 'child_process'
import fs from 'fs'

const PROJECTS_DIR = path.join(process.cwd(), 'projects')
const TEX_BIN = process.env.TEX_BIN_PATH ?? 'C:\\texlive\\2026\\bin\\windows'

function safeProjectDir(projectId: string): string | null {
  const resolved = path.resolve(PROJECTS_DIR, projectId)
  if (!resolved.startsWith(PROJECTS_DIR + path.sep) && resolved !== PROJECTS_DIR) return null
  return resolved
}

interface SyncTexRequest {
  projectId: string
  mainFile: string
  page: number
  x: number
  y: number
}

export async function POST(request: NextRequest) {
  const { projectId, mainFile, page, x, y } = await request.json() as SyncTexRequest

  const projectDir = safeProjectDir(projectId)
  if (!projectDir) return NextResponse.json({ ok: false, error: 'Invalid project ID' })

  const pdfPath = path.join(projectDir, '.build', mainFile.replace(/\.tex$/, '.pdf'))
  if (!fs.existsSync(pdfPath)) {
    return NextResponse.json({ ok: false, error: 'PDF not found — compile first' })
  }

  const synctexBin = path.join(TEX_BIN, process.platform === 'win32' ? 'synctex.exe' : 'synctex')
  const result = spawnSync(synctexBin, [
    'edit', '-o', `${page}:${Math.round(x)}:${Math.round(y)}:${pdfPath}`,
  ], { encoding: 'utf8' })

  const output = (result.stdout ?? '') + (result.stderr ?? '')
  const lineMatch = output.match(/^Line:(\d+)/m)
  const inputMatch = output.match(/^Input:(.+)/m)

  if (!lineMatch || !inputMatch) {
    return NextResponse.json({ ok: false, error: 'No SyncTeX result' })
  }

  const absInput = inputMatch[1].trim()
  const relFile = path.isAbsolute(absInput)
    ? path.relative(projectDir, absInput)
    : absInput

  return NextResponse.json({
    ok: true,
    file: relFile.replace(/\\/g, '/'),
    line: parseInt(lineMatch[1], 10),
  })
}
