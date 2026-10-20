import juniorCrest from '../../assets/images/reliance-junior-crest.webp'
import seniorCrest from '../../assets/images/reliance-senior-crest.webp'
import './campusBranding.css'

const campusCrests = {
  junior: { src: juniorCrest, name: 'Junior School' },
  senior: { src: seniorCrest, name: 'Senior School' },
}

export default function CampusBrandMark({ campus = 'all', className = '' }) {
  const selected = campusCrests[campus]
  const crests = selected ? [[campus, selected]] : Object.entries(campusCrests)
  const label = crests.map(([, crest]) => crest.name).join(' and ')

  return <span className={`campus-brand-mark${selected ? ' is-campus-specific' : ' is-dual-campus'} ${className}`.trim()} role="img" aria-label={`${label} crest${selected ? '' : 's'}`}>
    {crests.map(([key, crest]) => <img key={key} src={crest.src} alt="" aria-hidden="true" />)}
  </span>
}
