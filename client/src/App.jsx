import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import HomePage      from './pages/HomePage';
import ServicesPage  from './pages/ServicesPage';
import { LoginPage, SignupPage }  from './pages/AuthPages';
import { AboutPage, ContactPage } from './pages/OtherPages';
import DashboardPage   from './pages/app/DashboardPage';
import StructuralPage  from './pages/app/StructuralPage';
import ProcurementPage from './pages/app/ProcurementPage';
import AIAssistantPage from './pages/app/AIAssistantPage';

// Waits for token verification before redirecting — prevents flash
function Protected({ children }) {
  const { user, verified } = useAuth();

  // Still checking token validity — show nothing (avoids redirect flash)
  if (!verified) return (
    <div className="min-h-screen flex items-center justify-center bg-page">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 rounded-md bg-amber flex items-center justify-center animate-pulse">
          <span className="text-white font-bold text-lg">T</span>
        </div>
        <p className="font-barlow text-[13px] text-gray-400">Loading…</p>
      </div>
    </div>
  );

  // Token verified — user is not logged in, send to login
  if (!user) return <Navigate to="/login" replace />;

  return children;
}

// Redirect logged-in users away from auth pages
function GuestOnly({ children }) {
  const { user, verified } = useAuth();
  if (!verified) return null;
  if (user) return <Navigate to="/app" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      {/* ── Public pages (always accessible) ── */}
      <Route path="/"         element={<HomePage />}    />
      <Route path="/about"    element={<AboutPage />}   />
      <Route path="/services" element={<ServicesPage />}/>
      <Route path="/contact"  element={<ContactPage />} />

      {/* ── Auth pages (redirect to /app if already logged in) ── */}
      <Route path="/login"  element={<GuestOnly><LoginPage /></GuestOnly>}   />
      <Route path="/signup" element={<GuestOnly><SignupPage /></GuestOnly>}  />

      {/* ── Protected app pages ── */}
      <Route path="/app"             element={<Protected><DashboardPage /></Protected>}    />
      <Route path="/app/structural"  element={<Protected><StructuralPage /></Protected>}   />
      <Route path="/app/procurement" element={<Protected><ProcurementPage /></Protected>}  />
      <Route path="/app/ai"          element={<Protected><AIAssistantPage /></Protected>}  />

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
