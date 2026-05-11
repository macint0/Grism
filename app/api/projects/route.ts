import { NextRequest, NextResponse } from 'next/server'
import { listProjects, createProject, deleteProject, renameProject } from '@/lib/projects'
import type { ProjectCreateRequest, ProjectDeleteRequest, ProjectRenameRequest } from '@/lib/types'

export async function GET() {
  const projects = listProjects()
  return NextResponse.json(projects)
}

export async function POST(request: NextRequest) {
  const { name } = await request.json() as ProjectCreateRequest
  if (!name?.trim()) {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 })
  }
  const project = createProject(name.trim())
  return NextResponse.json(project)
}

export async function PATCH(request: NextRequest) {
  const { id, name } = await request.json() as ProjectRenameRequest
  if (!id || !name?.trim()) {
    return NextResponse.json({ error: 'ID and name required' }, { status: 400 })
  }
  renameProject(id, name.trim())
  return NextResponse.json({ ok: true })
}

export async function DELETE(request: NextRequest) {
  const { id } = await request.json() as ProjectDeleteRequest
  if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 })
  deleteProject(id)
  return NextResponse.json({ ok: true })
}
