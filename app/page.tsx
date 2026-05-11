import { listProjects } from '@/lib/projects'
import EditorApp from '@/components/EditorApp'

export default function Home() {
  const projects = listProjects()
  return <EditorApp initialProjects={projects} />
}
