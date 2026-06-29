import { GiphyFetch } from '@giphy/js-fetch-api';

// Giphy API key (provided for this project).
const GIPHY_API_KEY = 'QWR0DzGFnAB0esLajnlUBxDky6nqZrnv';

const gf = new GiphyFetch(GIPHY_API_KEY);

// Mocking-flavored search terms the gremlin uses when it throws a meme at you.
const MOCK_QUERIES = [
  'mocking spongebob',
  'facepalm',
  'this is fine fire',
  'coding fail',
  'programmer bug',
  'disappointed',
  'rage quit',
  'broken computer',
  'error 404',
  'laughing at you',
  'crying coding',
  'debugging pain',
];

function pickQuery(caption?: string): string {
  // Try to pull a meaty word out of the gremlin's line so the gif loosely relates.
  if (caption) {
    const words = caption
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .split(/\s+/)
      .filter((w) => w.length > 4);
    if (words.length && Math.random() > 0.4) {
      return words[Math.floor(Math.random() * words.length)];
    }
  }
  return MOCK_QUERIES[Math.floor(Math.random() * MOCK_QUERIES.length)];
}

/**
 * Fetch a random GIF URL for a mocking meme. Returns null on failure so the
 * caller can gracefully fall back to text.
 */
export async function fetchMemeGif(caption?: string): Promise<string | null> {
  try {
    const query = pickQuery(caption);
    const { data } = await gf.search(query, { limit: 25, rating: 'pg-13', sort: 'relevant' });
    if (!data || data.length === 0) return null;
    const pick = data[Math.floor(Math.random() * data.length)];
    return pick.images?.fixed_height?.url || pick.images?.original?.url || null;
  } catch {
    return null;
  }
}
