/**
 * 네이버 지역 검색 API 프록시
 * GET /api/naversearch?lat={lat}&lng={lng}&radius={radius}
 *
 * - Nominatim 역지오코딩으로 동 이름 추출
 * - "동 음식점" + "동 한식/중식/일식/양식/분식" 병렬 검색 → 최대 약 55개 후보
 * - 1km 내 최대 20개 거리순 반환
 */

function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function jsonRes(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  });
}

async function naverSearch(query, start, headers) {
  try {
    const res = await fetch(
      `https://openapi.naver.com/v1/search/local.json` +
        `?query=${encodeURIComponent(query)}&display=5&start=${start}&sort=comment`,
      { headers }
    );
    if (!res.ok) {
      console.log(`[naversearch] Naver ${res.status} for "${query}" start=${start}`);
      return [];
    }
    const data = await res.json();
    return data.items ?? [];
  } catch (e) {
    console.log(`[naversearch] fetch error for "${query}":`, e.message);
    return [];
  }
}

export async function onRequestGet(context) {
  const { searchParams } = new URL(context.request.url);
  const lat = searchParams.get('lat');
  const lng = searchParams.get('lng');
  const radius = parseInt(searchParams.get('radius') || '1000', 10);
  const maxResults = 20;

  const NAVER_CLIENT_ID = context.env.NAVER_CLIENT_ID;
  const NAVER_CLIENT_SECRET = context.env.NAVER_CLIENT_SECRET;

  if (!NAVER_CLIENT_ID || !NAVER_CLIENT_SECRET) {
    return jsonRes({ error: 'NAVER_CLIENT_ID 또는 NAVER_CLIENT_SECRET이 설정되지 않았습니다.' }, 500);
  }
  if (!lat || !lng) {
    return jsonRes({ error: 'lat, lng 파라미터가 필요합니다.' }, 400);
  }

  const userLat = parseFloat(lat);
  const userLng = parseFloat(lng);

  // ─── 1. Nominatim 역지오코딩 ────────────────────────────────────────────
  let area = '';
  try {
    const nomRes = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=15&addressdetails=1`,
      {
        headers: {
          'User-Agent': 'LunchPick/1.0 (lunchpick.pages.dev)',
          'Accept-Language': 'ko',
        },
      }
    );
    if (nomRes.ok) {
      const nomData = await nomRes.json();
      const addr = nomData.address ?? {};
      area =
        addr.quarter ||
        addr.neighbourhood ||
        addr.suburb ||
        addr.city_district ||
        addr.county ||
        addr.city ||
        '';
      console.log('[naversearch] 역지오코딩:', area, '| 전체 주소:', nomData.display_name);
    }
  } catch (e) {
    console.log('[naversearch] Nominatim 실패:', e.message);
  }

  if (!area) {
    console.log('[naversearch] 동 이름 없음, 일반 쿼리 사용');
  }

  // ─── 2. 병렬 검색 쿼리 구성 ─────────────────────────────────────────────
  // "동 음식점" 2페이지 + 카테고리별 각 1페이지 = 10+5 = 최대 55개 후보
  const FOOD_CATS = ['한식', '중식', '일식', '양식', '분식'];
  const naverHeaders = {
    'X-Naver-Client-Id': NAVER_CLIENT_ID,
    'X-Naver-Client-Secret': NAVER_CLIENT_SECRET,
  };

  const baseQuery = area ? `${area} 음식점` : '음식점';
  const searches = [
    naverSearch(baseQuery, 1, naverHeaders),
    naverSearch(baseQuery, 6, naverHeaders),
    naverSearch(baseQuery, 11, naverHeaders),
    naverSearch(baseQuery, 16, naverHeaders),
    ...FOOD_CATS.map((cat) =>
      naverSearch(area ? `${area} ${cat}` : cat, 1, naverHeaders)
    ),
  ];

  const results = await Promise.all(searches);
  const allItems = results.flat();

  console.log(`[naversearch] 쿼리: "${baseQuery}" | 수집 ${allItems.length}개`);

  // ─── 3. 중복 제거 + 거리 필터 + 정렬 ───────────────────────────────────
  const seen = new Set();
  const documents = [];

  for (const item of allItems) {
    const name = item.title.replace(/<[^>]+>/g, '');
    if (seen.has(name)) continue;
    seen.add(name);

    const placeLat = Number(item.mapy) / 1e7;
    const placeLng = Number(item.mapx) / 1e7;

    // 한국 좌표 유효성
    if (placeLat < 33 || placeLat > 39 || placeLng < 124 || placeLng > 132) continue;

    const distance = Math.round(haversine(userLat, userLng, placeLat, placeLng));
    if (distance > radius) continue;

    const categoryNorm = item.category
      ? `음식점 > ${item.category.replace(/>/g, ' > ')}`
      : '음식점';

    // description: 네이버 한줄 소개 (HTML 태그 제거)
    const description = item.description
      ? item.description.replace(/<[^>]+>/g, '').trim()
      : null;

    documents.push({
      id: `naver-${item.mapx}-${item.mapy}`,
      place_name: name,
      category_name: categoryNorm,
      distance: String(distance),
      road_address_name: item.roadAddress || '',
      address_name: item.address || '',
      phone: item.telephone || null,
      place_url: item.link || null,
      description: description || null,
      x: String(placeLng),
      y: String(placeLat),
    });
  }

  documents.sort((a, b) => parseInt(a.distance) - parseInt(b.distance));
  const top20 = documents.slice(0, maxResults);

  console.log(`[naversearch] 반경 ${radius}m 내 ${documents.length}개 → ${top20.length}개 반환`);

  return jsonRes({ documents: top20 });
}
