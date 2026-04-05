/**
 * Cloudflare Pages Function — 카카오맵 API 프록시
 * GET /api/kakaomap?lat=37.123&lng=127.456&radius=300
 *
 * 브라우저에서 카카오맵 REST API를 직접 호출하면
 * - KAKAO_MAP_KEY가 클라이언트에 노출됨
 * - 카카오 API의 Referer 제한에 걸릴 수 있음
 * 이 Worker가 서버 측에서 호출을 대신합니다.
 *
 * 환경변수: KAKAO_MAP_KEY (wrangler secret put KAKAO_MAP_KEY)
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',           // 프로덕션에서는 실제 도메인으로 좁히세요
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

/** KAKAO 카테고리: FD6 = 음식점 */
const KAKAO_CATEGORY = 'FD6';
const KAKAO_API_URL = 'https://dapi.kakao.com/v2/local/search/category.json';

export async function onRequestGet({ request, env }) {
  // ─── Preflight OPTIONS 처리 ───────────────────────────────────────────────
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  // ─── 쿼리 파라미터 파싱 ──────────────────────────────────────────────────
  const { searchParams } = new URL(request.url);
  const lat = searchParams.get('lat');
  const lng = searchParams.get('lng');
  const radius = searchParams.get('radius') ?? '300';

  if (!lat || !lng) {
    return jsonResponse({ error: 'lat, lng 파라미터가 필요합니다.' }, 400);
  }

  const latNum = parseFloat(lat);
  const lngNum = parseFloat(lng);
  const radiusNum = Math.min(parseInt(radius, 10), 20000); // 카카오 최대 20000m

  if (isNaN(latNum) || isNaN(lngNum) || isNaN(radiusNum)) {
    return jsonResponse({ error: 'lat, lng, radius는 숫자여야 합니다.' }, 400);
  }

  // ─── 환경변수 확인 ────────────────────────────────────────────────────────
  if (!env.KAKAO_MAP_KEY) {
    return jsonResponse({ error: 'KAKAO_MAP_KEY 환경변수가 설정되지 않았습니다.' }, 500);
  }

  // ─── 카카오맵 REST API 호출 ───────────────────────────────────────────────
  const kakaoParams = new URLSearchParams({
    category_group_code: KAKAO_CATEGORY,
    x: lngNum,   // 카카오는 경도(x), 위도(y) 순서
    y: latNum,
    radius: radiusNum,
    sort: 'distance',
    size: 15,    // 최대 15개 (카카오 API 최대값)
  });

  let kakaoRes;
  try {
    kakaoRes = await fetch(`${KAKAO_API_URL}?${kakaoParams}`, {
      headers: {
        Authorization: `KakaoAK ${env.KAKAO_MAP_KEY}`,
      },
    });
  } catch (err) {
    return jsonResponse({ error: '카카오맵 API 호출 실패: ' + err.message }, 502);
  }

  // ─── 카카오 응답 처리 ─────────────────────────────────────────────────────
  if (!kakaoRes.ok) {
    const body = await kakaoRes.text();
    return jsonResponse(
      { error: `카카오맵 API 오류 (${kakaoRes.status})`, detail: body },
      502
    );
  }

  const data = await kakaoRes.json();

  // ─── 클라이언트에 반환 ────────────────────────────────────────────────────
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      ...CORS_HEADERS,
    },
  });
}

/** OPTIONS preflight도 처리 */
export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

// ─── 헬퍼 ─────────────────────────────────────────────────────────────────
function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}
