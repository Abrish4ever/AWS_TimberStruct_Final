import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Bell, Menu, X, ArrowRight, LayoutDashboard, LogOut, User, ChevronDown } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const PUBLIC_LINKS = [
  { label: 'Home',     to: '/'         },
  { label: 'About',    to: '/about'    },
  { label: 'Services', to: '/services' },
  { label: 'Contact',  to: '/contact'  },
];

export default function Navbar() {
  const [menuOpen,    setMenuOpen]    = useState(false);
  const [userDropOpen,setUserDropOpen]= useState(false);
  const [scrolled,    setScrolled]    = useState(false);
  const { user, logout }              = useAuth();
  const location                      = useLocation();
  const navigate                      = useNavigate();

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', fn);
    return () => window.removeEventListener('scroll', fn);
  }, []);

  // Close menus on route change
  useEffect(() => { setMenuOpen(false); setUserDropOpen(false); }, [location.pathname]);

  // Close user dropdown when clicking outside
  useEffect(() => {
    if (!userDropOpen) return;
    const fn = () => setUserDropOpen(false);
    document.addEventListener('click', fn);
    return () => document.removeEventListener('click', fn);
  }, [userDropOpen]);

  const doLogout = () => { logout(); navigate('/'); };

  // Nav links: add Dashboard after Contact when logged in
  const navLinks = user
    ? [...PUBLIC_LINKS, { label: 'Dashboard', to: '/app' }]
    : PUBLIC_LINKS;

  return (
    <header
      className={`fixed top-0 inset-x-0 z-50 h-16 transition-all duration-200 ${scrolled ? 'shadow-xl' : ''}`}
      style={{ backgroundColor: '#0E0E0E' }}
    >
      <div className="max-w-7xl mx-auto h-full px-6 flex items-center justify-between gap-6">

        {/* ── Logo ── */}
        <Link to="/" className="flex items-center gap-2.5 flex-shrink-0">
          <div className="w-9 h-9 rounded-md bg-amber flex items-center justify-center">
            <Bell size={17} className="text-white" strokeWidth={2.3} />
          </div>
          <div className="leading-none">
            <div className="font-condensed font-bold text-[15px] text-white  tracking-widest leading-tight">TIMBER</div>
            <div className="font-condensed font-bold text-[15px] text-amber tracking-widest leading-tight">STRUCT</div>
          </div>
        </Link>

        {/* ── Desktop nav links ── */}
        <nav className="hidden md:flex items-center gap-7 flex-1 justify-center">
          {navLinks.map(l => {
            const active = l.to === '/'
              ? location.pathname === '/'
              : location.pathname.startsWith(l.to);
            return (
              <Link key={l.to} to={l.to}
                className={`nav-link flex items-center gap-1.5 ${active ? '!text-amber' : ''}`}>
                {l.label === 'Dashboard' && <LayoutDashboard size={13} />}
                {l.label}
              </Link>
            );
          })}
        </nav>

        {/* ── Desktop right: auth area ── */}
        <div className="hidden md:flex items-center gap-4 flex-shrink-0">
          {user ? (
            /* Logged-in: user dropdown */
            <div className="relative" onClick={e => e.stopPropagation()}>
              <button
                onClick={() => setUserDropOpen(v => !v)}
                className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg border border-white/10
                           hover:border-white/20 transition-all duration-150 group"
              >
                {/* Avatar */}
                <div className="w-7 h-7 rounded-full bg-amber flex items-center justify-center flex-shrink-0">
                  <span className="text-white text-[11px] font-bold">{user.name?.[0]?.toUpperCase()}</span>
                </div>
                <div className="text-left leading-none">
                  <p className="font-barlow font-semibold text-white text-[13px] leading-tight truncate max-w-[120px]">{user.name}</p>
                  <p className="font-barlow text-[10px] text-gray-500 capitalize">{user.role}</p>
                </div>
                <ChevronDown size={13} className={`text-gray-500 transition-transform ${userDropOpen ? 'rotate-180' : ''}`} />
              </button>

              {/* Dropdown */}
              {userDropOpen && (
                <div className="absolute right-0 top-full mt-2 w-52 bg-gray-900 border border-white/10
                                rounded-xl shadow-2xl overflow-hidden z-50">
                  {/* User info */}
                  <div className="px-4 py-3 border-b border-white/10">
                    <p className="font-barlow font-semibold text-white text-[13px] truncate">{user.name}</p>
                    <p className="font-barlow text-[11px] text-gray-500 truncate">{user.email}</p>
                    <span className="inline-block mt-1 font-barlow text-[10px] font-bold uppercase tracking-widest
                                     bg-amber/20 text-amber px-2 py-0.5 rounded">{user.role}</span>
                  </div>
                  {/* Links */}
                  <div className="py-1">
                    <Link to="/app"
                      className="flex items-center gap-2.5 px-4 py-2.5 font-barlow text-[13px] text-gray-300
                                 hover:text-white hover:bg-white/5 transition-colors">
                      <LayoutDashboard size={14} className="text-amber" /> Dashboard
                    </Link>
                    <Link to="/app/structural"
                      className="flex items-center gap-2.5 px-4 py-2.5 font-barlow text-[13px] text-gray-300
                                 hover:text-white hover:bg-white/5 transition-colors">
                      <User size={14} className="text-amber" /> My Profile
                    </Link>
                  </div>
                  {/* Logout */}
                  <div className="border-t border-white/10 py-1">
                    <button onClick={doLogout}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 font-barlow text-[13px]
                                 text-red-400 hover:bg-red-400/5 transition-colors">
                      <LogOut size={14} /> Logout
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Logged-out: Login + Get Started */
            <>
              <Link to="/login"  className="nav-link">Login</Link>
              <Link to="/signup" className="btn-amber !py-2 !px-5 !text-[11px]">
                Get Started <ArrowRight size={12} />
              </Link>
            </>
          )}
        </div>

        {/* ── Mobile hamburger ── */}
        <button className="md:hidden text-white hover:text-amber transition-colors"
          onClick={() => setMenuOpen(v => !v)} aria-label="Menu">
          {menuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {/* ── Mobile drawer ── */}
      {menuOpen && (
        <div className="md:hidden absolute top-16 inset-x-0 py-4 px-6 flex flex-col gap-3
                        border-t border-white/10 shadow-2xl"
          style={{ backgroundColor: '#0E0E0E' }}>

          {navLinks.map(l => (
            <Link key={l.to} to={l.to}
              className={`nav-link py-2 text-sm flex items-center gap-2 ${
                location.pathname === l.to ? '!text-amber' : ''}`}>
              {l.label === 'Dashboard' && <LayoutDashboard size={13} />}
              {l.label}
            </Link>
          ))}

          <div className="border-t border-white/10 pt-3 flex flex-col gap-3">
            {user ? (
              <>
                {/* Mobile user info */}
                <div className="flex items-center gap-3 px-1 py-2">
                  <div className="w-9 h-9 rounded-full bg-amber flex items-center justify-center flex-shrink-0">
                    <span className="text-white text-sm font-bold">{user.name?.[0]?.toUpperCase()}</span>
                  </div>
                  <div>
                    <p className="font-barlow font-semibold text-white text-[13px]">{user.name}</p>
                    <p className="font-barlow text-[11px] text-gray-500">{user.email}</p>
                  </div>
                </div>
                <button onClick={doLogout}
                  className="flex items-center gap-2 font-barlow font-semibold uppercase tracking-widest
                             text-[12px] text-red-400 hover:text-red-300 py-2 transition-colors">
                  <LogOut size={14} /> Logout
                </button>
              </>
            ) : (
              <>
                <Link to="/login"  className="nav-link text-sm">Login</Link>
                <Link to="/signup" className="btn-amber justify-center text-[11px] py-2.5">
                  Get Started <ArrowRight size={12} />
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
