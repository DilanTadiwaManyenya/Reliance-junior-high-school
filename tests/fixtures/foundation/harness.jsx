import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import Button from '../../../src/components/ui/Button'
import Card from '../../../src/components/ui/Card'
import Badge from '../../../src/components/ui/Badge'
import FormField from '../../../src/components/ui/FormField'
import SectionHeading from '../../../src/components/ui/SectionHeading'
import SlideOver from '../../../src/components/ui/SlideOver'
import DataTable from '../../../src/components/ui/DataTable'
import PortalNotice from '../../../src/components/portal/PortalNotice'
import { ActionBar, FilterPanel, PortalPageHeader } from '../../../src/components/ui/PortalPatterns'
import '../../../src/index.css'
import '../../../src/portal.css'
import '../../../src/staffPortal.css'
import '../../../src/mobileUX.css'
import '../../../src/portalResponsive.css'
import '../../../src/portalFoundation.css'
import '../../../src/portalNavigation.css'
import '../../../src/portalAdminMobile.css'

export default function Foundation() {
  const [name, setName] = useState(''), [error,setError] = useState(''), [saved,setSaved] = useState(false)
  const [panel,setPanel] = useState(false), [second,setSecond] = useState(false)
  return <><main className="portal-foundation" style={{maxWidth:1000,margin:'auto',padding:16}}>
    <PortalPageHeader eyebrow="Shared mobile patterns" title="Portal foundation reference" description="Readable controls and clear feedback for every role." actions={<Button type="button" onClick={()=>setPanel(true)}>Open learner details</Button>} />
    <Card aria-label="Form example">
      <SectionHeading title="Learner details" text="Long names remain readable on a small phone." />
      <div className="ui-action-bar"><Badge>Pending verification</Badge><Badge tone="success">Active</Badge><Badge tone="warning">Needs attention</Badge><Badge tone="error">Save failed</Badge></div>
      <PortalNotice>Use your assigned campus and learner context.</PortalNotice>
      <form noValidate onSubmit={event=>{event.preventDefault();setError(name.trim()?'':'Enter the learner full name.');setSaved(!!name.trim())}}>
        <FormField label="Full name" required hint="Use the name shown on the learner record." error={error}><input value={name} onChange={event=>setName(event.target.value)} autoComplete="name" /></FormField>
        <FormField label="Notes" hint="Optional information for the school office."><textarea rows={3} /></FormField>
        <ActionBar><Button>Save details</Button><Button type="button" variant="secondary" disabled>Unavailable action</Button><Button to="/unavailable" disabled>Unavailable link</Button></ActionBar>
      </form>
      {saved && <PortalNotice tone="success" role="status">Details saved in this reference example.</PortalNotice>}
      <FilterPanel count={1}><FormField label="Search learners"><input type="search" /></FormField><Button type="button" variant="secondary">Apply filters</Button></FilterPanel>
      <DataTable label="Learner comparison" columns={[{label:'Learner',render:row=>row.name},{label:'Reference',render:row=>row.reference},{label:'Notes',render:()=> 'A comparison column that stays available when scrolling horizontally.'}]} rows={[{id:1,name:'Alexandra Example Learner With A Very Long Full Name',reference:'REFERENCE-000000000000000000000000001'}]} getRowKey={row=>row.id} />
      <Button type="button" variant="secondary" onClick={()=>setSecond(true)}>Open another panel</Button>
    </Card>
    <SlideOver open={panel} onClose={()=>setPanel(false)} title="Learner details panel" description="Edit details without losing the page context."><form onSubmit={event=>{event.preventDefault();setPanel(false)}}>{Array.from({length:8},(_,i)=><FormField key={i} label={`Detail ${i+1}`}><input /></FormField>)}<ActionBar><Button>Save panel</Button><Button type="button" variant="secondary" onClick={()=>setPanel(false)}>Cancel panel</Button></ActionBar></form></SlideOver>
    <SlideOver open={second} onClose={()=>setSecond(false)} title="Another panel"><p>This panel has its own accessible title.</p></SlideOver>
  </main><aside data-testid="public-control" style={{padding:16}}><SectionHeading title="Public website heading" /><Button type="button">Public website button</Button></aside></>
}
createRoot(document.getElementById('root')).render(<MemoryRouter><Foundation /></MemoryRouter>)
