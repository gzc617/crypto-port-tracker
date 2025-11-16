import React, { useState, useEffect, useMemo } from 'react';
import {
  getAssetPricesDailyBySearch,
  getUniverseBenchmarkBySearch
} from '../actions';
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, AreaChart, Area } from 'recharts';

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

export default function PerformanceDashboard({ tokens }) {
  const [timeframe, setTimeframe] = useState('30d');
  const [prices, setPrices] = useState([]);
  const [benchmark, setBenchmark] = useState([]);
  const [pricesLoading, setPricesLoading] = useState(true);
  const [bmLoading, setBmLoading] = useState(true);
  const [pricesError, setPricesError] = useState(null);
  const [bmError, setBmError] = useState(null);

  // Fetch data when tokens or timeframe changes
  useEffect(() => {
    async function fetchData() {
      if (tokens.length === 0) {
        setPrices([]);
        setBenchmark([]);
        setPricesLoading(false);
        setBmLoading(false);
        return;
      }

      // Asset IDs for portfolio, always include bitcoin for comparison
      const assetIds = tokens.map(t => t.id);
      const allIds = [...new Set([...assetIds, 'bitcoin'])];
      const [start, end] = getTimeframeDates(timeframe);

      setPricesLoading(true);
      setBmLoading(true);
      setPricesError(null);
      setBmError(null);

      try {
        console.log('allIds', allIds);
        console.log('assetIds', assetIds);
        const [pricesData, benchmarkData] = await Promise.all([
          getAssetPricesDailyBySearch(allIds, start, end),
          getUniverseBenchmarkBySearch(assetIds, start, end)
        ]);
        setPrices(pricesData);
        setBenchmark(benchmarkData);
      } catch (error) {
        setPricesError(error);
        setBmError(error);
      } finally {
        setPricesLoading(false);
        setBmLoading(false);
      }
    }

    fetchData();
  }, [tokens, timeframe]);

  // --- COMPUTE CHART SERIES ---
  const { portfolioSeries, btcSeries, benchmarkSeries, weightSeries } = useMemo(() => {
    if (!prices || !tokens || tokens.length === 0) return { portfolioSeries: [], btcSeries: [], benchmarkSeries: [], weightSeries: [] };
    // Gather all unique dates from prices
    const dates = Array.from(new Set(prices.map(p => p.date))).sort();
    const assetPriceByDate = (aid) => Object.fromEntries(prices.filter(p => p.asset_id === aid).map(p => [p.date, p.close_price]));
    // Portfolio value by date
    const portfolioSeries = dates.map(date => {
      let portfolioVal = 0;
      for (let t of tokens) {
        const price = assetPriceByDate(t.id)[date];
        if (price) portfolioVal += price * (t.amount || 0);
      }
      const btc = assetPriceByDate('bitcoin')[date];
      return { date, portfolio: portfolioVal, btc };
    });
    // Benchmark (universe market cap) by date
    let bmMap = {};
    if (benchmark && Array.isArray(benchmark)) {
      for (const row of benchmark) bmMap[row.date] = Number(row.universe_market_cap);
    }
    for (const point of portfolioSeries) {
      point.benchmark = bmMap[point.date] || null;
    }
    // Asset weights per date
    const weightSeries = dates.map(date => {
      let total = 0;
      const obj = { date };
      for (let t of tokens) {
        const price = assetPriceByDate(t.id)[date];
        obj[t.symbol] = price ? price * (t.amount || 0) : 0;
        total += obj[t.symbol];
      }
      for (let t of tokens) {
        obj[`${t.symbol}_weight`] = total ? obj[t.symbol] / total : 0;
      }
      return obj;
    });
    return { portfolioSeries, btcSeries: portfolioSeries, benchmarkSeries: portfolioSeries, weightSeries };
  }, [prices, benchmark, tokens]);

  // ---- RENDER ----
  if (pricesLoading || bmLoading) return <div>Loading…</div>;
  if (pricesError) return <div>Error loading prices: {String(pricesError)}</div>;
  if (bmError) return <div>Error loading benchmark: {String(bmError)}</div>;

  return (
    <div style={{ padding: 16 }}>
      <h2>Performance Dashboard</h2>
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
      <h3>Portfolio Value vs Universe vs BTC</h3>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={portfolioSeries}>
          <XAxis dataKey="date" minTickGap={20} />
          <YAxis />
          <Tooltip />
          <Legend />
          <Line type="monotone" dataKey="portfolio" stroke="#8884d8" name="Portfolio" />
          <Line type="monotone" dataKey="benchmark" stroke="#4caf50" name="Benchmark" />
          <Line type="monotone" dataKey="btc" stroke="#fa5252" name="BTC" />
        </LineChart>
      </ResponsiveContainer>
      <h3>Asset Weighting Over Time</h3>
      <ResponsiveContainer width="100%" height={180}>
        <AreaChart data={weightSeries}>
          <XAxis dataKey="date" minTickGap={20} />
          <YAxis />
          <Tooltip />
          <Legend />
          {tokens.map((t, i) => (
            <Area
              key={t.symbol}
              type="monotone"
              dataKey={`${t.symbol}_weight`}
              stackId="a"
              stroke="#8884d8"
              fillOpacity={0.25 + 0.15 * (i % 3)}
              fill={i % 2 === 0 ? "#8884d8" : "#4caf50"}
              name={t.symbol}
              dot={false}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
      <h3>Projected Return (based on Covariances)</h3>
      {/* TODO: Insert projection UI using useCovarianceData and JS calc */}
    </div>
  );
}
