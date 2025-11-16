import React, { useState, useEffect, useMemo } from 'react';
import { getPricesMatrix } from '../actions';

const TIMEFRAMES = [
  { label: '1D', value: '1d' },
  { label: '30D', value: '30d' },
  { label: 'YTD', value: 'ytd' },
  { label: '1Y', value: '1y' },
  { label: 'ALL', value: 'all' }
];

function getTimeframeDates(timeframe) {
  const end = new Date();
  let start = new Date();
  if (timeframe === '1d') start.setDate(end.getDate() - 1);
  else if (timeframe === '30d') start.setDate(end.getDate() - 30);
  else if (timeframe === 'ytd') start = new Date(end.getFullYear(), 0, 1);
  else if (timeframe === '1y') start.setDate(end.getDate() - 365);
  else start = new Date('2000-01-01');
  return [start.toISOString().slice(0, 10), end.toISOString().slice(0, 10)];
}

function calculateDailyReturns(series) {
  return series.slice(1).map((d, i) => {
    const prev = series[i].close_price;
    const curr = d.close_price;
    return (curr - prev) / prev;
  });
}
function sharpe(returns) {
  const avg = returns.reduce((a, b) => a + b, 0) / returns.length;
  const std = Math.sqrt(returns.reduce((s, r) => s + (r - avg) ** 2, 0) / (returns.length - 1));
  return std === 0 ? 0 : avg / std;
}
function maxDrawdown(series) {
  let max = -Infinity;
  let maxDD = 0;
  for (let d of series) {
    if (d.close_price > max) max = d.close_price;
    const dd = (d.close_price - max) / max;
    if (dd < maxDD) maxDD = dd;
  }
  return Math.abs(maxDD);
}
function calcBeta(assetReturns, benchReturns) {
  const meanAsset = assetReturns.reduce((a, b) => a + b, 0) / assetReturns.length;
  const meanBench = benchReturns.reduce((a, b) => a + b, 0) / benchReturns.length;
  let cov = 0, varBench = 0;
  for (let i = 0; i < assetReturns.length; i++) {
    cov += (assetReturns[i] - meanAsset) * (benchReturns[i] - meanBench);
    varBench += (benchReturns[i] - meanBench) ** 2;
  }
  cov /= assetReturns.length;
  varBench /= assetReturns.length;
  return varBench === 0 ? 0 : cov / varBench;
}

export default function RiskDashboard({ tokens }) {
  const [timeframe, setTimeframe] = useState('30d');
  const [matrix, setMatrix] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch data when tokens or timeframe changes
  useEffect(() => {
    async function fetchData() {
      if (tokens.length === 0) {
        setMatrix([]);
        setLoading(false);
        return;
      }

      const [start, end] = getTimeframeDates(timeframe);
      const assetIds = tokens.map(t => t.id).concat('bitcoin');

      setLoading(true);
      setError(null);

      try {
        const data = await getPricesMatrix(assetIds, start, end);
        setMatrix(data);
      } catch (err) {
        setError(err);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [tokens, timeframe]);

  // JS metrics computation (now in useMemo for perf)
  const { metrics, portfolioMetrics } = useMemo(() => {
    if (!matrix || !tokens.length) return { metrics: [], portfolioMetrics: {} };
    const seriesByAsset = {};
    for (let rec of matrix) {
      if (!seriesByAsset[rec.asset_id]) seriesByAsset[rec.asset_id] = [];
      seriesByAsset[rec.asset_id].push(rec);
    }
    // Assume dates align for portfolio series
    let portfolioSeries = [];
    const dates = seriesByAsset[tokens[0].id]?.map(d => d.date) || [];
    for (let i = 0; i < dates.length; i++) {
      let total = 0;
      for (let t of tokens) {
        total += (seriesByAsset[t.id]?.[i]?.close_price || 0) * t.amount;
      }
      portfolioSeries.push({ date: dates[i], close_price: total });
    }
    const portReturns = calculateDailyReturns(portfolioSeries);    
    // Asset metrics
    const assetMetrics = tokens.map(t => {
      const ser = seriesByAsset[t.id] || [];
      const rets = calculateDailyReturns(ser);
      return {
        id: t.id,
        symbol: t.symbol,
        sharpe: rets.length > 0 ? sharpe(rets) : '-',
        maxDrawdown: ser.length > 0 ? maxDrawdown(ser) : '-',
        beta: ser.length > 0 && seriesByAsset['bitcoin'] ? calcBeta(rets, calculateDailyReturns(seriesByAsset['bitcoin'])) : '-'
      };
    });
    // Portfolio risk
    return {
      metrics: assetMetrics,
      portfolioMetrics: {
        sharpe: portReturns.length > 0 ? sharpe(portReturns) : '-',
        maxDrawdown: portfolioSeries.length > 0 ? maxDrawdown(portfolioSeries) : '-',
        beta: portReturns.length > 0 && seriesByAsset['bitcoin'] ? calcBeta(portReturns, calculateDailyReturns(seriesByAsset['bitcoin'])) : '-'
      }
    };
  }, [matrix, tokens]);

  if (loading) return <div>Loading…</div>;
  if (error) return <div>Error loading risk data: {String(error)}</div>;

  return (
    <div style={{ padding: 16 }}>
      <h2>Risk Dashboard</h2>
      <div style={{ marginBottom: 16 }}>
        Timeframe:
        {TIMEFRAMES.map(tf => (
          <button
            key={tf.value}
            className={tf.value === timeframe ? 'active' : ''}
            onClick={() => setTimeframe(tf.value)}
            style={{ margin: 4 }}
          >{tf.label}</button>
        ))}
      </div>
      <h3>Portfolio Risk Metrics</h3>
      <table style={{ marginBottom: 30 }}>
        <thead>
          <tr>
            <th>Sharpe</th>
            <th>Beta (vs BTC)</th>
            <th>Max Drawdown</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>{portfolioMetrics.sharpe}</td>
            <td>{portfolioMetrics.beta}</td>
            <td>{portfolioMetrics.maxDrawdown}</td>
          </tr>
        </tbody>
      </table>
      <h3>Asset Risk Breakdown</h3>
      <table>
        <thead>
          <tr>
            <th>Asset</th>
            <th>Sharpe</th>
            <th>Beta (vs BTC)</th>
            <th>Max Drawdown</th>
          </tr>
        </thead>
        <tbody>
        {metrics.map(m => (
          <tr key={m.id}>
            <td>{m.symbol}</td>
            <td>{m.sharpe}</td>
            <td>{m.beta}</td>
            <td>{m.maxDrawdown}</td>
          </tr>
        ))}
        </tbody>
      </table>
    </div>
  );
}
