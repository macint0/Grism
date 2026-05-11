import { NextRequest } from 'next/server'
import fs from 'fs'
import path from 'path'

const PROJECTS_DIR = path.join(process.cwd(), 'projects')

function resolveFilePath(projectId: string, file: string): string | null {
  if (!projectId || projectId.includes('..') || path.isAbsolute(projectId)) return null
  const projectDir = path.resolve(PROJECTS_DIR, projectId)
  if (!projectDir.startsWith(PROJECTS_DIR + path.sep)) return null
  if (!file || file.includes('..') || path.isAbsolute(file)) return null
  const resolved = path.resolve(projectDir, file)
  if (!resolved.startsWith(projectDir + path.sep)) return null
  return resolved
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const projectId = searchParams.get('projectId') ?? ''
  const file = searchParams.get('file') ?? ''

  const filePath = resolveFilePath(projectId, file)
  if (!filePath) return new Response('Invalid path', { status: 400 })

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    start(controller) {
      const send = (payload: object) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`))
        } catch {
          // stream already closed
        }
      }

      send({ connected: true })

      let debounce: ReturnType<typeof setTimeout> | null = null
      let watcher: fs.FSWatcher | null = null

      try {
        watcher = fs.watch(filePath, (eventType) => {
          if (eventType !== 'change') return
          if (debounce) clearTimeout(debounce)
          debounce = setTimeout(() => send({ changed: true }), 100)
        })
      } catch {
        // file may not exist yet — no watcher
      }

      request.signal.addEventListener('abort', () => {
        if (debounce) clearTimeout(debounce)
        watcher?.close()
        try { controller.close() } catch { /* already closed */ }
      })
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}
