export default function PortalNotice({ children, tone = 'info' }) { return <div className={`portal-notice ${tone}`}>{children}</div> }
