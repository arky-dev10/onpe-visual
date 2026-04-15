const NAV: { label: string; href: string }[] = [
  { label: 'PRESIDENCIAL', href: '#' },
  { label: 'SENADO',       href: '#senado' },
  { label: 'NOSOTROS',     href: '#' },
  { label: 'CONSULTORÍA',  href: '#' },
  { label: 'PUBLICACIONES',href: '#' },
];

export function HeaderGoberna() {
  return (
    <header className="gob-header">
      <div className="gob-header-inner">
        <a className="gob-brand" href="#" aria-label="Goberna Consultora Política">
          <img src="/goberna-isotipo.jpg" alt="" className="gob-logo" />
          <span className="gob-brand-text">
            <strong>GOBERNA</strong>
            <small>Consultora Política</small>
          </span>
        </a>

        <nav className="gob-nav">
          {NAV.map((n) => (
            <a key={n.label} className="gob-nav-link" href={n.href}>{n.label}</a>
          ))}
        </nav>

        <div className="gob-tools" aria-hidden="true">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
        </div>
      </div>
      <div className="gob-rule" />
    </header>
  );
}
