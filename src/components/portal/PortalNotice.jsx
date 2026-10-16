export default function PortalNotice({ children, tone = 'info', className = '', ...props }) {
  return <div role={tone === 'error' ? 'alert' : undefined} {...props} className={`portal-notice ui-notice ${tone} ${className}`}>{children}</div>
}
