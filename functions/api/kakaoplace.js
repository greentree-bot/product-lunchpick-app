/**
 * 카카오 장소 상세 정보 프록시 (별점 조회용)
 * GET /api/kakaoplace?id={place_id}
 * 반환: { starScore, reviewCount }
 */
export async function onRequestGet(context) {
  const { searchParams } = new URL(context.request.url);
  const id = searchParams.get('id');
  const KAKAO_MAP_KEY = context.env.KAKAO_MAP_KEY;

  if (!id) {
    return json({ error: 'id required' }, 400);
  }

  try {
    const res = await fetch(`https://place.map.kakao.com/main/v/${id}`, {
      headers: {
        Authorization: `KakaoAK ${KAKAO_MAP_KEY}`,
        Referer: 'https://map.kakao.com/',
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15',
      },
    });

    if (!res.ok) return json({ error: `upstream ${res.status}` }, 502);

    const data = await res.json();

    return json({
      starScore: data.basicInfo?.starScore ?? null,
      reviewCount: data.basicInfo?.wpointcount ?? 0,
    }, 200);
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}

function json(data, status) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  });
}
