export async function onRequestGet(context) {
  const { searchParams } = new URL(context.request.url);
  const lat = searchParams.get('lat');
  const lng = searchParams.get('lng');
  const radius = searchParams.get('radius') || '300';

  const KAKAO_MAP_KEY = context.env.KAKAO_MAP_KEY;

  // 환경변수 미설정 확인
  if (!KAKAO_MAP_KEY) {
    return new Response(JSON.stringify({ error: 'KAKAO_MAP_KEY not set' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }

  // 필수 파라미터 확인
  if (!lat || !lng) {
    return new Response(JSON.stringify({ error: 'lat and lng are required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }

  const url = `https://dapi.kakao.com/v2/local/search/category.json?category_group_code=FD6&x=${lng}&y=${lat}&radius=${radius}&sort=distance`;

  let response;
  try {
    response = await fetch(url, {
      headers: { Authorization: `KakaoAK ${KAKAO_MAP_KEY}` },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'fetch failed', detail: err.message }), {
      status: 502,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }

  const data = await response.json();

  // 카카오 API 오류 응답 그대로 전달 (status 포함)
  return new Response(JSON.stringify(data), {
    status: response.status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
