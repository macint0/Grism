import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import fs from 'fs'
import path from 'path'
import { spawn, spawnSync } from 'child_process'

const PROJECTS_DIR = path.join(import.meta.dirname, '..', 'projects')
const TEX_BIN = process.env.TEX_BIN_PATH ?? 'C:\\texlive\\2026\\bin\\windows'

// ── Path safety ───────────────────────────────────────────────────────────────

function safeProjectDir(projectId: string): string | null {
  if (!projectId || projectId.includes('..') || path.isAbsolute(projectId)) return null
  const resolved = path.resolve(PROJECTS_DIR, projectId)
  if (!resolved.startsWith(PROJECTS_DIR + path.sep)) return null
  return resolved
}

function safeFilePath(projectDir: string, filePath: string): string | null {
  if (!filePath || filePath.includes('..') || path.isAbsolute(filePath)) return null
  const resolved = path.resolve(projectDir, filePath)
  if (!resolved.startsWith(projectDir + path.sep)) return null
  return resolved
}

function walkDir(dir: string, root: string): string[] {
  const files: string[] = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) files.push(...walkDir(full, root))
    else files.push(path.relative(root, full))
  }
  return files.sort()
}

// ── MCP server ────────────────────────────────────────────────────────────────

const server = new McpServer({
  name: 'prism',
  version: '1.0.0',
})

server.tool('list_projects', 'List all Prism projects', {}, () => {
  fs.mkdirSync(PROJECTS_DIR, { recursive: true })
  const projects = fs
    .readdirSync(PROJECTS_DIR, { withFileTypes: true })
    .filter((e) => e.isDirectory() && !e.name.startsWith('.'))
    .map((e) => {
      try {
        const meta = JSON.parse(
          fs.readFileSync(path.join(PROJECTS_DIR, e.name, '.prism.json'), 'utf8')
        )
        return { id: e.name, name: meta.name ?? e.name }
      } catch {
        return { id: e.name, name: e.name }
      }
    })
  return { content: [{ type: 'text', text: JSON.stringify(projects, null, 2) }] }
})

server.tool(
  'list_files',
  'List all files in a project',
  { projectId: z.string().describe('Project ID') },
  ({ projectId }) => {
    const projectDir = safeProjectDir(projectId)
    if (!projectDir) return { content: [{ type: 'text', text: 'Invalid project ID' }] }
    const files = walkDir(projectDir, projectDir)
    return { content: [{ type: 'text', text: files.join('\n') }] }
  }
)

server.tool(
  'read_file',
  'Read a file from a project',
  {
    projectId: z.string().describe('Project ID'),
    file: z.string().describe('File path relative to project root'),
  },
  ({ projectId, file }) => {
    const projectDir = safeProjectDir(projectId)
    if (!projectDir) return { content: [{ type: 'text', text: 'Invalid project ID' }] }
    const filePath = safeFilePath(projectDir, file)
    if (!filePath) return { content: [{ type: 'text', text: 'Invalid file path' }] }
    if (!fs.existsSync(filePath)) return { content: [{ type: 'text', text: 'File not found' }] }
    const content = fs.readFileSync(filePath, 'utf8')
    return { content: [{ type: 'text', text: content }] }
  }
)

server.tool(
  'write_file',
  'Write content to a file in a project',
  {
    projectId: z.string().describe('Project ID'),
    file: z.string().describe('File path relative to project root'),
    content: z.string().describe('New file content'),
  },
  ({ projectId, file, content }) => {
    const projectDir = safeProjectDir(projectId)
    if (!projectDir) return { content: [{ type: 'text', text: 'Invalid project ID' }] }
    const filePath = safeFilePath(projectDir, file)
    if (!filePath) return { content: [{ type: 'text', text: 'Invalid file path' }] }
    fs.mkdirSync(path.dirname(filePath), { recursive: true })
    fs.writeFileSync(filePath, content, 'utf8')
    return { content: [{ type: 'text', text: `Written ${file}` }] }
  }
)

server.tool(
  'compile',
  'Compile a LaTeX project and return the log',
  {
    projectId: z.string().describe('Project ID'),
    mainFile: z.string().describe('Main .tex file to compile').default('main.tex'),
    engine: z.enum(['pdflatex', 'xelatex', 'lualatex']).default('pdflatex'),
  },
  ({ projectId, mainFile, engine }) => {
    const projectDir = safeProjectDir(projectId)
    if (!projectDir) return { content: [{ type: 'text', text: 'Invalid project ID' }] }

    const buildDir = path.join(projectDir, '.build')
    fs.mkdirSync(buildDir, { recursive: true })

    const latexmk = path.join(TEX_BIN, 'latexmk.exe')
    const engineFlag = engine === 'pdflatex' ? '-pdf' : engine === 'xelatex' ? '-xelatex' : '-lualatex'

    const result = spawnSync(latexmk, [
      engineFlag, '-g', '-interaction=nonstopmode',
      `-output-directory=${buildDir}`, mainFile,
    ], { cwd: projectDir, encoding: 'utf8' })

    const log = (result.stdout ?? '') + (result.stderr ?? '')
    const pdfPath = path.join(buildDir, mainFile.replace(/\.tex$/, '.pdf'))
    const ok = fs.existsSync(pdfPath)

    return {
      content: [{
        type: 'text',
        text: `Compile ${ok ? 'SUCCEEDED' : 'FAILED'}\n\n${log}`,
      }],
    }
  }
)

// ── Start ─────────────────────────────────────────────────────────────────────

const transport = new StdioServerTransport()
await server.connect(transport)
