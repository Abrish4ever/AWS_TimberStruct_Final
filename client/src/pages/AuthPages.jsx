import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bell, Eye, EyeOff, ArrowRight, Loader, CheckCircle, Wifi, WifiOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

function ConnectionBanner() {
  const [status, setStatus] = useState('checking');
  useEffect(() => {
    fetch('http://localhost:4000/api/ping', { signal: AbortSignal.timeout(3000) })
      .then(r => r.ok ? setStatus('ok') : setStatus('error'))
      .catch(() => setStatus('error'));
  }, []);
  if (status === 'checking') return (
    <div className="flex items-center gap-2 text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded px-3 py-2 mb-5">
      <Loader size={11} className="animate-spin text-amber"/>Checking connection…
    </div>
  );
  if (status === 'ok') return (
    <div className="flex items-center gap-2 text-xs text-green-700 bg-green-50 border border-green-200 rounded px-3 py-2 mb-5">
      <Wifi size={11}/>Connected — ready
    </div>
  );
  return (
    <div className="text-xs bg-red-50 border border-red-200 rounded px-3 py-2.5 mb-5 space-y-1">
      <div className="flex items-center gap-2 text-red-600 font-semibold"><WifiOff size={11}/>Backend not reachable (port 4000)</div>
      <p className="text-red-500">Run: <code className="bg-red-100 px-1 rounded">node server/server.js</code></p>
    </div>
  );
}

function ErrBox({ msg }) {
  if (!msg) return null;
  return <div className="bg-red-50 border border-red-200 text-red-700 text-[13px] px-4 py-3 rounded mb-4">{msg}</div>;
}

function AuthLogo() {
  return (
    <Link to="/" className="flex items-center gap-2.5 justify-center mb-8">
      <div className="w-10 h-10 rounded-md bg-amber flex items-center justify-center">
        <Bell size={19} className="text-white" strokeWidth={2.3}/>
      </div>
      <div className="leading-none">
        <div className="font-condensed font-bold text-[17px] text-heading tracking-widest leading-tight">TIMBER</div>
        <div className="font-condensed font-bold text-[17px] text-amber  tracking-widest leading-tight">STRUCT</div>
      </div>
    </Link>
  );
}

function Field({ label, type='text', value, onChange, placeholder, show, onToggle }) {
  return (
    <div>
      <label className="block font-barlow font-semibold uppercase tracking-[0.1em] text-[11px] text-sub mb-1.5">{label}</label>
      <div className="relative">
        <input className="ts-input" type={type==='password'?(show?'text':'password'):type}
          value={value} onChange={onChange} placeholder={placeholder}/>
        {type==='password'&&(
          <button type="button" onClick={onToggle}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-amber transition-colors">
            {show?<EyeOff size={15}/>:<Eye size={15}/>}
          </button>
        )}
      </div>
    </div>
  );
}

function BrandBar() {
  return (
    <div style={{ backgroundColor:'#0E0E0E' }} className="h-16 flex items-center px-6">
      <Link to="/" className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded bg-amber flex items-center justify-center">
          <Bell size={15} className="text-white" strokeWidth={2.3}/>
        </div>
        <div className="leading-none">
          <div className="font-condensed font-bold text-[14px] text-white  tracking-widest leading-tight">TIMBER</div>
          <div className="font-condensed font-bold text-[14px] text-amber tracking-widest leading-tight">STRUCT</div>
        </div>
      </Link>
    </div>
  );
}

// ═══ LOGIN PAGE ══════════════════════════════════════════════
export function LoginPage() {
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [show,     setShow]     = useState(false);
  const [err,      setErr]      = useState('');
  const { login, loading }      = useAuth();
  const navigate                = useNavigate();

  const handleSubmit = async e => {
    e.preventDefault(); setErr('');
    if (!email.trim()) return setErr('Email address is required');
    if (!password)     return setErr('Password is required');
    try {
      await login(email.trim().toLowerCase(), password);
      navigate('/app');
    } catch(e) { setErr(e.message); }
  };

  return (
    <div className="min-h-screen flex flex-col bg-page">
      <BrandBar/>
      <div className="flex-1 flex items-center justify-center py-12 px-4">
        <div className="w-full max-w-[420px] bg-white border border-border rounded-xl p-8 shadow-sm">
          <AuthLogo/>
          <ConnectionBanner/>
          <h1 className="font-condensed font-extrabold text-heading uppercase text-[28px] mb-1">Sign In</h1>
          <p className="font-barlow text-body text-sm mb-6">Access your TimberStruct platform</p>
          <ErrBox msg={err}/>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Field label="Email Address" type="email"    value={email}    onChange={e=>setEmail(e.target.value)}    placeholder="you@company.com"/>
            <Field label="Password"      type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••••" show={show} onToggle={()=>setShow(v=>!v)}/>
            <button type="submit" disabled={loading}
              className="btn-amber w-full justify-center py-3.5 mt-2 disabled:opacity-50">
              {loading?<Loader size={15} className="animate-spin"/>:<><ArrowRight size={14}/>Sign In</>}
            </button>
          </form>
          <p className="text-center font-barlow text-sm text-body mt-6">
            Don't have an account?{' '}
            <Link to="/signup" className="text-amber hover:text-amber-dark font-semibold">Create one free</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

// ═══ SIGNUP PAGE ═════════════════════════════════════════════
export function SignupPage() {
  const [f,    setF]    = useState({name:'',email:'',password:'',confirm:'',phone:'',company:''});
  const [show, setShow] = useState(false);
  const [err,  setErr]  = useState('');
  const [done, setDone] = useState(false);
  const { register, loading } = useAuth();
  const navigate              = useNavigate();
  const set = k => e => setF(p=>({...p,[k]:e.target.value}));

  const strength  = f.password.length>=10?'strong':f.password.length>=6?'medium':'weak';
  const strConfig = {strong:['#22c55e','100%','Strong'],medium:['#f59e0b','60%','Medium'],weak:['#ef4444','25%','Too short']}[strength];

  const handleSubmit = async e => {
    e.preventDefault(); setErr('');
    if (!f.name.trim())           return setErr('Full name is required');
    if (!f.email.trim())          return setErr('Email address is required');
    if (f.password.length < 6)    return setErr('Password must be at least 6 characters');
    if (f.password !== f.confirm) return setErr('Passwords do not match');
    try {
      await register({ name:f.name.trim(), email:f.email.trim().toLowerCase(),
                       password:f.password, phone:f.phone||null, company:f.company||null });
      setDone(true);
      setTimeout(()=>navigate('/app'), 1500);
    } catch(e) { setErr(e.message); }
  };

  return (
    <div className="min-h-screen flex flex-col bg-page">
      <BrandBar/>
      <div className="flex-1 flex items-center justify-center py-12 px-4">
        <div className="w-full max-w-[480px] bg-white border border-border rounded-xl p-8 shadow-sm">
          <AuthLogo/>
          <ConnectionBanner/>
          {done ? (
            <div className="text-center py-8">
              <CheckCircle size={52} className="text-green-500 mx-auto mb-4"/>
              <h2 className="font-condensed font-bold text-heading uppercase text-2xl mb-2">Account Created!</h2>
              <p className="font-barlow text-body text-sm">Taking you to the platform…</p>
            </div>
          ) : (
            <>
              <h1 className="font-condensed font-extrabold text-heading uppercase text-[28px] mb-1">Create Account</h1>
              <p className="font-barlow text-body text-sm mb-6">Free account — start in under 2 minutes</p>
              <ErrBox msg={err}/>
              <form onSubmit={handleSubmit} className="space-y-4">
                <Field label="Full Name *"            value={f.name}    onChange={set('name')}    placeholder="Jane Mwangi"/>
                <Field label="Email Address *" type="email" value={f.email} onChange={set('email')} placeholder="jane@company.com"/>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Phone"   value={f.phone}   onChange={set('phone')}   placeholder="+254 700 000 000"/>
                  <Field label="Company" value={f.company} onChange={set('company')} placeholder="Company Ltd"/>
                </div>
                <Field label="Password * (min 6 chars)" type="password" value={f.password} onChange={set('password')} placeholder="••••••••" show={show} onToggle={()=>setShow(v=>!v)}/>
                <Field label="Confirm Password *"        type="password" value={f.confirm}  onChange={set('confirm')}  placeholder="••••••••" show={show} onToggle={()=>setShow(v=>!v)}/>
                {f.password&&(
                  <div className="space-y-1">
                    <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-300"
                        style={{width:strConfig[1],backgroundColor:strConfig[0]}}/>
                    </div>
                    <p className="font-barlow text-[12px]" style={{color:strConfig[0]}}>{strConfig[2]} password</p>
                  </div>
                )}
                <button type="submit" disabled={loading}
                  className="btn-amber w-full justify-center py-3.5 disabled:opacity-50">
                  {loading?<Loader size={15} className="animate-spin"/>:<><ArrowRight size={14}/>Create Account</>}
                </button>
              </form>
              <p className="text-center font-barlow text-sm text-body mt-6">
                Already have an account?{' '}
                <Link to="/login" className="text-amber hover:text-amber-dark font-semibold">Sign in</Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
