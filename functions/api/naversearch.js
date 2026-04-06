/**
 * 네이버 지역 검색 API 프록시
 * GET /api/naversearch?lat={lat}&lng={lng}&radius={radius}
 *
 * 1. OpenStreetMap Nominatim으로 현재 위치 동 이름 추출 (키 불필요)
 * 2. 네이버 로컬 검색으로 "[동] 음식점" 검색
 * 3. mapx/mapy(WGS84 × 1e7) → 거리 계산 → radius 내 필터링
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

  if (!NAVER_CLIENT_ID || !NAVER_CLIENT_SECRET) {
    return jsonRes({ error: 'NAVER_CLIENT_ID 또는 NAVER_CLIENT_SECRET이 설정되지 않았습니다.' }, 500);
  }
  if (!lat || !lng) {
    return jsonRes({ error: 'lat, lng 파라미터가 필요합니다.' }, 400);
  }

  const userLat = parseFloat(lat);
  const userLng = parseFloat(lng);

  // ─── 1. Nominatim 역지오코딩으로 동 이름 추출 (무료, 키 불필요) ────────────
  let searchQuery = '음식점';
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
      // 동 > 구 > 도시 순으로 가장 세밀한 지역명 사용
      const area =
        addr.quarter ||
        addr.neighbourhood ||
        addr.suburb ||
        addr.city_district ||
        addr.county ||
        addr.city;
      if (area) {
        searchQuery = `${area} 음식점`;
        console.log('[naversearch] 역지오코딩 성공:', searchQuery);
      } else {
        console.log('[naversearch] 역지오코딩 결과 없음, 기본 쿼리 사용');
      }
    }
  } catch (e) {
    console.log('[naversearch] 역지오코딩 실패:', e.message);
  }

  // ─── 2. 네이버 지역 검색 (3페이지 병렬, 최대 15개) ───────────────────────
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
          .then(async (r) => {
            if (!r.ok) {
              const errText = await r.text();
              console.log(`[naversearch] 네이버 API 오류 ${r.status}:`, errText);
              return { items: [] };
            }
            return r.json();
          })
          .catch((e) => {
            console.log('[naversearch] 네이버 fetch 실패:', e.message);
            return { items: [] };
          })
      )
    );
  } catch (err) {
    return jsonRes({ error: `네이버 API 호출 실패: ${err.message}` }, 500);
  }

  // ─── 3. 좌표 변환 + 거리 필터링 + 정렬 ─────────────────────────────────
  const seen = new Set();
  const documents = [];
  let totalItems = 0;

  for (const page of pages) {
    for (const item of page.items ?? []) {
      totalItems++;
      const name = item.title.replace(/<[^>]+>/g, '');
      if (seen.has(name)) continue;
      seen.add(name);

      // Naver mapx/mapy: WGS84 × 1e7 (문자열로 반환됨)
      const placeLat = Number(item.mapy) / 1e7;
      const placeLng = Number(item.mapx) / 1e7;

      // 한국 좌표 유효성 검사
      if (placeLat < 33 || placeLat > 39 || placeLng < 124 || placeLng > 132) {
        console.log('[naversearch] 유효하지 않은 좌표 무시:', name, placeLat, placeLng);
        continue;
      }

      const distance = Math.round(haversine(userLat, userLng, placeLat, placeLng));

      if (distance > radius) continue;

      const categoryNorm = item.category
        ? `음식점 > ${item.category.replace(/>/g, ' > ')}`
        : '음식점';

      documents.push({
        id: `naver-${item.mapx}-${item.mapy}`,
        place_name: name,
        category_name: categoryNorm,
        distance: String(distance),
        road_address_name: item.roadAddress || '',
        address_name: item.address || '',
        phone: item.telephone || null,
        place_url: item.link || null,
        x: String(placeLng),
        y: String(placeLat),
      });
    }
  }

  console.log(
    `[naversearch] 쿼리: "${searchQuery}" | 전체 ${totalItems}개 → 반경 ${radius}m 내 ${documents.length}개`
  );

  documents.sort((a, b) => parseInt(a.distance) - parseInt(b.distance));

  return jsonRes({ documents, debug: { query: searchQuery, total: totalItems, inRadius: documents.length } });
}
