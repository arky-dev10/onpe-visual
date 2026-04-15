import { useEffect, useMemo, useState } from 'react';
import './styles/dashboard.css';
import { Hero } from './components/Hero';
import { StatusBar } from './components/StatusBar';
import { Tabs, type TabId } from './components/Tabs';
import { CandidateStrip } from './components/CandidateStrip';
import { ProbabilityBar } from './components/ProbabilityBar';
import { MapDept } from './components/MapDept';
import { ProjectionChart } from './components/ProjectionChart';
import { RegionModal } from './components/RegionModal';
import { SecondRoundBanner } from './components/SecondRoundBanner';
import { CriticalGap } from './components/CriticalGap';
import { HeaderGoberna } from './components/HeaderGoberna';
import { SenadoPage } from './components/SenadoPage';
import { MOCK_ONPE, MOCK_DATUM } from './data/mock';
import { loadData } from './data/source';
import { useTheme } from './components/ThemeToggle';
import type { DashboardData } from './types';
import { CAND_ORDER } from './data/candidates';
import type { RegionResult, CandKey } from './types';

const PARTY_MAP: Record<CandKey, { party: string; initials: string }> = {
  fujimori: { party: 'Fuerza Popular',      initials: 'KF'  },
  rla:      { party: 'Renovación Popular',  initials: 'RLA' },
  sanchez:  { party: 'Juntos por el Perú',  initials: 'RS'  },
  nieto:    { party: 'Partido del Buen Gobierno', initials: 'JN' },
  belmont:  { party: 'País para Todos',     initials: 'RB'  },
};

type View = 'presidencial' | 'senado';

function App() {
  const [theme, setTheme] = useTheme();
  const [tab, setTab] = useState<TabId>('onpe');
  const [view, setView] = useState<View>(() => (window.location.hash === '#senado' ? 'senado' : 'presidencial'));

  useEffect(() => {
    const onHash = () => setView(window.location.hash === '#senado' ? 'senado' : 'presidencial');
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<RegionResult | null>(null);
  const [onpeData, setOnpeData] = useState<DashboardData>(MOCK_ONPE);
  const [datumData, setDatumData] = useState<DashboardData>(MOCK_DATUM);

  // Fetch inicial + refresh cada 60s
  useEffect(() => {
    let alive = true;
    async function fetchAll() {
      const [o, d] = await Promise.all([loadData('onpe'), loadData('datum')]);
      if (!alive) return;
      setOnpeData(o); setDatumData(d);
    }
    fetchAll();
    const id = setInterval(fetchAll, 60_000);
    return () => { alive = false; clearInterval(id); };
  }, []);

  const data = tab === 'onpe' ? onpeData : datumData;

  // Valores nacionales reales del ONPE (vienen en data.projection desde el scraper)
  const current = useMemo(() => {
    return { ...data.projection } as Record<CandKey, number>;
  }, [data]);

  const deltas: Partial<Record<CandKey, number>> = { fujimori: 0.048, sanchez: 0.185, rla: -0.021, nieto: -0.012, belmont: -0.015 };

  // Ranking dinámico — así cuando cambia el mock/fetch, el banner se actualiza solo
  const ranking = [...CAND_ORDER].sort((a, b) => (current[b] ?? 0) - (current[a] ?? 0));
  const [first, second, third] = ranking;
  const small: Partial<Record<CandKey, string>> = {
    fujimori: '2.5M votos', rla: '1.9M votos', nieto: '1.7M votos',
    belmont: '1.5M votos', sanchez: '1.6M votos',
  };

  const refresh = async () => {
    setLoading(true);
    const [o, d] = await Promise.all([loadData('onpe'), loadData('datum')]);
    setOnpeData(o); setDatumData(d);
    setTimeout(() => setLoading(false), 400);
  };

  const sourceLabel = tab === 'onpe' ? 'ONPE parcial' : 'Datum CR 100%';

  if (view === 'senado') {
    return (
      <>
        <HeaderGoberna />
        <SenadoPage />
      </>
    );
  }

  return (
    <>
      <HeaderGoberna />
      <div className="container">
      <Hero pctActas={data.pctActas} onRefresh={refresh} loading={loading} theme={theme} onThemeChange={setTheme} />
      <StatusBar d={data} />

      <SecondRoundBanner
        aKey={first} bKey={second}
        aPct={current[first]} bPct={current[second]}
        aParty={PARTY_MAP[first].party}   bParty={PARTY_MAP[second].party}
      />

      <CriticalGap
        secondName={second}
        thirdName={third}
        secondPct={current[second]}
        thirdPct={current[third]}
        secondVotes={data.votes?.[second]}
        thirdVotes={data.votes?.[third]}
        votosRestantes={data.votosFaltantes}
      />

      <Tabs active={tab} onChange={setTab} />

      <CandidateStrip values={current} deltas={deltas} small={small} />
      <ProbabilityBar probs={data.probabilities} />

      <div className="grid-2">
        <div className="card">
          <div className="card-title">Mapa — Ganador por departamento ({sourceLabel})</div>
          <div className="card-sub">Contabilizados: {data.votosEmitidos.toLocaleString('es-PE')} · −{data.votosFaltantes.toLocaleString('es-PE')}</div>
          <MapDept key={tab} regions={data.regions} source={sourceLabel} onSelect={setSelected} />
        </div>
        <div className="card">
          <div className="card-title">Evolución del conteo + Proyección al 100%</div>
          <div className="card-sub">Últimos cortes ONPE · línea punteada = proyección</div>
          <ProjectionChart series={data.series} projection={data.projection} currentPct={data.pctActas} />
        </div>
      </div>

      <RegionModal region={selected} source={sourceLabel} onClose={() => setSelected(null)} />
      </div>
    </>
  );
}

export default App;
