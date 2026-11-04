import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { tracking as trackingApi } from '../api/client';
import PieChart from '../components/PieChart';
import type { TrackingTimeSummary } from '../types';
import { logError } from '../utils/logger';
import { getDayRange, getWeekRange, getMonthRange } from '../utils/dateRange';
import { isTrackingPeriod, trackingPeriodLabel } from '../utils/trackingPeriods';
import styles from './SummaryPage.module.css';

const EMPTY_SUMMARY: TrackingTimeSummary = { breakdown: [], total_seconds: 0 };

export default function SummaryPage() {
  const { period } = useParams<{ period: string }>();
  const navigate = useNavigate();
  const [summary, setSummary] = useState<TrackingTimeSummary>(EMPTY_SUMMARY);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isTrackingPeriod(period)) return;
    trackingApi
      .summary({ day: getDayRange(), week: getWeekRange(), month: getMonthRange() })
      .then((summaries) => setSummary(summaries[period]))
      .catch(logError)
      .finally(() => setLoading(false));
  }, [period]);

  if (!isTrackingPeriod(period)) {
    return (
      <div className={styles.page}>
        <p className={styles.notFound}>Unknown time window.</p>
        <button className="btn btn-secondary" onClick={() => navigate('/sessions')}>
          ← Back to sessions
        </button>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <button className="btn-icon" onClick={() => navigate('/sessions')} aria-label="Back to sessions" title="Back to sessions">
          <BackIcon />
        </button>
        <h1 className={styles.title}>{trackingPeriodLabel(period)} — full breakdown</h1>
      </header>

      {loading ? (
        <div className={styles.placeholder} />
      ) : (
        <div className={styles.chartWrap}>
          <PieChart summary={summary} />
        </div>
      )}
    </div>
  );
}

function BackIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="19" y1="12" x2="5" y2="12" />
      <polyline points="12 19 5 12 12 5" />
    </svg>
  );
}
