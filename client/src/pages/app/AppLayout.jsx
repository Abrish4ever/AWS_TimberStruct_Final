import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Bell, LayoutGrid, Package, Zap, Home,
  LogOut, Menu, X, ChevronRight, User
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const NAV = [
  { to: '/app',            icon: Home,        label: 'Dashboard'           },
  { to: '/app/structural', icon: LayoutGrid,  label: 'Structural Design'   },
  { to: '/app/procurement',icon: Package,     label: 'Procurement'         },
  { to: '/app/ai',         icon: Zap,         label: 'AI Assistant'        },
];

export default function AppLayout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileOpen,  setMobileOpen]  = useState(false);
  const { user, logout }              = useAuth();
  const location                      = useLocation();
  const navigate                      = useNavigate();

  const doLogout = () => { logout(); navigate('/'); };

  const SidebarContent = ({ mobile = false }) => (
    <div className={`flex flex-col h-full ${mobile ? 'w-64' : sidebarOpen ? 'w-60' : 'w-16'} transition-all duration-300`}
      style={{ backgroundColor: '#0E0E0E' }}>

      {/* Logo */}
      <div className="h-16 flex items-center px-4 border-b border-white/10 flex-shrink-0">
        <Link to="/" className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded bg-amber flex items-center justify-center flex-shrink-0">
            <Bell size={16} className="text-white" strokeWidth={2.3} />
          </div>
          {(sidebarOpen || mobile) && (
            <div className="leading-none min-w-0">
              <div className="font-condensed font-bold text-[14px] text-white  tracking-widest leading-tight">TIMBER</div>
              <div className="font-condensed font-bold text-[14px] text-amber tracking-widest leading-tight">STRUCT</div>
            </div>
          )}
        </Link>
      </div>

      {/* Nav links */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {NAV.map(item => {
          const active = location.pathname === item.to ||
            (item.to !== '/app' && location.pathname.startsWith(item.to));
          return (
            <Link key={item.to} to={item.to}
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-barlow font-medium
                          transition-all duration-150 group
                          ${active
                            ? 'bg-amber/10 text-amber border-l-2 border-amber pl-[10px]'
                            : 'text-gray-400 hover:text-white hover:bg-white/5'
                          }
                          ${!sidebarOpen && !mobile ? 'justify-center px-2' : ''}`}>
              <item.icon size={18} className="flex-shrink-0" />
              {(sidebarOpen || mobile) && (
                <>
                  <span className="flex-1 truncate">{item.label}</span>
                  {active && <ChevronRight size={14} className="text-amber opacity-60" />}
                </>
              )}
            </Link>
          );
        })}
      </nav>

      {/* User + logout */}
      <div className={`border-t border-white/10 p-3 flex-shrink-0 ${!sidebarOpen && !mobile ? 'flex flex-col items-center gap-2' : ''}`}>
        {(sidebarOpen || mobile) && user && (
          <div className="flex items-center gap-3 px-3 py-2 mb-2">
            <div className="w-8 h-8 rounded-full bg-amber/20 border border-amber/30 flex items-center justify-center flex-shrink-0">
              <span className="text-amber text-xs font-bold">{user.name?.[0]?.toUpperCase()}</span>
            </div>
            <div className="min-w-0">
              <p className="font-barlow text-[13px] text-white font-semibold truncate">{user.name}</p>
              <p className="font-barlow text-[11px] text-gray-500 capitalize">{user.role}</p>
            </div>
          </div>
        )}
        <button onClick={doLogout}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-barlow
                      text-gray-400 hover:text-red-400 hover:bg-red-400/5 transition-all
                      ${!sidebarOpen && !mobile ? 'justify-center' : ''}`}>
          <LogOut size={17} className="flex-shrink-0" />
          {(sidebarOpen || mobile) && <span>Logout</span>}
        </button>
      </div>

      {/* Collapse toggle (desktop only) */}
      {!mobile && (
        <button onClick={() => setSidebarOpen(v => !v)}
          className="border-t border-white/10 h-10 flex items-center justify-center
                     text-gray-600 hover:text-gray-300 transition-colors flex-shrink-0">
          {sidebarOpen ? <X size={15} /> : <Menu size={15} />}
        </button>
      )}
    </div>
  );

  return (
    <div className="flex h-screen bg-page overflow-hidden">

      {/* Desktop sidebar */}
      <div className="hidden md:flex h-full flex-shrink-0">
        <SidebarContent />
      </div>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setMobileOpen(false)} />
          <div className="absolute left-0 top-0 bottom-0 z-10">
            <SidebarContent mobile />
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Topbar */}
        <header className="h-16 bg-white border-b border-border flex items-center px-6 gap-4 flex-shrink-0">
          <button className="md:hidden text-gray-400 hover:text-heading transition-colors"
            onClick={() => setMobileOpen(true)}>
            <Menu size={22} />
          </button>
          <div className="flex-1" />
          {/* Back to site */}
          <Link to="/" className="font-barlow text-[12px] text-gray-400 hover:text-amber
                                   uppercase tracking-widest transition-colors hidden sm:block">
            ← Public Site
          </Link>
          {/* User badge */}
          {user && (
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-amber flex items-center justify-center">
                <span className="text-white text-xs font-bold">{user.name?.[0]?.toUpperCase()}</span>
              </div>
              <div className="hidden sm:block">
                <p className="font-barlow text-[13px] text-heading font-semibold leading-none">{user.name}</p>
                <p className="font-barlow text-[11px] text-gray-400 capitalize">{user.role}</p>
              </div>
            </div>
          )}
        </header>

        {/* Page */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
