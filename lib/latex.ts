import { spawn, spawnSync } from 'child_process'
import path from 'path'
import fs from 'fs'
import type { Engine } from './types'

const TEX_BIN = process.env.TEX_BIN_PATH ?? 'C:\\texlive\\2026\\bin\\windows'

function engineBinary(engine: Engine): string {
  if (engine === 'tectonic') {
    // tectonic is a standalone binary, not bundled with TeX Live
    return process.platform === 'win32' ? 'tectonic.exe' : 'tectonic'
  }
  return path.join(TEX_BIN, engine === 'pdflatex' ? 'pdflatex.exe'
    : engine === 'xelatex' ? 'xelatex.exe'
    : 'lualatex.exe')
}

function latexmkBinary(): string {
  return path.join(TEX_BIN, 'latexmk.exe')
}

function binaryExists(bin: string): boolean {
  if (fs.existsSync(bin)) return true
  // For bare names (no path separator), check PATH
  if (!bin.includes(path.sep)) {
    const result = spawnSync(process.platform === 'win32' ? 'where' : 'which', [bin], {
      encoding: 'utf8',
    })
    return result.status === 0
  }
  return false
}

export interface RunResult {
  ok: boolean
  log: string
  pdfPath?: string
}

export async function compileLatex(
  projectDir: string,
  mainFile: string,
  engine: Engine,
): Promise<RunResult> {
  const buildDir = path.join(projectDir, '.build')
  fs.mkdirSync(buildDir, { recursive: true })

  const mainFilePath = path.join(projectDir, mainFile)
  if (!fs.existsSync(mainFilePath)) {
    return { ok: false, log: `File not found: ${mainFile}` }
  }

  const pdfPath = path.join(buildDir, mainFile.replace(/\.tex$/, '.pdf'))

  let args: string[]
  let binary: string

  if (engine === 'tectonic') {
    binary = engineBinary('tectonic')
    if (!binaryExists(binary)) {
      return {
        ok: false,
        log: 'tectonic not found.\n\nInstall it from https://tectonic-typesetting.github.io\nor via: cargo install tectonic',
      }
    }
    args = ['--outdir', buildDir, mainFilePath]
  } else {
    binary = latexmkBinary()
    if (!binaryExists(binary)) {
      return {
        ok: false,
        log: `latexmk not found at ${binary}.\n\nCheck that TeX Live is installed and TEX_BIN_PATH is set correctly.`,
      }
    }
    const engineFlag = engine === 'pdflatex' ? '-pdf'
      : engine === 'xelatex' ? '-xelatex'
      : '-lualatex'
    args = [
      engineFlag,
      '-g',
      '-interaction=nonstopmode',
      `-output-directory=${buildDir}`,
      mainFile,
    ]
  }

  const log = await run(binary, args, projectDir)
  const ok = fs.existsSync(pdfPath)
  return { ok, log, pdfPath: ok ? pdfPath : undefined }
}

function run(binary: string, args: string[], cwd: string): Promise<string> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = []
    const proc = spawn(binary, args, { cwd })
    proc.stdout.on('data', (d: Buffer) => chunks.push(d))
    proc.stderr.on('data', (d: Buffer) => chunks.push(d))
    proc.on('close', () => resolve(Buffer.concat(chunks).toString('utf8')))
    proc.on('error', (e) => resolve(`Process error: ${e.message}`))
  })
}
