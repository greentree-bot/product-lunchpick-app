/**
 * 네이버 지역 검색 API 프록시
 * GET /api/naversearch?lat={lat}&lng={lng}&radius={radius}
 *
 * 1. Kakao 역지오코딩으로 현재 위치 동 이름 추출
 * 2. 네이버 로컬 검색으로 "[동] 음식점" 검색 (3페이지 × 5개)
 * 3. mapx/mapy → WGS84 변환 후 거리 계산 → radius 내 필터링
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

export async function onRequestGet(context) {
  const { searchParams } = new URL(context.request.url);
  const lat = searchParams.get('lat');
  const lng = searchParams.get('lng');
  const radius = parseInt(searchParams.get('radius') || '1000', 10);

  const NAVER_CLIENT_ID = context.env.NAVER_CLIENT_ID;
  const NAVER_CLIENT_SECRET = context.env.NAVER_CLIENT_SECRET;
  const KAKAO_MAP_KEY = context.env.KAKAO_MAP_KEY;

  if (!NAVER_CLIENT_ID || !NAVER_CLIENT_SECRET) {
    return jsonRes({ error: 'NAVER_CLIENT_ID 또는 NAVER_CLIENT_SECRET이 설정되지 않았습니다.' }, 500);
  }
  if (!lat || !lng) {
    return jsonRes({ error: 'lat, lng 파라미터가 필요합니다.' }, 400);
  }

  const userLat = parseFloat(lat);
  const userLng = parseFloat(lng);

  // ─── 1. 역지오코딩으로 동 이름 추출 (Kakao) ─────────────────────────────
  let searchQuery = '음식점';
  if (KAKAO_MAP_KEY) {
    try {
      const geoRes = await fetch(
        `https://dapi.kakao.com/v2/local/geo/coord2regioncode.json?x=${lng}&y=${lat}`,
        { headers: { Authorization: `KakaoAK ${KAKAO_MAP_KEY}` } }
      );
      if (geoRes.ok) {
        const geoData = await geoRes.json();
        const region = geoData.documents?.[0];
        const dong =
          region?.region_3depth_name ||
          region?.region_2depth_name ||
          region?.region_1depth_name;
        if (dong) searchQuery = `${dong} 음식점`;
      }
    } catch {
      // 역지오코딩 실패 시 기본 쿼리 사용
    }
  }

  // ─── 2. 네이버 지역 검색 (3페이지 병렬) ─────────────────────────────────
  const naverHeaders = {
    'X-Naver-Client-Id': NAVER_CLIENT_ID,
    'X-Naver-Client-Secret': NAVER_CLIENT_SECRET,
  };

  let pages;
  try {
    pages = await Promise.all(
      [1, 6, 11].map((start) =>
        fetch(
          `https://openapi.naver.com/v1/search/local.json` +
            `?query=${encodeURIComponent(searchQuery)}&display=5&start=${start}&sort=comment`,
          { headers: naverHeaders }
        )
          .then((r) => (r.ok ? r.json() : { items: [] }))
          .catch(() => ({ items: [] }))
      )
    );
  } catch (err) {
    return jsonRes({ error: err.message }, 500);
  }

  // ─── 3. 좌표 변환 + 거리 필터링 + 정렬 ─────────────────────────────────
  const seen = new Set();
  const documents = [];

  for (const page of pages) {
    for (const item of page.items ?? []) {
      // HTML 태그 제거
      const name = item.title.replace(/<[^>]+>/g, '');
      if (seen.has(name)) continue;
      seen.add(name);

      // Naver mapx/mapy: WGS84 × 1e7
      const placeLat = item.mapy / 1e7;
      const placeLng = item.mapx / 1e7;

      const distance = Math.round(haversine(userLat, userLng, placeLat, placeLng));
      if (distance > radius) continue;

      // 카테고리 정규화: "한식>순대국" → "음식점 > 한식 > 순대국"
      const categoryNorm = item.category
        ? `음식점 > ${item.category.replace(/>/g, ' > ')}`
        : '음식점';

      documents.push({
        id: `naver-${item.mapx}-${item.mapy}`,
        place_name: name,
        category_name: categoryNorm,
        distance: String(distance),
        road_address_name: item.roadAddress,
        address_name: item.address,
        phone: item.telephone || null,
        place_url: item.link || null,
        x: String(placeLng),
        y: String(placeLat),
      });
    }
  }

  // 거리 오름차순 정렬
  documents.sort((a, b) => parseInt(a.distance) - parseInt(b.distance));

  return jsonRes({ documents });
}
