/**
 * Vercel Serverless Function
 * GET /api/station-search?lat=37.xxx&lng=126.xxx&address=서울강남구...
 *
 * 수정사항:
 * - 검색 쿼리를 "지역명 + 지하철역" 조합으로 변경 (근처 역이 실제로 검색되도록)
 * - NAVER 지역검색 mapx/mapy 좌표 변환 로직 개선
 *   (NAVER Local Search는 mapx/mapy를 Integer로 내려주는데 1e7 나눗셈이 맞지 않는 경우가 있음)
 * - 주소에서 시/구 추출해 검색 정확도 향상
 */

const NAVER_LOCAL_URL = 'https://openapi.naver.com/v1/search/local.json';

function stripTags(str) {
  return (str || '').replace(/<[^>]*>/g, '');
}

/**
 * NAVER Local Search의 mapx/mapy:
 * - 값이 1억 단위(예: 1269809220)이면 WGS84 * 1e7 형태 → 1e7로 나눔
 * - 값이 소수점 포함이거나 3자리 정수면 이미 WGS84
 */
function parseNaverCoord(mapx, mapy) {
  let x = Number(mapx);
  let y = Number(mapy);
  if (Math.abs(x) > 1000) x = x / 1e7;
  if (Math.abs(y) > 1000) y = y / 1e7;
  return { lat: y, lng: x };
}

function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371000, toRad = d => d * Math.PI / 180;
  const dLat = toRad(lat2 - lat1), dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

/**
 * 주소 문자열에서 시/구/동 추출 (검색 키워드로 사용)
 * 예: "서울특별시 강남구 역삼동" → "강남구"
 */
function extractRegion(address) {
  if (!address) return '';
  const match = address.match(/([가-힣]+구|[가-힣]+시|[가-힣]+군)/);
  return match ? match[1] : '';
}

async function searchNearbyStation(query, clientId, clientSecret) {
  const url = NAVER_LOCAL_URL +
    '?query=' + encodeURIComponent(query) +
    '&display=10&sort=random';

  const res = await fetch(url, {
    headers: {
      'X-Naver-Client-Id': clientId,
      'X-Naver-Client-Secret': clientSecret,
    },
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error('NAVER_HTTP_' + res.status + ' ' + errText.slice(0, 100));
  }

  const data = await res.json();
  return data.items || [];
}

module.exports = async (req, res) => {
  const lat = parseFloat(req.query && req.query.lat);
  const lng = parseFloat(req.query && req.query.lng);
  const address = (req.query && req.query.address) || '';

  if (isNaN(lat) || isNaN(lng)) {
    res.status(400).json({ error: 'LAT_LNG_REQUIRED' });
    return;
  }

  const clientId = process.env.NAVER_SEARCH_CLIENT_ID;
  const clientSecret = process.env.NAVER_SEARCH_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    res.status(500).json({ error: 'NAVER_SEARCH_CREDENTIALS_NOT_CONFIGURED' });
    return;
  }

  try {
    const region = extractRegion(address);

    // 지역명을 포함한 쿼리로 검색 (예: "강남구 지하철역")
    // 지역을 못 찾으면 범용 쿼리 사용
    const queries = region
      ? [region + ' 지하철역', region + ' 역']
      : ['지하철역'];

    const results = await Promise.all(
      queries.map(q => searchNearbyStation(q, clientId, clientSecret))
    );
    const allItems = results.flat();

    if (allItems.length === 0) {
      res.status(200).json({ station: null });
      return;
    }

    // 지하철 카테고리 필터
    const stationItems = allItems.filter(item =>
      item.category && (
        item.category.includes('지하철') ||
        item.category.includes('전철') ||
        item.category.includes('지하철역')
      )
    );
    const candidates = stationItems.length > 0 ? stationItems : allItems;

    // 거리 계산 후 가장 가까운 역 선택
    let nearest = null;
    let minDist = Infinity;

    for (const item of candidates) {
      const pos = parseNaverCoord(item.mapx, item.mapy);

      // 좌표가 한국 범위(위도 33~38, 경도 124~132) 벗어나면 스킵
      if (pos.lat < 33 || pos.lat > 38 || pos.lng < 124 || pos.lng > 132) continue;

      const dist = haversine(lat, lng, pos.lat, pos.lng);
      if (dist < minDist) {
        minDist = dist;
        nearest = { name: stripTags(item.title), lat: pos.lat, lng: pos.lng };
      }
    }

    res.status(200).json({ station: nearest });

  } catch (err) {
    console.error('[station-search] error:', err.message);
    res.status(502).json({ error: 'STATION_SEARCH_FAILED', detail: err.message });
  }
};
