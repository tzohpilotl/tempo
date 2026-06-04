import type { TrackingTimeSummary } from '../types';
import { useTheme } from '../context/theme';
import styles from './PieChart.module.css';

const SIZE = 260;
const CX = SIZE / 2;
const CY = SIZE / 2;
const OUTER = 106;
const INNER = 64;
const START = -Math.PI / 2; // 12 o'clock

const DEFAULT_COLORS = [
  '#f0a500',
  '#3b82f6',
  '#10b981',
  '#f43f5e',
  '#8b5cf6',
  '#f59e0b',
  '#06b6d4',
  '#84cc16',
];

const TUI_COLORS = [
  '#1c180e',
  '#4c4840',
  '#6a6660',
  '#908c86',
  '#b4b0aa',
  '#2e2a22',
  '#3e3a32',
  '#7a7670',
];

function sector(startA: number, endA: number): string {
  // Clamp to avoid degenerate full-circle arc (start === end after wrap)
  const a2 = Math.min(endA, startA + 2 * Math.PI - 0.0001);
  const large = a2 - startA > Math.PI ? 1 : 0;
  const ox1 = CX + OUTER * Math.cos(startA);
  const oy1 = CY + OUTER * Math.sin(startA);
  const ox2 = CX + OUTER * Math.cos(a2);
  const oy2 = CY + OUTER * Math.sin(a2);
  const ix1 = CX + INNER * Math.cos(startA);
  const iy1 = CY + INNER * Math.sin(startA);
  const ix2 = CX + INNER * Math.cos(a2);
  const iy2 = CY + INNER * Math.sin(a2);
  return [
    `M ${ix1} ${iy1}`,
    `L ${ox1} ${oy1}`,
    `A ${OUTER} ${OUTER} 0 ${large} 1 ${ox2} ${oy2}`,
    `L ${ix2} ${iy2}`,
    `A ${INNER} ${INNER} 0 ${large} 0 ${ix1} ${iy1}`,
    'Z',
  ].join(' ');
}

function fmtDuration(s: number): string {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m`;
  return `${s}s`;
}

interface Props {
  summary: TrackingTimeSummary;
}

export default function PieChart({ summary }: Props) {
  const { theme } = useTheme();
  const palette = theme === 'tui' ? TUI_COLORS : DEFAULT_COLORS;
  const { breakdown, total_seconds } = summary;

  const isEmpty = total_seconds === 0;

  let cursor = START;
  const segments = breakdown.map((item, i) => {
    const ratio = total_seconds > 0 ? item.total_seconds / total_seconds : 0;
    const startA = cursor;
    const endA = cursor + ratio * 2 * Math.PI;
    cursor = endA;
    return {
      path: sector(startA, endA),
      color: palette[i % palette.length],
      label: item.name ?? 'No project',
      seconds: item.total_seconds,
      pct: Math.round(ratio * 100),
    };
  });

  return (
    <div className={styles.root}>
      <div className={styles.chartWrap}>
        <svg
          width={SIZE}
          height={SIZE}
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          className={styles.svg}
        >
          {isEmpty ? (
            <>
              <circle cx={CX} cy={CY} r={OUTER} fill="var(--border-soft)" />
              <circle cx={CX} cy={CY} r={INNER} fill="var(--bg)" />
            </>
          ) : (
            segments.map((seg, i) => (
              <path
                key={i}
                d={seg.path}
                fill={seg.color}
                style={{ stroke: 'var(--bg)', strokeWidth: 2 }}
                className={styles.segment}
              />
            ))
          )}

          {/* Centre label */}
          <text
            x={CX}
            y={CY - 10}
            textAnchor="middle"
            className={styles.centerValue}
          >
            {isEmpty ? '—' : fmtDuration(total_seconds)}
          </text>
          <text
            x={CX}
            y={CY + 12}
            textAnchor="middle"
            className={styles.centerLabel}
          >
            {isEmpty ? 'no data' : 'total'}
          </text>
        </svg>
      </div>

      {!isEmpty && (
        <ul className={styles.legend}>
          {segments.map((seg, i) => (
            <li key={i} className={styles.legendItem}>
              <span className={styles.dot} style={{ background: seg.color }} />
              <span className={styles.legendName}>{seg.label}</span>
              <span className={styles.legendDuration}>{fmtDuration(seg.seconds)}</span>
              <span className={styles.legendPct}>{seg.pct}%</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
