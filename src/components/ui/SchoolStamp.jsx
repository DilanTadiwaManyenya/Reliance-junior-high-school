const formatStampDate = value => {
  const date = value instanceof Date ? value : value ? new Date(value) : new Date()
  return Number.isNaN(date.getTime())
    ? new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'long', year: 'numeric' }).format(new Date())
    : new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'long', year: 'numeric' }).format(date)
}

/** A reusable, print-safe rendering of the Reliance Learning Centre official stamp. */
export default function SchoolStamp({ date, className = '', title = 'Reliance Learning Centre official principal stamp' }) {
  const stampDate = formatStampDate(date)
  return <svg className={`school-stamp ${className}`.trim()} viewBox="0 0 390 255" role="img" aria-label={title} xmlns="http://www.w3.org/2000/svg">
    <defs>
      <filter id="school-stamp-grain" x="-8%" y="-10%" width="116%" height="120%">
        <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="17" result="noise" />
        <feColorMatrix in="noise" type="saturate" values="0" result="monoNoise" />
        <feComponentTransfer in="monoNoise" result="fadedNoise"><feFuncA type="table" tableValues="0 0.15" /></feComponentTransfer>
        <feBlend in="SourceGraphic" in2="fadedNoise" mode="multiply" />
      </filter>
    </defs>
    <g filter="url(#school-stamp-grain)" fill="none" stroke="currentColor" strokeWidth="4" opacity=".88">
      <path d="M36 12H354L378 38V217L354 243H36L12 217V38Z" />
      <path d="M42 20H348L370 42V213L348 235H42L20 213V42Z" strokeWidth="1.5" opacity=".7" />
    </g>
    <g fill="currentColor" textAnchor="middle" fontFamily="Arial, Helvetica, sans-serif" filter="url(#school-stamp-grain)">
      <text x="195" y="47" fontSize="22" fontWeight="900" letterSpacing=".65">RELIANCE LEARNING</text>
      <text x="195" y="70" fontSize="20" fontWeight="900" letterSpacing="1.1">★  CENTRE  ★</text>
      <rect x="86" y="87" width="218" height="35" rx="3" fill="none" stroke="currentColor" strokeWidth="2.3" />
      <text x="195" y="111" fontSize="17" fontWeight="800">{stampDate}</text>
      <text x="195" y="148" fontSize="19" fontWeight="900" letterSpacing=".8">THE PRINCIPAL</text>
      <text x="195" y="168" fontSize="15" fontWeight="800" letterSpacing="2.4">HARARE</text>
      <path d="M70 180H320" stroke="currentColor" strokeWidth="1.5" opacity=".65" />
      <text x="195" y="199" fontSize="13" fontWeight="700">Stand No. 3029 Nehanda · Dzivarasekwa Ext, Harare</text>
      <text x="195" y="218" fontSize="13" fontWeight="700">Cell: 0716 663 966</text>
      <text x="195" y="234" fontSize="12" fontWeight="700">0773 148 543 / 0776 910 943</text>
    </g>
  </svg>
}
