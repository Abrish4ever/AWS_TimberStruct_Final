import { Link } from 'react-router-dom';
import { Bell, MapPin, Mail, Phone } from 'lucide-react';

export default function Footer() {
  return (
    <footer style={{ backgroundColor: '#0E0E0E' }} className="text-white">
      <div className="max-w-7xl mx-auto px-6 py-16 grid grid-cols-1 md:grid-cols-3 gap-12">
        <div>
          <Link to="/" className="flex items-center gap-2.5 mb-5">
            <div className="w-9 h-9 rounded-md bg-amber flex items-center justify-center">
              <Bell size={17} className="text-white" strokeWidth={2.3} />
            </div>
            <div className="leading-none">
              <div className="font-condensed font-bold text-[15px] text-white  tracking-widest leading-tight">TIMBER</div>
              <div className="font-condensed font-bold text-[15px] text-amber tracking-widest leading-tight">STRUCT</div>
            </div>
          </Link>
          <p className="text-gray-400 text-sm leading-relaxed max-w-xs">
            East Africa's most advanced timber structural design and procurement platform. Built on AWS.
          </p>
        </div>
        <div>
          <h4 className="font-condensed font-bold uppercase tracking-widest text-sm text-white mb-5">Navigation</h4>
          <ul className="space-y-2.5">
            {[['Home','/'],['About','/about'],['Services','/services'],['Contact','/contact']].map(([l,h])=>(
              <li key={l}><Link to={h} className="text-gray-400 hover:text-amber text-sm transition-colors">{l}</Link></li>
            ))}
          </ul>
        </div>
        <div>
          <h4 className="font-condensed font-bold uppercase tracking-widest text-sm text-white mb-5">Contact</h4>
          <ul className="space-y-3">
            {[[MapPin,'Nairobi, Kenya'],[Mail,'info@timberstruct.co.ke'],[Phone,'+254 800 TIMBER']].map(([Icon,t])=>(
              <li key={t} className="flex items-start gap-3 text-gray-400 text-sm">
                <Icon size={14} className="text-amber mt-0.5 flex-shrink-0"/>{t}
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10 py-5 px-6 flex flex-col md:flex-row items-center justify-between gap-2 max-w-7xl mx-auto">
        <p className="text-gray-600 text-xs">© 2025 TimberStruct. All rights reserved.</p>
        <p className="text-gray-600 text-xs">Built on AWS · East Africa</p>
      </div>
    </footer>
  );
}
