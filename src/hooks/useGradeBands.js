import { useEffect, useState } from 'react'

/** Load the school's configured scales for mark previews and grade checks. */
export function useGradeBands(supabase) {
  const [bands, setBands] = useState([])

  useEffect(() => {
    let active = true
    supabase.from('grade_bands').select('band_group, minimum_score, maximum_score, grade, points, description')
      .then(({ data, error }) => {
        if (!active) return
        setBands(error ? [] : data || [])
      })
    return () => { active = false }
  }, [supabase])

  return bands
}
