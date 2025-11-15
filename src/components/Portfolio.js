import React, { useEffect, useRef } from 'react';
import { useEthereumMarketCap } from '../contexts/EthereumMarketCapContext';

/**
 * TradingViewWidget: renders TradingView widget for portfolio chart
 */
function TradingViewWidget({ portfolio, selectedTokenId }) {
  const containerRef = useRef(null);

  useEffect(() => {
    if (portfolio.length === 0 || !selectedTokenId) return;
    
    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/tv.js';
    script.async = true;
    script.onload = () => {
      if(window.TradingView && containerRef.current) {
        // Find the selected token in portfolio
        const selectedToken = portfolio.find(t => t.id === selectedTokenId);
        const tokenSymbol = selectedToken ? selectedToken.symbol : (portfolio.length > 0 ? portfolio[0].symbol : 'BTC');
        
        const tradingViewSymbolMap = {
          BTC: 'COINBASE:BTCUSD',
          CBETH: 'COINBASE:ETHUSD',
          XRP: 'COINBASE:XRPUSD',
          HBAR: 'BINANCE:HBARUSD',
          CRV: 'BINANCE:CRVUSD',
          AVAX: 'COINBASE:AVAXUSD',
          DOGE: 'COINBASE:DOGEUSD'
        };
        const tvSymbol = tradingViewSymbolMap[tokenSymbol] || 'COINBASE:BTCUSD';
        
        // Clear previous chart
        if(containerRef.current) {
          containerRef.current.innerHTML = '';
        }
        
        new window.TradingView.widget({
          "container_id": containerRef.current.id,
          "width": "100%",
          "height": 400,
          "symbol": tvSymbol,
          "interval": "D",
          "timezone": "Etc/UTC",
          "theme": "dark",
          "style": "1",
          "locale": "en",
          "toolbar_bg": "#1f1f1f",
          "hide_side_toolbar": false,
          "allow_symbol_change": false,
          "save_image": false,
          "calendar": false,
          "studies": [],
        });
      }
    };
    document.body.appendChild(script);
    return () => {
      if(script.parentNode) script.parentNode.removeChild(script);
      if(containerRef.current) containerRef.current.innerHTML = '';
    };
  }, [portfolio, selectedTokenId]);

  if (portfolio.length === 0) {
    return <div className="empty-chart">Add assets to see portfolio chart</div>;
  }

  return <div id="portfolio-chart" ref={containerRef} style={{width: '100%', height: 400}} />;
}

/**
 * Props: portfolio [{
 *   id, name, symbol, amount, currentValue, totalValue, change24h, marketCap
 * }]
 * showTable, showChart, showAllocation, showStatistics, selectedChartToken, onUpdateHoldings
 */
function Portfolio({ portfolio, showTable, showChart, showAllocation, showStatistics, timeframe, selectedChartToken, onUpdateHoldings, onDeleteToken }) {
  const [editingTokenId, setEditingTokenId] = React.useState(null);
  const [editAmount, setEditAmount] = React.useState('');
  const ethGlobalMarketCap = useEthereumMarketCap();

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  };

  const formatNumber = (value, decimals = 8) => {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: decimals
    }).format(value);
  };

  const formatMarketCap = (value) => {
    if (!value || value === 0) return 'N/A';
    if (value >= 1e12) return `$${(value / 1e12).toFixed(2)}T`;
    if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
    if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
    if (value >= 1e3) return `$${(value / 1e3).toFixed(2)}K`;
    return formatCurrency(value);
  };

  const handleEditClick = (token) => {
    setEditingTokenId(token.id);
    setEditAmount(token.amount.toString());
  };

  const handleSaveEdit = (tokenId) => {
    if (onUpdateHoldings) {
      onUpdateHoldings(tokenId, editAmount);
    }
    setEditingTokenId(null);
    setEditAmount('');
  };

  const handleCancelEdit = () => {
    setEditingTokenId(null);
    setEditAmount('');
  };

  // --- Allocation/Universe math ---
  const totalPortfolioValue = portfolio.reduce((sum, t) => sum + (t.totalValue || 0), 0);
  // ETH for CBETH market allocation adjustment (now using global context)
  const getMarketCapForAllocation = (coin) => {
    if (coin.id === 'coinbase-wrapped-staked-eth') {
      return ethGlobalMarketCap || 0;
    }
    return coin.marketCap || 0;
  };
  const totalUniverseValue = portfolio.reduce((sum, t) => sum + getMarketCapForAllocation(t), 0);
  // -------------------------------

  if (showTable) {
    if (portfolio.length === 0) {
      return <div className="empty-state">No assets in portfolio. Click "+ Add Asset" to get started.</div>;
    }
    return (
      <div className="assets-table-container">
        <div style={{marginBottom: 16, color: '#f0b90b', fontWeight: 500}}>
          Total Universe Value: {formatMarketCap(totalUniverseValue)}
        </div>
        <table className="assets-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Price</th>
              <th>Market Cap</th>
              <th>Market Allocation</th>
              <th>Portfolio Allocation</th>
              <th>O/W or U/W</th>
              <th>24h</th>
              <th>Holdings</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {portfolio.map((coin) => {
              const customMarketCap = getMarketCapForAllocation(coin);
              const marketAllocation = totalUniverseValue ? customMarketCap / totalUniverseValue : 0;
              const portfolioAllocation = totalPortfolioValue ? (coin.totalValue || 0) / totalPortfolioValue : 0;
              const overweight = portfolioAllocation - marketAllocation;
              return (
                <tr key={coin.id}>
                  <td>
                    <div className="asset-name">
                      <strong>{coin.name}</strong>
                      <span className="asset-symbol">{coin.symbol}</span>
                    </div>
                  </td>
                  <td>{formatCurrency(coin.currentValue)}</td>
                  <td>{formatMarketCap(coin.marketCap)}</td>
                  <td>{(marketAllocation * 100).toFixed(2)}%</td>
                  <td>{(portfolioAllocation * 100).toFixed(2)}%</td>
                  <td className={overweight >= 0 ? 'positive' : 'negative'}>
                    {(overweight * 100).toFixed(2)}%
                  </td>
                  <td className={coin.change24h >= 0 ? 'positive' : 'negative'}>
                    {coin.change24h >= 0 ? '+' : ''}{coin.change24h?.toFixed(2)}%
                  </td>
                  <td>
                    {editingTokenId === coin.id ? (
                      <div className="edit-holdings">
                        <input
                          type="number"
                          value={editAmount}
                          onChange={(e) => setEditAmount(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              handleSaveEdit(coin.id);
                            } else if (e.key === 'Escape') {
                              handleCancelEdit();
                            }
                          }}
                          className="edit-amount-input"
                          step="any"
                          autoFocus
                        />
                        <div className="edit-actions">
                          <button 
                            className="save-btn"
                            onClick={() => handleSaveEdit(coin.id)}
                          >
                            Save
                          </button>
                          <button 
                            className="cancel-btn"
                            onClick={handleCancelEdit}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="holdings-info">
                        <div>{formatCurrency(coin.totalValue)}</div>
                        <div className="holdings-amount">{formatNumber(coin.amount)} {coin.symbol}</div>
                      </div>
                    )}
                  </td>
                  <td>
                    {editingTokenId === coin.id ? null : (
                      <>
                        <button 
                          className="edit-btn"
                          onClick={() => handleEditClick(coin)}
                        >
                          Edit
                        </button>
                        {onDeleteToken && (
                          <button
                            className="delete-btn"
                            onClick={() => onDeleteToken(coin.id)}
                            style={{marginLeft: 6}}
                          >
                            Delete
                          </button>
                        )}
                      </>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }

  if (showChart) {
    return <TradingViewWidget portfolio={portfolio} selectedTokenId={selectedChartToken} />;
  }

  if (showAllocation) {
    const totalValue = portfolio.reduce((sum, token) => sum + (token.totalValue || 0), 0);
    return (
      <div className="allocation-container">
        {portfolio.map((coin) => {
          const allocation = totalValue > 0 ? (coin.totalValue / totalValue) * 100 : 0;
          return (
            <div key={coin.id} className="allocation-item">
              <div className="allocation-header">
                <span>{coin.name} ({coin.symbol})</span>
                <span>{allocation.toFixed(2)}%</span>
              </div>
              <div className="allocation-bar">
                <div 
                  className="allocation-bar-fill" 
                  style={{ width: `${allocation}%` }}
                />
              </div>
              <div className="allocation-value">{formatCurrency(coin.totalValue)}</div>
            </div>
          );
        })}
      </div>
    );
  }

  if (showStatistics) {
    const totalValue = portfolio.reduce((sum, token) => sum + (token.totalValue || 0), 0);
    const totalInvested = portfolio.reduce((sum, token) => sum + (token.costBasis || token.totalValue), 0);
    const totalPnL = totalValue - totalInvested;
    const totalPnLPercent = totalInvested > 0 ? ((totalPnL / totalInvested) * 100) : 0;
    
    return (
      <div className="statistics-container">
        <div className="stat-item">
          <div className="stat-label">Total Value</div>
          <div className="stat-value">{formatCurrency(totalValue)}</div>
        </div>
        <div className="stat-item">
          <div className="stat-label">Total Invested</div>
          <div className="stat-value">{formatCurrency(totalInvested)}</div>
        </div>
        <div className="stat-item">
          <div className="stat-label">Total P&L</div>
          <div className={`stat-value ${totalPnL >= 0 ? 'positive' : 'negative'}`}>
            {formatCurrency(totalPnL)} ({totalPnLPercent >= 0 ? '+' : ''}{totalPnLPercent.toFixed(2)}%)
          </div>
        </div>
        <div className="stat-item">
          <div className="stat-label">Number of Assets</div>
          <div className="stat-value">{portfolio.length}</div>
        </div>
      </div>
    );
  }

  return null;
}

export default Portfolio;