import React from 'react';

/**
 * TradingViewWidget: renders TradingView widget for a crypto symbol
 * Expects props.symbol ("BTC", "ETH", "XRP", etc.)
 */
function TradingViewWidget({ symbol }) {
  // Map CoinGecko/selector symbols to TradingView chart symbol (e.g., "BTCUSD", "ETHUSD")
  const tradingViewSymbolMap = {
    BTC: 'COINBASE:BTCUSD',
    CBETH: 'COINBASE:ETHUSD', // fallback to ETH chart
    XRP: 'COINBASE:XRPUSD',
    HBAR: 'BINANCE:HBARUSD',
    CRV: 'BINANCE:CRVUSD',
    AVAX: 'COINBASE:AVAXUSD',
    DOGE: 'COINBASE:DOGEUSD'
  };
  const tvSymbol = tradingViewSymbolMap[symbol] || 'COINBASE:BTCUSD'; // fallback

  React.useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/tv.js';
    script.async = true;
    script.onload = () => {
      if(window.TradingView) {
        new window.TradingView.widget({
          "container_id": `tv_chart_${symbol}`,
          "width": "100%",
          "height": 300,
          "symbol": tvSymbol,
          "interval": "D",
          "timezone": "Etc/UTC",
          "theme": "dark",
          "style": "1",
          "locale": "en",
          "toolbar_bg": "#1f1f1f",
          "hide_side_toolbar": true,
          "allow_symbol_change": false,
          "save_image": false,
          "calendar": false,
          "studies": [],
        });
      }
    };
    document.body.appendChild(script);
    return () => {
      // Remove script and widget on unmount
      if(script.parentNode) script.parentNode.removeChild(script);
      const el = document.getElementById(`tv_chart_${symbol}`);
      if(el) el.innerHTML = '';
    };
  }, [symbol, tvSymbol]);

  return <div id={`tv_chart_${symbol}`} style={{marginBottom: 24}} />;
}

/**
 * Props: portfolio [{
 *   id, name, symbol, amount, currentValue, totalValue
 * }]
 */
function Portfolio({ portfolio }) {
  return (
    <div>
      <h2>Portfolio</h2>
      {portfolio.map((coin) => (
        <div key={coin.id} style={{marginBottom: '1em', border: '1px solid #333', padding: '1em', borderRadius: 8}}>
          <h3>{coin.name} {coin.symbol && `(${coin.symbol})`}</h3>
          <p>Holdings: {coin.amount}</p>
          <p>Current Value: {coin.currentValue}</p>
          <p>Total Value: {coin.totalValue}</p>
          {/* Add the TradingView chart */}
          <TradingViewWidget symbol={coin.symbol} />
        </div>
      ))}
    </div>
  );
}

export default Portfolio;