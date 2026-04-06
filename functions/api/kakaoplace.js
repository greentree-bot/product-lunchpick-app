/**
 * 카카오 장소 상세 정보 프록시
 * GET /api/kakaoplace?id={place_id}
 * 반환: { starScore, reviewCount, menus: [{name, price}] }
 */
export async function onRequestGet(context) {
  const { searchParams } = new URL(context.request.url);
  const id = searchParams.get('id');

  if (!id) {
    return json({ error: 'id required' }, 400);
  }

  try {
    const res = await fetch(`https://place.map.kakao.com/m/main/v/${id}`, {
      headers: {
        'Referer': 'https://map.kakao.com/',
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15',
        'Accept': 'application/json',
      },
    });

    if (!res.ok) return json({ error: `upstream ${res.status}` }, 502);

    const data = await res.json();

    const result = {
      starScore: data.basicInfo?.starScore ?? null,
      reviewCount: data.basicInfo?.wpointcount ?? 0,
      menus: (data.menuInfo?.menuList ?? [])
        .slice(0, 3)
        .map((m) => ({ name: m.menu, price: m.price ?? null })),
    };

    return json(result, 200);
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}

function json(data, status) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
