/**
 * 네이버 지역 검색 API 프록시
 * GET /api/naversearch?lat={lat}&lng={lng}&radius={radius}
 *
 * 전략:
 *  1. Nominatim 역지오코딩 → 동(fine) + 구(broad) 동시 추출
 *  2. 구 레벨 검색(후보 많음) + 동 레벨 검색(정확도) 병렬 실행
 *  3. 1km 내 필터 → 부족 시 2km, 3km 자동 확장
 *  4. naverRank(리뷰 많은 순) 정렬 → 상위 20개 반환
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

  // ─── 1. Nominatim 역지오코딩 → 동(fine) + 구(broad) ────────────────────
  let areaFine = '';   // 동 레벨: 역삼동
  let areaBroad = '';  // 구 레벨: 강남구

  try {
    const nomRes = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=14&addressdetails=1`,
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

      // 행정동 번호 제거: 역삼1동 → 역삼동
      const stripNum = (s) => (s || '').replace(/^(.*\D)\d+(동)$/, '$1$2');

      // 동 레벨: 법정동(suburb) 우선, 없으면 행정동(quarter/neighbourhood)
      areaFine = stripNum(addr.suburb || addr.quarter || addr.neighbourhood || '');

      // 구 레벨: city_district (서울/부산 등) 또는 county (경기도 시군)
      areaBroad = addr.city_district || addr.county || addr.town || '';

      console.log('[naversearch] 역지오코딩 → 동:', areaFine, '| 구:', areaBroad, '| raw:', JSON.stringify(addr));
    }
  } catch (e) {
    console.log('[naversearch] Nominatim 실패:', e.message);
  }

  // ─── 2. 병렬 검색: 구 레벨(후보 많음) + 동 레벨(정확도) ─────────────────
  const FOOD_CATS = ['한식', '중식', '일식', '양식', '분식'];
  const naverHeaders = {
    'X-Naver-Client-Id': NAVER_CLIENT_ID,
    'X-Naver-Client-Secret': NAVER_CLIENT_SECRET,
  };

  const searches = [];

  // 구 레벨 검색: 4페이지 일반 + 5카테고리×2페이지 = 14 queries
  if (areaBroad) {
    [1, 6, 11, 16].forEach((s) => searches.push(naverSearch(`${areaBroad} 음식점`, s, naverHeaders)));
    FOOD_CATS.forEach((cat) => {
      searches.push(naverSearch(`${areaBroad} ${cat}`, 1, naverHeaders));
      searches.push(naverSearch(`${areaBroad} ${cat}`, 6, naverHeaders));
    });
  }

  // 동 레벨 검색: 2페이지 일반 + 5카테고리×1페이지 = 7 queries
  if (areaFine && areaFine !== areaBroad) {
    [1, 6].forEach((s) => searches.push(naverSearch(`${areaFine} 음식점`, s, naverHeaders)));
    FOOD_CATS.forEach((cat) => searches.push(naverSearch(`${areaFine} ${cat}`, 1, naverHeaders)));
  }

  // 둘 다 없으면 fallback
  if (searches.length === 0) {
    [1, 6, 11, 16].forEach((s) => searches.push(naverSearch('음식점', s, naverHeaders)));
  }

  const results = await Promise.all(searches);

  // ─── 3. 네이버 랭크 부여 (sort=comment 순서 = 리뷰 많은 순) ─────────────
  const rankedItems = [];
  let rank = 0;
  for (const pageItems of results) {
    for (const item of pageItems) {
      rankedItems.push({ item, rank: rank++ });
    }
  }

  console.log(`[naversearch] 구:"${areaBroad}" 동:"${areaFine}" | 수집 ${rankedItems.length}개`);

  // ─── 4. 중복 제거 + 거리 계산 → 전체 후보 목록 생성 ────────────────────
  const seen = new Set();
  const allDocs = [];

  for (const { item, rank: naverRank } of rankedItems) {
    const name = item.title.replace(/<[^>]+>/g, '');
    if (seen.has(name)) continue;
    seen.add(name);

    const placeLat = Number(item.mapy) / 1e7;
    const placeLng = Number(item.mapx) / 1e7;

    // 한국 영역 좌표 검증
    if (placeLat < 33 || placeLat > 39 || placeLng < 124 || placeLng > 132) continue;
    // 좌표 없는 항목 제외
    if (placeLat === 0 || placeLng === 0) continue;

    const distance = Math.round(haversine(userLat, userLng, placeLat, placeLng));

    const categoryNorm = item.category
      ? `음식점 > ${item.category.replace(/>/g, ' > ')}`
      : '음식점';

    const description = item.description
      ? item.description.replace(/<[^>]+>/g, '').trim()
      : null;

    const searchKeyword = item.roadAddress ? `${name} ${item.roadAddress}` : name;
    const naverUrl = `https://search.naver.com/search.naver?query=${encodeURIComponent(searchKeyword)}`;

    allDocs.push({
      id: `naver-${item.mapx}-${item.mapy}`,
      place_name: name,
      category_name: categoryNorm,
      distance,
      road_address_name: item.roadAddress || '',
      address_name: item.address || '',
      phone: item.telephone || null,
      place_url: naverUrl,
      description: description || null,
      x: String(placeLng),
      y: String(placeLat),
      naverRank,
    });
  }

  // ─── 5. 반경 내 필터 → 결과 없으면 5km로 확장 ───────────────────────────
  const EXPAND_STEPS = [radius, 5000];
  let documents = [];
  let usedRadius = radius;

  for (const r of EXPAND_STEPS) {
    documents = allDocs.filter((d) => d.distance <= r);
    usedRadius = r;
    if (documents.length > 0) break;
  }

  // naverRank(리뷰 많은 순) 정렬 → 1km 이내: 상위 20개, 5km 확장: 상위 10개
  documents.sort((a, b) => a.naverRank - b.naverRank);
  const returnCount = usedRadius > radius ? 10 : maxResults;
  const top20 = documents.slice(0, returnCount);

  // distance를 문자열로 변환 (기존 클라이언트 호환)
  const top20Str = top20.map((d) => ({ ...d, distance: String(d.distance) }));

  console.log(`[naversearch] 반경 ${usedRadius}m 내 ${documents.length}개 → ${top20Str.length}개 반환`);

  return jsonRes({ documents: top20Str });
}
