/**
 * Vercel Serverless Function
 * GET /api/store-search?query=...
 * 현재 프론트엔드(index.html)는 주소 검색(Geocoder)만 사용하며 이 함수는
 * 호출하지 않는다. 매장명 검색(후보 매칭)을 다시 붙일 때 사용.
 */
const { searchLocal } = require('../server/naver');

module.exports = async (req, res) => {
  const query = ((req.query && req.query.query) || '').trim();

  if (!query) {
    res.status(400).json({ error: 'QUERY_REQUIRED' });
    return;
  }

  try {
    const items = await searchLocal(query);
    res.status(200).json({ items });
  } catch (err) {
    console.error('[store-search] error:', err.message);
    res.status(502).json({ error: 'STORE_SEARCH_FAILED' });
  }
};
