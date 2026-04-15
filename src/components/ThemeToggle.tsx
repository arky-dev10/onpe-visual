import { useEffect, useState } from 'react';

export type Theme = 'dark' | 'pe';

function applyTheme(t: Theme) {
  document.body.classList.toggle('theme-pe', t === 'pe');
}

export function useTheme(): [Theme, (t: Theme) => void] {
  const [t, setT] = useState<Theme>(() => (localStorage.getItem('theme') as Theme) || 'dark');
  useEffect(() => { applyTheme(t); localStorage.setItem('theme', t); }, [t]);
  return [t, setT];
}

export function ThemeToggle({ theme, onChange }: { theme: Theme; onChange: (t: Theme) => void }) {
  return (
    <div className="theme-toggle" role="tablist" aria-label="Tema">
      <button
        className={theme === 'dark' ? 'active' : ''}
        onClick={() => onChange('dark')}
        aria-selected={theme === 'dark'}
      >
        Oscuro
      </button>
      <button
        className={theme === 'pe' ? 'active pe' : 'pe'}
        onClick={() => onChange('pe')}
        aria-selected={theme === 'pe'}
        title="Tema Perú"
      >
        <span className="pe-flag" /> Perú
      </button>
    </div>
  );
}
