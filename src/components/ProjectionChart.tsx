import { Line } from 'react-chartjs-2';
import {
  Chart, LineElement, PointElement, LinearScale, CategoryScale,
  Tooltip, Legend, Filler, LineController,
} from 'chart.js';
import { CANDIDATES, CAND_ORDER } from '../data/candidates';
import type { SeriesPoint, CandKey } from '../types';

Chart.register(LineElement, PointElement, LinearScale, CategoryScale, Tooltip, Legend, Filler, LineController);

interface Props {
  series: SeriesPoint[];
  projection: Record<CandKey, number>;
  currentPct: number;
}

export function ProjectionChart({ series, projection, currentPct }: Props) {
  const labels = series.map(s => `${s.pct}%`).concat(['100%']);

  const datasets = CAND_ORDER.map(k => {
    const c = CANDIDATES[k];
    const solid = series.map(s => s[k]);
    const lastVal = solid[solid.length - 1];
    const projected = Array(series.length).fill(null) as (number | null)[];
    projected.push(projection[k]);
    // connect last real point to projection with dashed line
    const combined: (number | null)[] = [...solid, projection[k]];
    return [
      {
        label: c.name,
        data: solid.concat([null as unknown as number]),
        borderColor: c.color,
        backgroundColor: c.color + '33',
        tension: 0.35,
        pointRadius: 0,
        borderWidth: 2,
      },
      {
        label: `${c.name} (proy.)`,
        data: [...Array(series.length - 1).fill(null), lastVal, projection[k]],
        borderColor: c.color,
        borderDash: [4, 4],
        pointRadius: [0, 0, 4].concat([]) as any,
        pointBackgroundColor: c.color,
        borderWidth: 1.5,
      },
    ];
    void combined; void projected;
  }).flat();

  const data = { labels, datasets };
  const options: any = {
    maintainAspectRatio: false,
    responsive: true,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: 'rgba(24,27,36,.95)',
        borderColor: 'rgba(255,255,255,.08)',
        borderWidth: 1,
        titleColor: '#e8eaed',
        bodyColor: '#9aa0ab',
        bodyFont: { family: 'JetBrains Mono' },
      },
    },
    scales: {
      x: {
        title: { display: true, text: '% de ONPE', color: '#5f6673', font: { size: 10 } },
        ticks: { color: '#5f6673', font: { family: 'JetBrains Mono', size: 10 } },
        grid: { color: 'rgba(255,255,255,.04)' },
      },
      y: {
        min: 6, max: 20,
        ticks: { color: '#5f6673', font: { family: 'JetBrains Mono', size: 10 }, callback: (v:any) => v + '%' },
        grid: { color: 'rgba(255,255,255,.04)' },
      },
    },
  };

  return (
    <>
      <div className="chart-container">
        <Line data={data} options={options} />
      </div>
      <div className="proj-summary">
        <span className="lead">ONPE al {currentPct.toFixed(2)}% actas:</span>{' '}
        {CAND_ORDER.map(k => (
          <span key={k} style={{ color: CANDIDATES[k].color, marginRight: 10 }}>
            ● {CANDIDATES[k].name} {projection[k].toFixed(2)}%
          </span>
        ))}
      </div>
    </>
  );
}
