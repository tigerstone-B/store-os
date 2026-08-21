module.exports = (req, res) => {
  const clientId = process.env.NAVER_MAP_CLIENT_ID;

  if (!clientId) {
    res.status(500).json({ error: 'MAP_CLIENT_ID_NOT_CONFIGURED' });
    return;
  }

  res.status(200).json({ clientId });
};
