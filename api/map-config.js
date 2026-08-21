/**
 * Vercel Serverless Function
 * GET /api/map-config
 * NAVER_MAP_CLIENT_ID는 Vercel 프로젝트의 Environment Variables에 설정한다
 * (대시보드에만 저장되며 GitHub 저장소에는 절대 올라가지 않는다).
 */
module.exports = (req, res) => {
  const clientId = process.env.NAVER_MAP_CLIENT_ID;

  if (!clientId) {
    res.status(500).json({ error: 'MAP_CLIENT_ID_NOT_CONFIGURED' });
    return;
  }

  res.status(200).json({ clientId });
};
