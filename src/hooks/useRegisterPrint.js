import {useEffect} from 'react'
import {flushSync} from 'react-dom'
import '../components/portal/learnerRegister.css'

export function useRegisterPrint(enabled,title,setPrinting) {
 useEffect(()=>{
  let ancestors=[],originalTitle=null,active=true
  const pageStyle=document.createElement('style')
  pageStyle.textContent='@page { size: A4 landscape; margin: 10mm; }'
  const prepare=()=>{
   if(!enabled||document.body.classList.contains('printing-learner-register'))return
   flushSync(()=>setPrinting(true))
   const register=document.getElementById('learner-register-preview');if(!register)return
   originalTitle=document.title;document.title=title
   document.head.append(pageStyle);document.body.classList.add('printing-learner-register')
   register.setAttribute('data-print-register','')
   for(let parent=register.parentElement;parent;parent=parent.parentElement){parent.setAttribute('data-register-ancestor','');ancestors.push(parent)}
  }
  const restore=()=>{
   pageStyle.remove();document.body.classList.remove('printing-learner-register')
   document.getElementById('learner-register-preview')?.removeAttribute('data-print-register')
   ancestors.forEach(el=>el.removeAttribute('data-register-ancestor'));ancestors=[]
   if(originalTitle!==null){document.title=originalTitle;originalTitle=null}
  }
  const finish=()=>{restore();if(active)setPrinting(false)}
  window.addEventListener('beforeprint',prepare);window.addEventListener('afterprint',finish)
  return()=>{active=false;restore();window.removeEventListener('beforeprint',prepare);window.removeEventListener('afterprint',finish)}
 },[enabled,title,setPrinting])
}
