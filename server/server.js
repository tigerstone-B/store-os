/**
 * STORE OS - server.js
 * Backend: serves the static frontend, proxies NAVER Local Search,
 * and proxies OpenAI Vision (로드뷰 이미지 기반 자동 진단) so that
 * both secrets never reach the browser.
 *
 * Structure (per DEVELOPMENT RULES / section 5):
 *   Browser -> /api/store-search         -> NAVER Local Search API
 *   Browser -> /api/map-config           -> returns public NAVER Map client id
 *   Browser -> /api/ai-visual-diagnosis  -> OpenAI Vision API (로드뷰 이미지 평가)
 */

require('dotenv').config();
const express = require('express');
const path = require('path');
const { searchLocal } = require('./naver');
const { analyzeRoadviewImage } = require('./vision');

const app = express();
const PORT = process.env.PORT || 3000;

// 로드뷰 이미지(base64)를 JSON 바디로 받기 위해 넉넉한 용량 한도 설정
app.use(express.json({ limit: '15mb' }));

// Serve the static frontend (index.html, css/, js/)
app.use(express.static(path.join(__dirname, '..')));

/**
 * GET /api/map-config
 * Returns the NAVER Maps client id needed by the browser to load the
 * Maps JS SDK. This id is a public, domain-restricted identifier
 * (not a secret), but is still kept out of source files and served
 * from the environment so it can be rotated without a code change.
 */
app.get('/api/map-config', (req, res) => {
  const clientId = process.env.NAVER_MAP_CLIENT_ID;

  if (!clientId) {
    return res.status(500).json({ error: 'MAP_CLIENT_ID_NOT_CONFIGURED' });
  }

  res.json({ clientId });
});

/**
 * GET /api/store-search?query=...
 * Proxies NAVER Local Search API. NAVER_SEARCH_CLIENT_ID /
 * NAVER_SEARCH_CLIENT_SECRET stay server-side only.
 */
app.get('/api/store-search', async (req, res) => {
  const query = (req.query.query || '').trim();

  if (!query) {
    return res.status(400).json({ error: 'QUERY_REQUIRED' });
  }

  try {
    const items = await searchLocal(query);
    res.json({ items });
  } catch (err) {
    console.error('[store-search] error:', err.message);
    res.status(502).json({ error: 'STORE_SEARCH_FAILED' });
  }
});

/**
 * POST /api/ai-visual-diagnosis
 * body: { imageDataUrl: "data:image/...;base64,...", storeName?: string, address?: string }
 * OPENAI_API_KEY는 서버에만 존재. 이미지는 요청 처리 후 저장하지 않는다.
 */
app.post('/api/ai-visual-diagnosis', async (req, res) => {
  const { imageDataUrl, storeName, address } = req.body || {};

  if (!imageDataUrl) {
    return res.status(400).json({ error: 'IMAGE_REQUIRED' });
  }

  try {
    const result = await analyzeRoadviewImage(imageDataUrl, { storeName, address });
    res.json(result);
  } catch (err) {
    console.error('[ai-visual-diagnosis] error:', err.message);
    res.status(502).json({ error: 'AI_VISUAL_DIAGNOSIS_FAILED' });
  }
});

app.listen(PORT, () => {
  console.log(`STORE OS server running on http://localhost:${PORT}`);
});
