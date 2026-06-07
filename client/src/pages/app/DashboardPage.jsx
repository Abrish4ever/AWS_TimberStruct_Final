import { Link } from 'react-router-dom';
import { LayoutGrid, Package, Zap, ArrowRight, CheckCircle, Clock, TrendingUp } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import AppLayout from './AppLayout';

const SERVICES = [
  {
    to:    '/app/structural',
    icon:  LayoutGrid,
    label: 'Structural Design',
    desc:  'Eurocode 5 compliant analysis — struts, rafters, beams, trusses. Member sizing in seconds.',
    color: '#C8861A',
    features: ['Strut & rafter analysis', 'Buckling checks', 'BOM generation'],
    badge: 'EC5 Compliant',
  },
  {
    to:    '/app/procurement',
    icon:  Package,
    label: 'Procurement Automation',
    desc:  'Automated RFQ, multi-supplier comparison and one-click purchase orders.',
    color: '#2563eb',
    features: ['Multi-supplier RFQ', 'Quote comparison', 'Purchase orders'],
    badge: 'Automated',
  },
  {
    to:    '/app/ai',
    icon:  Zap,
    label: 'AI Design Assistant',
    desc:  'Describe your project in plain English. AI sizes members and flags risks instantly.',
    color: '#16a34a',
    features: ['Natural language input', 'Instant sizing', 'Risk flagging'],
    badge: 'AI Powered',
  },
];

const QUICK_STATS = [
  { icon: TrendingUp, label: 'Analyses Run',      value: '0', sub: 'Start your first' },
  { icon: Package,    label: 'Orders Created',     value: '0', sub: 'No orders yet'    },
  { icon: CheckCircle,label: 'Projects Complete',  value: '0', sub: 'Get started'       },
  { icon: Clock,      label: 'Avg. Analysis Time', value: '< 2s', sub: 'Per member'    },
];

export default function DashboardPage() {
  const { user } = useAuth();
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <AppLayout>
      <div className="p-6 md:p-8 max-w-6xl mx-auto">

        {/* Welcome */}
        <div className="mb-10">
          <p className="section-label mb-2">{greeting}</p>
          <h1 className="font-condensed font-extrabold text-heading uppercase"
            style={{ fontSize: 'clamp(28px,4vw,44px)' }}>
            Welcome, {user?.name?.split(' ')[0]}
          </h1>
          <p className="font-barlow text-body text-[15px] mt-2">
            Select a service below to get started. All tools are available to you right now.
          </p>
        </div>

        {/* Service Cards — the main launchers */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          {SERVICES.map(s => (
            <Link key={s.to} to={s.to}
              className="group bg-white border border-border rounded-xl p-7 flex flex-col
                         hover:shadow-xl hover:-translate-y-1 transition-all duration-200">

              {/* Icon + badge */}
              <div className="flex items-start justify-between mb-5">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center"
                  style={{ backgroundColor: s.color + '15' }}>
                  <s.icon size={24} style={{ color: s.color }} strokeWidth={1.8} />
                </div>
                <span className="font-barlow text-[10px] font-bold uppercase tracking-widest
                                 px-2 py-1 rounded"
                  style={{ color: s.color, backgroundColor: s.color + '15' }}>
                  {s.badge}
                </span>
              </div>

              <h3 className="font-barlow font-bold text-heading text-[18px] mb-2">{s.label}</h3>

              {/* Amber divider */}
              <div className="w-8 h-[2px] bg-amber mb-4 group-hover:w-14 transition-all duration-300" />

              <p className="font-barlow text-body text-[14px] leading-relaxed flex-1">{s.desc}</p>

              <ul className="mt-5 space-y-1.5 mb-6">
                {s.features.map(f => (
                  <li key={f} className="flex items-center gap-2 font-barlow text-[13px] text-body">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber flex-shrink-0" />{f}
                  </li>
                ))}
              </ul>

              <div className="flex items-center gap-1.5 font-barlow font-semibold uppercase
                              tracking-widest text-[11px] text-amber group-hover:gap-3 transition-all">
                Open Tool <ArrowRight size={13} />
              </div>
            </Link>
          ))}
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {QUICK_STATS.map(s => (
            <div key={s.label} className="bg-white border border-border rounded-xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <s.icon size={15} className="text-amber" />
                <span className="font-barlow text-[11px] text-gray-400 uppercase tracking-widest">{s.label}</span>
              </div>
              <div className="font-condensed font-bold text-heading text-3xl mb-0.5">{s.value}</div>
              <p className="font-barlow text-[12px] text-gray-400">{s.sub}</p>
            </div>
          ))}
        </div>

        {/* Quick start guide */}
        <div className="bg-heading rounded-xl p-7 text-white">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div>
              <h3 className="font-condensed font-bold uppercase text-xl mb-2">Quick Start Guide</h3>
              <div className="w-8 h-[2px] bg-amber mb-4" />
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mt-4">
                {[
                  { step:'01', title:'Describe Project', desc:'Input spans, loads and location — or describe in plain English to the AI.' },
                  { step:'02', title:'Run Analysis',     desc:'Structural members are sized automatically to Eurocode 5 in under 2 seconds.' },
                  { step:'03', title:'Procure Timber',   desc:'Approve the BOM, dispatch RFQs to suppliers, compare quotes and place your order.' },
                ].map(s => (
                  <div key={s.step} className="flex gap-4">
                    <div className="font-condensed font-bold text-amber text-2xl flex-shrink-0">{s.step}</div>
                    <div>
                      <p className="font-barlow font-semibold text-white text-[14px] mb-1">{s.title}</p>
                      <p className="font-barlow text-gray-400 text-[13px] leading-relaxed">{s.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
