import { getFeeAmount as getFeeAmountFromStructure } from './FeeStructure.js';
/** @param {number} due @param {number} paid @returns {number} */ export const calculateBalance=(due,paid)=>Math.max(0,Number(due||0)-Number(paid||0))
/** @param {string|Date} paymentDate @param {string|Date|null} termEndDate @returns {number} */ export const calculateDaysOverdue=(paymentDate,termEndDate=null)=>Math.max(0,Math.floor((Date.now()-new Date(termEndDate||paymentDate||Date.now()))/86400000))
/** @param {Array} records @returns {{due:number,paid:number,balance:number}} */ export const calculateFeesSummary=(records=[])=>records.reduce((x,r)=>{const due=Number(r.total_fees??r.amount_due??0),paid=Number(r.amount_paid??0);x.due+=due;x.paid+=paid;x.balance+=calculateBalance(due,paid);return x},{due:0,paid:0,balance:0})
/** @param {number} value @param {number} total @param {number} decimals @returns {string} */ export const formatPercentage=(value,total,decimals=1)=>`${(total?value/total*100:0).toFixed(decimals)}%`
/** @param {number} amount @returns {string} */ export const formatCurrency=amount=>`$${Number(amount||0).toFixed(2)}`
/** @param {string|Date|null} date @returns {string} */ export const formatDate=date=>date?new Intl.DateTimeFormat('en-ZW',{day:'2-digit',month:'short',year:'numeric'}).format(new Date(date)):'�'
/** @param {string} level @param {string} stream @returns {string} */ export const formatClass=(level,stream)=>[level,stream].filter(Boolean).join(' ')
/** @param {string} name @returns {string} */ export const getInitials=name=>String(name||'?').trim().split(/\s+/).map(x=>x[0]).join('').slice(0,2).toUpperCase()
/** @param {string} value @returns {string} */ export const capitalize=value=>value?`${value[0].toUpperCase()}${value.slice(1)}`:''
/** @param {string} text @param {number} maxLength @returns {string} */ export const truncateText=(text,maxLength=50)=>String(text||'').length>maxLength?`${String(text).slice(0,maxLength-1)}�`:String(text||'')
/** @param {string} campus @returns {number} */ export const getFeeAmount = classLevel => getFeeAmountFromStructure(classLevel)
/** @param {number} due @param {number} paid @returns {'full'|'half'|'unpaid'} */ export const getPaymentCategory=(due,paid)=>Number(due)>0&&Number(paid)>=Number(due)?'full':Number(paid)>0?'half':'unpaid'
/** @param {string} category @returns {string} */ export const getPaymentCategoryColor=category=>({full:'#2ecc71',half:'#f39c12',unpaid:'#e74c3c'})[category]||'#6b7280'
/** @param {number|string} term @returns {string} */ export const getTermLabel=term=>String(term).startsWith('Term')?String(term):`Term ${term}`
/** @returns {number} */ export const getCurrentSchoolYear=()=>new Date().getFullYear()
/** @returns {1|2|3} */ export const getCurrentSchoolTerm=()=>{const m=new Date().getMonth()+1;return m<=5?1:m<=8?2:3}
/** @param {string} status @returns {string} */ export const getStatusLabel=status=>String(status).toLowerCase()==='active'?'Active':'Inactive'
/** @param {Array} students @returns {Array} */ export const sortStudentsByName=(students=[])=>[...students].sort((a,b)=>String(a.full_name||a.name||'').localeCompare(String(b.full_name||b.name||'')))
/** @param {Array} students @returns {Record<string,Array>} */ export const groupStudentsByClass=(students=[])=>students.reduce((g,s)=>{(g[s.class_level||'Unassigned']||=[]).push(s);return g},{})
/** @param {string} email @returns {boolean} */ export const isValidEmail=email=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email||''))
/** @param {string} phone @returns {boolean} */ export const isValidPhoneZW=phone=>/^(?:\+263|0)7[1-8]\d{7}$/.test(String(phone||'').replace(/[\s-]/g,''))
/** @param {Function} func @param {number} delay @returns {Function} */ export const debounce=(func,delay=300)=>{let timer;return(...args)=>{clearTimeout(timer);timer=setTimeout(()=>func(...args),delay)}}