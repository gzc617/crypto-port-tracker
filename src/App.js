import React, { useState, useEffect } from 'react';
import Portfolio from './components/Portfolio';
import './App.css';

// Predefined asset list
const ASSETS = [
  { label: 'Bitcoin', symbol: 'BTC', id: 'bitcoin' },
  { label: 'Coinbase Wrapped Staked ETH', symbol: 'CBETH', id: 'coinbase-wrapped-staked-eth' },
  { label: 'XRP', symbol: 'XRP', id: 'ripple' },
  { label: 'HBAR', symbol: 'HBAR', id: 'hedera-hashgraph' },
  { label: 'Curve', symbol: 'CRV', id: 'curve-dao-token' },
  { label: 'Avalanche', symbol: 'AVAX', id: 'avalanche-2' },
  { label: 'Dogecoin', symbol: 'DOGE', id: 'dogecoin' }
];

function App() {
  const [tokens, setTokens] = useState([]); // [{id, symbol, label, amount, currentValue, totalValue}]
  const [selectedAsset, setSelectedAsset] = useState(ASSETS[0].id);
  const [inputAmount, setInputAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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
    // Fetch price
    try {
      const priceRes = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${assetObj.id}&vs_currencies=usd`);
      const priceData = await priceRes.json();
      const price = priceData[assetObj.id]?.usd;
      if (!price) {
        setError('No USD price available for this token');
        setLoading(false);
        return;
      }
      setTokens([
        ...tokens,
        {
          id: assetObj.id,
          name: assetObj.label,
          symbol: assetObj.symbol,
          amount,
          currentValue: price,
          totalValue: price * amount
        },
      ]);
      setInputAmount('');
    } catch (e) {
      setError('API error, try again');
    } finally {
      setLoading(false);
    }
  };

  // Refresh prices every 60s or when tokens are added/removed
  useEffect(() => {
    if (tokens.length === 0) return;
    const fetchPrices = async () => {
      setLoading(true);
      try {
        const ids = tokens.map((t) => t.id).join(',');
        const priceRes = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`);
        const priceData = await priceRes.json();
        setTokens((prev) => prev.map((t) => {
          const price = priceData[t.id]?.usd || t.currentValue;
          return {
            ...t,
            currentValue: price,
            totalValue: price * t.amount
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

  return (
    <div className="App">
      <h1>My Crypto Portfolio</h1>
      <form onSubmit={handleAddToken} style={{ marginBottom: 24 }}>
        <select
          value={selectedAsset}
          onChange={e => setSelectedAsset(e.target.value)}
          style={{ marginRight: 8 }}
        >
          {ASSETS.map(asset => (
            <option value={asset.id} key={asset.id}>{asset.label} ({asset.symbol})</option>
          ))}
        </select>
        <input
          type="number"
          value={inputAmount}
          onChange={e => setInputAmount(e.target.value)}
          placeholder="Amount"
          style={{ marginRight: 8 }}
        />
        <button type="submit" disabled={loading}>
          Add
        </button>
      </form>
      {error && <div style={{ color: "#fa5252", marginBottom: 12 }}>{error}</div>}
      {loading && <div>Loading...</div>}
      <Portfolio portfolio={tokens} />
    </div>
  );
}

export default App;