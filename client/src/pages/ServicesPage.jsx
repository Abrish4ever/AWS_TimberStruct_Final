import { Link } from 'react-router-dom';
import { ArrowRight, LayoutGrid, Package, Zap, CheckCircle, Star } from 'lucide-react';
import Navbar from '../components/layout/Navbar';
import Footer from '../components/layout/Footer';

const SERVICES = [
  {
    id:'structural', label:'Service & Engineering', title:'Structural Design', Icon:LayoutGrid,
    tagline:'Eurocode 5 compliant analysis in seconds — not days.',
    description:'Our structural design engine automates the full member sizing workflow for timber roofs, frames and trusses. Input spans and loads; get code-compliant member schedules, buckling checks and deflection results — all traceable to Eurocode 5, BS 5268 and East African standards.',
    features:['Strut, rafter, beam and post analysis','Slenderness ratio & Euler buckling checks','Deflection verification (span/300 limit)','Auto-generated Bill of Materials','C16, C24, GL24h, GL28h grade support','Full calculation audit trail'],
    metric:{ value:'< 2s', label:'Analysis time per member' },
  },
  {
    id:'procurement', label:'Service & Procurement', title:'Procurement Automation', Icon:Package,
    tagline:'From approved design to purchase order in one click.',
    description:'TimberStruct eliminates the procurement bottleneck by connecting structural designs directly to your supplier network. Automated RFQs are dispatched in parallel; quotes are scored on price, lead time and reliability. One click generates a compliant purchase order.',
    features:['Automated multi-supplier RFQ dispatch','Side-by-side quote comparison dashboard','Waste-optimised cutting list generation','Live stock availability checking','Delivery scheduling linked to project timeline','One-click purchase order generation'],
    metric:{ value:'18%', label:'Average material saving' },
  },
  {
    id:'ai', label:'Service & AI Intelligence', title:'AI Design Assistant', Icon:Zap,
    tagline:'Describe your project in plain English — AI does the rest.',
    description:'Powered by Amazon Bedrock, our AI interprets natural-language project briefs, extracts structural parameters, sizes members automatically and reviews designs for compliance risks. It surfaces value engineering opportunities and flags potential failures before they reach site.',
    features:['Natural language project brief interpretation','Automatic structural parameter extraction','Instant member sizing from description','Code compliance risk flagging','Value engineering recommendations','Streaming token-by-token responses'],
    metric:{ value:'10×', label:'Faster than manual design' },
  },
];

const PROCESS = [
  { step:'01', title:'Describe',  desc:'Input your project brief — spans, loads, location, use type.' },
  { step:'02', title:'Analyse',   desc:'Eurocode 5 checks run and all members are sized instantly.' },
  { step:'03', title:'Procure',   desc:'Automated RFQs go to your supplier network for competitive quotes.' },
  { step:'04', title:'Deliver',   desc:'Approve the PO; track delivery against your project schedule.' },
];

const TESTIMONIALS = [
  { name:'David Kamau',    role:'Head of Projects',   company:'Acacia Developers',     rating:5, quote:'TimberStruct cut our structural design time from three days to under an hour. The procurement automation alone saved us over KES 400,000 on the Westlands project.' },
  { name:'Dr. Fatima Hassan', role:'Structural Engineer', company:'GreenBuild Consultants', rating:5, quote:'The Eurocode 5 compliance checks give me complete confidence in every design. I can produce five times more work with the same team.' },
];

function ServiceBlock({ s, even }) {
  return (
    <div id={s.id} className={`py-20 px-6 ${even ? 'bg-page' : 'bg-white'}`}>
      <div className={`max-w-6xl mx-auto flex flex-col ${even ? 'lg:flex-row' : 'lg:flex-row-reverse'} gap-16 items-start`}>
        {/* Text */}
        <div className="flex-1 max-w-xl">
          <span className="section-label mb-4 block">{s.label}</span>
          <h2 className="font-condensed font-extrabold text-heading uppercase mb-3"
            style={{ fontSize:'clamp(30px,4vw,48px)' }}>{s.title}</h2>
          <span className="amber-divider-left" />
          <p className="font-barlow font-semibold text-[16px] text-heading mb-4 leading-snug italic mt-4">
            "{s.tagline}"
          </p>
          <p className="font-barlow text-body text-[15px] leading-[1.7] mb-8">{s.description}</p>
          <ul className="space-y-3 mb-10">
            {s.features.map(f=>(
              <li key={f} className="flex items-start gap-3 font-barlow text-[14px] text-body">
                <CheckCircle size={15} className="text-amber mt-0.5 flex-shrink-0"/>{f}
              </li>
            ))}
          </ul>
          <Link to="/signup" className="btn-amber">Get Started <ArrowRight size={14}/></Link>
        </div>
        {/* Visual */}
        <div className="flex-1 w-full">
          <div className="bg-heading rounded-xl p-10 mb-5 text-center">
            <s.Icon size={44} className="text-amber mx-auto mb-5" strokeWidth={1.4}/>
            <div className="font-condensed font-bold text-amber mb-2"
              style={{ fontSize:'clamp(48px,6vw,72px)' }}>{s.metric.value}</div>
            <div className="font-barlow text-[12px] text-gray-400 uppercase tracking-widest">{s.metric.label}</div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {s.features.slice(0,4).map((f,i)=>(
              <div key={i} className="bg-white border border-border rounded-lg p-4">
                <div className="w-5 h-5 rounded bg-amber/10 flex items-center justify-center mb-2">
                  <div className="w-2 h-2 rounded-full bg-amber"/>
                </div>
                <p className="font-barlow text-[12px] text-body leading-snug">{f}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ServicesPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar/>

      {/* Hero */}
      <div className="hero-bg pt-16">
        <div className="py-24 px-6 text-center">
          <div className="max-w-2xl mx-auto fade-up">
            <span className="section-label mb-5 block">Platform Capabilities</span>
            <h1 className="font-condensed font-extrabold text-white uppercase leading-none mb-6"
              style={{ fontSize:'clamp(40px,7vw,72px)' }}>Our Services</h1>
            <span className="amber-divider"/>
            <p className="font-barlow text-gray-300 text-lg leading-[1.7] max-w-lg mx-auto my-7">
              Three integrated services — structural design, procurement automation and AI intelligence —
              engineered to work together seamlessly across your entire project lifecycle.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              {SERVICES.map(s=>(
                <a key={s.id} href={`#${s.id}`}
                  className="inline-flex items-center gap-2 font-barlow font-semibold uppercase
                             tracking-widest text-[11px] border border-white/20 text-white/80
                             hover:border-amber hover:text-amber px-4 py-2 rounded transition-colors">
                  <s.Icon size={12}/>{s.title}
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Service blocks */}
      {SERVICES.map((s,i) => <ServiceBlock key={s.id} s={s} even={i%2===0}/>)}

      {/* Process */}
      <section style={{ backgroundColor:'#111111' }} className="py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <span className="section-label mb-4 block">How It Works</span>
            <h2 className="font-condensed font-extrabold text-white uppercase"
              style={{ fontSize:'clamp(28px,4vw,48px)' }}>From Brief to Delivery</h2>
            <span className="amber-divider"/>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {PROCESS.map((p,i)=>(
              <div key={p.step} className="bg-white/5 border border-white/10 rounded-xl p-6">
                <div className="font-condensed font-bold text-amber text-3xl mb-3">{p.step}</div>
                <h3 className="font-condensed font-bold text-white uppercase text-xl mb-2">{p.title}</h3>
                <p className="font-barlow text-[14px] text-gray-400 leading-relaxed">{p.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20 px-6 bg-page">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <span className="section-label mb-4 block">Client Results</span>
            <h2 className="font-condensed font-extrabold text-heading uppercase"
              style={{ fontSize:'clamp(28px,4vw,48px)' }}>What Our Clients Say</h2>
            <span className="amber-divider"/>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {TESTIMONIALS.map(t=>(
              <div key={t.name} className="bg-white border border-border rounded-xl p-8">
                <div className="flex gap-1 mb-5">
                  {[...Array(t.rating)].map((_,i)=><Star key={i} size={13} className="text-amber fill-amber"/>)}
                </div>
                <p className="font-barlow text-[15px] text-body leading-[1.7] italic mb-6">"{t.quote}"</p>
                <div className="border-t border-border pt-4">
                  <p className="font-barlow font-bold text-heading text-[15px]">{t.name}</p>
                  <p className="font-barlow text-[12px] text-amber">{t.role} · {t.company}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-6 bg-white text-center border-t border-border">
        <div className="max-w-xl mx-auto">
          <span className="section-label mb-4 block">Start Today</span>
          <h2 className="font-condensed font-extrabold text-heading uppercase mb-4"
            style={{ fontSize:'clamp(26px,4vw,44px)' }}>Ready to Engineer Smarter?</h2>
          <span className="amber-divider"/>
          <p className="font-barlow text-body text-[16px] leading-[1.7] my-8">
            Create your free account and run your first structural analysis in under five minutes.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link to="/signup"  className="btn-amber px-8 py-3.5">Create Free Account <ArrowRight size={14}/></Link>
            <Link to="/contact" className="btn-outline-dark px-8 py-3.5">Talk to an Engineer</Link>
          </div>
        </div>
      </section>

      <Footer/>
    </div>
  );
}
