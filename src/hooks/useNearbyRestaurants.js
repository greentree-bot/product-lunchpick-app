import { useState, useCallback } from 'react';

/**
 * 현재 위치 기반 주변 음식점 검색 훅
 * - Geolocation으로 좌표 획득
 * - Cloudflare Pages Function(/api/kakaomap)을 프록시로 카카오맵 API 호출
 * - 이번 주 히스토리 메뉴 자동 필터링
 * - 결과를 메뉴 카드 형식으로 변환
 *
 * @param {Set<string>} weekMenuSet - useVotes에서 받은 이번 주 메뉴명 Set
 * @param {number} radius - 검색 반경(m), 기본 300
 */
export function useNearbyRestaurants(weekMenuSet = new Set(), radius = 300) {
  const [restaurants, setRestaurants] = useState([]);
  const [rawList, setRawList] = useState([]);
  const [location, setLocation] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // ─── 1. 브라우저 Geolocation ───────────────────────────────────────────────
  const getCurrentLocation = useCallback(() => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('이 브라우저는 위치 서비스를 지원하지 않습니다.'));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        (err) => {
          const messages = {
            1: '위치 접근 권한이 거부되었습니다.',
            2: '위치 정보를 가져올 수 없습니다.',
            3: '위치 요청 시간이 초과되었습니다.',
          };
          reject(new Error(messages[err.code] || err.message));
        },
        { enableHighAccuracy: true, timeout: 8000 }
      );
    });
  }, []);

  // ─── 2. 카카오 결과 → 메뉴 카드 변환 ────────────────────────────────────
  const toMenuCard = (place) => ({
    id: place.id,
    name: place.place_name,
    category: place.category_name?.split(' > ').pop() ?? '',
    distance: Number(place.distance),
    address: place.road_address_name || place.address_name,
    phone: place.phone || null,
    url: place.place_url,
    lat: Number(place.y),
    lng: Number(place.x),
  });

  // ─── 3. /api/kakaomap 호출 ────────────────────────────────────────────────
  const searchNearby = useCallback(async (coords) => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        lat: coords.lat,
        lng: coords.lng,
        radius,
      });
      const url = `/api/kakaomap?${params}`;
      console.log('[useNearbyRestaurants] fetch →', url);

      const res = await fetch(url);
      const data = await res.json();

      console.log('[useNearbyRestaurants] 응답 status:', res.status, 'data:', data);

      if (!res.ok) {
        const msg = data?.error || data?.msg || `서버 오류 (${res.status})`;
        console.error('[useNearbyRestaurants] 오류 응답:', data);
        throw new Error(msg);
      }

      const places = data.documents ?? [];
      console.log('[useNearbyRestaurants] 장소 수:', places.length);

      setRawList(places);

      const filtered = places
        .map(toMenuCard)
        .filter((card) => !weekMenuSet.has(card.name));

      console.log('[useNearbyRestaurants] 필터 후 장소 수:', filtered.length);
      setRestaurants(filtered);

    } catch (err) {
      console.error('[useNearbyRestaurants] catch:', err.message);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [radius, weekMenuSet]);

  // ─── 4. 위치 + 검색 통합 실행 ────────────────────────────────────────────
  const fetchNearby = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const coords = await getCurrentLocation();
      console.log('[useNearbyRestaurants] 위치:', coords);
      setLocation(coords);
      await searchNearby(coords);
    } catch (err) {
      console.error('[useNearbyRestaurants] 위치 오류:', err.message);
      setError(err.message);
      setLoading(false);
    }
  }, [getCurrentLocation, searchNearby]);

  // ─── 5. weekMenuSet 변경 시 필터 재적용 (API 재호출 없음) ─────────────────
  const refilter = useCallback(() => {
    if (!rawList.length) return;
    const filtered = rawList.map(toMenuCard).filter((card) => !weekMenuSet.has(card.name));
    setRestaurants(filtered);
  }, [rawList, weekMenuSet]);

  return {
    restaurants,
    location,
    loading,
    error,
    fetchNearby,
    searchNearby,
    refilter,
  };
}
