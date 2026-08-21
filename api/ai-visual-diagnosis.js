/**
 * Vercel Serverless Function
 * POST /api/ai-visual-diagnosis
 * body: { imageDataUrl, storeName?, address? }
 *
 * OPENAI_API_KEY는 Vercel 프로젝트의 Environment Variables에 설정한다.
 * 실제 평가 로직은 server/vision.js를 그대로 재사용한다
 * (로컬 Express 개발 서버와 Vercel 배포가 같은 로직을 공유).
 */
const { analyzeRoadviewImage } = require('../server/vision');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
    return;
  }

  const { imageDataUrl, storeName, address } = req.body || {};

  if (!imageDataUrl) {
    res.status(400).json({ error: 'IMAGE_REQUIRED' });
    return;
  }

  try {
    const result = await analyzeRoadviewImage(imageDataUrl, { storeName, address });
    res.status(200).json(result);
  } catch (err) {
    console.error('[ai-visual-diagnosis] error:', err.message);
    res.status(502).json({ error: 'AI_VISUAL_DIAGNOSIS_FAILED' });
  }
};
