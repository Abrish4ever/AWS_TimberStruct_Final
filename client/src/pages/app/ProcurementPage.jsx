import { useState } from 'react';
import { Package, Send, Truck, CheckCircle, Clock, Plus, X, Star, ArrowRight, Download } from 'lucide-react';
import AppLayout from './AppLayout';

const SUPPLIERS = [
  { id:1, name:'TimberCo East Africa', region:'Nairobi',       rating:4.8, lead:5,  speciality:'Structural Softwood' },
  { id:2, name:'Nordic Timber Ltd',    region:'Kampala',       rating:4.5, lead:12, speciality:'C24/C16 Graded' },
  { id:3, name:'Savanna Hardwoods',    region:'Dar es Salaam', rating:4.2, lead:8,  speciality:'Hardwood & Glulam' },
  { id:4, name:'EcoForest Supplies',   region:'Mombasa',       rating:4.7, lead:6,  speciality:'FSC Certified' },
];

const SPECIES = ['Scots Pine','Douglas Fir','Spruce','Iroko','Glulam'];
const GRADES  = ['C16','C24','GL24h','GL28h'];
const STATUS_CFG = {
  rfq:        { label:'RFQ Sent',   cls:'bg-yellow-50 text-yellow-700 border-yellow-200', Icon:Send        },
  in_transit: { label:'In Transit', cls:'bg-blue-50   text-blue-700   border-blue-200',   Icon:Truck       },
  delivered:  { label:'Delivered',  cls:'bg-green-50  text-green-700  border-green-200',  Icon:CheckCircle },
  pending:    { label:'Pending',    cls:'bg-gray-50   text-gray-500   border-gray-200',   Icon:Clock       },
};

function Badge({ status }) {
  const cfg = STATUS_CFG[status] || STATUS_CFG.pending;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[11px] font-barlow font-semibold uppercase tracking-wider ${cfg.cls}`}>
      <cfg.Icon size={11} />{cfg.label}
    </span>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="block font-barlow font-semibold uppercase tracking-[0.1em] text-[11px] text-sub mb-1.5">{label}</label>
      {children}
    </div>
  );
}

export default function ProcurementPage() {
  const [orders, setOrders]     = useState([
    { id:1, supplier:'TimberCo East Africa', species:'Scots Pine',  grade:'C24',   section:'47×200mm', qty:148.8, unitPrice:42.5, total:6324,   status:'delivered',  date:'2025-02-10', notes:'Rafters batch 1' },
    { id:2, supplier:'Nordic Timber Ltd',    species:'Glulam',      grade:'GL24h', section:'147×297mm',qty:37.0,  unitPrice:285,  total:10545,  status:'in_transit', date:'2025-03-01', notes:'Ridge beam' },
    { id:3, supplier:'EcoForest Supplies',   species:'Iroko',       grade:'GL28h', section:'147×297mm',qty:60.0,  unitPrice:410,  total:24600,  status:'rfq',        date:null,         notes:'Awaiting quote' },
  ]);
  const [showNew,   setShowNew]   = useState(false);
  const [filterSt,  setFilterSt]  = useState('all');
  const [activeTab, setActiveTab] = useState('orders'); // 'orders' | 'suppliers'

  const [form, setForm] = useState({
    supplier:'', species:'Scots Pine', grade:'C24', section:'', qty:'', unitPrice:'', notes:'', status:'rfq',
  });
  const set = k => e => setForm(p => ({ ...p, [k]: e.target.value }));
  const total = (parseFloat(form.qty)||0) * (parseFloat(form.unitPrice)||0);

  const addOrder = () => {
    if (!form.supplier || !form.qty) return;
    setOrders(prev => [...prev, {
      id:        Date.now(),
      supplier:  form.supplier, species: form.species, grade: form.grade,
      section:   form.section,  qty: +form.qty, unitPrice: +form.unitPrice,
      total,     status: form.status, date: new Date().toISOString().slice(0,10),
      notes:     form.notes,
    }]);
    setForm({ supplier:'', species:'Scots Pine', grade:'C24', section:'', qty:'', unitPrice:'', notes:'', status:'rfq' });
    setShowNew(false);
  };

  const filtered = filterSt === 'all' ? orders : orders.filter(o => o.status === filterSt);
  const totalValue    = orders.reduce((s, o) => s + (o.total||0), 0);
  const deliveredVal  = orders.filter(o => o.status === 'delivered').reduce((s,o) => s+(o.total||0), 0);

  const exportOrders = () => {
    const rows = ['Supplier,Species,Grade,Section,Qty(m),Unit Price,Total,Status,Date,Notes'];
    orders.forEach(o => rows.push(`${o.supplier},${o.species},${o.grade},${o.section},${o.qty},${o.unitPrice},${o.total},${o.status},${o.date||''},${o.notes}`));
    const blob = new Blob([rows.join('\n')], { type:'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = 'timberstruct-orders.csv'; a.click();
  };

  return (
    <AppLayout>
      <div className="p-6 md:p-8 max-w-7xl mx-auto">

        {/* Header */}
        <div className="mb-8 flex items-start justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
              <Package size={20} className="text-blue-600" />
            </div>
            <div>
              <p className="section-label">Service & Procurement</p>
              <h1 className="font-condensed font-extrabold text-heading uppercase"
                style={{ fontSize:'clamp(24px,3vw,36px)' }}>Procurement Automation</h1>
            </div>
          </div>
          <button onClick={() => setShowNew(true)} className="btn-amber">
            <Plus size={15}/> New Order
          </button>
        </div>

        {/* KPI row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[
            { label:'Total Orders',     v:orders.length },
            { label:'Total Value',      v:`KES ${totalValue.toLocaleString()}` },
            { label:'In Transit',       v:orders.filter(o=>o.status==='in_transit').length },
            { label:'Delivered Value',  v:`KES ${deliveredVal.toLocaleString()}` },
          ].map(k=>(
            <div key={k.label} className="bg-white border border-border rounded-xl p-5">
              <p className="font-barlow text-[11px] text-gray-400 uppercase tracking-widest mb-2">{k.label}</p>
              <p className="font-condensed font-bold text-heading text-2xl">{k.v}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1 mb-5 w-fit">
          {[['orders','Orders'],['suppliers','Supplier Network']].map(([id,lbl])=>(
            <button key={id} onClick={()=>setActiveTab(id)}
              className={`px-4 py-2 rounded-md text-[12px] font-barlow font-semibold uppercase tracking-wider transition-all ${activeTab===id?'bg-white text-heading shadow-sm':'text-gray-400 hover:text-heading'}`}>
              {lbl}
            </button>
          ))}
        </div>

        {activeTab === 'orders' && (
          <>
            {/* Filters + export */}
            <div className="flex gap-2 flex-wrap items-center justify-between mb-4">
              <div className="flex gap-2 flex-wrap">
                {['all','rfq','in_transit','delivered','pending'].map(s=>(
                  <button key={s} onClick={()=>setFilterSt(s)}
                    className={`px-3 py-1.5 rounded text-[11px] font-barlow font-bold uppercase tracking-wider transition-all border ${filterSt===s?'bg-amber text-white border-amber':'bg-white text-gray-400 border-border hover:border-amber hover:text-amber'}`}>
                    {s.replace('_',' ')}
                  </button>
                ))}
              </div>
              <button onClick={exportOrders} className="btn-outline-dark !py-1.5 !px-3 !text-[11px]">
                <Download size={12}/> Export CSV
              </button>
            </div>

            <div className="bg-white border border-border rounded-xl overflow-hidden">
              <table className="tbl w-full">
                <thead className="bg-gray-50">
                  <tr>{['Supplier','Species','Grade','Section','Qty (m)','Unit Price','Total','Status','Date','Notes'].map(h=><th key={h} className="px-4 py-3">{h}</th>)}</tr>
                </thead>
                <tbody>
                  {filtered.map(o=>(
                    <tr key={o.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 font-semibold text-heading text-sm">{o.supplier}</td>
                      <td className="px-4 py-3 text-sm">{o.species}</td>
                      <td className="px-4 py-3"><span className="font-mono text-xs bg-amber/10 text-amber px-2 py-0.5 rounded">{o.grade}</span></td>
                      <td className="px-4 py-3 font-mono text-xs">{o.section}</td>
                      <td className="px-4 py-3 text-sm">{o.qty}m</td>
                      <td className="px-4 py-3 text-sm">KES {(o.unitPrice||0).toFixed(0)}/m</td>
                      <td className="px-4 py-3 font-barlow font-bold text-amber text-sm">KES {(o.total||0).toLocaleString()}</td>
                      <td className="px-4 py-3"><Badge status={o.status}/></td>
                      <td className="px-4 py-3 text-xs text-gray-400">{o.date||'—'}</td>
                      <td className="px-4 py-3 text-xs text-gray-400 max-w-[150px] truncate">{o.notes}</td>
                    </tr>
                  ))}
                  {!filtered.length && (
                    <tr><td colSpan="10" className="px-4 py-12 text-center text-gray-300 font-barlow text-sm">No orders found</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}

        {activeTab === 'suppliers' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {SUPPLIERS.map(s=>(
              <div key={s.id} className="bg-white border border-border rounded-xl p-5 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h4 className="font-barlow font-bold text-heading text-[14px] leading-snug">{s.name}</h4>
                    <p className="font-barlow text-[12px] text-gray-400 mt-0.5">{s.region}</p>
                  </div>
                  <div className="flex items-center gap-1 bg-amber/10 rounded px-2 py-1">
                    <Star size={11} className="text-amber fill-amber"/>
                    <span className="font-barlow font-bold text-amber text-[12px]">{s.rating}</span>
                  </div>
                </div>
                <div className="h-1.5 bg-gray-100 rounded-full mb-3 overflow-hidden">
                  <div className="h-full bg-amber rounded-full" style={{width:`${(s.rating/5)*100}%`}}/>
                </div>
                <div className="space-y-1.5 text-xs font-barlow text-gray-400">
                  <div className="flex justify-between"><span>Speciality</span><span className="text-body">{s.speciality}</span></div>
                  <div className="flex justify-between"><span>Lead Time</span><span className="text-body">{s.lead} days</span></div>
                </div>
                <button onClick={()=>{ setForm(p=>({...p,supplier:s.name})); setShowNew(true); setActiveTab('orders'); }}
                  className="mt-4 w-full text-[11px] font-barlow font-semibold uppercase tracking-widest text-amber hover:text-amber-dark flex items-center justify-center gap-1 transition-colors">
                  Create Order <ArrowRight size={11}/>
                </button>
              </div>
            ))}
          </div>
        )}

        {/* ── New Order Modal ── */}
        {showNew && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white border border-border rounded-xl w-full max-w-lg p-6 shadow-xl">
              <div className="flex items-center justify-between mb-5">
                <h3 className="font-barlow font-bold text-heading text-[18px]">New Procurement Order</h3>
                <button onClick={()=>setShowNew(false)} className="text-gray-400 hover:text-heading"><X size={20}/></button>
              </div>
              <div className="space-y-4">
                <Field label="Supplier">
                  <select className="ts-select" value={form.supplier} onChange={set('supplier')}>
                    <option value="">— select supplier —</option>
                    {SUPPLIERS.map(s=><option key={s.id} value={s.name}>{s.name} ({s.region})</option>)}
                  </select>
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Species">
                    <select className="ts-select" value={form.species} onChange={set('species')}>
                      {SPECIES.map(s=><option key={s}>{s}</option>)}
                    </select>
                  </Field>
                  <Field label="Grade">
                    <select className="ts-select" value={form.grade} onChange={set('grade')}>
                      {GRADES.map(g=><option key={g}>{g}</option>)}
                    </select>
                  </Field>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Section (mm)"><input className="ts-input" placeholder="e.g. 47×200mm" value={form.section} onChange={set('section')}/></Field>
                  <Field label="Status">
                    <select className="ts-select" value={form.status} onChange={set('status')}>
                      {Object.entries(STATUS_CFG).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
                    </select>
                  </Field>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Quantity (m)"><input className="ts-input" type="number" value={form.qty} onChange={set('qty')} placeholder="0.0"/></Field>
                  <Field label="Unit Price (KES/m)"><input className="ts-input" type="number" value={form.unitPrice} onChange={set('unitPrice')} placeholder="0.00"/></Field>
                </div>
                {total > 0 && (
                  <div className="flex justify-between items-center bg-amber/5 border border-amber/20 rounded-lg px-4 py-3">
                    <span className="font-barlow text-[13px] text-gray-500">Total Order Value</span>
                    <span className="font-condensed font-bold text-amber text-xl">KES {total.toLocaleString()}</span>
                  </div>
                )}
                <Field label="Notes"><input className="ts-input" placeholder="Delivery instructions, specs..." value={form.notes} onChange={set('notes')}/></Field>
              </div>
              <div className="flex gap-3 justify-end mt-5">
                <button onClick={()=>setShowNew(false)} className="btn-outline-dark !py-2 !px-4">Cancel</button>
                <button onClick={addOrder} className="btn-amber"><Plus size={15}/> Create Order</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
