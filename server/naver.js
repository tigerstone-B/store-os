/**
 * STORE OS - naver.js
 * NAVER Local Search API 프록시. 현재 프론트엔드는 미사용 (확장용).
 */

const NAVER_LOCAL_SEARCH_URL = 'https://openapi.naver.com/v1/search/local.json';

function stripHtmlTags(str) {
  return (str || '').replace(/<[^>]*>/g, '');
}

async function searchLocal(query) {
  const clientId = process.env.NAVER_SEARCH_CLIENT_ID;
  const clientSecret = process.env.NAVER_SEARCH_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('NAVER_SEARCH_CREDENTIALS_NOT_CONFIGURED');
  }

  const url =
    NAVER_LOCAL_SEARCH_URL +
    '?query=' +
    encodeURIComponent(query) +
    '&display=5&start=1&sort=random';

  const response = await fetch(url, {
    headers: {
      'X-Naver-Client-Id': clientId,
      'X-Naver-Client-Secret': clientSecret,
    },
  });

  if (!response.ok) {
    throw new Error('NAVER_LOCAL_SEARCH_HTTP_' + response.status);
  }

  const data = await response.json();

  return (data.items || []).map((item) => ({
    title: stripHtmlTags(item.title),
    category: item.category,
    address: item.address,
    roadAddress: item.roadAddress,
  }));
}

module.exports = { searchLocal };
