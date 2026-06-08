// ╔═══════════════════════════════════════════════════════════╗
// ║  TimberStruct — Procurement Automation                    ║
// ║  Fastener categories: Screws · Bolts · Nails · Hangers   ║
// ║  Fully wired to MySQL backend via REST API                ║
// ║                                                           ║
// ║  BACKEND ROUTES USED:                                     ║
// ║   GET  /api/procurement/stats                             ║
// ║   GET  /api/procurement/orders                            ║
// ║   POST /api/procurement/orders          (single)          ║
// ║   POST /api/procurement/orders/bulk     (multiple)        ║
// ║   PUT  /api/procurement/orders/:id      (status update)   ║
// ║   DELETE /api/procurement/orders/:id                      ║
// ║   POST /api/procurement/rfq             (dispatch)        ║
// ║   GET  /api/procurement/rfq                               ║
// ║   GET  /api/procurement/fasteners       (from design)     ║
// ║   GET  /api/suppliers                                     ║
// ╚═══════════════════════════════════════════════════════════╝

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Package, Send, Truck, CheckCircle, Clock, Plus, X, Star,
  Download, Upload, FileText, ArrowRight, Zap, Search,
  Mail, Phone, MapPin, Eye, DollarSign, LayoutGrid,
  ShoppingCart, Trash2, AlertTriangle, Loader, RefreshCw,
  ChevronDown, ChevronUp
} from 'lucide-react';
import { api } from '../../context/AuthContext';
import AppLayout from './AppLayout';

// ─────────────────────────────────────────────────────────────
//  FASTENER CATALOGUE — only 4 categories
// ─────────────────────────────────────────────────────────────
const CAT = {
  screws: {
    label: 'Screws', icon: '🔩', color: '#C8861A',
    bg: 'rgba(200,134,26,0.10)', border: 'rgba(200,134,26,0.30)',
    items: [
      'Timber Screws (Self-drilling)',
      'Coach Screws (Hex head)',
      'Structural Screws (ASSY type)',
      'Decking Screws (Countersunk)',
    ],
    diameters: ['4mm','5mm','6mm','8mm','10mm','12mm'],
    lengths:   ['50mm','75mm','100mm','120mm','150mm','200mm','220mm'],
    grades:    ['Grade 4.6 Zinc Plated','Grade 4.8 BZP','Grade 5.6 Galvanised','A2 Stainless Steel','A4 Stainless Steel'],
  },
  bolts: {
    label: 'Bolts', icon: '🔧', color: '#2563eb',
    bg: 'rgba(37,99,235,0.08)', border: 'rgba(37,99,235,0.25)',
    items: [
      'Carriage Bolts (Round head)',
      'Coach Bolts (Cup square)',
      'Hex Bolts + Nut + Washer',
      'Anchor Bolts (Expansion type)',
    ],
    diameters: ['8mm','10mm','12mm','16mm','20mm'],
    lengths:   ['60mm','80mm','100mm','150mm','200mm','250mm','300mm'],
    grades:    ['Grade 4.6 HDG','Grade 8.8 HDG','Grade 10.9 HDG','A2 Stainless Steel','A4 Stainless Steel'],
  },
  nails: {
    label: 'Nails', icon: '📌', color: '#16a34a',
    bg: 'rgba(22,163,74,0.08)', border: 'rgba(22,163,74,0.25)',
    items: [
      'Ring Shank Nails (Joist hanger)',
      'Smooth Shank Round Wire Nails',
      'Annular Ring Shank Nails',
      'Structural Nails (D-head)',
    ],
    diameters: ['2.5mm','3.0mm','3.1mm','3.4mm','3.5mm','4.0mm'],
    lengths:   ['32mm','38mm','50mm','65mm','75mm','90mm','100mm'],
    grades:    ['BZP (Bright Zinc Plated)','HDG (Hot Dip Galvanised)','Stainless Steel','Bright Smooth'],
  },
  hangers: {
    label: 'Hangers', icon: '🔗', color: '#7c3aed',
    bg: 'rgba(124,58,237,0.08)', border: 'rgba(124,58,237,0.25)',
    items: [
      'Joist Hangers (LUS type)',
      'Beam Hangers (LBC type)',
      'Post Bases (ABA/ABU type)',
      'Ridge Cap Connectors',
      'Rafter Tie-Down Straps',
    ],
    diameters: ['—'],
    lengths:   ['38mm','47mm','63mm','75mm','100mm','150mm','Standard'],
    grades:    ['G185 Galvanised','HDG Grade 275','Stainless Grade 304','Stainless Grade 316'],
  },
};

// map DB fastener_type_cat back to CAT key
const resolvecat = v => {
  if (!v) return 'screws';
  const k = String(v).toLowerCase();
  if (CAT[k]) return k;
  if (k.includes('bolt'))   return 'bolts';
  if (k.includes('nail'))   return 'nails';
  if (k.includes('hanger')) return 'hangers';
  return 'screws';
};

// ─────────────────────────────────────────────────────────────
//  STATUS CONFIG
// ─────────────────────────────────────────────────────────────
const STATUS = {
  rfq:        { label:'RFQ Sent',   dot:'bg-yellow-400', tag:'text-yellow-700 bg-yellow-50 border-yellow-200', Icon:Send         },
  quoted:     { label:'Quoted',     dot:'bg-purple-400', tag:'text-purple-700 bg-purple-50 border-purple-200', Icon:DollarSign   },
  in_transit: { label:'In Transit', dot:'bg-blue-400',   tag:'text-blue-700   bg-blue-50   border-blue-200',   Icon:Truck        },
  delivered:  { label:'Delivered',  dot:'bg-green-500',  tag:'text-green-700  bg-green-50  border-green-200',  Icon:CheckCircle  },
  pending:    { label:'Pending',    dot:'bg-gray-400',   tag:'text-gray-500   bg-gray-50   border-gray-200',   Icon:Clock        },
  cancelled:  { label:'Cancelled',  dot:'bg-red-400',    tag:'text-red-600    bg-red-50    border-red-200',    Icon:X            },
};

// ─────────────────────────────────────────────────────────────
//  STATIC FASTENER SCHEDULE (fallback when no DB design exists)
//  This is the EC5 output that would come from the structural design
// ─────────────────────────────────────────────────────────────
const STATIC_SCHEDULE = [
  { id:'fs1', cat:'screws',  item:'Timber Screws (Self-drilling)', diameter:'6mm',   length:'120mm', grade:'Grade 4.6 Zinc Plated', qty:240,  unit:'pcs', unit_cost:12,  total:2880,  used_in:'Rafter-to-ridge beam (2 per end × 24 rafters × 5 connections)', ec5:'EC5 cl.8.3 — Laterally loaded screws' },
  { id:'fs2', cat:'bolts',   item:'Coach Bolts (Cup square)',      diameter:'12mm',  length:'200mm', grade:'Grade 8.8 HDG',          qty:96,   unit:'pcs', unit_cost:85,  total:8160,  used_in:'Strut base & apex joints (4 per joint × 24 joints)',             ec5:'EC5 cl.8.5 — Bolted connections'      },
  { id:'fs3', cat:'nails',   item:'Ring Shank Nails (Joist hanger)',diameter:'3.1mm',length:'38mm',  grade:'BZP (Bright Zinc Plated)',qty:1440, unit:'pcs', unit_cost:2.5, total:3600,  used_in:'Joist hanger fixings (20 per hanger × 72 hangers)',              ec5:'EC5 cl.8.3 — Nailed connections'      },
  { id:'fs4', cat:'bolts',   item:'Carriage Bolts (Round head)',   diameter:'10mm',  length:'150mm', grade:'Grade 8.8 HDG',          qty:48,   unit:'pcs', unit_cost:65,  total:3120,  used_in:'Collar tie bolts (2 per collar × 24 collars)',                   ec5:'EC5 cl.8.5 — Bolted connections'      },
  { id:'fs5', cat:'hangers', item:'Joist Hangers (LUS type)',      diameter:'—',     length:'47mm',  grade:'G185 Galvanised',        qty:72,   unit:'pcs', unit_cost:180, total:12960, used_in:'Ceiling tie to ridge beam (all 72 ceiling ties)',                ec5:'EC5 cl.8 — Connector systems'         },
];

// ─────────────────────────────────────────────────────────────
//  SHARED UI ATOMS
// ─────────────────────────────────────────────────────────────
const Lbl = ({ t, req }) => (
  <label className="block font-barlow font-semibold uppercase tracking-[0.1em] text-[11px] text-sub mb-1.5">
    {t}{req && <span className="text-red-400 ml-0.5">*</span>}
  </label>
);

const StatusBadge = ({ s }) => {
  const c = STATUS[s] || STATUS.pending;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded border text-[11px] font-barlow font-semibold uppercase tracking-wider ${c.tag}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
      {c.label}
    </span>
  );
};

const CatTag = ({ cat }) => {
  const c = CAT[cat];
  if (!c) return null;
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-barlow font-bold uppercase tracking-wider"
      style={{ background: c.bg, color: c.color, border: `1px solid ${c.border}` }}>
      {c.icon} {c.label}
    </span>
  );
};

const Spin = () => <Loader size={16} className="animate-spin text-amber" />;

// Error banner
const Err = ({ msg, onDismiss }) => msg ? (
  <div className="flex items-center justify-between bg-red-50 border border-red-200 text-red-700 text-[13px] px-4 py-3 rounded-lg mb-4">
    <span><AlertTriangle size={14} className="inline mr-2" />{msg}</span>
    {onDismiss && <button onClick={onDismiss}><X size={14} /></button>}
  </div>
) : null;

// ─────────────────────────────────────────────────────────────
//  CATEGORY PICKER — 4 coloured buttons
// ─────────────────────────────────────────────────────────────
function CatPicker({ value, onChange }) {
  return (
    <div className="grid grid-cols-4 gap-2">
      {Object.values(CAT).map(c => {
        const active = value === c.key || value === c.label.toLowerCase();
        return (
          <button key={c.label} type="button" onClick={() => onChange(c.label.toLowerCase())}
            className={`flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl border-2 transition-all
              font-barlow font-bold text-[11px] uppercase tracking-wider
              ${active ? 'text-white shadow-md' : 'border-border bg-white text-gray-400 hover:border-gray-300'}`}
            style={active ? { borderColor: c.color, background: c.color } : {}}>
            <span className="text-2xl leading-none">{c.icon}</span>
            {c.label}
          </button>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
//  SINGLE ORDER LINE FORM (used inside NewOrderModal)
// ─────────────────────────────────────────────────────────────
function OrderLine({ line, idx, onChange, onRemove, canRemove }) {
  const catKey = resolvecat(line.cat);
  const c      = CAT[catKey] || CAT.screws;
  const est    = (Number(line.qty) || 0) * (Number(line.unit_cost) || 0);

  return (
    <div className="border border-border rounded-xl p-4 bg-white relative">
      {canRemove && (
        <button onClick={() => onRemove(idx)}
          className="absolute top-3 right-3 text-gray-300 hover:text-red-400 transition-colors z-10">
          <X size={15} />
        </button>
      )}

      {/* Row 1 — Category */}
      <div className="mb-4">
        <Lbl t="Fastener Category" req />
        <CatPicker value={line.cat} onChange={v => onChange(idx, 'cat', v)} />
      </div>

      {/* Row 2 — Item, Diameter, Length, Grade */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 mb-3">
        <div className="sm:col-span-2">
          <Lbl t="Item Name" req />
          <select className="ts-select text-[12px]" value={line.item}
            onChange={e => onChange(idx, 'item', e.target.value)}>
            <option value="">— select item —</option>
            {c.items.map(i => <option key={i} value={i}>{i}</option>)}
          </select>
        </div>
        <div>
          <Lbl t="Diameter" />
          <select className="ts-select text-[12px]" value={line.diameter}
            onChange={e => onChange(idx, 'diameter', e.target.value)}>
            <option value="">—</option>
            {c.diameters.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
        <div>
          <Lbl t="Length" />
          <select className="ts-select text-[12px]" value={line.length}
            onChange={e => onChange(idx, 'length', e.target.value)}>
            <option value="">—</option>
            {c.lengths.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
        </div>
      </div>

      {/* Row 3 — Grade, Qty, Cost, Total */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="col-span-2">
          <Lbl t="Grade / Spec" />
          <select className="ts-select text-[12px]" value={line.grade}
            onChange={e => onChange(idx, 'grade', e.target.value)}>
            <option value="">— select grade —</option>
            {c.grades.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
        </div>
        <div>
          <Lbl t="MTO Qty (pcs)" req />
          <input className="ts-input text-[12px]" type="number" min="1"
            value={line.qty} placeholder="0"
            onChange={e => onChange(idx, 'qty', e.target.value)} />
        </div>
        <div>
          <Lbl t="Unit Cost (KES)" />
          <input className="ts-input text-[12px]" type="number" min="0" step="0.01"
            value={line.unit_cost} placeholder="0.00"
            onChange={e => onChange(idx, 'unit_cost', e.target.value)} />
        </div>
      </div>

      {/* Row 4 — Used in + est total */}
      <div className="flex items-end gap-3 mt-3">
        <div className="flex-1">
          <Lbl t="Used In (structural connection)" />
          <input className="ts-input text-[12px]" value={line.used_in}
            onChange={e => onChange(idx, 'used_in', e.target.value)}
            placeholder="e.g. Rafter-to-ridge connections, 2 screws per joint × 24 rafters" />
        </div>
        {est > 0 && (
          <div className="flex-shrink-0 rounded-lg px-4 py-2.5 text-right"
            style={{ background: c.bg, border: `1px solid ${c.border}` }}>
            <p className="font-barlow text-[10px] text-gray-400 uppercase tracking-wider">Est. Total</p>
            <p className="font-condensed font-bold text-[18px]" style={{ color: c.color }}>
              KES {est.toLocaleString()}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
//  NEW ORDER MODAL — wired to POST /api/procurement/orders/bulk
// ─────────────────────────────────────────────────────────────
function NewOrderModal({ prefill, suppliers, onClose, onCreated }) {
  const fileRef = useRef(null);
  const [mode,     setMode]     = useState(prefill ? 'manual' : 'manual');
  const [lines,    setLines]    = useState(
    prefill
      ? prefill.map((f, i) => ({
          _id: i, cat: f.cat, item: f.item || f.fastener_type || '',
          diameter: (f.diameter === '—' ? '' : f.diameter) || '',
          length:   f.length  || '',
          grade:    f.grade   || f.grade_spec  || '',
          qty:      f.qty     || f.mto_qty     || '',
          unit_cost:f.unit_cost || f.unit_cost_kes || '',
          used_in:  f.used_in || '',
        }))
      : [{ _id: 0, cat: 'screws', item: '', diameter: '', length: '', grade: '', qty: '', unit_cost: '', used_in: '' }]
  );
  const [supplier,  setSupplier]  = useState('');
  const [reqDate,   setReqDate]   = useState('');
  const [address,   setAddress]   = useState('');
  const [loading,   setLoading]   = useState(false);
  const [err,       setErr]       = useState('');
  const [imported,  setImported]  = useState(false);

  const change  = (i, k, v) => setLines(p => p.map((l, j) => j === i ? { ...l, [k]: v } : l));
  const addLine = () => setLines(p => [...p, { _id: Date.now(), cat: 'screws', item: '', diameter: '', length: '', grade: '', qty: '', unit_cost: '', used_in: '' }]);
  const rmLine  = i  => setLines(p => p.filter((_, j) => j !== i));

  /* CSV import */
  const handleFile = useCallback(e => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const rows = ev.target.result.split('\n').map(r => r.trim()).filter(Boolean).slice(1);
      const parsed = rows.map((r, i) => {
        const c = r.split(',');
        const cat = (c[0] || 'screws').trim().toLowerCase();
        return { _id: i, cat, item: (c[1] || '').trim(), diameter: (c[2] || '').trim(), length: (c[3] || '').trim(), grade: (c[4] || '').trim(), qty: c[5] || '', unit_cost: c[6] || '', used_in: (c[7] || '').trim() };
      }).filter(r => r.item && ['screws','bolts','nails','hangers'].includes(r.cat));
      if (parsed.length) { setLines(parsed); setImported(true); }
      else setErr('No valid rows found. Make sure Category column is screws / bolts / nails / hangers.');
    };
    reader.readAsText(file);
  }, []);

  const dlTemplate = () => {
    const csv = [
      'Category,Item Name,Diameter,Length,Grade/Spec,Qty (pcs),Unit Cost (KES),Used In',
      'screws,Timber Screws (Self-drilling),6mm,120mm,Grade 4.6 Zinc Plated,240,12,Rafter-to-ridge connections',
      'bolts,Coach Bolts (Cup square),12mm,200mm,Grade 8.8 HDG,96,85,Strut base joints',
      'nails,Ring Shank Nails (Joist hanger),3.1mm,38mm,BZP (Bright Zinc Plated),1440,2.5,Joist hanger fixings',
      'hangers,Joist Hangers (LUS type),,47mm,G185 Galvanised,72,180,Ceiling tie connections',
    ].join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = 'fastener-order-template.csv'; a.click();
  };

  const validLines = lines.filter(l => l.item && l.qty);
  const totalEst   = lines.reduce((s, l) => s + (Number(l.qty) || 0) * (Number(l.unit_cost) || 0), 0);

  const submit = async () => {
    setErr('');
    if (!supplier)         return setErr('Please select a supplier');
    if (!validLines.length)return setErr('Add at least one item with name and quantity');

    setLoading(true);
    try {
      const payload = {
        supplier,
        req_date: reqDate || null,
        delivery_addr: address || null,
        orders: validLines.map(l => ({
          cat:       l.cat,
          item:      l.item,
          diameter:  l.diameter || null,
          length:    l.length   || null,
          grade:     l.grade    || null,
          qty:       Number(l.qty),
          unit_cost: Number(l.unit_cost) || null,
          total:     (Number(l.qty) || 0) * (Number(l.unit_cost) || 0),
          used_in:   l.used_in || null,
          source:    prefill ? 'structural' : imported ? 'file_upload' : 'manual',
        })),
      };
      await api.post('/procurement/orders/bulk', payload);
      onCreated();
      onClose();
    } catch (e) {
      setErr(e.response?.data?.error || 'Failed to create orders — check backend connection');
    } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-3">
      <div className="bg-white border border-border rounded-xl w-full max-w-4xl shadow-2xl flex flex-col"
        style={{ maxHeight: '94vh' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0">
          <div>
            <h3 className="font-condensed font-extrabold text-heading uppercase text-xl">
              {prefill ? '📥 Import from Structural Design' : '+ New Fastener Order'}
            </h3>
            <p className="font-barlow text-[13px] text-gray-400 mt-0.5">
              {prefill
                ? `${lines.length} fasteners pre-filled from EC5 analysis — review & confirm`
                : 'Screws · Bolts · Nails · Hangers only'}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-heading"><X size={20} /></button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          <Err msg={err} onDismiss={() => setErr('')} />

          {/* Mode toggle */}
          {!prefill && (
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex bg-gray-100 rounded-lg p-1 gap-1">
                {[['manual', 'Manual Entry'], ['file', 'Upload CSV']].map(([id, lbl]) => (
                  <button key={id} onClick={() => setMode(id)}
                    className={`px-4 py-2 rounded-md text-[11px] font-barlow font-bold uppercase tracking-widest transition-all
                      ${mode === id ? 'bg-amber text-white' : 'text-gray-400 hover:text-heading'}`}>
                    {lbl}
                  </button>
                ))}
              </div>
              <button onClick={dlTemplate}
                className="flex items-center gap-1.5 font-barlow text-[12px] text-amber hover:text-amber-dark uppercase tracking-widest">
                <Download size={12} /> CSV Template
              </button>
            </div>
          )}

          {/* File drop zone */}
          {mode === 'file' && !imported && (
            <div
              className="border-2 border-dashed border-border rounded-xl p-12 text-center cursor-pointer hover:border-amber hover:bg-amber/5 transition-all"
              onClick={() => fileRef.current?.click()}
              onDragOver={e => e.preventDefault()}
              onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) { const dt = new DataTransfer(); dt.items.add(f); fileRef.current.files = dt.files; handleFile({ target: { files: [f] } }); } }}
            >
              <input ref={fileRef} type="file" className="hidden" accept=".csv,.txt" onChange={handleFile} />
              <Upload size={44} className="text-gray-200 mx-auto mb-3" />
              <p className="font-barlow font-semibold text-heading text-[15px]">Drop CSV here or click to browse</p>
              <p className="font-barlow text-[12px] text-gray-400 mt-1">
                Columns: Category · Item · Diameter · Length · Grade · Qty · Unit Cost · Notes
              </p>
              <p className="font-barlow text-[11px] text-amber mt-2 uppercase tracking-widest">
                Valid categories: screws / bolts / nails / hangers
              </p>
            </div>
          )}

          {/* Order lines */}
          {(mode === 'manual' || imported || prefill) && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="font-barlow font-bold text-[13px] text-heading">
                  Fastener Line Items
                  {imported && <span className="ml-2 text-[11px] font-normal text-green-600">✓ {lines.length} imported</span>}
                </p>
                {!prefill && (
                  <button onClick={addLine}
                    className="flex items-center gap-1 font-barlow text-[12px] text-amber hover:text-amber-dark uppercase tracking-widest">
                    <Plus size={13} /> Add Line
                  </button>
                )}
              </div>
              {lines.map((l, i) => (
                <OrderLine key={l._id} line={l} idx={i} onChange={change} onRemove={rmLine} canRemove={lines.length > 1} />
              ))}
              {totalEst > 0 && (
                <div className="flex items-center justify-between bg-heading rounded-xl px-5 py-3">
                  <span className="font-barlow text-[13px] text-gray-300">
                    {validLines.length} valid line{validLines.length !== 1 ? 's' : ''} · Estimated total
                  </span>
                  <span className="font-condensed font-bold text-amber text-2xl">
                    KES {totalEst.toLocaleString()}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Supplier + logistics */}
          {(mode === 'manual' || imported || prefill) && (
            <div className="border-t border-border pt-5">
              <p className="font-barlow font-bold text-[13px] text-heading mb-3">Supplier &amp; Delivery</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <Lbl t="Preferred Supplier" req />
                  <select className="ts-select" value={supplier} onChange={e => setSupplier(e.target.value)}>
                    <option value="">— select supplier —</option>
                    {suppliers.map(s => (
                      <option key={s.id} value={s.name}>{s.name} ({s.region}) · {s.lead_days}d</option>
                    ))}
                  </select>
                </div>
                <div>
                  <Lbl t="Required By Date" />
                  <input className="ts-input" type="date" value={reqDate}
                    onChange={e => setReqDate(e.target.value)}
                    min={new Date().toISOString().slice(0, 10)} />
                </div>
                <div>
                  <Lbl t="Delivery Address" />
                  <input className="ts-input" value={address} onChange={e => setAddress(e.target.value)}
                    placeholder="Site address, Nairobi" />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {(mode === 'manual' || imported || prefill) && (
          <div className="px-6 py-4 border-t border-border flex items-center justify-between gap-3 flex-shrink-0">
            <span className="font-barlow text-[12px] text-gray-400">
              {validLines.length}/{lines.length} lines valid
            </span>
            <div className="flex gap-3">
              <button onClick={onClose} className="btn-outline-dark !py-2 !px-4">Cancel</button>
              <button onClick={submit} disabled={loading || !supplier || !validLines.length}
                className="btn-amber disabled:opacity-40">
                {loading ? <Spin /> : <ShoppingCart size={14} />}
                {loading ? 'Saving…' : `Create ${validLines.length} Order${validLines.length !== 1 ? 's' : ''}`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
//  RFQ DISPATCH MODAL — wired to POST /api/procurement/rfq
// ─────────────────────────────────────────────────────────────
function RFQModal({ items, suppliers, onClose, onSent }) {
  const [selected,  setSelected]  = useState([]);
  const [catF,      setCatF]      = useState('all');
  const [deadline,  setDeadline]  = useState('');
  const [address,   setAddress]   = useState('');
  const [notes,     setNotes]     = useState('');
  const [loading,   setLoading]   = useState(false);
  const [err,       setErr]       = useState('');
  const [done,      setDone]      = useState(false);
  const [result,    setResult]    = useState(null);

  const itemCats   = [...new Set(items.map(i => resolvecat(i.fastener_type_cat || i.cat)))];
  const listSupp   = catF === 'all' ? suppliers
    : suppliers.filter(s => {
        const cats = s.items_supplied ? (typeof s.items_supplied === 'string' ? JSON.parse(s.items_supplied) : s.items_supplied) : [];
        return cats.some(c => c.toLowerCase().includes(catF));
      });
  const totalEst   = items.reduce((s, i) => s + Number(i.total_price || i.total || 0), 0);
  const toggle     = id => setSelected(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);

  // Always dispatch all selected orders regardless of current status (multiple dispatch allowed)
  const dispatch = async () => {
    if (!selected.length) return setErr('Select at least one supplier');
    setLoading(true); setErr('');
    try {
      const res = await api.post('/procurement/rfq', {
        supplier_ids:  selected,
        order_ids:     items.map(i => i.id),
        deadline:      deadline || null,
        message:       notes    || null,
        delivery_addr: address  || null,
        force:         true,   // always allow multiple dispatch
      });
      setResult(res.data.data || res.data);
      setDone(true);
      setTimeout(() => { onSent(); onClose(); }, 2500);
    } catch (e) {
      setErr(e.response?.data?.error || 'Failed to dispatch RFQ — check connection');
    } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-3">
      <div className="bg-white border border-border rounded-xl w-full max-w-2xl shadow-2xl flex flex-col"
        style={{ maxHeight: '92vh' }}>

        <div className="flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0">
          <div>
            <h3 className="font-condensed font-extrabold text-heading uppercase text-xl">Dispatch RFQ</h3>
            <p className="font-barlow text-[13px] text-gray-400 mt-0.5">
              {items.length} item{items.length !== 1 ? 's' : ''} · KES {totalEst.toLocaleString()} est.
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-heading"><X size={20} /></button>
        </div>

        {done ? (
          <div className="flex-1 flex flex-col items-center justify-center py-12 text-center px-6">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mb-4">
              <CheckCircle size={34} className="text-green-500" />
            </div>
            <h4 className="font-condensed font-bold text-heading uppercase text-2xl mb-2">RFQ Dispatched!</h4>
            <p className="font-barlow text-body text-sm mb-4">
              Sent to {result?.dispatched_count || selected.length} supplier{(result?.dispatched_count || selected.length) !== 1 ? 's' : ''}.
            </p>

            {/* Email results per supplier */}
            {result?.email_results?.length > 0 && (
              <div className="w-full max-w-sm space-y-2 mb-4">
                {result.email_results.map((e, i) => (
                  <div key={i} className={`flex items-center justify-between px-3 py-2 rounded-lg text-[12px] font-barlow ${e.sent ? 'bg-green-50 border border-green-200' : 'bg-yellow-50 border border-yellow-200'}`}>
                    <span className="font-semibold text-heading">{e.supplier}</span>
                    <span className={`flex items-center gap-1 font-semibold ${e.sent ? 'text-green-600' : 'text-yellow-600'}`}>
                      {e.sent ? <><CheckCircle size={12}/> Email sent</> : <><AlertTriangle size={12}/> Email skipped</>}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Skipped orders info */}
            {result?.orders_skipped > 0 && (
              <div className="w-full max-w-sm bg-amber/10 border border-amber/20 rounded-lg px-4 py-3 text-[12px] font-barlow text-amber-700 text-left">
                <strong>{result.orders_skipped} order{result.orders_skipped !== 1 ? 's were' : ' was'} already in RFQ status</strong> and skipped to prevent double-dispatch.
              </div>
            )}

            <p className="font-barlow text-[11px] text-gray-400 mt-4">Closing automatically…</p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
            <Err msg={err} onDismiss={() => setErr('')} />

            {/* Items summary */}
            <div className="border border-border rounded-xl overflow-hidden">
              <div className="px-4 py-2 bg-gray-50 border-b border-border">
                <p className="font-barlow font-bold text-[11px] uppercase tracking-widest text-gray-400">Items in RFQ</p>
              </div>
              <div className="divide-y divide-border max-h-44 overflow-y-auto">
                {items.map((item, i) => {
                  const cat = resolvecat(item.fastener_type_cat || item.cat);
                  return (
                    <div key={i} className="flex items-center justify-between px-4 py-2.5">
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <CatTag cat={cat} />
                        <div className="min-w-0">
                          <p className="font-barlow font-semibold text-heading text-[13px] truncate">
                            {item.item_name || item.item}
                          </p>
                          <p className="font-barlow text-[11px] text-gray-400">
                            {item.diameter_mm || item.diameter ? `Ø${item.diameter_mm || item.diameter} · ` : ''}
                            {item.grade_spec || item.grade || ''}
                          </p>
                        </div>

                      </div>
                      <div className="text-right ml-3 flex-shrink-0">
                        <p className="font-barlow font-semibold text-heading text-[13px]">
                          {Number(item.quantity || item.qty || 0).toLocaleString()} {item.unit || 'pcs'}
                        </p>
                        <p className="font-barlow text-[11px] text-amber font-semibold">
                          KES {Number(item.total_price || item.total || 0).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>



            {/* Supplier filter + selection */}
            <div>
              <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                <p className="font-barlow font-bold text-[12px] uppercase tracking-widest text-sub">
                  Select Suppliers <span className="text-red-400">*</span>
                </p>
                <div className="flex gap-1 flex-wrap">
                  {['all', ...Object.keys(CAT)].map(k => (
                    <button key={k} onClick={() => setCatF(k)}
                      className={`px-2 py-0.5 rounded text-[10px] font-barlow font-bold uppercase tracking-wider transition-all
                        ${catF === k ? 'bg-amber text-white' : 'bg-gray-100 text-gray-400 hover:text-heading'}`}>
                      {k === 'all' ? 'All' : CAT[k]?.icon + ' ' + CAT[k]?.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {listSupp.map(s => {
                  const isSel = selected.includes(s.id);
                  const isRec = s.items_supplied && itemCats.some(c => JSON.stringify(s.items_supplied).toLowerCase().includes(c));
                  return (
                    <button key={s.id} onClick={() => toggle(s.id)}
                      className={`text-left p-3 rounded-xl border-2 transition-all
                        ${isSel ? 'border-amber bg-amber/5' : 'border-border bg-white hover:border-amber/40'}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <p className="font-barlow font-bold text-heading text-[13px]">{s.name}</p>
                            {isRec && <span className="text-[9px] font-bold bg-green-100 text-green-700 px-1.5 py-0.5 rounded uppercase">Recommended</span>}
                          </div>
                          <p className="font-barlow text-[11px] text-gray-400 mt-0.5">{s.region} · {s.lead_days}d lead</p>
                        </div>
                        <div className="flex flex-col items-end gap-2 flex-shrink-0">
                          <span className="flex items-center gap-0.5 font-bold text-amber text-[12px]">
                            <Star size={10} className="fill-amber" /> {s.rating}
                          </span>
                          <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${isSel ? 'border-amber bg-amber' : 'border-gray-300'}`}>
                            {isSel && <CheckCircle size={12} className="text-white" />}
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
                {!listSupp.length && (
                  <p className="col-span-2 text-center font-barlow text-[13px] text-gray-300 py-4">
                    No suppliers found for this filter
                  </p>
                )}
              </div>
            </div>

            {/* Deadline + address + notes */}
            <div className="grid grid-cols-2 gap-3">
              <div><Lbl t="Quote Deadline" /><input className="ts-input" type="date" value={deadline} onChange={e => setDeadline(e.target.value)} min={new Date().toISOString().slice(0, 10)} /></div>
              <div><Lbl t="Delivery Address" /><input className="ts-input" value={address} onChange={e => setAddress(e.target.value)} placeholder="Site address" /></div>
            </div>
            <div><Lbl t="Notes to Suppliers" /><textarea className="ts-input h-20 resize-none" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Quality requirements, site access, delivery schedule…" /></div>

            {selected.length > 0 && (
              <div className="flex items-center justify-between bg-amber/5 border border-amber/20 rounded-lg px-4 py-3">
                <p className="font-barlow text-[13px] text-gray-500">
                  Dispatching {items.length} order{items.length !== 1 ? 's' : ''} to {selected.length} supplier{selected.length !== 1 ? 's' : ''}
                </p>
                <p className="font-condensed font-bold text-amber text-lg">KES {totalEst.toLocaleString()}</p>
              </div>
            )}
          </div>
        )}

        {!done && (
          <div className="px-6 py-4 border-t border-border flex-shrink-0">
            <button onClick={dispatch}
              disabled={loading || !selected.length}
              className="btn-amber w-full justify-center py-3.5 disabled:opacity-40">
              {loading ? <Spin /> : <Send size={15} />}
              {loading ? 'Dispatching…' : `Dispatch to ${selected.length || '—'} Supplier${selected.length !== 1 ? 's' : ''}`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
//  ORDER DETAIL DRAWER — wired to PUT + DELETE endpoints
// ─────────────────────────────────────────────────────────────
function OrderDrawer({ order, suppliers, onClose, onUpdated, onDeleted }) {
  const [loading,     setLoading]     = useState(false);
  const [err,         setErr]         = useState('');
  const [confirmDel,  setConfirmDel]  = useState(false); // show inline confirm
  const cat = resolvecat(order?.fastener_type_cat || order?.cat);
  const sup = suppliers.find(s => s.name === (order?.supplier));

  // Orders in_transit or delivered cannot be deleted
  const canDelete = !['in_transit', 'delivered'].includes(order?.status);

  const updStatus = async st => {
    setLoading(true); setErr('');
    try {
      await api.put(`/procurement/orders/${order.id}`, { status: st });
      onUpdated(order.id, { status: st });
    } catch (e) { setErr(e.response?.data?.error || 'Update failed'); }
    finally { setLoading(false); }
  };

  const del = async () => {
    setLoading(true); setErr('');
    try {
      await api.delete(`/procurement/orders/${order.id}`);
      onDeleted(order.id);
      onClose();
    } catch (e) {
      setErr(e.response?.data?.error || 'Delete failed');
      setConfirmDel(false);
    } finally { setLoading(false); }
  };

  if (!order) return null;

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white w-full max-w-[380px] h-full overflow-y-auto shadow-2xl border-l border-border">

        <div className="p-5 border-b border-border">
          <div className="flex items-start justify-between mb-3">
            <CatTag cat={cat} />
            <button onClick={onClose} className="text-gray-400 hover:text-heading"><X size={18} /></button>
          </div>
          <h3 className="font-barlow font-bold text-heading text-[16px] leading-snug">
            {order.item_name || order.item}
          </h3>
          <div className="mt-2"><StatusBadge s={order.status} /></div>
        </div>

        <div className="p-5 space-y-5">
          <Err msg={err} onDismiss={() => setErr('')} />

          {/* Spec */}
          <div className="bg-gray-50 border border-border rounded-xl p-4">
            <p className="font-barlow font-bold text-[10px] uppercase tracking-widest text-gray-400 mb-3">Specification</p>
            <div className="space-y-2 text-[13px]">
              {[
                ['Diameter',    order.diameter_mm || order.diameter || '—'],
                ['Length',      order.length_mm_val || order.length || '—'],
                ['Grade/Spec',  order.grade_spec || order.grade || '—'],
                ['Quantity',    `${Number(order.quantity || order.qty || 0).toLocaleString()} ${order.unit || 'pcs'}`],
                ['Unit Price',  `KES ${Number(order.unit_price || order.unit_cost || 0).toLocaleString()}`],
                ['Total',       `KES ${Number(order.total_price || order.total || 0).toLocaleString()}`],
                ['Order Date',  order.order_date || order.date || '—'],
                ['Required By', order.required_date || order.reqDate || '—'],
              ].map(([l, v]) => (
                <div key={l} className="flex justify-between gap-3">
                  <span className="text-gray-400 flex-shrink-0">{l}</span>
                  <span className="text-heading font-semibold text-right">{v}</span>
                </div>
              ))}
              {(order.used_in) && (
                <div className="pt-2 border-t border-border">
                  <p className="text-gray-400 text-[11px] uppercase tracking-wider mb-1">Used In</p>
                  <p className="text-body text-[12px] leading-relaxed">{order.used_in}</p>
                </div>
              )}
            </div>
          </div>

          {/* Source badge */}
          <div>
            {order.source === 'structural'
              ? <span className="inline-flex items-center gap-1.5 text-[11px] font-bold bg-amber/10 text-amber px-3 py-1 rounded-lg uppercase tracking-wider"><LayoutGrid size={11} />From Structural Design</span>
              : order.source === 'file_upload'
              ? <span className="inline-flex items-center gap-1.5 text-[11px] font-bold bg-blue-50 text-blue-600 px-3 py-1 rounded-lg uppercase tracking-wider"><Upload size={11} />CSV File Upload</span>
              : <span className="inline-flex items-center gap-1.5 text-[11px] font-bold bg-gray-100 text-gray-500 px-3 py-1 rounded-lg uppercase tracking-wider"><FileText size={11} />Manual Entry</span>}
          </div>

          {/* Supplier */}
          {sup && (
            <div className="bg-heading rounded-xl p-4">
              <p className="font-barlow font-bold text-[10px] uppercase tracking-widest text-gray-500 mb-3">Supplier</p>
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="font-barlow font-bold text-white text-[14px]">{sup.name}</p>
                  <p className="flex items-center gap-1 font-barlow text-gray-400 text-[12px] mt-0.5"><MapPin size={10} />{sup.region}</p>
                </div>
                <span className="flex items-center gap-0.5 text-amber font-bold text-[12px]"><Star size={11} className="fill-amber" />{sup.rating}</span>
              </div>
              <div className="space-y-1.5 text-[12px]">
                <a href={`mailto:${sup.email}`} className="flex items-center gap-2 text-gray-300 hover:text-amber transition-colors"><Mail size={11} />{sup.email}</a>
                <span className="flex items-center gap-2 text-gray-400"><Phone size={11} />{sup.phone}</span>
                <span className="flex items-center gap-2 text-gray-400"><Clock size={11} />{sup.lead_days} day lead time</span>
              </div>
            </div>
          )}

          {/* Status update */}
          <div>
            <p className="font-barlow font-bold text-[12px] uppercase tracking-widest text-sub mb-2">Update Status</p>
            <div className="space-y-2">
              {Object.entries(STATUS).map(([k, v]) => (
                <button key={k} onClick={() => updStatus(k)} disabled={loading || order.status === k}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg border text-[12px] font-barlow font-semibold transition-all
                    ${order.status === k ? 'border-amber bg-amber/5 text-amber' : 'border-border text-gray-500 hover:border-amber/50 hover:text-heading disabled:opacity-50'}`}>
                  <v.Icon size={13} /> {v.label}
                  {order.status === k && <CheckCircle size={13} className="ml-auto text-amber" />}
                </button>
              ))}
            </div>
          </div>

          {/* Delete — with inline confirm, blocked for in_transit/delivered */}
          {!canDelete ? (
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-gray-50 border border-border text-[12px] font-barlow text-gray-400">
              <AlertTriangle size={13} className="text-yellow-500" />
              Cannot delete — set status to <strong className="text-heading ml-1">Cancelled</strong> first
            </div>
          ) : !confirmDel ? (
            <button onClick={() => setConfirmDel(true)} disabled={loading}
              className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border border-red-200 text-red-500 hover:bg-red-50 font-barlow text-[12px] font-semibold transition-all disabled:opacity-40">
              <Trash2 size={13} /> Delete Order
            </button>
          ) : (
            <div className="border border-red-200 rounded-xl p-4 bg-red-50 space-y-3">
              <p className="font-barlow font-bold text-red-700 text-[13px]">Delete this order permanently?</p>
              <p className="font-barlow text-red-600 text-[12px] leading-relaxed">
                <strong>{order.item_name}</strong> from {order.supplier} will be removed from the database. This cannot be undone.
              </p>
              <div className="flex gap-2">
                <button onClick={() => setConfirmDel(false)} disabled={loading}
                  className="flex-1 px-3 py-2 rounded-lg border border-border text-gray-500 hover:text-heading font-barlow text-[12px] font-semibold transition-all">
                  Cancel
                </button>
                <button onClick={del} disabled={loading}
                  className="flex-1 px-3 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white font-barlow text-[12px] font-semibold transition-all flex items-center justify-center gap-1.5 disabled:opacity-50">
                  {loading ? <Spin /> : <Trash2 size={12} />}
                  {loading ? 'Deleting…' : 'Yes, Delete'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
//  MAIN PAGE
// ─────────────────────────────────────────────────────────────
export default function ProcurementPage() {
  /* ── API state ── */
  const [orders,    setOrders]    = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [stats,     setStats]     = useState(null);
  const [schedule,  setSchedule]  = useState(STATIC_SCHEDULE); // EC5 fastener schedule
  const [rfqs,      setRfqs]      = useState([]);
  const [loadingO,  setLoadingO]  = useState(true);
  const [loadingS,  setLoadingS]  = useState(true);
  const [apiErr,    setApiErr]    = useState('');

  /* ── UI state ── */
  const [tab,        setTab]        = useState('orders');
  const [filterSt,   setFilterSt]   = useState('all');
  const [filterCat,  setFilterCat]  = useState('all');
  const [search,     setSearch]     = useState('');
  const [selected,   setSelected]   = useState([]);
  const [showNew,    setShowNew]     = useState(false);
  const [prefill,    setPrefill]     = useState(null);
  const [rfqItems,   setRfqItems]   = useState(null);
  const [drawer,     setDrawer]     = useState(null);

  /* ── Fetch orders + stats ── */
  const fetchOrders = useCallback(async () => {
    setLoadingO(true);
    try {
      const [oRes, sRes] = await Promise.all([
        api.get('/procurement/orders'),
        api.get('/procurement/stats'),
      ]);
      setOrders(oRes.data.data || []);
      setStats(sRes.data.data || null);
    } catch (e) {
      setApiErr('Could not load orders — is the backend running on port 4000?');
    } finally { setLoadingO(false); }
  }, []);

  /* ── Fetch suppliers + fastener schedule ── */
  const fetchSuppliers = useCallback(async () => {
    setLoadingS(true);
    try {
      const [supRes, schedRes] = await Promise.all([
        api.get('/suppliers'),
        api.get('/procurement/fasteners'),
      ]);
      setSuppliers(supRes.data.data || []);
      const sched = schedRes.data.data || [];
      // Normalise DB rows to match our local shape
      if (sched.length) {
        setSchedule(sched.map(f => ({
          id:        f.id,
          cat:       resolvecat(f.fastener_type),
          item:      f.fastener_type,
          diameter:  f.diameter || '—',
          length:    f.length   || '—',
          grade:     f.grade_spec,
          qty:       f.mto_qty,
          unit:      f.unit || 'pcs',
          unit_cost: f.unit_cost_kes,
          total:     f.total_cost_kes,
          used_in:   f.used_in,
          ec5:       f.description,
          ordered:   f.ordered,
        })));
      }
    } catch {
      // non-fatal — suppliers might not exist yet
    } finally { setLoadingS(false); }
  }, []);

  /* ── Fetch RFQ dispatches ── */
  const fetchRFQs = useCallback(async () => {
    try {
      const res = await api.get('/procurement/rfq');
      setRfqs(res.data.data || []);
    } catch { /* non-fatal */ }
  }, []);

  useEffect(() => { fetchOrders(); fetchSuppliers(); fetchRFQs(); }, []);

  /* ── Mutations ── */
  const onCreated  = () => { fetchOrders(); setSelected([]); };
  const onSent     = () => { fetchOrders(); fetchRFQs(); setSelected([]); };
  const onUpdated  = (id, patch) => setOrders(p => p.map(o => o.id === id ? { ...o, ...patch } : o));
  const onDeleted  = id => setOrders(p => p.filter(o => o.id !== id));

  /* ── Derived ── */
  const filtered = orders.filter(o => {
    const cat = resolvecat(o.fastener_type_cat || o.cat);
    if (filterSt  !== 'all' && o.status !== filterSt)    return false;
    if (filterCat !== 'all' && cat      !== filterCat)    return false;
    if (search && !`${o.item_name || ''} ${o.supplier || ''} ${cat}`.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const totalVal  = stats?.total_value   || orders.reduce((s, o) => s + Number(o.total_price || 0), 0);
  const delivVal  = stats?.delivered_value|| orders.filter(o => o.status === 'delivered').reduce((s, o) => s + Number(o.total_price || 0), 0);
  const rfqCnt    = stats?.rfq_count     ?? orders.filter(o => o.status === 'rfq').length;
  const transitCnt= stats?.in_transit    ?? orders.filter(o => o.status === 'in_transit').length;

  const catCounts = Object.keys(CAT).reduce((acc, k) => {
    const rows = orders.filter(o => resolvecat(o.fastener_type_cat || o.cat) === k);
    acc[k] = { count: rows.length, value: rows.reduce((s, o) => s + Number(o.total_price || 0), 0) };
    return acc;
  }, {});

  const toggleSel = id  => setSelected(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);
  const selAll    = () => setSelected(p => p.length === filtered.length ? [] : filtered.map(o => o.id));

  const exportCSV = () => {
    const src  = selected.length ? orders.filter(o => selected.includes(o.id)) : orders;
    const rows = ['Category,Item,Diameter,Length,Grade,Qty,Unit,Unit Price (KES),Total (KES),Supplier,Status,Source,Date,Used In'];
    src.forEach(o => rows.push(
      `${resolvecat(o.fastener_type_cat)},${o.item_name||''},${o.diameter_mm||''},${o.length_mm_val||''},${o.grade_spec||''},${o.quantity||0},${o.unit||'pcs'},${o.unit_price||0},${o.total_price||0},${o.supplier||''},${o.status||''},${o.source||''},${o.order_date||''},${o.used_in||''}`
    ));
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([rows.join('\n')], { type: 'text/csv' }));
    a.download = 'fastener-procurement.csv'; a.click();
  };

  /* ── Render ── */
  return (
    <AppLayout>
      {/* MODALS */}
      {showNew && (
        <NewOrderModal
          prefill={prefill}
          suppliers={suppliers}
          onClose={() => { setShowNew(false); setPrefill(null); }}
          onCreated={onCreated}
        />
      )}
      {rfqItems && (
        <RFQModal
          items={rfqItems}
          suppliers={suppliers}
          onClose={() => setRfqItems(null)}
          onSent={onSent}
        />
      )}
      {drawer && (
        <OrderDrawer
          order={drawer}
          suppliers={suppliers}
          onClose={() => setDrawer(null)}
          onUpdated={(id, patch) => { onUpdated(id, patch); setDrawer(d => d?.id === id ? { ...d, ...patch } : d); }}
          onDeleted={onDeleted}
        />
      )}

      <div className="p-5 md:p-8 max-w-7xl mx-auto">

        {/* ── Header ── */}
        <div className="flex items-start justify-between flex-wrap gap-4 mb-7">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
              <Package size={20} className="text-blue-600" />
            </div>
            <div>
              <p className="section-label">Service &amp; Procurement</p>
              <h1 className="font-condensed font-extrabold text-heading uppercase"
                style={{ fontSize: 'clamp(22px,3vw,34px)' }}>
                Procurement Automation
              </h1>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => fetchOrders()} disabled={loadingO}
              className="flex items-center gap-1.5 font-barlow text-[11px] text-gray-400 hover:text-amber uppercase tracking-widest disabled:opacity-40 transition-colors">
              <RefreshCw size={13} className={loadingO ? 'animate-spin' : ''} /> Refresh
            </button>
            <button onClick={() => { setPrefill(schedule); setShowNew(true); }}
              className="btn-outline-amber !py-2 !px-4 !text-[11px]">
              <LayoutGrid size={13} /> From Structural Design
            </button>
            <button onClick={() => setShowNew(true)} className="btn-amber">
              <Plus size={14} /> New Order
            </button>
          </div>
        </div>

        {/* Global API error */}
        {apiErr && <Err msg={apiErr} onDismiss={() => setApiErr('')} />}

        {/* ── KPI Cards ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
          {loadingO ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-white border border-border rounded-xl p-5">
                <div className="skeleton h-3 w-24 mb-3" />
                <div className="skeleton h-7 w-20 mb-2" />
                <div className="skeleton h-2.5 w-16" />
              </div>
            ))
          ) : [
            { l: 'Total Orders',    v: orders.length,                             s: `${rfqCnt} awaiting quote` },
            { l: 'Total Value',     v: `KES ${Number(totalVal).toLocaleString()}`, s: 'All fastener categories' },
            { l: 'In Transit',      v: transitCnt,                                s: 'Shipments en route' },
            { l: 'Delivered Value', v: `KES ${Number(delivVal).toLocaleString()}`, s: 'Received on site' },
          ].map(k => (
            <div key={k.l} className="bg-white border border-border rounded-xl p-5">
              <p className="font-barlow text-[11px] text-gray-400 uppercase tracking-widest mb-2">{k.l}</p>
              <p className="font-condensed font-bold text-heading text-2xl">{k.v}</p>
              <p className="font-barlow text-[11px] text-gray-400 mt-1">{k.s}</p>
            </div>
          ))}
        </div>

        {/* ── Category breakdown (clickable filter) ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
          {Object.values(CAT).map(c => {
            const { count, value } = catCounts[c.label.toLowerCase()] || { count: 0, value: 0 };
            const active = filterCat === c.label.toLowerCase();
            return (
              <button key={c.label} onClick={() => setFilterCat(active ? 'all' : c.label.toLowerCase())}
                className={`bg-white border-2 rounded-xl p-4 text-left transition-all hover:shadow-sm ${!active ? 'border-border hover:border-gray-300' : ''}`}
                style={active ? { borderColor: c.color } : {}}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-2xl">{c.icon}</span>
                  <span className="font-barlow text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded"
                    style={{ background: c.bg, color: c.color, border: `1px solid ${c.border}` }}>
                    {c.label}
                  </span>
                </div>
                <p className="font-condensed font-bold text-heading text-3xl">{count}</p>
                <p className="font-barlow text-[11px] text-gray-400 mt-0.5">KES {Number(value).toLocaleString()}</p>
              </button>
            );
          })}
        </div>

        {/* ── Structural Design banner ── */}
        <div className="bg-amber/5 border border-amber/25 rounded-xl p-4 mb-5 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-start gap-3">
            <Zap size={18} className="text-amber mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-barlow font-bold text-heading text-[14px]">
                {schedule.length} fasteners recommended from Structural Design
              </p>
              <p className="font-barlow text-[12px] text-gray-400 mt-0.5">
                {[...new Set(schedule.map(f => CAT[resolvecat(f.cat)]?.label).filter(Boolean))].join(' · ')}
                &nbsp;·&nbsp;
                Est. KES {schedule.reduce((s, f) => s + Number(f.total || 0), 0).toLocaleString()}
                &nbsp;·&nbsp;
                {schedule.reduce((s, f) => s + Number(f.qty || 0), 0).toLocaleString()} total pcs
              </p>
            </div>
          </div>
          <button onClick={() => { setPrefill(schedule); setShowNew(true); }}
            className="btn-amber !py-2 !px-4 !text-[11px] flex-shrink-0">
            <ArrowRight size={13} /> Import &amp; Order
          </button>
        </div>

        {/* ── Tabs ── */}
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1 mb-5 w-fit">
          {[['orders','Orders'],['schedule','Fastener Schedule'],['rfq','RFQ Log'],['suppliers','Suppliers']].map(([id, lbl]) => (
            <button key={id} onClick={() => setTab(id)}
              className={`px-4 py-2 rounded-md text-[11px] font-barlow font-bold uppercase tracking-widest transition-all ${tab === id ? 'bg-white text-heading shadow-sm' : 'text-gray-400 hover:text-heading'}`}>
              {lbl}
            </button>
          ))}
        </div>

        {/* ════════════════════════════════════════════════════ */}
        {/* TAB: ORDERS                                         */}
        {/* ════════════════════════════════════════════════════ */}
        {tab === 'orders' && (
          <div className="space-y-4">
            {/* Toolbar */}
            <div className="flex flex-wrap gap-2 items-center justify-between">
              <div className="flex gap-2 flex-wrap items-center">
                <div className="flex items-center gap-2 bg-white border border-border rounded-lg px-3 py-2 min-w-44">
                  <Search size={13} className="text-gray-400" />
                  <input className="bg-transparent text-[12px] font-barlow outline-none w-full placeholder:text-gray-400"
                    placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)} />
                </div>
                <div className="flex gap-1 flex-wrap">
                  {['all', ...Object.keys(STATUS)].map(s => (
                    <button key={s} onClick={() => setFilterSt(s)}
                      className={`px-2.5 py-1.5 rounded text-[10px] font-barlow font-bold uppercase tracking-wider border transition-all ${filterSt === s ? 'bg-amber text-white border-amber' : 'bg-white text-gray-400 border-border hover:border-amber hover:text-amber'}`}>
                      {s.replace('_', ' ')}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                {selected.length > 0 && (
                  <button onClick={() => setRfqItems(orders.filter(o => selected.includes(o.id)))}
                    className="btn-amber !py-2 !px-3 !text-[11px]">
                    <Send size={12} /> RFQ ({selected.length})
                  </button>
                )}
                <button onClick={exportCSV} className="btn-outline-dark !py-2 !px-3 !text-[11px]">
                  <Download size={12} /> Export CSV
                </button>
              </div>
            </div>

            {/* Table */}
            {loadingO ? (
              <div className="bg-white border border-border rounded-xl p-12 flex items-center justify-center gap-3">
                <Spin /> <span className="font-barlow text-gray-400 text-sm">Loading orders from database…</span>
              </div>
            ) : (
              <div className="bg-white border border-border rounded-xl overflow-x-auto">
                <table className="tbl w-full text-xs">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-3 w-8">
                        <input type="checkbox" className="rounded accent-amber"
                          checked={selected.length > 0 && selected.length === filtered.length}
                          onChange={selAll} />
                      </th>
                      {['Category','Item','Specification','Qty','Supplier','Unit Price','Total','Source','Status',''].map(h => (
                        <th key={h} className="px-3 py-3 text-[10px] text-left font-barlow font-bold uppercase tracking-wider text-gray-400">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filtered.map(o => {
                      const cat = resolvecat(o.fastener_type_cat || o.cat);
                      return (
                        <tr key={o.id}
                          className={`hover:bg-gray-50 transition-colors cursor-pointer ${selected.includes(o.id) ? 'bg-amber/5' : ''}`}>
                          <td className="px-3 py-3" onClick={e => e.stopPropagation()}>
                            <input type="checkbox" className="rounded accent-amber"
                              checked={selected.includes(o.id)} onChange={() => toggleSel(o.id)} />
                          </td>
                          <td className="px-3 py-3" onClick={() => setDrawer(o)}><CatTag cat={cat} /></td>
                          <td className="px-3 py-3" onClick={() => setDrawer(o)}>
                            <p className="font-semibold text-heading">{o.item_name}</p>
                            {o.used_in && <p className="text-gray-400 text-[10px] mt-0.5 max-w-[160px] truncate">{o.used_in}</p>}
                          </td>
                          <td className="px-3 py-3 font-mono text-gray-500" onClick={() => setDrawer(o)}>
                            {o.diameter_mm ? `Ø${o.diameter_mm}` : ''}
                            {o.length_mm_val && o.length_mm_val !== '—' ? ` × ${o.length_mm_val}` : ''}
                            {o.grade_spec && <div className="text-[10px] text-gray-400 mt-0.5">{o.grade_spec}</div>}
                          </td>
                          <td className="px-3 py-3" onClick={() => setDrawer(o)}>
                            <span className="font-semibold text-heading">{Number(o.quantity || 0).toLocaleString()}</span>
                            <span className="text-gray-400 ml-1">{o.unit || 'pcs'}</span>
                          </td>
                          <td className="px-3 py-3 font-semibold text-heading" onClick={() => setDrawer(o)}>{o.supplier}</td>
                          <td className="px-3 py-3 text-gray-500" onClick={() => setDrawer(o)}>KES {Number(o.unit_price || 0).toLocaleString()}</td>
                          <td className="px-3 py-3 font-semibold text-amber" onClick={() => setDrawer(o)}>KES {Number(o.total_price || 0).toLocaleString()}</td>
                          <td className="px-3 py-3" onClick={() => setDrawer(o)}>
                            {o.source === 'structural'
                              ? <span className="inline-flex items-center gap-1 text-[9px] font-bold bg-amber/10 text-amber px-1.5 py-0.5 rounded uppercase"><LayoutGrid size={8} />Design</span>
                              : o.source === 'file_upload'
                              ? <span className="inline-flex items-center gap-1 text-[9px] font-bold bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded uppercase"><Upload size={8} />File</span>
                              : <span className="inline-flex items-center gap-1 text-[9px] font-bold bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded uppercase"><FileText size={8} />Manual</span>}
                          </td>
                          <td className="px-3 py-3" onClick={() => setDrawer(o)}><StatusBadge s={o.status} /></td>
                          <td className="px-3 py-3"><button onClick={() => setDrawer(o)} className="text-gray-300 hover:text-amber transition-colors"><Eye size={14} /></button></td>
                        </tr>
                      );
                    })}
                    {!filtered.length && (
                      <tr><td colSpan="11" className="px-4 py-14 text-center font-barlow text-gray-300">
                        {orders.length === 0 ? 'No orders yet — create one above' : 'No orders match the current filters'}
                      </td></tr>
                    )}
                  </tbody>
                  {filtered.length > 0 && (
                    <tfoot className="bg-gray-50 border-t-2 border-border">
                      <tr>
                        <td colSpan="7" className="px-3 py-3 font-barlow font-semibold text-heading text-[13px]">
                          {filtered.length} order{filtered.length !== 1 ? 's' : ''} shown
                        </td>
                        <td className="px-3 py-3 font-condensed font-bold text-amber text-lg">
                          KES {filtered.reduce((s, o) => s + Number(o.total_price || 0), 0).toLocaleString()}
                        </td>
                        <td colSpan="3" />
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            )}
          </div>
        )}

        {/* ════════════════════════════════════════════════════ */}
        {/* TAB: FASTENER SCHEDULE (EC5 from structural design) */}
        {/* ════════════════════════════════════════════════════ */}
        {tab === 'schedule' && (
          <div className="space-y-5">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <h3 className="font-barlow font-bold text-heading text-[16px]">EC5 Recommended Fastener Schedule</h3>
                <p className="font-barlow text-[13px] text-gray-400 mt-0.5">
                  {schedule.length} fastener types · Est. KES {schedule.reduce((s, f) => s + Number(f.total || 0), 0).toLocaleString()}
                </p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => {
                  const rows = ['Category,Item,Diameter,Length,Grade/Spec,MTO Qty,Unit,Unit Cost (KES),Total (KES),Used In,EC5 Ref'];
                  schedule.forEach(f => rows.push(`${resolvecat(f.cat)},${f.item||f.fastener_type||''},${f.diameter||''},${f.length||''},${f.grade||f.grade_spec||''},${f.qty||f.mto_qty||0},${f.unit||'pcs'},${f.unit_cost||f.unit_cost_kes||0},${f.total||f.total_cost_kes||0},${f.used_in||''},${f.ec5||''}`));
                  const a = document.createElement('a');
                  a.href = URL.createObjectURL(new Blob([rows.join('\n')], { type: 'text/csv' }));
                  a.download = 'ec5-fastener-schedule.csv'; a.click();
                }} className="btn-outline-dark !py-2 !px-3 !text-[11px]">
                  <Download size={12} /> Export CSV
                </button>
                <button onClick={() => { setPrefill(schedule); setShowNew(true); }} className="btn-amber !py-2 !text-[11px]">
                  <Send size={13} /> Order All
                </button>
              </div>
            </div>

            {/* Cards grouped by category */}
            {Object.values(CAT).map(cat => {
              const items = schedule.filter(f => resolvecat(f.cat) === cat.label.toLowerCase());
              if (!items.length) return null;
              return (
                <div key={cat.label}>
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-2xl">{cat.icon}</span>
                    <h4 className="font-condensed font-bold uppercase tracking-widest text-xl" style={{ color: cat.color }}>{cat.label}</h4>
                    <div className="flex-1 h-px" style={{ background: cat.border }} />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
                    {items.map((f, fi) => (
                      <div key={f.id || fi} className="bg-white border border-border rounded-xl p-5 hover:shadow-md transition-shadow">
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex-1 min-w-0">
                            <h5 className="font-barlow font-bold text-heading text-[15px]">{f.item || f.fastener_type}</h5>
                            <p className="font-barlow text-[12px] mt-0.5" style={{ color: cat.color }}>{f.grade || f.grade_spec}</p>
                          </div>
                          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ml-3"
                            style={{ background: cat.bg }}>
                            <Package size={18} style={{ color: cat.color }} />
                          </div>
                        </div>

                        {/* 4-cell spec grid */}
                        <div className="grid grid-cols-2 gap-2 mb-4">
                          {[
                            ['Diameter',     (f.diameter === '—' || !f.diameter) ? '—' : f.diameter],
                            ['Length',       f.length   || '—'],
                            ['MTO Quantity', `${Number(f.qty || f.mto_qty || 0).toLocaleString()} ${f.unit || 'pcs'}`],
                            ['Unit Cost',    `KES ${Number(f.unit_cost || f.unit_cost_kes || 0).toLocaleString()}`],
                          ].map(([l, v]) => (
                            <div key={l} className="bg-gray-50 border border-border rounded-lg px-3 py-2">
                              <p className="font-barlow text-[10px] text-gray-400 uppercase tracking-wider">{l}</p>
                              <p className="font-barlow font-semibold text-heading text-[13px] mt-0.5">{v}</p>
                            </div>
                          ))}
                        </div>

                        {/* Estimated Cost */}
                        <div className="flex justify-between items-center rounded-lg px-3 py-2.5 mb-3"
                          style={{ background: cat.bg, border: `1px solid ${cat.border}` }}>
                          <span className="font-barlow text-[11px] text-gray-500 uppercase tracking-wider">Estimated Cost</span>
                          <span className="font-condensed font-bold text-xl" style={{ color: cat.color }}>
                            KES {Number(f.total || f.total_cost_kes || 0).toLocaleString()}
                          </span>
                        </div>

                        {/* Used in */}
                        {f.used_in && (
                          <div className="mb-3">
                            <p className="font-barlow text-[10px] text-gray-400 uppercase tracking-wider mb-1">Screws Used in Analysis</p>
                            <p className="font-barlow text-[12px] text-body leading-relaxed">{f.used_in}</p>
                          </div>
                        )}

                        {/* EC5 ref */}
                        {(f.ec5 || f.description) && (
                          <div className="mb-4 bg-gray-50 rounded-lg px-3 py-2">
                            <p className="font-barlow text-[10px] text-gray-400 uppercase tracking-wider mb-0.5">EC5 Reference</p>
                            <p className="font-barlow text-[11px] text-gray-500 italic">{f.ec5 || f.description}</p>
                          </div>
                        )}

                        {/* Already ordered badge or Order button */}
                        {f.ordered ? (
                          <div className="flex items-center justify-center gap-2 py-2.5 rounded-lg bg-green-50 border border-green-200 text-green-700 font-barlow font-semibold text-[12px]">
                            <CheckCircle size={14} /> Order Created
                          </div>
                        ) : (
                          <button onClick={() => { setPrefill([f]); setShowNew(true); }}
                            className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-lg border-2 font-barlow font-bold uppercase tracking-widest text-[11px] transition-all hover:text-white"
                            style={{ borderColor: cat.color, color: cat.color }}
                            onMouseEnter={e => { e.currentTarget.style.background = cat.color; }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}>
                            <Plus size={12} /> Create Order
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}

            {/* Summary bar */}
            <div className="bg-heading text-white rounded-xl p-6 flex items-center justify-between flex-wrap gap-4">
              <div>
                <h4 className="font-condensed font-bold uppercase tracking-widest text-lg">Fastener Schedule Summary</h4>
                <p className="font-barlow text-gray-400 text-[13px] mt-1">All fasteners sized to Eurocode 5 connection requirements</p>
                <div className="flex flex-wrap gap-7 mt-3">
                  {[
                    ['Fastener Types', schedule.length],
                    ['Total Pieces',   schedule.reduce((s, f) => s + Number(f.qty || f.mto_qty || 0), 0).toLocaleString()],
                    ['Est. Total',     `KES ${schedule.reduce((s, f) => s + Number(f.total || f.total_cost_kes || 0), 0).toLocaleString()}`],
                  ].map(([l, v]) => (
                    <div key={l}>
                      <p className="font-barlow text-[10px] text-gray-500 uppercase tracking-wider">{l}</p>
                      <p className="font-condensed font-bold text-amber text-2xl">{v}</p>
                    </div>
                  ))}
                </div>
              </div>
              <button onClick={() => { setPrefill(schedule); setShowNew(true); }} className="btn-amber flex-shrink-0">
                <Send size={14} /> Procure All Fasteners
              </button>
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════════ */}
        {/* TAB: RFQ LOG                                        */}
        {/* ════════════════════════════════════════════════════ */}
        {tab === 'rfq' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-barlow font-bold text-heading text-[16px]">RFQ Dispatch Log</h3>
                <p className="font-barlow text-[13px] text-gray-400 mt-0.5">{rfqs.length} RFQ{rfqs.length !== 1 ? 's' : ''} dispatched</p>
              </div>
            </div>
            {rfqs.length === 0 ? (
              <div className="bg-white border border-border rounded-xl p-12 text-center">
                <Send size={36} className="text-gray-200 mx-auto mb-3" />
                <p className="font-barlow font-semibold text-heading text-[15px] mb-1">No RFQs dispatched yet</p>
                <p className="font-barlow text-body text-sm">Select orders on the Orders tab and click RFQ to dispatch</p>
              </div>
            ) : (
              <div className="bg-white border border-border rounded-xl overflow-hidden">
                <table className="tbl w-full text-xs">
                  <thead className="bg-gray-50">
                    <tr>
                      {['Supplier','Orders','Deadline','Sent','Status','Quote Value',''].map(h => (
                        <th key={h} className="px-4 py-3 text-[10px] text-left font-barlow font-bold uppercase tracking-wider text-gray-400">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {rfqs.map(r => (
                      <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 font-semibold text-heading">{r.supplier_name}</td>
                        <td className="px-4 py-3 text-gray-500">
                          {r.order_ids ? JSON.parse(r.order_ids).length : 0} order{JSON.parse(r.order_ids || '[]').length !== 1 ? 's' : ''}
                        </td>
                        <td className="px-4 py-3 text-gray-500">{r.deadline || '—'}</td>
                        <td className="px-4 py-3 text-gray-400">
                          {r.sent_at ? new Date(r.sent_at).toLocaleDateString('en-KE') : '—'}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded border text-[11px] font-barlow font-semibold uppercase tracking-wider ${
                            r.status === 'sent'     ? 'text-yellow-700 bg-yellow-50 border-yellow-200' :
                            r.status === 'quoted'   ? 'text-purple-700 bg-purple-50 border-purple-200' :
                            r.status === 'accepted' ? 'text-green-700  bg-green-50  border-green-200'  :
                            r.status === 'declined' ? 'text-red-600    bg-red-50    border-red-200'     :
                            'text-gray-500 bg-gray-50 border-gray-200'
                          }`}>{r.status}</span>
                        </td>
                        <td className="px-4 py-3 font-semibold text-amber">
                          {r.quote_value ? `KES ${Number(r.quote_value).toLocaleString()}` : '—'}
                        </td>
                        <td className="px-4 py-3 text-gray-400 text-[11px] max-w-[150px] truncate">{r.notes || r.message || ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ════════════════════════════════════════════════════ */}
        {/* TAB: SUPPLIER NETWORK                               */}
        {/* ════════════════════════════════════════════════════ */}
        {tab === 'suppliers' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-barlow font-bold text-heading text-[16px]">Supplier Network</h3>
                <p className="font-barlow text-[13px] text-gray-400 mt-0.5">
                  {loadingS ? 'Loading…' : `${suppliers.length} active supplier${suppliers.length !== 1 ? 's' : ''}`}
                </p>
              </div>
            </div>
            {loadingS ? (
              <div className="flex items-center justify-center py-12 gap-3">
                <Spin /> <span className="font-barlow text-gray-400 text-sm">Loading suppliers…</span>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {suppliers.map(s => {
                  const supItems = typeof s.items_supplied === 'string'
                    ? (() => { try { return JSON.parse(s.items_supplied); } catch { return []; } })()
                    : (s.items_supplied || []);
                  const cats = Object.keys(CAT).filter(k =>
                    supItems.some(i => i.toLowerCase().includes(k.replace('hangers','hanger')))
                  );
                  return (
                    <div key={s.id} className="bg-white border border-border rounded-xl p-5 hover:shadow-md transition-all hover:-translate-y-0.5">
                      <div className="flex items-start justify-between mb-3">
                        <div className="min-w-0 flex-1">
                          <h4 className="font-barlow font-bold text-heading text-[15px]">{s.name}</h4>
                          <p className="flex items-center gap-1 font-barlow text-[12px] text-gray-400 mt-0.5"><MapPin size={11} />{s.region}</p>
                        </div>
                        <div className="flex items-center gap-1 bg-amber/10 rounded-lg px-2 py-1 ml-2 flex-shrink-0">
                          <Star size={11} className="text-amber fill-amber" />
                          <span className="font-bold text-amber text-[12px]">{s.rating}</span>
                        </div>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full mb-3 overflow-hidden">
                        <div className="h-full bg-amber rounded-full" style={{ width: `${(Number(s.rating) / 5) * 100}%` }} />
                      </div>
                      <p className="font-barlow text-[12px] text-gray-500 mb-3">{s.speciality}</p>
                      {/* Category tags from DB items_supplied */}
                      {cats.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mb-4">
                          {cats.map(k => (
                            <span key={k} className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider"
                              style={{ background: CAT[k]?.bg, color: CAT[k]?.color, border: `1px solid ${CAT[k]?.border}` }}>
                              {CAT[k]?.icon} {CAT[k]?.label}
                            </span>
                          ))}
                        </div>
                      )}
                      <div className="space-y-1.5 text-[12px] mb-4">
                        <div className="flex items-center gap-2 text-gray-400"><Clock size={11} className="text-amber" />{s.lead_days} day lead time</div>
                        <a href={`mailto:${s.email}`} className="flex items-center gap-2 text-gray-400 hover:text-amber transition-colors"><Mail size={11} className="text-amber" />{s.email}</a>
                        <div className="flex items-center gap-2 text-gray-400"><Phone size={11} className="text-amber" />{s.phone}</div>
                        <div className="flex items-center gap-2 text-gray-400"><FileText size={11} className="text-amber" />{s.contact}</div>
                      </div>
                      <button onClick={() => setShowNew(true)}
                        className="w-full btn-outline-amber !py-2 !text-[11px] justify-center">
                        <Plus size={11} /> Create Order
                      </button>
                    </div>
                  );
                })}
                {!suppliers.length && (
                  <div className="col-span-3 text-center py-12">
                    <p className="font-barlow text-gray-300 text-sm">No suppliers found in database — add them via the API or phpMyAdmin</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
