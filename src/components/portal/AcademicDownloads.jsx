import { useEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { downloadCsv, downloadWorkbook } from '../../lib/operationsExport'
import './academicDownloads.css'

export default function AcademicDownloads({ sheets, details, filename = 'academic-records', printable = true }) {
  const [busy,setBusy]=useState(false), [error,setError]=useState(''), [preview,setPreview]=useState(false), [printing,setPrinting]=useState(false)
  const root=useRef(null)
  const downloadRequest=useRef(null)
  useEffect(()=>()=>downloadRequest.current?.abort(),[])
  useEffect(()=>{
    if(!preview||!printable)return
    let ancestors=[],title=null
    const style=document.createElement('style');style.textContent='@page { size:A4 landscape; margin:10mm; }'
    const restore=()=>{
      style.remove();document.body.classList.remove('printing-academic-extract')
      root.current?.removeAttribute('data-print-extract');ancestors.forEach(el=>el.removeAttribute('data-extract-ancestor'));ancestors=[]
      if(title!==null){document.title=title;title=null}
    }
    const before=()=>{
      if(!root.current||document.body.classList.contains('printing-academic-extract'))return
      flushSync(()=>setPrinting(true));title=document.title;document.title=filename
      root.current.setAttribute('data-print-extract','')
      for(let parent=root.current.parentElement;parent;parent=parent.parentElement){parent.setAttribute('data-extract-ancestor','');ancestors.push(parent)}
      document.body.classList.add('printing-academic-extract');document.head.append(style)
    }
    const after=()=>{restore();setPrinting(false)}
    window.addEventListener('beforeprint',before);window.addEventListener('afterprint',after)
    return()=>{restore();window.removeEventListener('beforeprint',before);window.removeEventListener('afterprint',after)}
  },[preview,printable,filename])
  const download=async format=>{
    if(busy)return
    const controller=new AbortController();downloadRequest.current=controller
    setBusy(true);setError('')
    const metadata={School:'Reliance Learning Centre',...details,'Generated at':new Date().toISOString(),'Data rows':sheets.reduce((n,s)=>n+s.rows.length-1,0)}
    try {
      if(format==='xlsx')await downloadWorkbook(sheets,metadata,`${filename}.xlsx`,controller.signal)
      else downloadCsv([...Object.entries(metadata),[],...sheets.flatMap(sheet=>[[sheet.name],...sheet.rows,[]])],`${filename}.csv`)
    }catch(cause){if(!controller.signal.aborted)setError(`Download failed: ${cause.message}`)}finally{if(!controller.signal.aborted)setBusy(false);if(downloadRequest.current===controller)downloadRequest.current=null}
  }
  return <section className="academic-downloads no-print" aria-label="Academic record downloads">
    <div className="academic-download-actions"><button type="button" disabled={busy} onClick={()=>download('csv')}>Download academic CSV</button><button type="button" disabled={busy} onClick={()=>download('xlsx')}>{busy?'Preparing…':'Download academic Excel'}</button>
      {printable&&<button type="button" onClick={()=>setPreview(!preview)}>{preview?'Close extract preview':'Preview printable extract'}</button>}</div>
    {error&&<p role="alert">{error}</p>}
    {preview&&<><p>Preview shows up to 100 rows per section. Print includes all rows. This is a recorded-data extract; use the report card for the official layout.</p><button type="button" onClick={()=>window.print()}>Print extract / Save PDF</button>
      <div ref={root} className="academic-extract"><h2>Reliance Learning Centre · recorded academic data</h2>{Object.entries(details).map(([key,value])=><p key={key}><strong>{key}:</strong> {String(value)}</p>)}
      {sheets.map(sheet=>{
        const columns=printing&&sheet.printColumns?sheet.printColumns:sheet.rows[0].map((_,index)=>index)
        return <section key={sheet.name}><h3>{sheet.name} · {sheet.rows.length-1} rows</h3><div className="academic-extract-scroll"><table><thead><tr>{columns.map(index=><th key={index}>{sheet.rows[0][index]}</th>)}</tr></thead><tbody>{(printing?sheet.rows.slice(1):sheet.rows.slice(1,101)).map((row,index)=><tr key={index}>{columns.map(col=><td key={col}>{String(row[col]??'')}</td>)}</tr>)}</tbody></table></div></section>
      })}</div></>}
  </section>
}
