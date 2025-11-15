import React, { createContext, useContext, useEffect, useState } from 'react';

const EthereumMarketCapContext = createContext();

export function EthereumMarketCapProvider({ children }) {
  const [ethMarketCap, setEthMarketCap] = useState(null);

  useEffect(() => {
    async function fetchEthMarketCap() {
      try {
        const res = await fetch('https://api.coingecko.com/api/v3/coins/markets?ids=ethereum&vs_currency=usd');
        const data = await res.json();
        setEthMarketCap(data[0]?.market_cap || null);
      } catch (e) {
        setEthMarketCap(null);
      }
    }
    fetchEthMarketCap();
    const interval = setInterval(fetchEthMarketCap, 60000); // Refresh every 60s
    return () => clearInterval(interval);
  }, []);

  return (
    <EthereumMarketCapContext.Provider value={ethMarketCap}>
      {children}
    </EthereumMarketCapContext.Provider>
  );
}

export function useEthereumMarketCap() {
  return useContext(EthereumMarketCapContext);
}
