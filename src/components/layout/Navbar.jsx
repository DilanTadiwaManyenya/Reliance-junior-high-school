import { Link, NavLink } from 'react-router-dom'
import { useEffect, useRef, useState } from 'react'
import { FiChevronDown, FiMenu, FiX } from 'react-icons/fi'
import { moreNavigation, primaryNavigation } from '../../data/navigation'
import { siteContent } from '../../data/siteContent'
import Button from '../ui/Button'
import MobileMenu from './MobileMenu'
import logo from '../../assets/images/reliance-senior-logo.png'

export default function Navbar() {
  const [open, setOpen] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  const headerRef = useRef(null)
  const moreRef = useRef(null)
  const toggleRef = useRef(null)
  useEffect(() => {
    function dismiss(event) {
      if (!headerRef.current?.contains(event.target)) { setOpen(false); setMoreOpen(false) }
    }
    function escape(event) {
      if (event.key !== 'Escape') return
      if (moreOpen) { setMoreOpen(false); moreRef.current?.focus() }
      if (open) { setOpen(false); toggleRef.current?.focus() }
    }
    document.addEventListener('pointerdown', dismiss)
    document.addEventListener('keydown', escape)
    return () => { document.removeEventListener('pointerdown', dismiss); document.removeEventListener('keydown', escape) }
  }, [open, moreOpen])
  return <header className="header" ref={headerRef}>
    <nav className="container nav" aria-label="Main navigation">
      <Link to="/" className="brand" onClick={() => setOpen(false)} aria-label="Reliance Learning Centre home"><img src={logo} alt="" /><span>{siteContent.name}<small>{siteContent.subname}</small></span></Link>
      <div className="links">{primaryNavigation.map(([name, path]) => <NavLink key={path} to={path} end={path === '/'}>{name}</NavLink>)}
        <div className="more-menu" onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setMoreOpen(false) }}>
          <button ref={moreRef} type="button" aria-expanded={moreOpen} aria-controls="more-navigation" onClick={() => setMoreOpen(!moreOpen)}>More <FiChevronDown aria-hidden="true" /></button>
          {moreOpen && <div id="more-navigation" className="more-panel">{moreNavigation.map(([name, path]) => <NavLink key={path} to={path} onClick={() => setMoreOpen(false)}>{name}</NavLink>)}</div>}
        </div>
      </div>
      <Button to="/portal" variant="secondary">Portal</Button><Button to="/admissions">Apply now</Button>
      <button ref={toggleRef} type="button" className="menu-toggle" aria-label={open ? 'Close navigation' : 'Open navigation'} aria-expanded={open} aria-controls="mobile-navigation" onClick={() => setOpen(!open)}>{open ? <FiX /> : <FiMenu />}</button>
    </nav><MobileMenu open={open} close={() => setOpen(false)} />
  </header>
}
