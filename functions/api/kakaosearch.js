/**
 * 카카오 로컬 API 프록시
 * GET /api/kakaosearch?lat={lat}&lng={lng}&radius={radius}
 *
 * 카카오 카테고리 검색(FD6: 음식점) 3페이지 × 15개 수집 후 상위 20개 반환
 * 응답 형식은 naversearch.js와 동일(documents 배열) — toMenuCard 호환
 */

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
  const radius = Math.min(parseInt(searchParams.get('radius') || '5000', 10), 20000);

  const KAKAO_REST_API_KEY = context.env.KAKAO_REST_API_KEY;

  if (!KAKAO_REST_API_KEY) {
    return jsonRes({ error: 'KAKAO_REST_API_KEY가 설정되지 않았습니다.' }, 500);
  }
  if (!lat || !lng) {
    return jsonRes({ error: 'lat, lng 파라미터가 필요합니다.' }, 400);
  }

  const headers = { Authorization: `KakaoAK ${KAKAO_REST_API_KEY}` };

  // 3페이지 × 15개 = 최대 45개 수집
  const pages = await Promise.all(
    [1, 2, 3].map((page) =>
      fetch(
        `https://dapi.kakao.com/v2/local/search/category.json` +
          `?category_group_code=FD6&x=${lng}&y=${lat}&radius=${radius}&size=15&page=${page}&sort=distance`,
        { headers }
      )
        .then((r) => (r.ok ? r.json() : { documents: [] }))
        .then((data) => data.documents ?? [])
        .catch(() => [])
    )
  );

  const seen = new Set();
  const documents = [];
  for (const page of pages) {
    for (const doc of page) {
      if (!seen.has(doc.id)) {
        seen.add(doc.id);
        // distance는 카카오가 이미 문자열(미터)로 반환 — toMenuCard 호환
        documents.push(doc);
      }
    }
  }

  console.log(`[kakaosearch] 반경 ${radius}m | ${documents.length}개 수집 → ${Math.min(documents.length, 20)}개 반환`);

  return jsonRes({ documents: documents.slice(0, 20) });
}
