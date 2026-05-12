import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { safeProjectDir, safeFilePath, listProjectFiles } from '@/lib/projects'
import type { FileSaveRequest, FileCreateRequest, FileDeleteRequest } from '@/lib/types'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const projectId = searchParams.get('projectId')
  const file = searchParams.get('file')

  if (!projectId) return NextResponse.json({ error: 'projectId required' }, { status: 400 })

  const projectDir = safeProjectDir(projectId)
  if (!projectDir) return NextResponse.json({ error: 'Invalid project' }, { status: 400 })

  if (!file) {
    return NextResponse.json({ files: listProjectFiles(projectId) })
  }

  const filePath = safeFilePath(projectDir, file)
  if (!filePath) return NextResponse.json({ error: 'Invalid file path' }, { status: 400 })

  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ error: 'File not found' }, { status: 404 })
  }

  const raw = searchParams.get('raw')
  if (raw === '1') {
    const MIME: Record<string, string> = {
      '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
      '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml',
      '.bmp': 'image/bmp', '.pdf': 'application/pdf',
    }
    const ext = path.extname(file).toLowerCase()
    const contentType = MIME[ext] ?? 'application/octet-stream'
    const data = fs.readFileSync(filePath)
    return new Response(new Uint8Array(data), {
      headers: { 'Content-Type': contentType, 'Cache-Control': 'no-store' },
    })
  }

  const content = fs.readFileSync(filePath, 'utf8')
  return NextResponse.json({ content })
}

export async function PUT(request: NextRequest) {
  const { projectId, file, content } = await request.json() as FileSaveRequest

  if (!projectId || !file || content === undefined) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }

  const projectDir = safeProjectDir(projectId)
  if (!projectDir) return NextResponse.json({ error: 'Invalid project' }, { status: 400 })

  const filePath = safeFilePath(projectDir, file)
  if (!filePath) return NextResponse.json({ error: 'Invalid file path' }, { status: 400 })

  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, content, 'utf8')
  return NextResponse.json({ ok: true })
}

export async function POST(request: NextRequest) {
  const { projectId, file } = await request.json() as FileCreateRequest

  if (!projectId || !file) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }

  const projectDir = safeProjectDir(projectId)
  if (!projectDir) return NextResponse.json({ error: 'Invalid project' }, { status: 400 })

  const filePath = safeFilePath(projectDir, file)
  if (!filePath) return NextResponse.json({ error: 'Invalid file path' }, { status: 400 })

  if (fs.existsSync(filePath)) {
    return NextResponse.json({ error: 'File already exists' }, { status: 409 })
  }

  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, '', 'utf8')
  return NextResponse.json({ ok: true })
}

export async function DELETE(request: NextRequest) {
  const { projectId, file } = await request.json() as FileDeleteRequest

  if (!projectId || !file) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }

  const projectDir = safeProjectDir(projectId)
  if (!projectDir) return NextResponse.json({ error: 'Invalid project' }, { status: 400 })

  const filePath = safeFilePath(projectDir, file)
  if (!filePath) return NextResponse.json({ error: 'Invalid file path' }, { status: 400 })

  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ error: 'File not found' }, { status: 404 })
  }

  fs.rmSync(filePath)
  return NextResponse.json({ ok: true })
}
