import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { safeProjectDir } from '@/lib/projects'

const ALLOWED_TYPES = new Set([
  'image/png', 'image/jpeg', 'image/gif', 'image/svg+xml', 'application/pdf',
])

const PNG_SIG = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
const STRIP_CHUNKS = new Set(['iCCP', 'sRGB', 'cHRM', 'gAMA'])

function stripPngColorChunks(buf: Buffer): Buffer {
  if (!buf.subarray(0, 8).equals(PNG_SIG)) return buf
  const out: Buffer[] = [PNG_SIG]
  let offset = 8
  while (offset + 12 <= buf.length) {
    const len = buf.readUInt32BE(offset)
    const type = buf.toString('ascii', offset + 4, offset + 8)
    const total = 4 + 4 + len + 4
    if (!STRIP_CHUNKS.has(type)) out.push(buf.subarray(offset, offset + total))
    offset += total
    if (type === 'IEND') break
  }
  return Buffer.concat(out)
}

export async function POST(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const projectId = searchParams.get('projectId') ?? ''

  const projectDir = safeProjectDir(projectId)
  if (!projectDir) return NextResponse.json({ error: 'Invalid project' }, { status: 400 })

  const formData = await request.formData()
  const file = formData.get('file')
  if (!file || typeof file === 'string') {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  }

  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json({ error: 'File type not allowed' }, { status: 400 })
  }

  const safeName = path.basename(file.name).replace(/[^a-zA-Z0-9._-]/g, '_')
  const destPath = path.join(projectDir, safeName)

  let buffer = Buffer.from(await file.arrayBuffer())
  if (file.type === 'image/png') buffer = stripPngColorChunks(buffer)
  fs.writeFileSync(destPath, buffer)

  return NextResponse.json({ ok: true, file: safeName })
}
