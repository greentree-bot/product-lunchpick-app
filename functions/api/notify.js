/**
 * Cloudflare Worker - 카카오톡 알림 전송
 * POST /api/notify
 * Body: { to: string, message: string }
 */
export default {
  async fetch(request, env) {
    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return new Response('Invalid JSON', { status: 400 });
    }

    const { to, message } = body;
    if (!to || !message) {
      return new Response(JSON.stringify({ error: '수신자(to)와 메시지(message)가 필요합니다.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    try {
      // 카카오톡 메시지 전송 API 호출
      const kakaoResponse = await fetch('https://kapi.kakao.com/v1/api/talk/friends/message/default/send', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.KAKAO_ACCESS_TOKEN}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          receiver_uuids: JSON.stringify([to]),
          template_object: JSON.stringify({
            object_type: 'text',
            text: message,
            link: {
              web_url: env.APP_URL || 'https://lunchpick.pages.dev',
              mobile_web_url: env.APP_URL || 'https://lunchpick.pages.dev',
            },
          }),
        }),
      });

      const result = await kakaoResponse.json();

      if (!kakaoResponse.ok) {
        return new Response(JSON.stringify({ error: '카카오톡 전송 실패', detail: result }), {
          status: 502,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ success: true, result }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  },
};
