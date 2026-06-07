import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

export default function ServiceCard({ label, title, description, Icon, href = '/signup', features = [] }) {
  return (
    <div className="group bg-white border border-border rounded-xl p-8 flex flex-col
                    hover:shadow-xl hover:-translate-y-1 transition-all duration-200">
      {/* Top: label + icon */}
      <div className="flex items-start justify-between mb-3">
        <span className="font-barlow font-semibold uppercase tracking-[0.12em] text-[11px] text-gray-400">
          {label}
        </span>
        {Icon && (
          <Icon size={28} strokeWidth={1.4}
            className="text-gray-300 group-hover:text-amber transition-colors duration-200 flex-shrink-0 ml-3" />
        )}
      </div>
      {/* Title */}
      <h3 className="font-barlow font-bold text-[22px] text-heading leading-snug mt-1">{title}</h3>
      {/* Amber divider — grows on hover */}
      <div className="h-[2.5px] bg-amber mt-3 mb-4 transition-all duration-300" style={{ width: '32px' }}
        onMouseEnter={e => e.currentTarget.style.width='52px'}
        onMouseLeave={e => e.currentTarget.style.width='32px'} />
      {/* Description */}
      <p className="font-barlow text-[15px] text-body leading-[1.65] flex-1">{description}</p>
      {/* Features */}
      {features.length > 0 && (
        <ul className="mt-5 space-y-2">
          {features.map(f => (
            <li key={f} className="flex items-center gap-2 text-[13px] text-body">
              <span className="w-1.5 h-1.5 rounded-full bg-amber flex-shrink-0" />{f}
            </li>
          ))}
        </ul>
      )}
      {/* CTA */}
      <Link to={href}
        className="inline-flex items-center gap-1.5 mt-6 font-barlow font-semibold
                   uppercase tracking-[0.1em] text-[12px] text-amber hover:text-amber-dark transition-colors">
        Access Tool <ArrowRight size={13} />
      </Link>
    </div>
  );
}
