import { useEffect, useMemo, useState } from 'react'

// school_classes is the operational class registry. Do not add streams to
// frontend constants: an administrator manages them in the registry instead.
export function useSchoolClasses(supabase, { activeOnly = true } = {}) {
  const [classes, setClasses] = useState([])
  const [loading, setLoading] = useState(Boolean(supabase))
  const [error, setError] = useState('')

  useEffect(() => {
    let current = true
    if (!supabase) {
      setClasses([])
      setLoading(false)
      return undefined
    }
    setLoading(true)
    let query = supabase
      .from('school_classes')
      .select('id, class_level, class_stream, campus, active, capacity')
      .order('campus')
      .order('class_level')
      .order('class_stream')
    if (activeOnly) query = query.eq('active', true)
    query.then(({ data, error: requestError }) => {
      if (!current) return
      setError(requestError?.message || '')
      setClasses(requestError ? [] : (data ?? []))
      setLoading(false)
    })
    return () => { current = false }
  }, [supabase, activeOnly])

  const levels = useMemo(
    () => [...new Set(classes.map((row) => row.class_level))],
    [classes],
  )
  const streamsForLevel = (level) => classes
    .filter((row) => row.class_level === level)
    .map((row) => row.class_stream || '')
    .filter(Boolean)

  return { classes, levels, streamsForLevel, loading, error }
}
