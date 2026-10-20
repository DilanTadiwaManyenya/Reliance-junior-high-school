import { useEffect, useRef } from 'react'
import Card from '../ui/Card'
import Button from '../ui/Button'
import PortalNotice from './PortalNotice'
import { learningFileSize } from '../../lib/learningLibrary'

export default function ParentLibraryFilePanel({ view, onClose, onRenew }) {
  const titleRef = useRef(null)
  useEffect(() => {
    titleRef.current?.scrollIntoView({ block: 'nearest' })
    titleRef.current?.focus({ preventScroll: true })
  }, [view.row.id, view.url, view.error])
  return <Card className="parent-library-file" aria-label={view.preview ? 'Learning file preview' : 'Learning file download'}>
    <h2 ref={titleRef} tabIndex={-1}>{view.preview ? 'File preview' : 'Download ready'}: {view.row.title}</h2>
    <Button type="button" variant="secondary" onClick={onClose}>Close file</Button>
    {view.error ? <PortalNotice tone="error">{view.error}</PortalNotice> : <>
      <p>{view.row.file.original_name} · {learningFileSize(view.row.file.size_bytes)}.</p>
      {view.expired ? <p role="status">This private link expired. You can keep reading an already loaded preview, or request a fresh link.</p> : <p>New downloads can use this private link for 60 seconds.</p>}
      {view.preview && view.url && (view.row.file.mime_type === 'application/pdf'
        ? <iframe title={`Preview of ${view.row.title}`} src={view.url} sandbox="allow-scripts allow-same-origin" referrerPolicy="no-referrer" />
        : <img alt={`Learning notes: ${view.row.title}`} src={view.url} referrerPolicy="no-referrer" />)}
      {!view.expired && <a className="btn secondary" target="_blank" rel="noopener noreferrer" href={view.url}>{view.preview ? 'Open file in a new tab' : `Download ${view.row.file.original_name}`}</a>}
      {view.preview && <small>If your phone cannot display the preview, open the file in a new tab or use Prepare download on the resource.</small>}
    </>}
    {(view.error || view.expired) && <Button type="button" onClick={onRenew}>Request new file link</Button>}
  </Card>
}
