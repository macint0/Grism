@AGENTS.md

# ⚠️ MANDATORY: USE THE MCP SERVER. NOTHING ELSE.

This project has a running Grism MCP server. Every single task goes through it:

- `mcp__grism__create_project` — new project
- `mcp__grism__write_file` — write .tex files
- `mcp__grism__compile` — compile LaTeX
- `mcp__grism__render_page` — inspect the PDF output
- `mcp__grism__list_projects`, `mcp__grism__list_files`, `mcp__grism__read_file`

**DO NOT use Edit, Write, Read, Bash, Glob, or Grep on project files.**
**DO NOT open Next.js files. DO NOT browse the codebase.**
**The first action on ANY request must be an MCP tool call.**

**EXCEPTION: If the user asks a question, just answer it. No tools needed.**

The user built this MCP server so Claude works exclusively through it.
Ignoring this is the single biggest failure mode in this project.
