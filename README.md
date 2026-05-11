# Grism

A local LaTeX editor with an MCP server so Claude Code can read, write, and compile your `.tex` files directly — no screenshots, no copy-paste.

## What it is

Grism is a Next.js app that runs on your machine. It gives you a basic LaTeX editor with PDF preview, and more importantly, an MCP server that plugs into Claude Code so you can work on LaTeX with Claude like a pair programmer.

## MCP server

Add to `~/.mcp.json`:

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

Claude Code gets these tools:

| Tool | What it does |
|------|-------------|
| `list_projects` | List all projects |
| `list_files` | List files in a project |
| `read_file` | Read a file |
| `write_file` | Write a file |
| `compile` | Compile with pdflatex / xelatex / lualatex |

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

Create `.env.local`:

```env
ANTHROPIC_API_KEY=your_api_key_here
```

Without a key, the chat panel runs in mock mode — the rest of the app still works.

If TeX Live is not at `C:\texlive\2026\bin\windows`, set:

```env
TEX_BIN_PATH=C:\path\to\texlive\bin\windows
```

### Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## License

MIT
