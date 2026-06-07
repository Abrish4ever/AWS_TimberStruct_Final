import { useState, useRef, useCallback } from 'react';
import {
  LayoutGrid, Upload, FileText, X, Zap, CheckCircle,
  AlertTriangle, XCircle, Download, ChevronRight, ChevronLeft,
  RotateCcw, Building2, Layers, Settings, BarChart3, Eye,
  Info, Plus, Trash2
} from 'lucide-react';
import AppLayout from './AppLayout';

// ─────────────────────────────────────────────────────────────
//  EC5 CONSTANTS  (EN 338 / EN 1194)
// ─────────────────────────────────────────────────────────────
const GRADE_PROPS = {
  C16:   { fc0k:17, fmk:16, ft0k:10,   E0mean:8000,  density:310 },
  C24:   { fc0k:21, fmk:24, ft0k:14,   E0mean:11000, density:350 },
  GL24h: { fc0k:24, fmk:24, ft0k:19.2, E0mean:11600, density:380 },
  GL28h: { fc0k:28, fmk:28, ft0k:22.4, E0mean:12600, density:410 },
};

// Keys are STRINGS '1','2','3' so SERVICE_CLASS[proj.serviceClass] always works
const SERVICE_CLASS = {
  '1': { kmod:0.80, label:'SC1 — Dry interior (T ≤ 20°C, RH ≤ 65%)' },
  '2': { kmod:0.70, label:'SC2 — Humid interior (T ≤ 20°C, RH ≤ 85%)' },
  '3': { kmod:0.65, label:'SC3 — Exterior / wet conditions' },
};

// Keys match exactly what the <select> value will be
const LOAD_DURATION = {
  permanent:    { kmod_factor:0.60, label:'Permanent (>10 yrs)'     },
  long_term:    { kmod_factor:0.70, label:'Long-term (6 mths–10 yrs)'},
  medium_term:  { kmod_factor:0.80, label:'Medium-term (1 wk–6 mths)'},
  short_term:   { kmod_factor:0.90, label:'Short-term (<1 week)'     },
  instantaneous:{ kmod_factor:1.10, label:'Instantaneous'            },
};

const GAMMA_M = 1.3; // partial factor for solid timber / glulam

// Safe kmod lookup — never returns NaN
function getKmod(serviceClass, loadDuration) {
  const sc = SERVICE_CLASS[String(serviceClass)];
  const ld = LOAD_DURATION[String(loadDuration)];
  if (!sc) { console.error('Bad serviceClass:', serviceClass); return 0.7; }
  if (!ld) { console.error('Bad loadDuration:', loadDuration); return 0.8; }
  return sc.kmod * ld.kmod_factor;
}

// ─────────────────────────────────────────────────────────────
//  EC0 LOAD COMBINATIONS
// ─────────────────────────────────────────────────────────────
function loadCombinations(G, Q, W) {
  const g=+G||0, q=+Q||0, w=+W||0;
  return [
    { label:'1.35G + 1.5Q',          value:+(1.35*g + 1.5*q).toFixed(3) },
    { label:'1.35G + 1.5Q + 0.9W',   value:+(1.35*g + 1.5*q + 0.9*w).toFixed(3) },
    { label:'1.0G + 1.5W',           value:+(1.0*g  + 1.5*w).toFixed(3) },
    { label:'1.35G + 1.05Q + 1.5W',  value:+(1.35*g + 1.05*q + 1.5*w).toFixed(3) },
  ];
}

// ─────────────────────────────────────────────────────────────
//  CALCULATION ENGINE — EC5 cl.6
// ─────────────────────────────────────────────────────────────

/** Strut / column in compression — EC5 cl.6.3 */
function calcStrut({ length, width, depth, grade, serviceClass, loadDuration, load }) {
  const p   = GRADE_PROPS[grade] || GRADE_PROPS.C24;
  const km  = getKmod(serviceClass, loadDuration);
  const fcd = (km * p.fc0k) / GAMMA_M;          // design compressive strength (N/mm²)
  const A   = (width/1000) * (depth/1000);       // cross-section area (m²)
  const iy  = depth / Math.sqrt(12);             // radius of gyration y-axis (mm)
  const iz  = width  / Math.sqrt(12);            // radius of gyration z-axis (mm)
  const lam = Math.max(length/iy, length/iz);    // governing slenderness ratio
  const lr  = (lam / Math.PI) * Math.sqrt(p.fc0k / p.E0mean); // relative slenderness
  const k   = 0.5 * (1 + 0.2*(lr - 0.3) + lr*lr);            // EC5 6.29
  const kc  = lr > 0.3 ? 1 / (k + Math.sqrt(k*k - lr*lr)) : 1.0;
  const cap = kc * fcd * A * 1000;               // design compression capacity (kN)
  const util= (load / cap) * 100;                // utilisation %

  return {
    mode      : 'strut',
    fcd       : +fcd.toFixed(2),
    area_cm2  : +(A*10000).toFixed(1),
    lambda    : +lam.toFixed(1),
    lambdaRel : +lr.toFixed(3),
    kc        : +kc.toFixed(3),
    capacity  : +cap.toFixed(2),
    utilisation: isFinite(util) ? +util.toFixed(1) : 0,
    pass      : util <= 100,
    warning   : util > 80 && util <= 100,
    weight    : +(p.density * (width/1000) * (depth/1000) * (length/1000)).toFixed(1),
    checks    : { buckling: util<=100, slenderness: lam<=150 },
  };
}

/** Rafter / beam in bending — EC5 cl.6.1 + deflection check */
function calcRafter({ span, width, depth, grade, serviceClass, loadDuration, load }) {
  const p   = GRADE_PROPS[grade] || GRADE_PROPS.C24;
  const km  = getKmod(serviceClass, loadDuration);
  const fmd = (km * p.fmk) / GAMMA_M;           // design bending strength (N/mm²)
  const L   = span / 1000;                        // span in metres
  const I   = (width * Math.pow(depth,3)) / 12 / 1e12;  // 2nd moment of area (m⁴)
  const Wel = (width * depth*depth) / 6 / 1e9;   // elastic section modulus (m³)
  const Md  = (load * L*L) / 8;                  // design bending moment (kNm) UDL
  const sig = Md / Wel / 1000;                   // bending stress (N/mm²)
  const util_b = (sig / fmd) * 100;

  // Deflection — instantaneous then final (kdef=0.6 for solid timber SC1)
  const kdef    = serviceClass === '1' ? 0.6 : serviceClass === '2' ? 0.8 : 1.0;
  const EI      = p.E0mean * 1e6 * I;            // bending stiffness (kNm²)
  const w_inst  = (5 * load * 1000 * Math.pow(L,4)) / (384 * EI) * 1000; // inst. deflection (mm)
  const w_fin   = w_inst * (1 + kdef);           // final deflection (mm)
  const lim_inst = L / 300 * 1000;               // EC5 Table 7.2 l/300 (mm)
  const lim_fin  = L / 250 * 1000;               // l/250
  const util_d  = (w_fin / lim_fin) * 100;
  const util    = Math.max(util_b, util_d);

  return {
    mode          : 'rafter',
    fmd           : +fmd.toFixed(2),
    moment        : +Md.toFixed(2),
    stress        : +sig.toFixed(2),
    utilisation   : isFinite(util) ? +util.toFixed(1) : 0,
    util_bending  : isFinite(util_b) ? +util_b.toFixed(1) : 0,
    util_deflection: isFinite(util_d) ? +util_d.toFixed(1) : 0,
    deflection_inst: +w_inst.toFixed(1),
    deflection_fin : +w_fin.toFixed(1),
    lim_inst      : +lim_inst.toFixed(1),
    lim_fin       : +lim_fin.toFixed(1),
    deflOk        : w_fin <= lim_fin,
    pass          : util <= 100,
    warning       : util > 80 && util <= 100,
    weight        : +(p.density * (width/1000) * (depth/1000) * (span/1000)).toFixed(1),
    checks        : { bending: util_b<=100, deflection: w_fin<=lim_fin },
  };
}

/** Run analysis on a member — dispatches to correct function */
function analyseMember(m, serviceClass, loadDuration) {
  // Ensure all values are numbers (form inputs can return strings)
  const w  = Number(m.width)  || 47;
  const d  = Number(m.depth)  || 200;
  const le = Number(m.length) || 6000;
  const lo = Number(m.load)   || 3.5;
  const qt = Number(m.qty)    || 1;

  try {
    if (m.type === 'strut' || m.type === 'post') {
      return calcStrut({ length:le, width:w, depth:d, grade:m.grade||'C24', serviceClass, loadDuration, load:lo });
    } else {
      return calcRafter({ span:le, width:w, depth:d, grade:m.grade||'C24', serviceClass, loadDuration, load:lo });
    }
  } catch (err) {
    console.error('Analysis error for member:', m.label, err);
    return { pass:false, warning:false, utilisation:0, capacity:0, weight:0, mode:m.type };
  }
}

// ─────────────────────────────────────────────────────────────
//  SVG STRUCTURAL DIAGRAM
// ─────────────────────────────────────────────────────────────
function StructureDiagram({ params, results }) {
  const W=700, H=380, ml=65, mr=65, mt=58, mb=80;
  const sw=W-ml-mr, sh=H-mt-mb;
  const px=ml, qx=ml+sw, by=H-mb, cx=ml+sw/2;

  const avgUtil = results && results.length
    ? results.reduce((s,r) => s + (Number(r.utilisation)||0), 0) / results.length
    : 45;

  const uColor = u => u>100 ? '#ef4444' : u>80 ? '#f59e0b' : '#22c55e';
  const rCol   = uColor(avgUtil);

  const { structureType='truss', span=12000, height=3600, pitch=22.5, grade='C24', load=3.5 } = params || {};

  const MARKER = (id) => (
    <marker key={id} id={id} markerWidth="7" markerHeight="7" refX="3.5" refY="3.5" orient="auto">
      <path d="M0,0 L7,3.5 L0,7Z" fill="#94a3b8"/>
    </marker>
  );
  const HATCH = (id) => (
    <pattern key={id} id={id} patternUnits="userSpaceOnUse" width="8" height="8" patternTransform="rotate(45)">
      <line x1="0" y1="0" x2="0" y2="8" stroke="#cbd5e1" strokeWidth="1.2"/>
    </pattern>
  );
  const UtilBox = ({ x, y }) => (
    <g transform={`translate(${x},${y})`}>
      <rect x="0" y="0" width="110" height="64" rx="6" fill="#f8fafc" stroke="#e2e8f0" strokeWidth="1.2"/>
      <text x="55" y="16" textAnchor="middle" fontSize="8" fill="#94a3b8" fontWeight="700" letterSpacing="1" fontFamily="Barlow,sans-serif">AVG UTILISATION</text>
      <text x="55" y="44" textAnchor="middle" fontSize="22" fontWeight="800" fill={uColor(avgUtil)} fontFamily="Barlow Condensed,sans-serif">{avgUtil.toFixed(0)}%</text>
      <rect x="8" y="50" width="94" height="5" rx="2" fill="#e2e8f0"/>
      <rect x="8" y="50" width={Math.min(94, 94*avgUtil/100)} height="5" rx="2" fill={uColor(avgUtil)}/>
    </g>
  );
  const TitleBlock = ({ sub }) => (<>
    <text x={W/2} y={22} textAnchor="middle" fontSize="13" fontWeight="800" fill="#111" fontFamily="Barlow Condensed,sans-serif" letterSpacing="2">{sub}</text>
    <text x={W/2} y={38} textAnchor="middle" fontSize="10" fill="#6b7280" fontFamily="Barlow,sans-serif">Span: {span}mm · Grade: {grade} · Load: {load} kN/m²</text>
  </>);
  const Ground = () => (<>
    <rect x={px-22} y={by} width={sw+44} height={14} fill="url(#hatch)" opacity="0.5"/>
    <line x1={px-22} y1={by} x2={qx+22} y2={by} stroke="#94a3b8" strokeWidth="2"/>
  </>);
  const Support = ({ x }) => (<g>
    <polygon points={`${x},${by} ${x-12},${by+13} ${x+12},${by+13}`} fill="#475569" opacity="0.85"/>
    <circle cx={x} cy={by} r="5" fill="#C8861A"/>
  </g>);
  const SpanDim = () => (<>
    <line x1={px} y1={by+50} x2={qx} y2={by+50} stroke="#94a3b8" strokeWidth="1.5" markerEnd="url(#arr)" markerStart="url(#arr)"/>
    <text x={cx} y={by+65} textAnchor="middle" fontSize="11" fill="#475569" fontWeight="700" fontFamily="Barlow,sans-serif">{span} mm</text>
  </>);

  // ── FINK TRUSS ───────────────────────────────────────────
  if (structureType === 'truss') {
    const n=4, ty=by-sh*0.58;
    const pts = Array.from({length:n+1},(_,i)=>{
      const t=Math.abs(i-n/2)/(n/2);
      return { x:px+(sw/n)*i, y:ty+(by-ty)*t*t };
    });
    const apex = pts[n/2];
    return (
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{fontFamily:'Barlow,sans-serif'}}>
        <defs>{MARKER('arr')}{HATCH('hatch')}</defs>
        <TitleBlock sub="TIMBER FINK TRUSS — EUROCODE 5"/>
        <Ground/>
        <Support x={px}/><Support x={qx}/>
        {/* Top chord */}
        {pts.slice(0,-1).map((p,i)=><line key={i} x1={p.x} y1={p.y} x2={pts[i+1].x} y2={pts[i+1].y} stroke={rCol} strokeWidth="7" strokeLinecap="round"/>)}
        {/* Bottom chord */}
        <line x1={px} y1={by} x2={qx} y2={by} stroke="#2563eb" strokeWidth="6" strokeLinecap="round"/>
        <text x={cx} y={by+20} textAnchor="middle" fontSize="9" fill="#2563eb" fontWeight="700">CEILING TIE</text>
        {/* Verticals */}
        {[1,2,3].map(i=><line key={i} x1={pts[i].x} y1={by} x2={pts[i].x} y2={pts[i].y} stroke="#C8861A" strokeWidth="4" strokeDasharray="5 2" strokeLinecap="round"/>)}
        {/* Diagonals */}
        {[[px+sw/4,by,apex.x,apex.y],[qx-sw/4,by,apex.x,apex.y]].map(([x1,y1,x2,y2],i)=>(
          <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#C8861A" strokeWidth="4" strokeDasharray="5 2" strokeLinecap="round"/>
        ))}
        {/* Nodes */}
        {pts.map((p,i)=><circle key={i} cx={p.x} cy={p.y} r="5" fill="#fff" stroke={rCol} strokeWidth="2.5"/>)}
        <circle cx={apex.x} cy={apex.y} r="7" fill="#fff" stroke={rCol} strokeWidth="3"/>
        {/* Grade label */}
        <text x={cx} y={(pts[0].y+apex.y)/2-8} textAnchor="middle" fontSize="10" fill={rCol} fontWeight="700">{grade}</text>
        {/* Load arrows */}
        {pts.slice(1,-1).map((p,i)=>(<g key={i}>
          <line x1={p.x} y1={p.y-34} x2={p.x} y2={p.y-9} stroke="#dc2626" strokeWidth="1.8" markerEnd="url(#arr)"/>
          <text x={p.x} y={p.y-38} textAnchor="middle" fontSize="9" fill="#dc2626" fontWeight="700">q</text>
        </g>))}
        {/* Reaction arrows */}
        {[px,qx].map((x,i)=>(<g key={i}>
          <line x1={x} y1={by+2} x2={x} y2={by+26} stroke="#16a34a" strokeWidth="2.2" markerEnd="url(#arr)"/>
          <text x={x} y={by+39} textAnchor="middle" fontSize="9.5" fill="#16a34a" fontWeight="700">R</text>
        </g>))}
        <SpanDim/>
        {/* Height dim */}
        <line x1={qx+28} y1={by} x2={qx+28} y2={apex.y} stroke="#94a3b8" strokeWidth="1.5" markerEnd="url(#arr)" markerStart="url(#arr)"/>
        <text x={qx+50} y={(by+apex.y)/2} textAnchor="middle" fontSize="11" fill="#475569" fontWeight="700"
          transform={`rotate(-90,${qx+50},${(by+apex.y)/2})`}>{height} mm</text>
        <UtilBox x={W-120} y={mt}/>
        {/* Legend */}
        <g transform={`translate(${px},${H-16})`}>
          {[{c:rCol,l:`Rafters (${grade})`},{c:'#2563eb',l:'Ceiling Tie'},{c:'#C8861A',l:'Struts'},{c:'#dc2626',l:'Load q'},{c:'#16a34a',l:'Reactions'}].map((d,i)=>(<g key={i} transform={`translate(${i*128},0)`}>
            <line x1="0" y1="0" x2="18" y2="0" stroke={d.c} strokeWidth="3"/>
            <text x="22" y="4" fontSize="9" fill="#6b7280">{d.l}</text>
          </g>))}
        </g>
      </svg>
    );
  }

  // ── PORTAL FRAME ─────────────────────────────────────────
  if (structureType === 'portal') {
    const postH=sh*0.68, ridgeY=by-postH-sh*0.22;
    return (
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
        <defs>{MARKER('arr')}{HATCH('hatch')}</defs>
        <TitleBlock sub="TIMBER PORTAL FRAME — EUROCODE 5"/>
        <Ground/>
        {/* Posts */}
        {[px,qx].map((x,i)=>(<g key={i}>
          <rect x={x-5} y={by-postH} width={10} height={postH} fill={rCol} opacity="0.85" rx="2"/>
          <rect x={x-14} y={by-2} width={28} height={6} fill="#475569" rx="1"/>
          <circle cx={x} cy={by} r="4" fill="#C8861A"/>
          <circle cx={x} cy={by-postH} r="7" fill="#fff" stroke={rCol} strokeWidth="2.5"/>
        </g>))}
        {/* Haunches */}
        <polygon points={`${px},${by-postH} ${px+sw*0.07},${by-postH} ${px+sw*0.22},${ridgeY}`} fill={rCol} opacity="0.6"/>
        <polygon points={`${qx},${by-postH} ${qx-sw*0.07},${by-postH} ${qx-sw*0.22},${ridgeY}`} fill={rCol} opacity="0.6"/>
        {/* Rafters */}
        <line x1={px} y1={by-postH} x2={cx} y2={ridgeY} stroke={rCol} strokeWidth="8" strokeLinecap="round"/>
        <line x1={qx} y1={by-postH} x2={cx} y2={ridgeY} stroke={rCol} strokeWidth="8" strokeLinecap="round"/>
        <circle cx={cx} cy={ridgeY} r="9" fill="#fff" stroke={rCol} strokeWidth="3"/>
        <text x={cx} y={ridgeY-14} textAnchor="middle" fontSize="9" fill="#475569">Ridge</text>
        {/* Grade */}
        <text x={cx-sw/4} y={(by-postH+ridgeY)/2-8} textAnchor="middle" fontSize="10" fill={rCol} fontWeight="700"
          transform={`rotate(-${pitch},${cx-sw/4},${(by-postH+ridgeY)/2-8})`}>{grade}</text>
        {/* Load arrows */}
        {[0.25,0.5,0.75].map(t=>{
          const lx=px+(cx-px)*t, ly=(by-postH)+(ridgeY-(by-postH))*t;
          const rx=qx+(cx-qx)*t, ry=(by-postH)+(ridgeY-(by-postH))*t;
          return(<g key={t}>
            <line x1={lx} y1={ly-28} x2={lx} y2={ly-7} stroke="#dc2626" strokeWidth="1.8" markerEnd="url(#arr)"/>
            <line x1={rx} y1={ry-28} x2={rx} y2={ry-7} stroke="#dc2626" strokeWidth="1.8" markerEnd="url(#arr)"/>
          </g>);
        })}
        <line x1={px} y1={by-postH-30} x2={qx} y2={by-postH-30} stroke="#dc2626" strokeWidth="1.2"/>
        <text x={cx} y={by-postH-36} textAnchor="middle" fontSize="9.5" fill="#dc2626" fontWeight="700">q = {load} kN/m²</text>
        {/* Reactions */}
        {[px,qx].map((x,i)=>(<g key={i}>
          <line x1={x} y1={by+2} x2={x} y2={by+26} stroke="#16a34a" strokeWidth="2.2" markerEnd="url(#arr)"/>
          <text x={x} y={by+39} textAnchor="middle" fontSize="9.5" fill="#16a34a" fontWeight="700">R</text>
        </g>))}
        <SpanDim/>
        <line x1={qx+28} y1={by} x2={qx+28} y2={by-postH} stroke="#94a3b8" strokeWidth="1.5" markerEnd="url(#arr)" markerStart="url(#arr)"/>
        <text x={qx+50} y={(by*2-postH)/2} textAnchor="middle" fontSize="11" fill="#475569" fontWeight="700"
          transform={`rotate(-90,${qx+50},${(by*2-postH)/2})`}>{height} mm</text>
        <UtilBox x={W-120} y={mt}/>
      </svg>
    );
  }

  // ── SIMPLE BEAM ──────────────────────────────────────────
  const bY = H/2 - 10;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
      <defs>{MARKER('arr')}{HATCH('hatch')}</defs>
      <TitleBlock sub="TIMBER BEAM / RAFTER — EUROCODE 5"/>
      {/* Beam */}
      <rect x={px} y={bY-20} width={sw} height={40} fill={rCol} opacity="0.82" rx="3"/>
      <text x={cx} y={bY+5} textAnchor="middle" fontSize="12" fill="#fff" fontWeight="700">{grade}</text>
      {/* UDL */}
      {Array.from({length:11},(_,i)=>px+sw*(i/10)).map((x,i)=>(
        <line key={i} x1={x} y1={bY-56} x2={x} y2={bY-24} stroke="#dc2626" strokeWidth="1.6" markerEnd="url(#arr)"/>
      ))}
      <line x1={px} y1={bY-56} x2={qx} y2={bY-56} stroke="#dc2626" strokeWidth="1.4"/>
      <text x={cx} y={bY-62} textAnchor="middle" fontSize="10" fill="#dc2626" fontWeight="700">q = {load} kN/m²</text>
      {/* Supports */}
      {[px,qx].map((x,i)=>(<g key={i}>
        <polygon points={`${x},${bY+20} ${x-13},${bY+38} ${x+13},${bY+38}`} fill="#475569"/>
        <rect x={x-18} y={bY+38} width={36} height={8} fill="url(#hatch)"/>
        <line x1={x} y1={bY+48} x2={x} y2={bY+68} stroke="#16a34a" strokeWidth="2.2" markerEnd="url(#arr)"/>
        <text x={x} y={bY+80} textAnchor="middle" fontSize="10" fill="#16a34a" fontWeight="700">R</text>
      </g>))}
      {/* BMD */}
      <path d={`M ${px} ${bY+110} Q ${cx} ${bY+162} ${qx} ${bY+110}`} fill="rgba(37,99,235,0.12)" stroke="#2563eb" strokeWidth="2"/>
      <text x={cx} y={bY+176} textAnchor="middle" fontSize="10" fill="#2563eb" fontWeight="600">
        M_max = {((Number(load)||3.5)*(Number(span)||6000)/1000*(Number(span)||6000)/1000/8).toFixed(2)} kNm
      </text>
      <text x={cx-50} y={bY+96} fontSize="9" fill="#2563eb">BMD</text>
      <SpanDim/>
      <UtilBox x={W-120} y={mt}/>
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────
//  SHARED UI
// ─────────────────────────────────────────────────────────────
const Fld = ({label,tip,children}) => (
  <div>
    <div className="flex items-center gap-1.5 mb-1.5">
      <label className="font-barlow font-semibold uppercase tracking-[0.1em] text-[11px] text-sub">{label}</label>
      {tip&&<span title={tip} className="text-gray-300 hover:text-amber cursor-help"><Info size={10}/></span>}
    </div>
    {children}
  </div>
);
const Inp = ({value,onChange,unit,placeholder,type='number'}) => (
  <div className="relative">
    <input className="ts-input pr-14" type={type} value={value} onChange={onChange} placeholder={placeholder} step="any"/>
    {unit&&<span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">{unit}</span>}
  </div>
);
const Sel = ({value,onChange,options}) => (
  <select className="ts-select" value={value} onChange={onChange}>
    {options.map(o=><option key={o.value??o} value={o.value??o}>{o.label??o}</option>)}
  </select>
);
const UBar = ({pct,label}) => {
  const n=parseFloat(pct)||0;
  const c=n>100?'#ef4444':n>80?'#f59e0b':'#22c55e';
  return (<div>
    {label&&<div className="flex justify-between text-xs mb-1">
      <span className="text-gray-400">{label}</span>
      <span className="font-bold" style={{color:c}}>{pct}%</span>
    </div>}
    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
      <div className="h-full rounded-full transition-all duration-700" style={{width:`${Math.min(100,n)}%`,background:c}}/>
    </div>
  </div>);
};
const Chip = ({pass,warning}) => {
  const b='inline-flex items-center gap-1 rounded font-barlow font-semibold uppercase tracking-wider text-[10px] px-2 py-0.5 border';
  if (pass === undefined || pass === null) return null;
  if (!pass)   return <span className={`${b} bg-red-50 text-red-600 border-red-200`}><XCircle size={11}/>FAIL</span>;
  if (warning) return <span className={`${b} bg-yellow-50 text-yellow-600 border-yellow-200`}><AlertTriangle size={11}/>HIGH</span>;
  return <span className={`${b} bg-green-50 text-green-600 border-green-200`}><CheckCircle size={11}/>PASS</span>;
};

const STEPS=[
  {id:'project', label:'Project Info',      icon:Building2},
  {id:'geometry',label:'Geometry & Loads',  icon:Layers},
  {id:'members', label:'Member Schedule',   icon:Settings},
  {id:'results', label:'Results & Diagram', icon:BarChart3},
];

// ─────────────────────────────────────────────────────────────
//  MAIN PAGE
// ─────────────────────────────────────────────────────────────
export default function StructuralPage() {
  const [step,     setStep]     = useState(0);
  const [members,  setMembers]  = useState([]);
  const [results,  setResults]  = useState([]);
  const [analysed, setAnalysed] = useState(false);
  const [error,    setError]    = useState('');
  const fileRef  = useRef(null);
  const diagRef  = useRef(null);

  // ── State ──────────────────────────────────────────────
  const [proj, setProj] = useState({
    name:'', client:'', location:'', date:new Date().toISOString().slice(0,10),
    engineer:'', reference:'', notes:'',
    structureType:'truss', serviceClass:'1', loadDuration:'medium_term', file:null,
  });
  const [geo, setGeo] = useState({
    span:12000, height:3600, pitch:22.5,
    deadLoad:1.5, liveLoad:2.0, windLoad:0.8, snowLoad:0.5,
  });
  const [mf, setMf] = useState({
    label:'', type:'rafter', width:47, depth:200, length:6000,
    grade:'C24', load:3.5, qty:1,
  });

  const sp  = k => e => setProj(p=>({...p,[k]:e.target.value}));
  const sg  = k => e => setGeo(p=>({...p,[k]:Number(e.target.value)||0}));
  const smv = k => e => setMf(p=>({...p,[k]:e.target.type==='number'?Number(e.target.value):e.target.value}));

  // ── File upload ────────────────────────────────────────
  const handleFile = useCallback(e => {
    const file = e.target.files?.[0]; if(!file) return;
    const reader = new FileReader();
    reader.onload = evt => {
      setProj(p=>({...p,file:{name:file.name,size:file.size}}));
      if (!file.name.endsWith('.csv')) return;
      const lines = evt.target.result.split('\n').map(l=>l.trim()).filter(Boolean).slice(1);
      const parsed = lines.map((l,i) => {
        const c = l.split(',');
        return {
          id: i+1,
          label:  (c[0]||'Member').trim(),
          type:   (c[1]||'rafter').trim().toLowerCase(),
          width:  Number(c[2])||47,
          depth:  Number(c[3])||200,
          length: Number(c[4])||6000,
          grade:  (c[5]||'C24').trim(),
          load:   Number(c[6])||3.5,
          qty:    Number(c[7])||1,
        };
      }).filter(r => r.label && r.label.toLowerCase()!=='member label');
      if (parsed.length) { setMembers(parsed); setAnalysed(false); }
    };
    reader.readAsText(file);
  },[]);

  // ── Member CRUD ────────────────────────────────────────
  const addMember = () => {
    if (!mf.label.trim()) return;
    setMembers(prev=>[...prev,{...mf,id:Date.now(),
      width:Number(mf.width)||47, depth:Number(mf.depth)||200,
      length:Number(mf.length)||6000, load:Number(mf.load)||3.5, qty:Number(mf.qty)||1,
    }]);
    setMf(p=>({...p,label:''}));
    setAnalysed(false); setError('');
  };
  const removeMember = id => { setMembers(p=>p.filter(m=>m.id!==id)); setAnalysed(false); };

  // ── RUN ANALYSIS ───────────────────────────────────────
  const runAnalysis = () => {
    setError('');
    if (!members.length) { setError('Add at least one member before running analysis.'); return; }

    try {
      const res = members.map(m => {
        const r = analyseMember(m, proj.serviceClass, proj.loadDuration);
        return { ...m, ...r };
      });
      setResults(res);
      setAnalysed(true);
      setStep(3);
    } catch(err) {
      console.error(err);
      setError('Analysis error: ' + err.message);
    }
  };

  // ── Exports ────────────────────────────────────────────
  const exportCSV = () => {
    const rows = ['Member,Type,Grade,Width(mm),Depth(mm),Length(mm),Qty,Load(kN),Capacity(kN),Utilisation(%),Status,Weight(kg)'];
    results.forEach(r => rows.push(
      `${r.label},${r.type},${r.grade},${r.width},${r.depth},${r.length},${r.qty},${r.load},${r.capacity||0},${r.utilisation||0},${r.pass?'PASS':'FAIL'},${((r.weight||0)*(r.qty||1)).toFixed(1)}`
    ));
    const a=document.createElement('a');
    a.href=URL.createObjectURL(new Blob([rows.join('\n')],{type:'text/csv'}));
    a.download=`${proj.name||'timberstruct'}-results.csv`; a.click();
  };
  const exportSVG = () => {
    const svg=diagRef.current?.querySelector('svg'); if(!svg) return;
    const a=document.createElement('a');
    a.href=URL.createObjectURL(new Blob([svg.outerHTML],{type:'image/svg+xml'}));
    a.download=`${proj.name||'timberstruct'}-diagram.svg`; a.click();
  };
  const dlTemplate = () => {
    const csv=`Member Label,Type,Width(mm),Depth(mm),Length(mm),Grade,Load(kN),Qty
Ridge Rafter,rafter,47,200,6200,C24,3.5,24
Internal Strut,strut,97,97,2400,C24,8.5,12
Ceiling Tie,rafter,47,150,12000,C24,1.8,8
Ridge Beam,rafter,147,297,12000,GL24h,12.4,2
Eave Post,strut,147,147,3600,C24,15.2,8`;
    const a=document.createElement('a');
    a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));
    a.download='timberstruct-member-template.csv'; a.click();
  };

  // ── Derived values ─────────────────────────────────────
  const hasFail  = results.some(r=>!r.pass);
  const hasWarn  = results.some(r=>r.warning&&r.pass);
  const avgUtil  = results.length ? results.reduce((s,r)=>s+(r.utilisation||0),0)/results.length : 0;
  const combos   = loadCombinations(geo.deadLoad,geo.liveLoad,geo.windLoad);
  const govLoad  = combos.reduce((mx,c)=>c.value>mx?c.value:mx, 0);

  // ══════════════════════════════════════════════════════
  return (
    <AppLayout>
      <div className="p-5 md:p-8 max-w-7xl mx-auto">

        {/* Header */}
        <div className="flex items-start justify-between flex-wrap gap-4 mb-7">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber/10 flex items-center justify-center">
              <LayoutGrid size={20} className="text-amber"/>
            </div>
            <div>
              <p className="section-label">Service & Engineering</p>
              <h1 className="font-condensed font-extrabold text-heading uppercase" style={{fontSize:'clamp(22px,3vw,34px)'}}>
                Structural Design
              </h1>
            </div>
          </div>
          <button onClick={()=>{setStep(0);setAnalysed(false);setResults([]);setMembers([]);setProj(p=>({...p,file:null}));setError('');}}
            className="flex items-center gap-1.5 font-barlow text-[12px] text-gray-400 hover:text-amber uppercase tracking-widest transition-colors">
            <RotateCcw size={13}/> New Design
          </button>
        </div>

        {/* Error banner */}
        {error && (
          <div className="mb-5 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg flex items-center justify-between">
            <span>{error}</span>
            <button onClick={()=>setError('')}><X size={16}/></button>
          </div>
        )}

        {/* Step indicator */}
        <div className="flex items-center gap-1 mb-7 overflow-x-auto pb-1">
          {STEPS.map((s,i)=>(
            <div key={s.id} className="flex items-center flex-shrink-0">
              <button onClick={()=>setStep(i)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-[11px] font-barlow font-semibold uppercase tracking-widest transition-all ${
                  i===step?'bg-amber text-white shadow-md':i<step?'text-green-600 bg-green-50 border border-green-200':'text-gray-400 bg-gray-50 border border-border'}`}>
                {i<step?<CheckCircle size={12}/>:<s.icon size={12}/>}
                <span className="hidden sm:inline">{s.label}</span>
                <span className="sm:hidden">{i+1}</span>
              </button>
              {i<3&&<ChevronRight size={15} className="mx-1 text-gray-300 flex-shrink-0"/>}
            </div>
          ))}
        </div>

        {/* ══ STEP 0: Project Info ══ */}
        {step===0&&(
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white border border-border rounded-xl p-6">
              <h3 className="font-barlow font-bold text-heading text-[15px] mb-5 flex items-center gap-2">
                <Building2 size={16} className="text-amber"/>Project Information
              </h3>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <Fld label="Project Name"><input className="ts-input" value={proj.name} onChange={sp('name')} placeholder="Westlands Roof"/></Fld>
                  <Fld label="Reference"><input className="ts-input" value={proj.reference} onChange={sp('reference')} placeholder="TSP-2025-001"/></Fld>
                </div>
                <Fld label="Client / Owner"><input className="ts-input" value={proj.client} onChange={sp('client')} placeholder="Acacia Developers Ltd"/></Fld>
                <div className="grid grid-cols-2 gap-3">
                  <Fld label="Location"><input className="ts-input" value={proj.location} onChange={sp('location')} placeholder="Nairobi, Kenya"/></Fld>
                  <Fld label="Date"><input className="ts-input" type="date" value={proj.date} onChange={sp('date')}/></Fld>
                </div>
                <Fld label="Engineer"><input className="ts-input" value={proj.engineer} onChange={sp('engineer')} placeholder="Eng. Jane Mwangi"/></Fld>
                <div className="grid grid-cols-3 gap-3 pt-3 border-t border-border">
                  <Fld label="Structure Type">
                    <Sel value={proj.structureType} onChange={sp('structureType')} options={[{value:'truss',label:'Fink Truss'},{value:'portal',label:'Portal Frame'},{value:'beam',label:'Simple Beam'}]}/>
                  </Fld>
                  <Fld label="Service Class" tip="EC5 cl.2.3.1.3">
                    <Sel value={proj.serviceClass} onChange={sp('serviceClass')} options={Object.entries(SERVICE_CLASS).map(([v,c])=>({value:v,label:`SC${v}`}))}/>
                  </Fld>
                  <Fld label="Load Duration" tip="EC5 Table 2.1">
                    <Sel value={proj.loadDuration} onChange={sp('loadDuration')} options={Object.entries(LOAD_DURATION).map(([v,c])=>({value:v,label:c.label.split(' ')[0]}))}/>
                  </Fld>
                </div>
                <Fld label="Notes"><textarea className="ts-input h-16 resize-none" value={proj.notes} onChange={sp('notes')} placeholder="Design assumptions…"/></Fld>
              </div>
            </div>
            <div className="space-y-5">
              <div className="bg-white border border-border rounded-xl p-6">
                <h3 className="font-barlow font-bold text-heading text-[15px] mb-2 flex items-center gap-2"><Upload size={16} className="text-amber"/>Upload Member Schedule (CSV)</h3>
                <p className="font-barlow text-[13px] text-gray-400 mb-4">Upload a CSV file to auto-populate the member schedule. All members will be extracted and ready for EC5 analysis.</p>
                <div className={`border-2 border-dashed rounded-xl p-7 text-center cursor-pointer transition-all ${proj.file?'border-green-300 bg-green-50':'border-border hover:border-amber hover:bg-amber/5'}`}
                  onClick={()=>fileRef.current?.click()}
                  onDragOver={e=>e.preventDefault()}
                  onDrop={e=>{e.preventDefault();const f=e.dataTransfer.files[0];if(f){const dt=new DataTransfer();dt.items.add(f);fileRef.current.files=dt.files;handleFile({target:{files:[f]}});}}}
                >
                  <input ref={fileRef} type="file" className="hidden" accept=".csv,.txt" onChange={handleFile}/>
                  {proj.file?(
                    <div className="flex flex-col items-center gap-2">
                      <CheckCircle size={36} className="text-green-500"/>
                      <p className="font-barlow font-semibold text-green-700">{proj.file.name}</p>
                      <p className="font-barlow text-[12px] text-gray-400">{(proj.file.size/1024).toFixed(1)} KB · {members.length} members loaded</p>
                      <button onClick={e=>{e.stopPropagation();setProj(p=>({...p,file:null}));setMembers([]);}}
                        className="flex items-center gap-1 text-[12px] text-red-400 hover:text-red-600"><X size={11}/>Remove</button>
                    </div>
                  ):(
                    <div className="flex flex-col items-center gap-3">
                      <Upload size={36} className="text-gray-200"/>
                      <div>
                        <p className="font-barlow font-semibold text-heading text-[15px]">Drop CSV file here or click to browse</p>
                        <p className="font-barlow text-[12px] text-gray-400 mt-1">Members auto-extracted and loaded</p>
                      </div>
                    </div>
                  )}
                </div>
                <button onClick={dlTemplate} className="mt-3 flex items-center gap-1.5 font-barlow text-[12px] text-amber hover:text-amber-dark uppercase tracking-widest">
                  <Download size={12}/> Download CSV Template
                </button>
              </div>
              <div className="bg-heading rounded-xl p-5 text-white">
                <h4 className="font-condensed font-bold uppercase tracking-widest text-sm mb-4">EC5 Design Parameters</h4>
                <div className="space-y-2 text-[13px]">
                  {[
                    ['Service Class', SERVICE_CLASS[proj.serviceClass]?.label||'—'],
                    ['Load Duration', LOAD_DURATION[proj.loadDuration]?.label||'—'],
                    ['kmod', getKmod(proj.serviceClass,proj.loadDuration).toFixed(2)],
                    ['γM',  GAMMA_M],
                    ['Structure', proj.structureType==='truss'?'Fink Truss':proj.structureType==='portal'?'Portal Frame':'Simple Beam'],
                    ['Building Code','Eurocode 5 (EN 1995-1-1)'],
                  ].map(([l,v])=>(
                    <div key={l} className="flex justify-between">
                      <span className="text-gray-400">{l}</span>
                      <span className="text-amber font-semibold text-right max-w-[180px]">{v}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ══ STEP 1: Geometry & Loads ══ */}
        {step===1&&(
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white border border-border rounded-xl p-6">
              <h3 className="font-barlow font-bold text-heading text-[15px] mb-5 flex items-center gap-2"><Layers size={16} className="text-amber"/>Structure Geometry</h3>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <Fld label="Span" tip="Centre-to-centre between supports"><Inp value={geo.span} onChange={sg('span')} unit="mm"/></Fld>
                  <Fld label="Eaves Height"><Inp value={geo.height} onChange={sg('height')} unit="mm"/></Fld>
                </div>
                <Fld label="Roof Pitch"><Inp value={geo.pitch} onChange={sg('pitch')} unit="°"/></Fld>
              </div>
              <h3 className="font-barlow font-bold text-heading text-[15px] mt-6 mb-5 flex items-center gap-2"><BarChart3 size={16} className="text-amber"/>Characteristic Loads (EN 1991)</h3>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <Fld label="Dead Load (G)" tip="Self-weight + permanent"><Inp value={geo.deadLoad} onChange={sg('deadLoad')} unit="kN/m²"/></Fld>
                  <Fld label="Imposed Load (Q)" tip="EC1 category A–H"><Inp value={geo.liveLoad} onChange={sg('liveLoad')} unit="kN/m²"/></Fld>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Fld label="Wind Load (W)" tip="EN 1991-1-4"><Inp value={geo.windLoad} onChange={sg('windLoad')} unit="kN/m²"/></Fld>
                  <Fld label="Snow Load (S)" tip="EN 1991-1-3"><Inp value={geo.snowLoad} onChange={sg('snowLoad')} unit="kN/m²"/></Fld>
                </div>
              </div>
            </div>
            <div className="space-y-5">
              <div className="bg-white border border-border rounded-xl p-6">
                <h3 className="font-barlow font-bold text-heading text-[15px] mb-4">EC0 Load Combinations</h3>
                <div className="space-y-2 mb-5">
                  {combos.map((c,i)=>(
                    <div key={i} className={`flex items-center justify-between py-2.5 px-3 rounded-lg border ${c.value===govLoad?'border-amber/30 bg-amber/5':'border-border bg-gray-50'}`}>
                      <span className="font-barlow text-[12px] text-body">{c.label}</span>
                      <div className="flex items-center gap-2">
                        <span className="font-condensed font-bold text-heading text-lg">{c.value} kN/m²</span>
                        {c.value===govLoad&&<span className="font-barlow text-[9px] bg-amber text-white px-1.5 py-0.5 rounded uppercase">Governs</span>}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="bg-amber/5 border border-amber/20 rounded-lg p-4">
                  <p className="font-barlow text-[11px] text-gray-400 mb-1 uppercase tracking-wider font-semibold">Governing Design Load</p>
                  <p className="font-condensed font-bold text-amber text-3xl">{govLoad.toFixed(3)} kN/m²</p>
                </div>
              </div>
              <div className="bg-gray-50 border border-border rounded-xl p-4">
                <p className="font-barlow text-[11px] text-gray-400 uppercase tracking-wider mb-3">Structure Preview</p>
                <StructureDiagram params={{...proj,...geo,load:geo.liveLoad}} results={[]}/>
              </div>
            </div>
          </div>
        )}

        {/* ══ STEP 2: Member Schedule ══ */}
        {step===2&&(
          <div className="space-y-5">
            <div className="bg-white border border-border rounded-xl p-6">
              <h3 className="font-barlow font-bold text-heading text-[15px] mb-5 flex items-center gap-2"><Settings size={16} className="text-amber"/>Add Structural Member</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-9 gap-3 items-end">
                <div className="col-span-2"><Fld label="Label"><input className="ts-input" value={mf.label} onChange={smv('label')} placeholder="e.g. Ridge Rafter"/></Fld></div>
                <Fld label="Type"><Sel value={mf.type} onChange={smv('type')} options={[{value:'rafter',label:'Rafter/Beam'},{value:'strut',label:'Strut/Post'}]}/></Fld>
                <Fld label="Width (mm)"><Inp value={mf.width} onChange={smv('width')} unit="mm"/></Fld>
                <Fld label="Depth (mm)"><Inp value={mf.depth} onChange={smv('depth')} unit="mm"/></Fld>
                <Fld label={mf.type==='strut'?'Length (mm)':'Span (mm)'}><Inp value={mf.length} onChange={smv('length')} unit="mm"/></Fld>
                <Fld label="Grade"><Sel value={mf.grade} onChange={smv('grade')} options={Object.keys(GRADE_PROPS)}/></Fld>
                <Fld label="Load (kN)"><Inp value={mf.load} onChange={smv('load')} unit="kN"/></Fld>
                <Fld label="Qty"><Inp value={mf.qty} onChange={smv('qty')}/></Fld>
              </div>
              <div className="flex flex-wrap gap-3 mt-4">
                <button onClick={addMember} disabled={!mf.label.trim()} className="btn-amber disabled:opacity-40"><Plus size={14}/>Add Member</button>
                <button onClick={dlTemplate} className="btn-outline-dark !py-2"><Download size={12}/>CSV Template</button>
                <div><input ref={fileRef} type="file" className="hidden" accept=".csv" onChange={handleFile}/>
                  <button onClick={()=>fileRef.current?.click()} className="btn-outline-amber !py-2"><Upload size={12}/>Import CSV</button>
                </div>
                {members.length>0&&(
                  <button onClick={runAnalysis} className="btn-amber ml-auto"><Zap size={14}/>Run EC5 Analysis ({members.length} members)</button>
                )}
              </div>
            </div>

            {/* Timber grade reference */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {Object.entries(GRADE_PROPS).map(([g,p])=>(
                <div key={g} className={`bg-white border rounded-lg p-4 transition-all cursor-pointer ${mf.grade===g?'border-amber shadow-sm':'border-border hover:border-amber/50'}`}
                  onClick={()=>setMf(prev=>({...prev,grade:g}))}>
                  <div className="font-condensed font-bold text-amber text-xl mb-2">{g}</div>
                  <div className="text-[11px] font-barlow text-gray-400 space-y-1">
                    <div className="flex justify-between"><span>fc0k</span><span className="font-semibold text-body">{p.fc0k} N/mm²</span></div>
                    <div className="flex justify-between"><span>fmk</span><span className="font-semibold text-body">{p.fmk} N/mm²</span></div>
                    <div className="flex justify-between"><span>E0mean</span><span className="font-semibold text-body">{p.E0mean} N/mm²</span></div>
                    <div className="flex justify-between"><span>Density</span><span className="font-semibold text-body">{p.density} kg/m³</span></div>
                  </div>
                </div>
              ))}
            </div>

            {members.length>0?(
              <div className="bg-white border border-border rounded-xl overflow-hidden">
                <div className="px-6 py-4 border-b border-border flex items-center justify-between">
                  <h3 className="font-barlow font-bold text-heading text-[15px]">Member Schedule — {members.length} member{members.length>1?'s':''}</h3>
                  <button onClick={runAnalysis} className="btn-amber"><Zap size={14}/>Run EC5 Analysis</button>
                </div>
                <div className="overflow-x-auto">
                  <table className="tbl w-full">
                    <thead className="bg-gray-50">
                      <tr>{['#','Label','Type','b × d (mm)','Length / Span','Grade','Load (kN)','Qty',''].map(h=><th key={h} className="px-4 py-3 text-[10px]">{h}</th>)}</tr>
                    </thead>
                    <tbody>
                      {members.map((m,i)=>(
                        <tr key={m.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3 text-gray-400 text-xs">{i+1}</td>
                          <td className="px-4 py-3 font-semibold text-heading text-sm">{m.label}</td>
                          <td className="px-4 py-3 text-sm capitalize">{m.type}</td>
                          <td className="px-4 py-3 font-mono text-xs">{m.width} × {m.depth}</td>
                          <td className="px-4 py-3 font-mono text-xs">{m.length} mm</td>
                          <td className="px-4 py-3"><span className="font-mono text-xs bg-amber/10 text-amber px-2 py-0.5 rounded">{m.grade}</span></td>
                          <td className="px-4 py-3 text-sm">{m.load} kN</td>
                          <td className="px-4 py-3 text-sm">×{m.qty}</td>
                          <td className="px-4 py-3"><button onClick={()=>removeMember(m.id)} className="text-gray-300 hover:text-red-400 transition-colors"><Trash2 size={13}/></button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ):(
              <div className="bg-white border border-dashed border-border rounded-xl p-12 text-center">
                <FileText size={36} className="text-gray-200 mx-auto mb-3"/>
                <p className="font-barlow font-semibold text-heading text-[15px] mb-1">No members yet</p>
                <p className="font-barlow text-body text-sm">Add members above or import from a CSV file</p>
              </div>
            )}
          </div>
        )}

        {/* ══ STEP 3: Results & Diagram ══ */}
        {step===3&&(
          <div className="space-y-6">
            {/* Summary banner */}
            <div className={`rounded-xl p-5 border flex items-start gap-4 ${hasFail?'bg-red-50 border-red-200':hasWarn?'bg-yellow-50 border-yellow-200':analysed?'bg-green-50 border-green-200':'bg-gray-50 border-border'}`}>
              {hasFail?<XCircle size={26} className="text-red-500 flex-shrink-0 mt-0.5"/>
               :hasWarn?<AlertTriangle size={26} className="text-yellow-500 flex-shrink-0 mt-0.5"/>
               :analysed?<CheckCircle size={26} className="text-green-500 flex-shrink-0 mt-0.5"/>
               :<Info size={26} className="text-gray-400 flex-shrink-0 mt-0.5"/>}
              <div className="flex-1">
                <h3 className={`font-barlow font-bold uppercase tracking-wide text-[14px] ${hasFail?'text-red-700':hasWarn?'text-yellow-700':analysed?'text-green-700':'text-gray-500'}`}>
                  {!analysed?'No analysis run — go back to Member Schedule and click Run EC5 Analysis'
                   :hasFail?`${results.filter(r=>!r.pass).length} member(s) FAIL Eurocode 5 — resize required`
                   :hasWarn?'All members pass — some have high utilisation (>80%), review recommended'
                   :'All members PASS Eurocode 5 — design is compliant'}
                </h3>
                {analysed&&<p className="font-barlow text-[13px] mt-1 text-gray-500">
                  {results.length} members analysed · Avg utilisation: {avgUtil.toFixed(1)}% · {proj.name||'Unnamed project'}
                </p>}
              </div>
              {analysed&&(
                <div className="flex gap-2 flex-shrink-0">
                  <button onClick={exportCSV} className="btn-amber !py-2 !px-3 !text-[11px]"><Download size={12}/>CSV</button>
                  <button onClick={exportSVG} className="btn-outline-dark !py-2 !px-3 !text-[11px]"><Download size={12}/>SVG</button>
                </div>
              )}
            </div>

            {/* Load combinations */}
            {analysed&&(
              <div className="bg-white border border-border rounded-xl p-6">
                <h3 className="font-barlow font-bold text-heading text-[15px] mb-4">EC0 Load Combinations Applied</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {combos.map((c,i)=>(
                    <div key={i} className={`rounded-lg p-3 border ${c.value===govLoad?'border-amber/30 bg-amber/5':'border-border bg-gray-50'}`}>
                      <p className="font-barlow text-[10px] text-gray-400 mb-1">{c.label}</p>
                      <p className={`font-condensed font-bold text-xl ${c.value===govLoad?'text-amber':'text-heading'}`}>{c.value}</p>
                      <p className="font-barlow text-[10px] text-gray-400">kN/m²</p>
                      {c.value===govLoad&&<span className="font-barlow text-[9px] bg-amber text-white px-1.5 py-0.5 rounded uppercase tracking-wider">Governing</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* DIAGRAM */}
            <div className="bg-white border border-border rounded-xl p-6" ref={diagRef}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-barlow font-bold text-heading text-[15px] flex items-center gap-2">
                  <Eye size={15} className="text-amber"/>Timber Structural Design Diagram
                </h3>
                <button onClick={exportSVG} className="btn-outline-amber !py-1.5 !px-3 !text-[11px]"><Download size={12}/>Export SVG</button>
              </div>
              <div className="bg-gray-50 border border-border rounded-xl p-4">
                <StructureDiagram
                  params={{...proj,...geo,load:geo.liveLoad}}
                  results={results}
                />
              </div>
              <div className="mt-3 flex flex-wrap gap-5 text-[11px] font-barlow text-gray-400">
                <span className="flex items-center gap-1.5"><span className="w-4 h-1 rounded bg-green-500 inline-block"/>{'<'}80% — Safe</span>
                <span className="flex items-center gap-1.5"><span className="w-4 h-1 rounded bg-yellow-400 inline-block"/>80–100% — Review</span>
                <span className="flex items-center gap-1.5"><span className="w-4 h-1 rounded bg-red-500 inline-block"/> &gt;100% — Fail</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-blue-500 inline-block"/>Tension member</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-amber inline-block" style={{borderTop:'2px dashed'}}/>Strut/diagonal</span>
              </div>
            </div>

            {/* Results table */}
            {results.length>0&&(
              <div className="bg-white border border-border rounded-xl overflow-hidden">
                <div className="px-6 py-4 border-b border-border">
                  <h3 className="font-barlow font-bold text-heading text-[15px]">EC5 Calculation Results</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="tbl w-full text-xs">
                    <thead className="bg-gray-50">
                      <tr>
                        {['Member','Type','Section','Grade','Load\n(kN)','Capacity\n(kN)','Compression / Bending','Deflection','Utilisation','Wt (kg)','Status'].map(h=>(
                          <th key={h} className="px-3 py-3 text-[10px] whitespace-pre-line">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {results.map((r,i)=>(
                        <tr key={i} className={`hover:bg-gray-50 transition-colors ${!r.pass?'bg-red-50/40':''}`}>
                          <td className="px-3 py-3 font-semibold text-heading">{r.label}</td>
                          <td className="px-3 py-3 capitalize">{r.mode||r.type}</td>
                          <td className="px-3 py-3 font-mono">{r.width}×{r.depth}mm</td>
                          <td className="px-3 py-3"><span className="bg-amber/10 text-amber px-2 py-0.5 rounded font-mono">{r.grade}</span></td>
                          <td className="px-3 py-3">{r.load}</td>
                          <td className="px-3 py-3 font-semibold text-green-600">{r.capacity||'—'}</td>
                          <td className="px-3 py-3 text-gray-500">
                            {r.mode==='strut'||r.type==='strut'
                              ?<><div>λ = {r.lambda} (≤150 ✓)</div><div>kc = {r.kc}</div><div>fcd = {r.fcd} N/mm²</div></>
                              :<><div>M = {r.moment} kNm</div><div>σ = {r.stress} N/mm²</div><div>fmd = {r.fmd} N/mm²</div></>}
                          </td>
                          <td className="px-3 py-3">
                            {r.mode==='rafter'||r.type==='rafter'
                              ?<span className={r.deflOk?'text-green-600':'text-red-500'}>
                                  wfin={r.deflection_fin}mm<br/>lim={r.lim_fin}mm
                                </span>
                              :<span className="text-gray-400">N/A</span>}
                          </td>
                          <td className="px-3 py-3 w-28"><UBar pct={r.utilisation||0}/></td>
                          <td className="px-3 py-3">{((r.weight||0)*(r.qty||1)).toFixed(1)}</td>
                          <td className="px-3 py-3"><Chip pass={r.pass} warning={r.warning}/></td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-gray-50 border-t-2 border-border">
                      <tr>
                        <td colSpan="9" className="px-3 py-3 font-semibold text-heading">Totals</td>
                        <td className="px-3 py-3 font-bold text-heading">{results.reduce((s,r)=>s+((r.weight||0)*(r.qty||1)),0).toFixed(1)} kg</td>
                        <td className="px-3 py-3"><Chip pass={!hasFail} warning={hasWarn}/></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}

            {/* Certificate */}
            {analysed&&!hasFail&&(
              <div className="bg-heading text-white rounded-xl p-6 flex items-center justify-between flex-wrap gap-4">
                <div>
                  <h3 className="font-condensed font-bold uppercase tracking-widest text-lg">Design Compliant — Eurocode 5</h3>
                  <p className="font-barlow text-gray-400 text-[13px] mt-1">{proj.name||'Project'} · {proj.engineer||'Engineer'} · {proj.date}</p>
                  <div className="flex flex-wrap gap-6 mt-3">
                    {[
                      ['Members',     results.length],
                      ['Pass EC5',    `${results.filter(r=>r.pass).length}/${results.length}`],
                      ['Total Weight',`${results.reduce((s,r)=>s+((r.weight||0)*(r.qty||1)),0).toFixed(0)} kg`],
                      ['Avg Util',    `${avgUtil.toFixed(1)}%`],
                    ].map(([l,v])=>(
                      <div key={l}>
                        <p className="font-barlow text-[10px] text-gray-500 uppercase tracking-wider">{l}</p>
                        <p className="font-condensed font-bold text-amber text-2xl">{v}</p>
                      </div>
                    ))}
                  </div>
                </div>
                <CheckCircle size={52} className="text-green-400 opacity-70"/>
              </div>
            )}
          </div>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between mt-8 pt-5 border-t border-border">
          <button onClick={()=>setStep(s=>Math.max(0,s-1))} disabled={step===0} className="btn-outline-dark disabled:opacity-30">
            <ChevronLeft size={14}/>Previous
          </button>
          <span className="font-barlow text-[11px] text-gray-400">Step {step+1} of {STEPS.length} — {STEPS[step].label}</span>
          {step<2
            ?<button onClick={()=>setStep(s=>s+1)} className="btn-amber">Next<ChevronRight size={14}/></button>
            :step===2
            ?<button onClick={runAnalysis} disabled={!members.length} className="btn-amber disabled:opacity-40"><Zap size={14}/>Run EC5 Analysis</button>
            :<button onClick={exportCSV} disabled={!analysed} className="btn-amber disabled:opacity-40"><Download size={14}/>Export Report</button>}
        </div>
      </div>
    </AppLayout>
  );
}
