import Anthropic from '@anthropic-ai/sdk'

export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

export function buildSystemPrompt(
  projectId: string,
  openFile: string,
  openFileContent: string,
  allFiles: string[],
): string {
  const fileList = allFiles.map((f) => `  - ${f}`).join('\n')

  return `You are a LaTeX expert assistant embedded in Prism, a local LaTeX editor.

Current project: ${projectId}
Open file: ${openFile}

Project files:
${fileList || '  (none)'}

Content of ${openFile}:
\`\`\`latex
${openFileContent}
\`\`\`

Help the user write, debug, and improve their LaTeX documents. When suggesting edits, show the relevant LaTeX snippet. Be concise.`
}
