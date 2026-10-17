import { Route } from 'lucide-react';

export function Logo() {
  return (
    <div className="brand" aria-label="DegreeGPS">
      <span className="brand-mark"><Route size={18} strokeWidth={2.8} /></span>
      <span>DegreeGPS</span>
    </div>
  );
}
