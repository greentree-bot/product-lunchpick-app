/**
 * Cloudflare Worker — 카카오톡 알림
 *
 * [HTTP] POST /api/notify
 *   Body: { to: string, message: string }
 *   수동으로 특정 수신자에게 메시지 전송
 *
 * [Cron] 매일 KST 11:50 (UTC 02:50), 월~금
 *   Supabase에서 모든 팀 목록 조회 후 점심 투표 알림 일괄 발송
 *
 * 필요 환경변수 (wrangler secret put):
 *   KAKAO_MSG_KEY      — 카카오 REST API 키
 *   SUPABASE_URL       — Supabase Project URL
 *   SUPABASE_SERVICE_KEY — Supabase service_role 키 (팀 목록 전체 조회용)
 *   APP_URL            — 앱 URL (메시지 링크용)
 */

const APP_URL = (env) => env.APP_URL || 'https://lunchpick.pages.dev';

// ─── 카카오톡 메시지 단건 전송 ────────────────────────────────────────────────
/**
 * @param {string} accessToken - 수신자의 카카오 OAuth 액세스 토큰
 * @param {string} message     - 전송할 텍스트
 * @param {string} appUrl      - 메시지에 포함할 링크
 */
async function sendKakaoMessage(accessToken, message, appUrl) {
  const res = await fetch(
    'https://kapi.kakao.com/v1/api/talk/memo/default/send',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        template_object: JSON.stringify({
          object_type: 'text',
          text: message,
          link: {
            web_url: appUrl,
            mobile_web_url: appUrl,
          },
          button_title: '지금 투표하기',
        }),
      }),
    }
  );
  return { ok: res.ok, status: res.status, body: await res.json() };
}

// ─── Supabase에서 팀 + 멤버 목록 조회 ────────────────────────────────────────
/**
 * service_role 키를 사용해 RLS를 우회하고 전체 팀 목록을 가져옵니다.
 * 각 팀의 멤버 kakao_access_token도 함께 조회합니다.
 *
 * @returns {Array<{ id, name, members: Array<{ name, kakao_access_token }> }>}
 */
async function fetchTeamsWithMembers(env) {
  const res = await fetch(
    `${env.SUPABASE_URL}/rest/v1/teams?select=id,name,members(name,kakao_access_token)`,
    {
      headers: {
        apikey: env.SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
      },
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase 팀 목록 조회 실패 (${res.status}): ${text}`);
  }

  return res.json();
}

// ─── Cron 핸들러 — 점심 투표 알림 일괄 발송 ──────────────────────────────────
async function handleScheduled(env) {
  const appUrl = APP_URL(env);
  const now = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
  console.log(`[Cron] 점심 알림 시작: ${now}`);

  // 1. 모든 팀 + 멤버 조회
  let teams;
  try {
    teams = await fetchTeamsWithMembers(env);
  } catch (err) {
    console.error('[Cron] 팀 목록 조회 실패:', err.message);
    return { error: err.message };
  }

  if (!teams.length) {
    console.log('[Cron] 등록된 팀 없음. 종료.');
    return { sent: 0 };
  }

  const results = [];

  // 2. 팀별 멤버에게 알림 발송
  for (const team of teams) {
    const members = team.members ?? [];
    const message =
      `🍽️ [${team.name}] 점심 메뉴 투표가 시작됐어요!\n` +
      `지금 바로 오늘 먹고 싶은 메뉴에 투표해주세요 😋\n\n` +
      `👉 ${appUrl}`;

    for (const member of members) {
      if (!member.kakao_access_token) {
        console.warn(`[Cron] ${team.name} / ${member.name}: kakao_access_token 없음, 건너뜀`);
        continue;
      }

      try {
        const result = await sendKakaoMessage(member.kakao_access_token, message, appUrl);
        console.log(
          `[Cron] ${team.name} / ${member.name}: ${result.ok ? '성공' : '실패'} (${result.status})`
        );
        results.push({ team: team.name, member: member.name, ...result });
      } catch (err) {
        console.error(`[Cron] ${team.name} / ${member.name} 전송 오류:`, err.message);
        results.push({ team: team.name, member: member.name, ok: false, error: err.message });
      }
    }
  }

  const sentCount = results.filter((r) => r.ok).length;
  console.log(`[Cron] 완료 — 성공 ${sentCount} / 전체 ${results.length}`);
  return { sent: sentCount, total: results.length, results };
}

// ─── HTTP 핸들러 — POST /api/notify ───────────────────────────────────────────
async function handleFetch(request, env) {
  if (request.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { to, message } = body;
  if (!to || !message) {
    return jsonRes({ error: '수신자(to)와 메시지(message)가 필요합니다.' }, 400);
  }

  const result = await sendKakaoMessage(to, message, APP_URL(env));

  if (!result.ok) {
    return jsonRes({ error: '카카오톡 전송 실패', detail: result.body }, 502);
  }

  return jsonRes({ success: true, result: result.body });
}

// ─── 헬퍼 ─────────────────────────────────────────────────────────────────────
function jsonRes(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

// ─── Worker 진입점 ─────────────────────────────────────────────────────────────
export default {
  // HTTP 요청 처리
  fetch: handleFetch,

  // Cron Trigger 처리 (wrangler.toml crons = ["50 2 * * 1-5"])
  async scheduled(event, env, ctx) {
    ctx.waitUntil(handleScheduled(env));
  },
};
