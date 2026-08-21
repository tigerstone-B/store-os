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
