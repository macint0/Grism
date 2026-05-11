import { NextRequest } from 'next/server'
import { listProjectFiles } from '@/lib/projects'
import { buildSystemPrompt } from '@/lib/anthropic'

interface ChatRequest {
  messages: { role: 'user' | 'assistant'; content: string }[]
  projectId: string
  openFile: string
  openFileContent: string
}

const USE_MOCK = !process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY === 'your_api_key_here'

export async function POST(request: NextRequest) {
  const { messages, projectId, openFile, openFileContent } =
    await request.json() as ChatRequest

  const encoder = new TextEncoder()
  const lastUserMessage = messages.findLast((m) => m.role === 'user')?.content ?? ''

  const stream = new ReadableStream({
    async start(controller) {
      const send = (payload: object) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`))

      if (USE_MOCK) {
        const reply = `**Mock response** (add \`ANTHROPIC_API_KEY\` to \`.env.local\` to use real Claude)\n\nYou asked: "${lastUserMessage}"\n\nI can see you're editing \`${openFile}\` in project \`${projectId}\`.`
        for (const char of reply) {
          send({ text: char })
          await new Promise((r) => setTimeout(r, 8))
        }
        send({ done: true })
        controller.close()
        return
      }

      try {
        const { anthropic } = await import('@/lib/anthropic')
        const allFiles = listProjectFiles(projectId)
        const systemPrompt = buildSystemPrompt(projectId, openFile, openFileContent, allFiles)

        const response = anthropic.messages.stream({
          model: 'claude-sonnet-4-6',
          max_tokens: 4096,
          system: systemPrompt,
          messages,
        })

        for await (const event of response) {
          if (
            event.type === 'content_block_delta' &&
            event.delta.type === 'text_delta'
          ) {
            send({ text: event.delta.text })
          }
        }

        send({ done: true })
      } catch (err) {
        send({ error: err instanceof Error ? err.message : String(err) })
      } finally {
        controller.close()
      }
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
