import { FiArrowUpRight } from 'react-icons/fi'
import Button from '../../ui/Button'
import students from '../../../assets/reliance1.jpg'
export default function Hero() {
  return <section className="hero"><div className="container hero-inner">
    <div className="hero-copy"><div className="eyebrow">Dzivarasekwa Ext · Harare</div><h1>Emancipation through <em>education.</em></h1>
      <p>A strong beginning. A brighter future. Discover a school where primary and secondary learners grow in knowledge, character and confidence.</p>
      <div className="hero-actions"><Button to="/admissions">Explore admissions <FiArrowUpRight aria-hidden="true" /></Button><Button to="/about" variant="secondary">Meet our school</Button></div>
      <div className="stats"><div><strong>Primary</strong><span>Strong foundations</span></div><div><strong>Secondary</strong><span>New possibilities</span></div><div><strong>Community</strong><span>Growing together</span></div></div>
    </div>
    <figure className="hero-card"><img src={students} alt="Reliance secondary learners in full school uniform" fetchPriority="high" /><figcaption><span className="hero-caption-mark" aria-hidden="true">R</span><span><strong>A place to learn. A place to belong.</strong><small>Reliance Learning Centre</small></span></figcaption></figure>
  </div></section>
}
