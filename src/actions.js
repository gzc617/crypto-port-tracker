// src/actions.js
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.REACT_APP_NEON_DATABASE_URL);

// Small helper for structured logging
function logInfo(message, meta = {}) {
  console.info(`[NEON] ${message}`, meta);
}

function logError(message, meta = {}) {
  
  
  console.error(`[NEON] ${message}`, meta);
}

function normalizeDateScalar(value) {
  if (!value) return '';

  // If it's already a string, assume it's 'YYYY-MM-DD' or similar
  if (typeof value === 'string') return value;

  // If it's a Date, use YYYY-MM-DD
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  // Fallback: stringify whatever it is
  return String(value);
}

// ----------------------------------------------------
// Helper: check if a term is a numeric ID
// ----------------------------------------------------
function isNumericId(term) {
  if (typeof term === 'number') return true;
  if (typeof term === 'string') {
    return /^\d+$/.test(term.trim());
  }
  return false;
}

// ----------------------------------------------------
// Find asset by name or symbol (case-insensitive)
// ----------------------------------------------------
export async function findAssetByNameOrSymbol(searchTerm) {
  try {
    const patternLower = searchTerm.toLowerCase();

    const rows = await sql`
      SELECT id, cmc_id, symbol, name
      FROM assets
      WHERE lower(name) = ${patternLower}
         OR lower(symbol) = ${patternLower}
      LIMIT 1;
    `;

    const asset = rows[0] || null;

    logInfo('findAssetByNameOrSymbol success', { searchTerm, asset });

    return asset;
  } catch (error) {
    logError('findAssetByNameOrSymbol error', { searchTerm, error });
    throw error;
  }
}

// ----------------------------------------------------
// NEW: Fetch daily prices by an ARRAY of ids/search terms
//   - numbers / numeric strings => treated as direct IDs
//   - non-numeric strings       => treated as names/symbols
//     * we lookup asset via assets.name/symbol
//     * then use asset.cmc_id to query asset_prices_daily
//     * and override row.asset_id to the original search term
//       (e.g. 'bitcoin') so the frontend can use that key
// ----------------------------------------------------
export async function getAssetPricesDailyBySearch(termsOrIds, start, end) {
  try {
    logInfo('getAssetPricesDailyBySearch called', { termsOrIds, start, end });

    if (!termsOrIds || termsOrIds.length === 0) return [];

    const allRows = [];

    for (const term of termsOrIds) {
      // Case 1: numeric → direct asset_id / cmc_id
      if (isNumericId(term)) {
        const assetId = typeof term === 'number' ? term : Number(term);
        const rows = await getAssetPricesDaily([assetId], start, end);
        // NOTE: leave asset_id exactly as returned (numeric)
        allRows.push(...rows);
        continue;
      }

      // Case 2: string name/symbol → lookup via assets, then query by cmc_id
      const asset = await findAssetByNameOrSymbol(term);
      if (!asset || asset.cmc_id == null) {
        logInfo('getAssetPricesDailyBySearch: no asset match for term', { term });
        continue;
      }

      // IMPORTANT: per your note, we assume asset_prices_daily.asset_id = cmc_id
      const cmcId = asset.cmc_id;

      const rows = await getAssetPricesDaily([cmcId], start, end);

      // Override asset_id to the original search term so the frontend can
      // use it as a key (e.g. assetPriceByDate('bitcoin')).
      for (const row of rows) {
        row.asset_id = term;
      }

      allRows.push(...rows);
    }

    // Sort by date; asset_id is used by frontend for grouping
    allRows.sort((a, b) =>
      normalizeDateScalar(a.date).localeCompare(normalizeDateScalar(b.date))
    );

    logInfo('getAssetPricesDailyBySearch success', {
      termsOrIds,
      start,
      end,
      rowCount: allRows.length,
    });

    return allRows;
  } catch (error) {
    logError('getAssetPricesDailyBySearch error', { termsOrIds, start, end, error });
    throw error;
  }
}

// ----------------------------------------------------
// ORIGINAL: Fetch daily prices for specified assets & date range
// Queries each asset individually and merges results
// ----------------------------------------------------
export async function getAssetPricesDaily(assetIds, start, end) {
  logInfo('getAssetPricesDaily', { assetIds, start, end });
  if (!assetIds || assetIds.length === 0) return [];

  try {
    // Query each asset individually to avoid array parameter issues
    const allRows = [];
    for (const assetId of assetIds) {
      const rows = await sql`
        select asset_id, date, close_price, open_price, high_price, low_price, volume, market_cap
        from asset_prices_daily
        where asset_id = ${assetId}
          and date >= ${start} and date <= ${end}
        order by date asc;
      `;
      allRows.push(...rows);
    }

    // Sort by date after merging (dates may be Date objects or strings)
allRows.sort((a, b) =>
  normalizeDateScalar(a.date).localeCompare(normalizeDateScalar(b.date))
);

    logInfo('getAssetPricesDaily success', {
      assetIds,
      start,
      end,
      rowCount: allRows.length,
    });

    return allRows;
  } catch (error) {
    logError('getAssetPricesDaily error', { assetIds, start, end, error });
    throw error;
  }
}

// ----------------------------------------------------
// Fetch all asset ids/symbols
// ----------------------------------------------------
export async function getAssetsMeta() {
  try {
    const rows = await sql`
      select id, symbol, name from assets;
    `;

    logInfo('getAssetsMeta success', { rowCount: rows.length });

    return rows;
  } catch (error) {
    logError('getAssetsMeta error', { error });
    throw error;
  }
}

// ----------------------------------------------------
// NEW: Universe benchmark by ARRAY of ids / search terms
//   - numeric: direct IDs
//   - string: resolve via name/symbol, use cmc_id as ID
//   - then delegate to getUniverseBenchmark
// ----------------------------------------------------
export async function getUniverseBenchmarkBySearch(termsOrIds, start, end) {
  try {
    logInfo('getUniverseBenchmarkBySearch called', { termsOrIds, start, end });

    if (!termsOrIds || termsOrIds.length === 0) return [];

    const resolvedIds = [];

    for (const term of termsOrIds) {
      if (isNumericId(term)) {
        const assetId = typeof term === 'number' ? term : Number(term);
        resolvedIds.push(assetId);
      } else {
        const asset = await findAssetByNameOrSymbol(term);
        if (!asset || asset.cmc_id == null) {
          logInfo('getUniverseBenchmarkBySearch: no asset match for term', { term });
          continue;
        }
        // Again, assume asset_prices_daily.asset_id = cmc_id
        resolvedIds.push(asset.cmc_id);
      }
    }

    if (resolvedIds.length === 0) return [];

    // Dedupe IDs
    const uniqueIds = [...new Set(resolvedIds)];

    return await getUniverseBenchmark(uniqueIds, start, end);
  } catch (error) {
    logError('getUniverseBenchmarkBySearch error', { termsOrIds, start, end, error });
    throw error;
  }
}

// ----------------------------------------------------
// Universe is the sum of all market caps for given assets
// Queries each asset individually and sums market caps by date
// ----------------------------------------------------
export async function getUniverseBenchmark(assetIds, start, end) {
  if (!assetIds || assetIds.length === 0) return [];

  try {
    // Query each asset individually and merge results
    const allRows = [];
    for (const assetId of assetIds) {
      const rows = await sql`
        select date, market_cap
        from asset_prices_daily
        where asset_id = ${assetId}
          and date >= ${start} and date <= ${end}
        order by date asc;
      `;
      allRows.push(...rows);
    }

    // Group by normalized date string and sum market caps
    const benchmarkByDate = {};
    for (const row of allRows) {
      const dateKey = normalizeDateScalar(row.date);

      if (!benchmarkByDate[dateKey]) {
        benchmarkByDate[dateKey] = { date: dateKey, universe_market_cap: 0 };
      }
      benchmarkByDate[dateKey].universe_market_cap += Number(row.market_cap || 0);
    }

    const rows = Object.values(benchmarkByDate).sort((a, b) =>
      normalizeDateScalar(a.date).localeCompare(normalizeDateScalar(b.date))
    );

    logInfo('getUniverseBenchmark success', {
      assetIds,
      start,
      end,
      rowCount: rows.length,
    });

    return rows;
  } catch (error) {
    logError('getUniverseBenchmark error', { assetIds, start, end, error });
    throw error;
  }
}


// ----------------------------------------------------
// Matrix of daily close prices
// Queries each asset individually and merges results
// ----------------------------------------------------
export async function getPricesMatrix(assetIds, start, end) {
  if (!assetIds || assetIds.length === 0) return [];

  try {
    // Query each asset individually to avoid array parameter issues
    const allRows = [];
    for (const assetId of assetIds) {
      const rows = await sql`
        select asset_id, date, close_price
        from asset_prices_daily
        where asset_id = ${assetId}
          and date >= ${start} and date <= ${end}
        order by date asc;
      `;
      allRows.push(...rows);
    }

    // Sort by asset_id then date
    allRows.sort((a, b) => {
  if (a.asset_id !== b.asset_id) {
    return String(a.asset_id).localeCompare(String(b.asset_id));
  }
  return normalizeDateScalar(a.date).localeCompare(normalizeDateScalar(b.date));
});

    logInfo('getPricesMatrix success', {
      assetIds,
      start,
      end,
      rowCount: allRows.length,
    });

    return allRows;
  } catch (error) {
    logError('getPricesMatrix error', { assetIds, start, end, error });
    throw error;
  }
}

// ----------------------------------------------------
// Covariance reuses price matrix
// ----------------------------------------------------
export async function getCovarianceData(assetIds, start, end) {
  try {
    const rows = await getPricesMatrix(assetIds, start, end);
    logInfo('getCovarianceData success', { rowCount: rows.length });
    return rows;
  } catch (error) {
    logError('getCovarianceData error', { assetIds, start, end, error });
    throw error;
  }
}

// ----------------------------------------------------
// Get distinct assets present in price table
// ----------------------------------------------------
export async function getAllAssetIDs() {
  try {
    const rows = await sql`
      select distinct asset_id from asset_prices_daily;
    `;

    logInfo('getAllAssetIDs success', { rowCount: rows.length });

    return rows;
  } catch (error) {
    logError('getAllAssetIDs error', { error });
    throw error;
  }
}
