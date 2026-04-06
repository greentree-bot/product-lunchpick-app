export async function onRequestGet(context) {
  const { searchParams } = new URL(context.request.url);
  const lat = searchParams.get('lat');
  const lng = searchParams.get('lng');
  const radius = searchParams.get('radius') || '1000';

  const KAKAO_MAP_KEY = context.env.KAKAO_MAP_KEY;

  if (!KAKAO_MAP_KEY) {
    return new Response(JSON.stringify({ error: 'KAKAO_MAP_KEY not set' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }

  if (!lat || !lng) {
    return new Response(JSON.stringify({ error: 'lat and lng are required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }

  const baseUrl = `https://dapi.kakao.com/v2/local/search/category.json`
    + `?category_group_code=FD6&x=${lng}&y=${lat}&radius=${radius}&sort=distance&size=15`;

  try {
    // 페이지 1~3 병렬 호출 → 최대 45개 결과
    const pages = await Promise.all(
      [1, 2, 3].map((page) =>
        fetch(`${baseUrl}&page=${page}`, {
          headers: { Authorization: `KakaoAK ${KAKAO_MAP_KEY}` },
        }).then((r) => r.json()).catch(() => ({ documents: [] }))
      )
    );

    // 중복 id 제거 후 병합
    const seen = new Set();
    const documents = [];
    for (const page of pages) {
      for (const doc of page.documents ?? []) {
        if (!seen.has(doc.id)) {
          seen.add(doc.id);
          documents.push(doc);
        }
      }
    }

    return new Response(JSON.stringify({ documents }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'fetch failed', detail: err.message }), {
      status: 502,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }
}
