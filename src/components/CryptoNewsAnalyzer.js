import React, { useEffect, useState } from 'react';
import axios from 'axios';

function CryptoNewsAnalyzer({ coins }) {
    const [suggestedCoins, setSuggestedCoins] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const apiKey = "6c5c579db7c045039231d1b5df237f10"; // Use the environment variable
        axios.get(`https://newsapi.org/v2/everything?q=cryptocurrency&apiKey=${apiKey}`)
            .then(response => {
                const positiveKeywords = ['bull', 'rally', 'rise', 'gain', 'positive', 'buy', 'up'];
                const articles = response.data.articles;
                const suggestedCoins = [];

                articles.forEach(article => {
                    const title = article.title ? article.title.toLowerCase() : '';
                    const description = article.description ? article.description.toLowerCase() : '';

                    positiveKeywords.forEach(keyword => {
                        if (title.includes(keyword) || description.includes(keyword)) {
                            // Check if a cryptocurrency name is mentioned in the title or description
                            coins.forEach(coin => {
                                if (coin.name && (title.includes(coin.name.toLowerCase()) || description.includes(coin.name.toLowerCase()))) {
                                    suggestedCoins.push(coin);
                                }
                            });
                        }
                    });
                });

                // Remove duplicates
                const uniqueSuggestedCoins = Array.from(new Set(suggestedCoins.map(coin => coin.id)))
                    .map(id => suggestedCoins.find(coin => coin.id === id));

                // Sort by 24h price change and select top 10
                uniqueSuggestedCoins.sort((a, b) => b.price_change_24h - a.price_change_24h);
                setSuggestedCoins(uniqueSuggestedCoins.slice(0, 10));

                setIsLoading(false);
            })
            .catch(error => {
                console.error(error);
                setError('Failed to fetch news');
                setIsLoading(false);
            });
    }, [coins]);

    if (isLoading) {
        return <div>Loading...</div>;
    }

    if (error) {
        return <div>{error}</div>;
    }

    return (
        <div className="crypto-news-analyzer">
          <h2>Top 10 Cryptocurrencies to Buy Based on News Sentiment</h2>
          {suggestedCoins.map((coin, index) => (
            <div key={index} className="suggested-coin" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '300px' }}>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <img src={coin.image} alt={coin.name} style={{ width: '20px', height: '20px', marginRight: '10px' }} />
                <h3 style={{ margin: 0 }}>{coin.name} ({coin.symbol.toUpperCase()})</h3>
              </div>
              <div style={{ position: 'relative', width: '100%' }}>
                <p style={{ fontSize: '1.9em' }}>{coin.current_price.toFixed(2)}</p>
                <span style={{ position: 'absolute', top: 2, right: 120, color: coin.price_change_24h < 0 ? 'red' : 'green' }}>
                  {coin.price_change_24h.toFixed(2)}
                </span>
              </div>
            </div>
          ))}
        </div>
      );
    }

export default CryptoNewsAnalyzer;
