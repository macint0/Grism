import { NextRequest, NextResponse } from 'next/server'
import path from 'path'
import fs from 'fs'
import { compileLatex } from '@/lib/latex'
import type { CompileRequest, CompileResult } from '@/lib/types'

const PROJECTS_DIR = path.join(process.cwd(), 'projects')

function safeProjectDir(projectId: string): string | null {
  const resolved = path.resolve(PROJECTS_DIR, projectId)
  if (!resolved.startsWith(PROJECTS_DIR + path.sep) && resolved !== PROJECTS_DIR) return null
  return resolved
}

export async function POST(request: NextRequest): Promise<NextResponse<CompileResult>> {
  const body = await request.json() as CompileRequest
  const { projectId, engine, mainFile, content } = body

  if (!projectId || !engine || !mainFile) {
    return NextResponse.json({ ok: false, log: 'Missing required fields' })
  }

  if (mainFile.includes('..') || path.isAbsolute(mainFile)) {
    return NextResponse.json({ ok: false, log: 'Invalid mainFile path' })
  }

  const projectDir = safeProjectDir(projectId)
  if (!projectDir) {
    return NextResponse.json({ ok: false, log: 'Invalid project ID' })
  }

  if (content !== undefined) {
    const filePath = path.join(projectDir, mainFile)
    fs.writeFileSync(filePath, content, 'utf8')
  }

  const result = await compileLatex(projectDir, mainFile, engine)

  if (!result.ok || !result.pdfPath) {
    return NextResponse.json({ ok: false, log: result.log })
  }

  const pdfBytes = fs.readFileSync(result.pdfPath)
  return NextResponse.json({
    ok: true,
    pdf: pdfBytes.toString('base64'),
    log: result.log,
  })
}
