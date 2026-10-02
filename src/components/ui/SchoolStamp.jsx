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
    <g filter="url(#school-stamp-grain)" fill="none" stroke="currentColor" opacity=".88">
      <path d="M37 12H353L378 37V218L353 243H37L12 218V37Z" strokeWidth="3.5" />
      <path d="M44 20H346L370 44V211L346 235H44L20 211V44Z" strokeWidth="1.7" opacity=".72" />
    </g>
    <g fill="currentColor" textAnchor="middle" fontFamily="Arial, Helvetica, sans-serif" filter="url(#school-stamp-grain)">
      <text x="195" y="46" fontSize="21" fontWeight="800" letterSpacing=".8">RELIANCE LEARNING</text>
      <text x="195" y="69" fontSize="19" fontWeight="800" letterSpacing="1.2">★  CENTRE  ★</text>
      <rect x="97" y="88" width="196" height="32" rx="2" fill="none" stroke="currentColor" strokeWidth="2" />
      <text x="195" y="110" fontSize="16" fontWeight="800" letterSpacing=".25">{stampDate}</text>
      <text x="195" y="146" fontSize="18" fontWeight="800" letterSpacing=".85">THE PRINCIPAL</text>
      <text x="195" y="166" fontSize="14" fontWeight="800" letterSpacing="2.3">HARARE</text>
      <path d="M76 177H314" stroke="currentColor" strokeWidth="1.35" opacity=".62" />
      <text x="195" y="194" fontSize="11.5" fontWeight="700" letterSpacing=".08">Stand No. 3029 Nehanda · Dzivarasekwa Ext, Harare</text>
      <text x="195" y="210" fontSize="11.5" fontWeight="700" letterSpacing=".08">Cell: 0716 663 966</text>
      <text x="195" y="226" fontSize="10.8" fontWeight="700" letterSpacing=".08">0773 148 543 / 0776 910 943</text>
    </g>
  </svg>
}
