import { useEffect, useState } from 'react'
import { useAuth } from '../../context/useAuth'
import { useSection } from './StaffPortalLayout'
import LearningLibraryWorkspace from './LearningLibraryWorkspace'
import PortalNotice from './PortalNotice'

export default function TeacherLearningLibrary() {
  const { supabase, user, profile } = useAuth()
  const { activeClassFilter, selectedSubjectAllocationId, selectedSubject, selectedSubjectLevel, clearSubjectGroup, setSection } = useSection()
  const [curriculum, setCurriculum] = useState({ rows: [], error: '', loaded: false })
  const [subject, setSubject] = useState('')
  const [revision, setRevision] = useState(0)
  const junior = profile?.campus === 'junior'
  useEffect(() => {
    if (!junior) return
    let active = true
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 15000)
    supabase.from('library_curriculum_subjects').select('class_level,subject').order('subject').abortSignal(controller.signal)
      .then(({ data, error }) => { if (active) setCurriculum({ rows: data || [], error: error?.message || '', loaded: true }) })
      .catch(() => { if (active) setCurriculum({ rows: [], error: 'Could not load your class subjects. Check your connection and retry.', loaded: true }) })
      .finally(() => clearTimeout(timer))
    return () => { active = false; clearTimeout(timer); controller.abort() }
  }, [junior, supabase, revision])
  const classAssignments = profile?.teacher_class_assignments || []
  const assignedClass = classAssignments.find(row => row.class_level === activeClassFilter.level && (!activeClassFilter.stream || (row.class_stream || '') === activeClassFilter.stream)) || (!activeClassFilter.level ? classAssignments[0] : null)
  const subjects = junior ? curriculum.rows.filter(row => row.class_level === assignedClass?.class_level).map(row => row.subject) : []
  const activeSubject = subjects.includes(subject) ? subject : subjects[0] || ''
  const allocation = (profile?.teacher_class_subject_assignments || []).find(row => row.id === selectedSubjectAllocationId && row.subject === selectedSubject && row.class_level === selectedSubjectLevel)
  const scope = junior
    ? assignedClass && activeSubject ? { ...assignedClass, campus: 'junior', subject: activeSubject } : null
    : allocation ? { ...allocation, allocation_id: allocation.id } : null
  if (junior && !curriculum.loaded) return <p role="status">Loading your class subjects…</p>
  if (junior && curriculum.error) return <PortalNotice tone="error">{curriculum.error} <button type="button" className="btn secondary" onClick={() => setRevision(value => value + 1)}>Retry subjects</button></PortalNotice>
  if (!scope) return <section className="learning-library"><h1>Learning library</h1><p>Choose a current {junior ? 'class' : 'subject'} allocation before uploading notes.</p><button type="button" className="btn secondary" onClick={() => junior ? setSection('dashboard') : clearSubjectGroup()}>Return to allocations</button></section>
  return <LearningLibraryWorkspace key={`${scope.campus}:${scope.class_level}:${scope.class_stream || ''}:${scope.subject}`}
    supabase={supabase} teacherId={user.id} scope={scope}
    subjects={subjects} onSubjectChange={setSubject}
    onBack={() => junior ? setSection('dashboard') : clearSubjectGroup()} />
}
