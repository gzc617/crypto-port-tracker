# Crypto Portfolio Tracker

Notes for next time: 
- db only have BTC data and needs cron job for updating daily data into neon db
- normalize performance so it's on % and not on nominal value
- risk dashboard not working but copy set up from performance 

A comprehensive React-based cryptocurrency portfolio tracker with advanced performance analytics and risk management features. This application allows you to track your crypto holdings, analyze performance against market benchmarks, and assess portfolio risk metrics in real-time.

## 🚀 Features

### Portfolio Management
- **Add Assets**: Select from predefined crypto assets (Bitcoin, Ethereum, XRP, HBAR, Curve, Avalanche, Dogecoin, Coinbase Wrapped Staked ETH)
- **Edit Holdings**: Update token amounts with inline editing and automatic price recalculation
- **Delete Assets**: Remove assets from your portfolio with one click
- **Real-time Price Updates**: Automatic price refresh every 60 seconds from CoinGecko API
- **Local Storage Persistence**: Your portfolio is automatically saved to browser localStorage

### Portfolio Dashboard
- **Current Balance**: Display total portfolio value with 24h change percentage
- **Interactive Charts**: 
  - Individual asset price charts using TradingView widgets
  - Portfolio allocation pie charts
  - Historical performance visualization
- **Asset Allocation View**: Visual breakdown of portfolio distribution
- **Statistics View**: Total value, ROI, P&L calculations

### Performance Dashboard
- **Portfolio Performance Chart**: Track portfolio value over time with adjustable timeframes (1D, 30D, YTD, 1Y, ALL)
- **Benchmark Comparisons**: 
  - Compare portfolio performance vs. market-weighted universe
  - Compare vs. Bitcoin as a benchmark
- **Asset Weighting Over Time**: Visualize how asset weights change over selected timeframes
- **Projected Returns**: Calculate potential returns based on covariance matrices (coming soon)

### Risk Dashboard
- **Sharpe Ratio**: Calculate and display Sharpe ratios for entire portfolio and individual assets
- **Beta Calculation**: Measure asset sensitivity vs. universe and Bitcoin benchmark
- **Max Drawdown**: Analyze maximum drawdown for portfolio and each asset
- **Adjustable Timeframes**: All risk metrics can be calculated for 1D, 30D, YTD, 1Y, or ALL periods

### Advanced Analytics
- **Market Allocation**: Compare your portfolio allocation vs. market-weighted universe allocation
- **Overweight/Underweight Analysis**: Identify which assets you're over/under-weighting relative to market
- **Total Universe Value**: Calculate total market cap of your portfolio universe
- **Live Market Data**: Real-time prices, market caps, and 24h changes from CoinGecko

## 🛠️ Tech Stack

- **Frontend Framework**: React 18.3.1
- **Build Tool**: Create React App (react-scripts 5.0.1)
- **Charts**: Recharts 3.4.1
- **Database**: Neon PostgreSQL (via @neondatabase/serverless 1.0.2)
- **Trading Charts**: TradingView Widget
- **API**: CoinGecko Public API
- **Styling**: Custom CSS with CoinMarketCap-inspired dark theme

## 📋 Prerequisites

- Node.js (v14 or higher recommended)
- npm or yarn
- Neon PostgreSQL database account
- CoinGecko API access (public API, no key required)

## 🔧 Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd crypto-portfolio-tracker-react
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   
   Create a `.env` file in the root directory:
   ```env
   REACT_APP_NEON_DATABASE_URL=your_neon_database_connection_string
   ```

   Your Neon connection string should look like:
   ```
   postgresql://username:password@host.neon.tech/dbname?sslmode=require
   ```

4. **Start the development server**
   ```bash
   npm start
   ```

   The app will open at `http://localhost:3000`

## 🗄️ Database Setup

This application requires a Neon PostgreSQL database with the following tables:

### `assets` table
```sql
CREATE TABLE assets (
  id TEXT PRIMARY KEY,
  cmc_id INTEGER,
  symbol TEXT NOT NULL,
  name TEXT NOT NULL,
  source TEXT,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

### `asset_prices_daily` table/view
```sql
CREATE VIEW asset_prices_daily AS
SELECT
  id,
  asset_id,
  date,
  time_open,
  time_close,
  time_high,
  time_low,
  open_price,
  high_price,
  low_price,
  close_price,
  volume,
  market_cap,
  circulating_supply,
  raw_timestamp,
  created_at,
  updated_at,
  one_day_price_change
FROM asset_prices_daily;
```

**Note**: The application queries these tables to compute historical performance and risk metrics. Ensure your database is populated with historical price data for the assets you want to track.

## 📁 Project Structure

```
crypto-portfolio-tracker-react/
├── public/
│   ├── index.html
│   ├── favicon.ico
│   └── csv_data/          # Historical data CSV files
├── src/
│   ├── actions.js         # Neon DB query functions
│   ├── App.js             # Main application component
│   ├── App.css            # Main stylesheet (CoinMarketCap theme)
│   ├── index.js           # Application entry point
│   ├── index.css          # Global styles
│   ├── components/
│   │   ├── Portfolio.js              # Portfolio table, charts, allocation views
│   │   ├── PerformanceDashboard.js   # Performance analytics dashboard
│   │   └── RiskDashboard.js          # Risk metrics dashboard
│   └── contexts/
│       └── EthereumMarketCapContext.js  # Global ETH market cap context
├── package.json
├── .env                   # Environment variables (not in git)
└── README.md
```

## 🎯 Key Components

### `App.js`
Main application component that manages:
- Portfolio token state
- Local storage persistence
- Real-time price updates from CoinGecko
- Dashboard tab navigation
- Asset addition/editing/deletion

### `components/Portfolio.js`
Displays portfolio in multiple views:
- **Table View**: Asset details, prices, market caps, allocations, 24h changes
- **Chart View**: TradingView widget for individual asset price charts
- **Allocation View**: Visual asset allocation breakdown
- **Statistics View**: Portfolio statistics (total value, P&L, ROI)

### `components/PerformanceDashboard.js`
Performance analytics dashboard:
- Fetches historical price data from Neon DB
- Computes portfolio value over time
- Compares against universe and Bitcoin benchmarks
- Visualizes asset weighting changes over time
- Calculates projected returns (in development)

### `components/RiskDashboard.js`
Risk analysis dashboard:
- Computes Sharpe ratios (portfolio and per-asset)
- Calculates Beta vs. universe and Bitcoin
- Analyzes max drawdown for portfolio and assets
- All metrics calculated on-demand from Neon DB data

### `actions.js`
Neon database query functions:
- `getAssetPricesDaily()` - Fetch daily prices for assets
- `getUniverseBenchmark()` - Calculate universe market cap benchmark
- `getPricesMatrix()` - Get price matrix for risk calculations
- `findAssetByNameOrSymbol()` - Search assets by name/symbol
- Individual asset queries (queries each asset separately to avoid array parameter issues)

### `contexts/EthereumMarketCapContext.js`
Global React context providing Ethereum market cap:
- Used for CBETH market allocation calculations
- Auto-fetches and refreshes every 60 seconds
- Available throughout the application

## 🔌 API Integrations

### CoinGecko API
- **Endpoint**: `https://api.coingecko.com/api/v3/coins/markets`
- **Usage**: Fetch current prices, market caps, and 24h changes
- **Rate Limits**: Free tier (50 calls/minute)
- **No API Key Required**: Uses public endpoints

### TradingView Widget
- **Script**: Loaded from `https://s3.tradingview.com/tv.js`
- **Usage**: Interactive price charts for individual assets
- **Themes**: Dark theme matching app design

### Neon PostgreSQL
- **Client**: `@neondatabase/serverless`
- **Connection**: Via connection string from environment variable
- **Usage**: Historical price data for performance and risk analytics

## 💾 Data Persistence

- **Portfolio Data**: Stored in browser `localStorage` under key `portfolio_tokens`
- **Auto-save**: Portfolio state automatically saved on any change
- **Auto-load**: Portfolio restored from cache on app initialization
- **No server persistence**: Portfolio data is client-side only

## 🎨 Styling

The application uses a dark theme inspired by CoinMarketCap:
- **Background**: `#0d1421` (deep blue-black)
- **Card Background**: `#1e2329` (darker gray)
- **Text**: White and light gray (`#848e9c`)
- **Accent Colors**: 
  - Green (`#16c784`) for positive changes
  - Red (`#ea3943`) for negative changes
  - Yellow (`#f0b90b`) for highlights and buttons

## 🚀 Available Scripts

- `npm start` - Start development server
- `npm run build` - Build for production
- `npm test` - Run tests
- `npm run eject` - Eject from Create React App (irreversible)

## 📊 Supported Assets

The application currently supports these predefined assets:
- Bitcoin (BTC) - `bitcoin`
- Ethereum (ETH) - `ethereum`
- Coinbase Wrapped Staked ETH (CBETH) - `coinbase-wrapped-staked-eth`
- XRP - `ripple`
- HBAR - `hedera-hashgraph`
- Curve (CRV) - `curve-dao-token`
- Avalanche (AVAX) - `avalanche-2`
- Dogecoin (DOGE) - `dogecoin`

## 🔍 Key Features Explained

### Market Allocation vs Portfolio Allocation
- **Market Allocation**: Each asset's percentage of total universe market cap
- **Portfolio Allocation**: Each asset's percentage of your total portfolio value
- **Overweight/Underweight**: Difference between portfolio and market allocation
- **Special Case**: CBETH uses Ethereum's market cap for allocation calculations

### Risk Metrics
- **Sharpe Ratio**: (Return - Risk-free rate) / Standard Deviation (risk-free rate = 0 for crypto)
- **Beta**: Covariance(Asset, Benchmark) / Variance(Benchmark)
- **Max Drawdown**: Maximum peak-to-trough decline in value

### Performance Benchmarks
- **Universe Benchmark**: Sum of market caps for all portfolio assets
- **Bitcoin Benchmark**: BTC price performance for comparison
- **Timeframe Options**: 1D, 30D, YTD, 1Y, ALL

## 🐛 Troubleshooting

### Database Connection Issues
- Verify your `REACT_APP_NEON_DATABASE_URL` is set correctly in `.env`
- Ensure your Neon database is active and accessible
- Check network/firewall settings

### API Rate Limiting
- CoinGecko free tier: 50 calls/minute
- The app refreshes every 60 seconds, which should be within limits
- If you hit rate limits, increase the refresh interval in `App.js`

### Portfolio Not Loading
- Check browser console for localStorage errors
- Clear browser cache if portfolio appears corrupted
- Verify JSON structure in localStorage: `portfolio_tokens`

### Charts Not Displaying
- TradingView widget requires internet connection
- Check browser console for script loading errors
- Verify asset symbols match TradingView format

## 📝 Notes

- **CBETH Special Handling**: Coinbase Wrapped Staked ETH uses Ethereum's market cap for allocation calculations via global context
- **Individual Asset Queries**: Database queries fetch each asset individually to avoid PostgreSQL array parameter issues
- **Client-side Calculations**: All analytics (Sharpe, Beta, Drawdown) are computed in React from fetched data
- **No Server Required**: Application runs entirely client-side (except for Neon DB queries)

## 🔮 Future Enhancements

- [ ] Projected returns calculation with covariance matrices
- [ ] Additional asset support
- [ ] Export portfolio data to CSV
- [ ] Multiple portfolio management
- [ ] Historical performance tracking
- [ ] Alert notifications for price changes
- [ ] Mobile responsive design improvements

## 📄 License

See LICENSE file for details.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

---

**Built with ❤️ using React and Neon PostgreSQL**

