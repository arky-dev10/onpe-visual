import type { CandConfig, CandKey } from '../types';

export const CANDIDATES: Record<CandKey, CandConfig> = {
  fujimori: { key: 'fujimori', name: 'Fujimori',     short: 'FUJIMORI',     color: '#E8943A', bg: 'rgba(232,148,58,0.15)', photo: '/candidates/fujimori.jpg', initials: 'KF'  },
  rla:      { key: 'rla',      name: 'López Aliaga', short: 'LÓPEZ ALIAGA', color: '#4A90D9', bg: 'rgba(74,144,217,0.15)', photo: '/candidates/rla.jpg',      initials: 'RLA' },
  nieto:    { key: 'nieto',    name: 'Nieto',        short: 'NIETO',        color: '#2ECDA7', bg: 'rgba(46,205,167,0.15)', photo: '/candidates/nieto.jpg',    initials: 'JN'  },
  belmont:  { key: 'belmont',  name: 'Belmont',      short: 'BELMONT',      color: '#B07CD8', bg: 'rgba(176,124,216,0.15)', photo: '/candidates/belmont.jpg',  initials: 'RB'  },
  sanchez:  { key: 'sanchez',  name: 'Sánchez',      short: 'SÁNCHEZ',      color: '#E04848', bg: 'rgba(224,72,72,0.15)', photo: '/candidates/sanchez.jpg',  initials: 'RS'  },
};

export const CAND_ORDER: CandKey[] = ['fujimori','rla','sanchez','nieto','belmont'];

export function getWinner(r: {fujimori:number;rla:number;nieto:number;belmont:number;sanchez:number}): CandKey {
  let best: CandKey = 'fujimori';
  let max = -Infinity;
  for (const k of CAND_ORDER) {
    const v = r[k] ?? 0;
    if (v > max) { max = v; best = k; }
  }
  return best;
}
