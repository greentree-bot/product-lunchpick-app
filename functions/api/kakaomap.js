export async function onRequestGet(context) {
  const { searchParams } = new URL(context.request.url);
  const lat = searchParams.get('lat');
  const lng = searchParams.get('lng');
  const radius = searchParams.get('radius') || '300';

  const KAKAO_MAP_KEY = context.env.KAKAO_MAP_KEY;

  const url = `https://dapi.kakao.com/v2/local/search/category.json?category_group_code=FD6&x=${lng}&y=${lat}&radius=${radius}&sort=distance`;

  const response = await fetch(url, {
    headers: {
      Authorization: `KakaoAK ${KAKAO_MAP_KEY}`,
    },
  });

  const data = await response.json();

  return new Response(JSON.stringify(data), {
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
