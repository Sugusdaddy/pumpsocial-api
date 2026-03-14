import axios from 'axios';

interface PumpTokenInfo {
  mint: string;
  name: string;
  symbol: string;
  creator: string;
  description?: string;
  image_uri?: string;
  market_cap?: number;
  usd_market_cap?: number;
}

/**
 * Fetch token info from pump.fun API
 */
export async function getPumpTokenInfo(mint: string): Promise<PumpTokenInfo | null> {
  try {
    // Try pump.fun frontend API
    const response = await axios.get(`https://frontend-api.pump.fun/coins/${mint}`, {
      timeout: 10000,
      headers: {
        'User-Agent': 'PumpSocial/1.0',
      },
    });
    
    if (response.data) {
      return {
        mint: response.data.mint,
        name: response.data.name,
        symbol: response.data.symbol,
        creator: response.data.creator,
        description: response.data.description,
        image_uri: response.data.image_uri,
        market_cap: response.data.market_cap,
        usd_market_cap: response.data.usd_market_cap,
      };
    }
    
    return null;
  } catch (error: any) {
    // Try alternative API endpoint
    try {
      const altResponse = await axios.get(`https://client-api-2-74b1891ee9f9.herokuapp.com/coins/${mint}`, {
        timeout: 10000,
      });
      
      if (altResponse.data) {
        return {
          mint: altResponse.data.mint,
          name: altResponse.data.name,
          symbol: altResponse.data.symbol,
          creator: altResponse.data.creator,
          description: altResponse.data.description,
          image_uri: altResponse.data.image_uri,
          market_cap: altResponse.data.market_cap,
          usd_market_cap: altResponse.data.usd_market_cap,
        };
      }
    } catch {
      // Both APIs failed
    }
    
    console.error('Failed to fetch pump token info:', error.message);
    return null;
  }
}

/**
 * Verify a token exists on pump.fun and get its creator
 */
export async function verifyPumpToken(mint: string): Promise<{ valid: boolean; creator?: string; name?: string; image?: string }> {
  const info = await getPumpTokenInfo(mint);
  
  if (!info) {
    return { valid: false };
  }
  
  return {
    valid: true,
    creator: info.creator,
    name: info.name,
    image: info.image_uri,
  };
}
