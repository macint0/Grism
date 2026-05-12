# Grism

A local LaTeX editor with an MCP server so Claude Code can read, write, and compile your `.tex` files directly — no screenshots, no copy-paste.

## What it is

Grism is two things:

1. **An MCP server** — exposes your LaTeX projects to Claude Code so Claude can read, edit, compile, and visually inspect documents like a pair programmer.
2. **A Next.js editor app** — file tree, CodeMirror editor, PDF preview, multi-engine compile. Runs locally at `localhost:3000`.

Both work on the same `projects/` directory on disk.

## MCP server

Add to `~/.mcp.json` (or your Claude Code MCP config):

```json
{
  "mcpServers": {
    "grism": {
      "command": "node",
      "args": ["--import", "tsx/esm", "mcp-server/index.ts"],
      "cwd": "C:\\path\\to\\Grism"
    }
  }
}
```

Claude Code gets these tools:

| Tool | What it does |
|------|-------------|
| `list_projects` | List all projects |
| `list_files` | List files in a project |
| `read_file` | Read a file |
| `write_file` | Write a file |
| `compile` | Compile with pdflatex / xelatex / lualatex |
| `render_page` | Render a PDF page to PNG so Claude can see the output |

## Editor app features

- CodeMirror editor with LaTeX syntax highlighting
- PDF preview with page navigation and jump-to-page
- **Click anywhere on the PDF to jump to that line in the editor** (SyncTeX inverse search)
- Structured compile error log — each error is a card showing message, file, and line; click to jump
- Image preview for PNG/JPG/SVG files in the file tree
- Toast notification when Claude edits a file via MCP and the editor auto-reloads
- Multi-engine compile: pdflatex, xelatex, lualatex, tectonic

## Setup

### Prerequisites

- Node.js >= 20
- TeX Live — [tug.org/texlive](https://tug.org/texlive/) (Windows) or `brew install --cask mactex` (macOS)

### Install

```bash
git clone https://github.com/macint0/Grism
cd Grism
npm install
```

### Configure

If TeX Live is not at `C:\texlive\2026\bin\windows`, set in `.env.local`:

```env
TEX_BIN_PATH=C:\path\to\texlive\bin\windows
```

### Run the editor

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Run the MCP server

The MCP server runs as a stdio process launched by Claude Code — you don't start it manually. Add the config above and restart Claude Code.

## License

MIT
