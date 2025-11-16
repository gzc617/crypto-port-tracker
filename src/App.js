import React, { useState, useEffect } from 'react';
import Portfolio from './components/Portfolio';
import PerformanceDashboard from './components/PerformanceDashboard';
import RiskDashboard from './components/RiskDashboard';
import './App.css';

// Predefined asset list
const ASSETS = [
  { label: 'Bitcoin', symbol: 'BTC', id: 'bitcoin' },
  { label: 'Coinbase Wrapped Staked ETH', symbol: 'CBETH', id: 'coinbase-wrapped-staked-eth' },
  { label: 'XRP', symbol: 'XRP', id: 'ripple' },
  { label: 'HBAR', symbol: 'HBAR', id: 'hedera-hashgraph' },
  { label: 'Curve', symbol: 'CRV', id: 'curve-dao-token' },
  { label: 'Avalanche', symbol: 'AVAX', id: 'avalanche-2' },
  { label: 'Dogecoin', symbol: 'DOGE', id: 'dogecoin' },
  { label: 'Ethereum', symbol: 'ETH', id: 'ethereum' },
];

// Optionally: define a default starter portfolio here (or [] for empty)
const DEFAULT_IDS = ['bitcoin', 'coinbase-wrapped-staked-eth', 'ethereum'];

function App() {
  const [tokens, setTokens] = useState([]);
  const [selectedAsset, setSelectedAsset] = useState(ASSETS[0].id);
  const [inputAmount, setInputAmount] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [activeTab, setActiveTab] = useState('Chart');
  const [timeframe, setTimeframe] = useState('All');
  const [selectedChartToken, setSelectedChartToken] = useState(null);
  const [previousTotalValue, setPreviousTotalValue] = useState(0);
  const [dashboardTab, setDashboardTab] = useState('Portfolio');

  // Load tokens from localStorage when app mounts (do NOT fetch defaults if missing)
  useEffect(() => {
    const cached = localStorage.getItem('portfolio_tokens');
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed)) setTokens(parsed);
      } catch {}
    }
    setLoading(false)
    // if no cache, setTokens([]) by default (done by useState above)
  }, []);
  // Save tokens to localStorage every change
  useEffect(() => {
    if (loading) return;
    localStorage.setItem('portfolio_tokens', JSON.stringify(tokens));
  }, [tokens]);

  // Calculate total portfolio value
  const totalValue = tokens.reduce((sum, token) => sum + (token.totalValue || 0), 0);
  const change24h = totalValue - previousTotalValue;
  const change24hPercent = previousTotalValue > 0 ? ((change24h / previousTotalValue) * 100) : 0;

  // Add token
  const handleAddToken = async (e) => {
    e.preventDefault();
    setError('');
    if (!selectedAsset || !inputAmount) return;
    const assetObj = ASSETS.find(a => a.id === selectedAsset);
    const amount = parseFloat(inputAmount);
    if (isNaN(amount) || amount <= 0) {
      setError('Enter a valid amount');
      return;
    }
    if (tokens.some((t) => t.id === assetObj.id)) {
      setError('Token already in portfolio');
      return;
    }
    setLoading(true);
    try {
      const marketsRes = await fetch(`https://api.coingecko.com/api/v3/coins/markets?ids=${assetObj.id}&vs_currency=usd`);
      const marketsData = await marketsRes.json();
      const coinData = marketsData.find(coin => coin.id === assetObj.id);
      if (!coinData || !coinData.current_price) {
        setError('No USD price available for this token');
        setLoading(false);
        return;
      }
      const price = coinData.current_price;
      const change24h = coinData.price_change_percentage_24h || 0;
      const marketCap = coinData.market_cap || 0;
      setTokens([
        ...tokens,
        {
          id: assetObj.id,
          name: assetObj.label,
          symbol: assetObj.symbol,
          amount,
          currentValue: price,
          totalValue: price * amount,
          change24h: change24h,
          marketCap: marketCap,
        },
      ]);
      setInputAmount('');
      setShowAddModal(false);
    } catch (e) {
      setError('API error, try again');
    } finally {
      setLoading(false);
    }
  };

  // Refresh prices every 60s
  useEffect(() => {
    if (tokens.length === 0) return;
    const fetchPrices = async () => {
      const currentTotal = tokens.reduce((sum, token) => sum + (token.totalValue || 0), 0);
      setPreviousTotalValue(currentTotal);
      setLoading(true);
      try {
        const ids = tokens.map((t) => t.id).join(',');
        const marketsRes = await fetch(`https://api.coingecko.com/api/v3/coins/markets?ids=${ids}&vs_currency=usd`);
        const marketsData = await marketsRes.json();
        setTokens((prev) => prev.map((t) => {
          const coinData = marketsData.find(coin => coin.id === t.id);
          if (!coinData) return t;
          const price = coinData.current_price || t.currentValue;
          const change24h = coinData.price_change_percentage_24h ?? t.change24h ?? 0;
          const marketCap = coinData.market_cap || t.marketCap || 0;
          return {
            ...t,
            currentValue: price,
            totalValue: price * t.amount,
            change24h: change24h,
            marketCap: marketCap,
          };
        }));
      } catch (e) {
        setError('API error updating prices');
      } finally {
        setLoading(false);
      }
    };
    fetchPrices();
    const interval = setInterval(fetchPrices, 60000);
    return () => clearInterval(interval);
  }, [tokens.length]);

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  };

  // Delete asset
  const handleDeleteToken = (tokenId) => {
    setTokens(tokens => tokens.filter(t => t.id !== tokenId));
  };

  // Handle updating token holdings
  const handleUpdateHoldings = async (tokenId, newAmount) => {
    if (isNaN(newAmount) || newAmount < 0) {
      setError('Enter a valid amount');
      return;
    }
    setLoading(true);
    try {
      const token = tokens.find(t => t.id === tokenId);
      if (!token) return;
      // Fetch latest price to recalculate total value using markets endpoint
      const marketsRes = await fetch(`https://api.coingecko.com/api/v3/coins/markets?ids=${tokenId}&vs_currency=usd`);
      const marketsData = await marketsRes.json();
      const coinData = marketsData.find(coin => coin.id === tokenId);
      const price = coinData?.current_price || token.currentValue;
      const change24h = coinData?.price_change_percentage_24h ?? token.change24h ?? 0;
      const marketCap = coinData?.market_cap || token.marketCap || 0;
      setTokens((prev) => prev.map((t) => {
        if (t.id === tokenId) {
          return {
            ...t,
            amount: parseFloat(newAmount),
            currentValue: price,
            totalValue: price * parseFloat(newAmount),
            change24h: change24h,
            marketCap: marketCap,
          };
        }
        return t;
      }));
    } catch (e) {
      setError('Error updating holdings');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="App">
      <div className="portfolio-header">
        <div className="current-balance">
          <h2>Current Balance</h2>
          <div className="balance-amount">{formatCurrency(totalValue)}</div>
          <div className={`balance-change ${change24h >= 0 ? 'positive' : 'negative'}`}>
            {change24h >= 0 ? '+' : ''}{formatCurrency(change24h)} ({change24hPercent >= 0 ? '+' : ''}{change24hPercent.toFixed(2)}%)
          </div>
        </div>
      </div>
      <div style={{marginBottom: 16, borderBottom: '1px solid #222', paddingBottom: 5}}>
        {['Portfolio', 'Performance', 'Risk'].map(tab => (
          <button
            key={tab}
            onClick={() => setDashboardTab(tab)}
            style={{ marginRight: 9, fontWeight: dashboardTab === tab ? 'bold' : 400 }}
            className={dashboardTab === tab ? 'active' : ''}
          >{tab}</button>
        ))}
      </div>
      {dashboardTab === 'Portfolio' && (
        <div className="chart-section">
          <div className="chart-tabs">
            <button 
              className={activeTab === 'Chart' ? 'active' : ''} 
              onClick={() => setActiveTab('Chart')}
            >
              Chart
            </button>
            <button 
              className={activeTab === 'Allocation' ? 'active' : ''} 
              onClick={() => setActiveTab('Allocation')}
            >
              Allocation
            </button>
            <button 
              className={activeTab === 'Statistics' ? 'active' : ''} 
              onClick={() => setActiveTab('Statistics')}
            >
              Statistics
            </button>
          </div>
          {activeTab === 'Chart' && (
            <div className="chart-container">
              {tokens.length > 0 && (
                <div className="token-selector">
                  <label htmlFor="chart-token-select">Select Token:</label>
                  <select
                    id="chart-token-select"
                    value={selectedChartToken || tokens[0]?.id || ''}
                    onChange={(e) => setSelectedChartToken(e.target.value)}
                    className="token-select-dropdown"
                  >
                    {tokens.map((token) => (
                      <option key={token.id} value={token.id}>
                        {token.name} ({token.symbol})
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div className="timeframe-selector">
                {['24h', '7d', '30d', '60d', '90d', 'All'].map((tf) => (
                  <button
                    key={tf}
                    className={timeframe === tf ? 'active' : ''}
                    onClick={() => setTimeframe(tf)}
                  >
                    {tf}
                  </button>
                ))}
              </div>
              <div className="portfolio-chart">
                <Portfolio 
                  portfolio={tokens} 
                  timeframe={timeframe} 
                  showChart={true}
                  selectedChartToken={selectedChartToken || (tokens.length > 0 ? tokens[0].id : null)}
                />
              </div>
            </div>
          )}
          {activeTab === 'Allocation' && (
            <div className="allocation-view">
              <Portfolio portfolio={tokens} showAllocation={true} />
            </div>
          )}
          {activeTab === 'Statistics' && (
            <div className="statistics-view">
              <Portfolio portfolio={tokens} showStatistics={true} />
            </div>
          )}
        </div>
      )}
      {dashboardTab === 'Performance' && (
        <PerformanceDashboard tokens={tokens} />
      )}
      {dashboardTab === 'Risk' && (
        <RiskDashboard tokens={tokens} />
      )}
      <div className="assets-section">
        <div className="assets-header">
          <h3>Your Assets</h3>
          <button className="add-asset-btn" onClick={() => setShowAddModal(true)}>
            + Add Asset
          </button>
        </div>
        <Portfolio 
          portfolio={tokens} 
          showTable={true} 
          onUpdateHoldings={handleUpdateHoldings}
          onDeleteToken={handleDeleteToken}
        />
      </div>
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Add Asset</h3>
              <button className="close-btn" onClick={() => setShowAddModal(false)}>×</button>
            </div>
            <form onSubmit={handleAddToken}>
              <div className="form-group">
                <label>Select Asset</label>
                <select
                  value={selectedAsset}
                  onChange={e => setSelectedAsset(e.target.value)}
                >
                  {ASSETS.map(asset => (
                    <option value={asset.id} key={asset.id}>{asset.label} ({asset.symbol})</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Amount</label>
                <input
                  type="number"
                  value={inputAmount}
                  onChange={e => setInputAmount(e.target.value)}
                  placeholder="Enter amount"
                  step="any"
                />
              </div>
              {error && <div className="error-message">{error}</div>}
              <button type="submit" className="submit-btn" disabled={loading}>
                {loading ? 'Adding...' : 'Add Asset'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;