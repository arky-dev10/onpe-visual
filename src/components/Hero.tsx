import { IconRefresh } from './Icons';
import { ThemeToggle, type Theme } from './ThemeToggle';

interface Props {
  pctActas: number;
  onRefresh: () => void;
  loading?: boolean;
  theme: Theme;
  onThemeChange: (t: Theme) => void;
}

export function Hero({ pctActas, onRefresh, loading, theme, onThemeChange }: Props) {
  const [intPart, decPart] = pctActas.toFixed(3).split('.');
  return (
    <header className="hero">
      <div className="hero-left">
        <div className="hero-title">Perú Elige 2026</div>
        <div className="hero-sub">Elecciones Generales · Primera Vuelta</div>
      </div>

      <div className="hero-center">
        <div className="hero-label">ONPE · Actas contabilizadas</div>
        <div className="hero-pct" key={pctActas}>
          <span className="num-flash">{intPart}</span>
          <span className="hero-pct-sign">.{decPart}%</span>
        </div>
        <div style={{ fontSize: 11, color: 'var(--tx3)', marginTop: 4 }}>
          <span className="live-dot" /> &nbsp; 15 Abr 02:24 a. m. · 25 regiones · En vivo
        </div>
      </div>

      <div className="hero-right">
        <ThemeToggle theme={theme} onChange={onThemeChange} />
        <button className={`refresh-btn ${loading ? 'loading' : ''}`} onClick={onRefresh}>
          <IconRefresh /> Actualizar
        </button>
      </div>
    </header>
  );
}
