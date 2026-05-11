# Grism

A local, AI-native LaTeX editor powered by Claude. Write `.tex`, pick a compile engine, see the PDF update live, and chat with Claude about your document — all running on your machine.

## Features

- **CodeMirror 6 editor** with LaTeX syntax highlighting
- **Live PDF preview** via react-pdf
- **4 compile engines** — pdflatex, xelatex, lualatex, tectonic
- **Claude chat panel** — project-aware, streams responses, knows your open file
- **Multi-file projects** — file tree, create/delete files
- **MCP server** — lets Claude Code work directly on your LaTeX files

## Stack

- Next.js 16 (App Router) + TypeScript
- CodeMirror 6 + `@codemirror/legacy-modes` (stex)
- react-pdf + pdfjs
- @anthropic-ai/sdk (streaming SSE)
- shadcn/ui + Tailwind
- TeX Live (local install)

## Setup

### Prerequisites

- Node.js >= 20
- TeX Live with pdflatex, xelatex, lualatex installed
  - Windows: [tug.org/texlive](https://tug.org/texlive/)
  - macOS: `brew install --cask mactex`
  - Ubuntu: `sudo apt install texlive-full`
- (Optional) Tectonic: [tectonic.typesetting.io](https://tectonic.typesetting.io/)

### Install

```bash
git clone https://github.com/macint0/Grism
cd grism
npm install
```

### Configure

Create `.env.local`:

```env
ANTHROPIC_API_KEY=your_api_key_here
```

Get a key at [console.anthropic.com](https://console.anthropic.com). Without one, Grism runs in mock mode — the UI works but Claude responses are placeholder text.

If your TeX Live is not at `C:\texlive\2026\bin\windows`, set:

```env
TEX_BIN_PATH=C:\path\to\texlive\bin\windows
```

### Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## MCP Server (Claude Code integration)

Grism ships an MCP server that lets Claude Code read, write, and compile your LaTeX projects directly.

Add to `~/.mcp.json` (or `.mcp.json` in your workspace):

```json
{
  "mcpServers": {
    "grism": {
      "command": "node",
      "args": ["--import", "tsx/esm", "mcp-server/index.ts"],
      "cwd": "/path/to/grism"
    }
  }
}
```

Claude Code then has access to `list_projects`, `list_files`, `read_file`, `write_file`, and `compile` tools.

## Project Structure

```
grism/
├── app/
│   ├── api/
│   │   ├── compile/route.ts
│   │   ├── files/route.ts
│   │   ├── projects/route.ts
│   │   └── chat/route.ts
│   └── page.tsx
├── components/
│   ├── Editor.tsx
│   ├── PdfPreview.tsx
│   ├── FileTree.tsx
│   ├── ChatPanel.tsx
│   └── CompilerDropdown.tsx
├── lib/
│   ├── latex.ts
│   ├── projects.ts
│   └── anthropic.ts
├── mcp-server/
│   └── index.ts
└── projects/          ← your LaTeX projects live here (gitignored)
```

## License

MIT
