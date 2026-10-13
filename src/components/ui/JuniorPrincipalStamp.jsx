const formatAssignedDate = value => {
  if (!value) return 'DATE NOT ASSIGNED'
  const parsed = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(parsed.getTime())) return 'DATE NOT ASSIGNED'
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(parsed).toUpperCase()
}

/**
 * Reliance Junior School principal rubber stamp.
 * Pass the report-structure assignment timestamp, for example:
 * <JuniorPrincipalStamp date={reportStructure.assigned_at} width={320} />
 */
export default function JuniorPrincipalStamp({ date, width = 320 }) {
  const assignedDate = formatAssignedDate(date)

  return (
    <svg
      aria-label={`Reliance Junior School principal stamp dated ${assignedDate}`}
      role="img"
      viewBox="0 0 640 360"
      width={width}
      style={{ display: 'block', height: 'auto', maxWidth: '100%' }}
      xmlns="http://www.w3.org/2000/svg"
    >
      <g fill="none" stroke="#D32F2F" strokeLinecap="round" opacity=".9">
        <rect x="12" y="12" width="616" height="336" rx="14" strokeWidth="8" />
        <rect x="28" y="28" width="584" height="304" rx="8" strokeWidth="2.5" />
      </g>
      <g fill="#D32F2F" fontFamily="Arial, Helvetica, sans-serif" textAnchor="middle" opacity=".92">
        <text x="320" y="78" fontSize="30" fontWeight="800" letterSpacing="1.8">THE PRINCIPAL</text>
        <text x="320" y="116" fontSize="28" fontWeight="800" letterSpacing="1.1">RELIANCE JUNIOR SCHOOL</text>
        <path d="M128 142H512M128 198H512" fill="none" stroke="#D32F2F" strokeWidth="2.5" />
        <text x="320" y="177" fill="#173F7A" fontSize="24" fontWeight="800" letterSpacing="1.5">{assignedDate}</text>
        <text x="320" y="232" fontSize="18" fontWeight="400">Stand No. 5126 Nehanda</text>
        <text x="320" y="258" fontSize="18" fontWeight="400">Dzivarasekwa Ext, Harare</text>
        <text x="320" y="284" fontSize="18" fontWeight="400">Cell: 0775 603 206</text>
        <text x="320" y="310" fontSize="18" fontWeight="400">0773 148 543 / 0776 910 943</text>
      </g>
    </svg>
  )
}
