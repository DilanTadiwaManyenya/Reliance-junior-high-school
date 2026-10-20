import { Link } from 'react-router-dom'

export default function ParentLibraryLauncher({ student }) {
  if (!student || student.status !== 'active') return null
  return <Link className="parent-library-launcher" to={`/portal/library?learner=${encodeURIComponent(student.id)}`} aria-label={`Open learning library for ${student.full_name}`}>
    <span className="parent-record-kicker">Learning at home</span><strong>Learning library</strong>
    <span>Read and download notes shared by your child’s teachers.</span>
  </Link>
}
