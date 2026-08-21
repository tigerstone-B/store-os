/**
 * STORE OS - naver.js
 * Thin wrapper around NAVER Local Search API (검색 > 지역).
 *
 * Docs: https://developers.naver.com/docs/serviceapi/search/local/local.md
 *
 * NOTE on coordinates: this API's mapx/mapy fields are NOT plain WGS84
 * lat/lng (they use an internal projected coordinate system and have
 * changed format across API versions), so we deliberately do NOT trust
 * them for marker placement. Instead the frontend geocodes the returned
 * address via naver.maps.Service.geocode (Maps JS geocoder submodule),
 * which reliably returns WGS84 coordinates. This module only returns
 * title/category/address/roadAddress.
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
