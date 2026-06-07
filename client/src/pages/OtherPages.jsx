import { Link } from 'react-router-dom';
import { ArrowRight, MapPin, Mail, Phone, Clock, CheckCircle } from 'lucide-react';
import Navbar from '../components/layout/Navbar';
import Footer from '../components/layout/Footer';

export function AboutPage() {
  return (
    <div className="min-h-screen flex flex-col"><Navbar/>
      <div className="hero-bg pt-16">
        <div className="py-24 px-6 text-center">
          <div className="max-w-2xl mx-auto fade-up">
            <span className="section-label mb-5 block">Our Story</span>
            <h1 className="font-condensed font-extrabold text-white uppercase mb-6" style={{fontSize:'clamp(40px,7vw,72px)'}}>About TimberStruct</h1>
            <span className="amber-divider"/>
            <p className="font-barlow text-gray-300 text-lg leading-[1.7] max-w-lg mx-auto mt-6">32 years of structural engineering expertise, now automated and available to every timber construction professional in East Africa.</p>
          </div>
        </div>
      </div>
      <section className="py-20 px-6 bg-page">
        <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16 items-start">
          <div>
            <span className="section-label mb-4 block">Who We Are</span>
            <h2 className="font-condensed font-extrabold text-heading uppercase mb-2" style={{fontSize:'clamp(28px,4vw,44px)'}}>Building the Future of Timber Engineering</h2>
            <span className="amber-divider-left"/>
            <p className="font-barlow text-body text-[15px] leading-[1.7] mb-5 mt-4">TimberStruct was founded by structural engineers tired of the same problem: brilliant timber designs delayed by weeks of manual calculations, disconnected procurement spreadsheets and supplier phone-tag.</p>
            <p className="font-barlow text-body text-[15px] leading-[1.7] mb-8">We built the platform we wished existed — automating everything from Eurocode 5 member sizing to purchase order generation, connected to a live East African supplier network.</p>
            <ul className="space-y-3 mb-8">
              {['Founded by practising structural engineers','Built on AWS cloud infrastructure','Serving Kenya, Uganda, Tanzania & beyond','ISO-compliant calculation methodology'].map(f=>(
                <li key={f} className="flex items-start gap-3 font-barlow text-[14px] text-body">
                  <CheckCircle size={15} className="text-amber mt-0.5 flex-shrink-0"/>{f}
                </li>
              ))}
            </ul>
            <Link to="/signup" className="btn-amber">Get Started Free <ArrowRight size={14}/></Link>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {[['32','Years Experience'],['500+','Projects'],['4','Countries'],['98%','Satisfaction']].map(([v,l])=>(
              <div key={l} className="bg-white border border-border rounded-xl p-6 text-center hover:shadow-md transition-shadow">
                <div className="font-condensed font-bold text-amber text-4xl mb-1">{v}</div>
                <div className="font-barlow text-[12px] text-body uppercase tracking-widest">{l}</div>
              </div>
            ))}
          </div>
        </div>
      </section>
      <Footer/>
    </div>
  );
}

export function ContactPage() {
  return (
    <div className="min-h-screen flex flex-col"><Navbar/>
      <div className="hero-bg pt-16">
        <div className="py-24 px-6 text-center">
          <div className="max-w-xl mx-auto fade-up">
            <span className="section-label mb-5 block">Get In Touch</span>
            <h1 className="font-condensed font-extrabold text-white uppercase mb-6" style={{fontSize:'clamp(40px,7vw,72px)'}}>Contact Us</h1>
            <span className="amber-divider"/>
            <p className="font-barlow text-gray-300 text-lg leading-[1.7] mt-6">Talk to a TimberStruct engineer — we respond within 24 hours.</p>
          </div>
        </div>
      </div>
      <section className="py-20 px-6 bg-page">
        <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16">
          <div>
            <span className="section-label mb-4 block">Contact Info</span>
            <h2 className="font-condensed font-extrabold text-heading uppercase mb-2" style={{fontSize:'clamp(24px,3vw,36px)'}}>We're here to help</h2>
            <span className="amber-divider-left"/>
            <ul className="space-y-5 mt-8">
              {[[MapPin,'Address','Nairobi, Kenya'],[Mail,'Email','info@timberstruct.co.ke'],[Phone,'Phone','+254 800 TIMBER'],[Clock,'Hours','Mon–Sat: 7:00AM – 6:00PM EAT']].map(([Icon,label,val])=>(
                <li key={label} className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-amber flex items-center justify-center rounded flex-shrink-0">
                    <Icon size={17} className="text-white"/>
                  </div>
                  <div>
                    <div className="font-barlow font-semibold text-[11px] uppercase tracking-widest text-gray-400 mb-0.5">{label}</div>
                    <div className="font-barlow text-heading text-[15px]">{val}</div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
          <div className="bg-white border border-border rounded-xl p-8">
            <h3 className="font-condensed font-bold text-heading uppercase text-xl mb-6">Send a Message</h3>
            <div className="space-y-4">
              {[['Full Name','text','Jane Mwangi'],['Email','email','jane@company.com'],['Project Type','text','e.g. Commercial Roof']].map(([l,t,ph])=>(
                <div key={l}>
                  <label className="block font-barlow font-semibold uppercase tracking-[0.1em] text-[11px] text-sub mb-1.5">{l}</label>
                  <input className="ts-input" type={t} placeholder={ph}/>
                </div>
              ))}
              <div>
                <label className="block font-barlow font-semibold uppercase tracking-[0.1em] text-[11px] text-sub mb-1.5">Message</label>
                <textarea className="ts-input h-28 resize-none" placeholder="Tell us about your project…"/>
              </div>
              <button className="btn-amber w-full justify-center py-3.5">Send Message <ArrowRight size={14}/></button>
            </div>
          </div>
        </div>
      </section>
      <Footer/>
    </div>
  );
}
