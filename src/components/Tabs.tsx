import { IconCheck, IconChart } from './Icons';

export type TabId = 'onpe' | 'datum';
interface Props { active: TabId; onChange: (t: TabId) => void; }

export function Tabs({ active, onChange }: Props) {
  return (
    <div className="tabs">
      <button className={`tab ${active==='onpe'?'active':''}`} onClick={() => onChange('onpe')}>
        <IconCheck /> ONPE en Vivo
      </button>
      <button className={`tab ${active==='datum'?'active':''}`} onClick={() => onChange('datum')}>
        <IconChart /> Datum CR 100%
      </button>
    </div>
  );
}
