import { Link } from 'react-router-dom';
import { ArrowRight, LayoutGrid, Package, Zap, CheckCircle } from 'lucide-react';
import Navbar      from '../components/layout/Navbar';
import Footer      from '../components/layout/Footer';
import ServiceCard from '../components/ui/ServiceCard';

const SERVICES = [
  {
    label: 'Structural Design', title: 'Structural Design', Icon: LayoutGrid,
    description: 'Automated Eurocode 5 compliant analysis for struts, rafters, beams and trusses. Member sizing, buckling checks and deflection verification in seconds.',
    features: ['Eurocode 5 & BS 5268', 'Strut & rafter analysis', 'Automated BOM generation'],
  },
  {
    label: 'Procurement', title: 'Procurement Automation', Icon: Package,
    description: 'Automated RFQ generation, multi-supplier comparison, and one-click purchase orders. Waste-optimised cutting lists and real-time delivery scheduling.',
    features: ['Multi-supplier RFQ', 'Live stock checking', 'Waste optimisation'],
  },
  {
    label: 'AI Intelligence', title: 'AI Design Assistant', Icon: Zap,
    description: 'Amazon Bedrock-powered AI that interprets plain-English project briefs, sizes members automatically and flags code compliance risks instantly.',
    features: ['Natural language input', 'Instant member sizing', 'Risk flagging'],
  },
];

const STATS = [
  { value:'500+', label:'Projects Completed' },
  { value:'32',   label:'Years Experience'   },
  { value:'< 2s', label:'Design Analysis'    },
  { value:'AWS',  label:'Powered'            },
];

const WHY = [
  'Eurocode 5 & BS 5268 compliant calculations',
  'Automated RFQ and procurement pipeline',
  'AI-powered member sizing and optimisation',
  'Real-time project tracking and event streaming',
  'East Africa supplier network integration',
  'Full calculation audit trail',
];

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      {/* ── Hero ───────────────────────────────────────────── */}
      <section className="hero-bg pt-16">
        <div className="relative overflow-hidden py-28 px-6 flex flex-col items-center text-center">
          <div className="absolute inset-0 opacity-[0.035] pointer-events-none"
            style={{ backgroundImage:'repeating-linear-gradient(87deg,transparent,transparent 3px,rgba(200,134,26,.8) 3px,rgba(200,134,26,.8) 4px)' }} />
          <div className="relative z-10 max-w-3xl fade-up">
            <span className="section-label mb-5 block">East Africa's Premier Platform</span>
            <h1 className="font-condensed font-extrabold text-white uppercase leading-none mb-6"
              style={{ fontSize:'clamp(48px,8vw,90px)' }}>
              Engineer Timber<br /><span className="text-amber">to New Levels</span>
            </h1>
            <span className="amber-divider" />
            <p className="font-barlow text-gray-300 text-lg leading-[1.7] max-w-xl mx-auto mb-10">
              Automated structural design, AI-powered member sizing and seamless procurement —
              all in one platform built for East African timber construction.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Link to="/signup"   className="btn-amber px-8 py-3.5 text-[12px]">Get Started Free <ArrowRight size={14}/></Link>
              <Link to="/services" className="btn-outline-amber px-8 py-3.5 text-[12px]">Explore Services</Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Services Preview ───────────────────────────────── */}
      <section className="py-20 px-6 bg-page">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <span className="section-label mb-4 block">What We Offer</span>
            <h2 className="font-condensed font-extrabold text-heading uppercase"
              style={{ fontSize:'clamp(32px,5vw,56px)' }}>Our Services</h2>
            <span className="amber-divider" />
            <p className="font-barlow text-body text-[16px] leading-[1.7] max-w-[540px] mx-auto mt-2">
              End-to-end timber engineering services powered by advanced AWS cloud infrastructure
              and AI — everything from concept to site delivery.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {SERVICES.map(s => <ServiceCard key={s.title} {...s} />)}
          </div>
          <div className="text-center mt-10">
            <Link to="/services" className="btn-outline-dark px-8 py-3">
              View All Services <ArrowRight size={13}/>
            </Link>
          </div>
        </div>
      </section>

      {/* ── Stats ──────────────────────────────────────────── */}
      <section style={{ backgroundColor:'#111111' }} className="py-16 px-6">
        <div className="max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {STATS.map(s => (
            <div key={s.label}>
              <div className="font-condensed font-bold text-amber mb-1"
                style={{ fontSize:'clamp(36px,5vw,52px)' }}>{s.value}</div>
              <div className="font-barlow text-[13px] text-gray-400 uppercase tracking-widest">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Why Choose ─────────────────────────────────────── */}
      <section className="py-20 px-6 bg-page">
        <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <div>
            <span className="section-label mb-4 block">Our Advantage</span>
            <h2 className="font-condensed font-extrabold text-heading uppercase mb-2"
              style={{ fontSize:'clamp(28px,4vw,44px)' }}>Why Choose TimberStruct?</h2>
            <span className="amber-divider-left" />
            <p className="font-barlow text-body text-[15px] leading-[1.7] mb-8 mt-4">
              Built by structural engineers who were tired of manual calculations, disconnected procurement
              spreadsheets, and supplier phone-tag. We automated everything.
            </p>
            <ul className="space-y-3">
              {WHY.map(w => (
                <li key={w} className="flex items-start gap-3 font-barlow text-[14px] text-body">
                  <CheckCircle size={16} className="text-amber mt-0.5 flex-shrink-0"/>{w}
                </li>
              ))}
            </ul>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {[['500+','Projects'],['32','Years'],['4','Countries'],['98%','Satisfaction']].map(([v,l])=>(
              <div key={l} className="bg-white border border-border rounded-xl p-6 text-center hover:shadow-md transition-shadow">
                <div className="font-condensed font-bold text-amber text-4xl mb-1">{v}</div>
                <div className="font-barlow text-[12px] text-body uppercase tracking-widest">{l}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ────────────────────────────────────────────── */}
      <section className="py-24 px-6 bg-white text-center border-t border-border">
        <div className="max-w-xl mx-auto">
          <span className="section-label mb-4 block">Ready to Begin?</span>
          <h2 className="font-condensed font-extrabold text-heading uppercase mb-4"
            style={{ fontSize:'clamp(28px,4vw,44px)' }}>Ready to Engineer Smarter?</h2>
          <span className="amber-divider" />
          <p className="font-barlow text-body text-[16px] leading-[1.7] mb-10 mt-4">
            Join hundreds of East African structural engineers and contractors already using
            TimberStruct to design faster, buy smarter and build better.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link to="/signup"  className="btn-amber px-8 py-3.5">Create Free Account <ArrowRight size={14}/></Link>
            <Link to="/contact" className="btn-outline-dark px-8 py-3.5">Talk to an Engineer</Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
