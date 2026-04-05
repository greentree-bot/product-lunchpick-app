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
  const [restaurants, setRestaurants] = useState([]); // 필터링 후 메뉴 카드 목록
  const [rawList, setRawList] = useState([]);          // 카카오 원본 결과
  const [location, setLocation] = useState(null);      // { lat, lng }
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
        (pos) => {
          const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          resolve(coords);
        },
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

  // ─── 2. 카카오 결과 → 메뉴 카드 형식 변환 ────────────────────────────────
  /**
   * 카카오맵 장소 객체를 앱에서 사용할 카드 형식으로 변환
   * @param {object} place - 카카오맵 API 장소 객체
   */
  const toMenuCard = (place) => ({
    id: place.id,
    name: place.place_name,
    category: place.category_name.split(' > ').pop(), // "음식점 > 한식 > 찌개" → "찌개"
    distance: Number(place.distance),                 // 단위: m
    address: place.road_address_name || place.address_name,
    phone: place.phone || null,
    url: place.place_url,
    lat: Number(place.y),
    lng: Number(place.x),
  });

  // ─── 3. 검색 실행 ─────────────────────────────────────────────────────────
  const searchNearby = useCallback(async (coords) => {
    setLoading(true);
    setError(null);

    try {
      // Cloudflare Pages Function 프록시를 통해 카카오맵 API 호출
      // (브라우저에서 직접 호출 시 KAKAO_MAP_KEY가 노출되므로 서버 경유)
      const params = new URLSearchParams({
        lat: coords.lat,
        lng: coords.lng,
        radius,
      });
      const res = await fetch(`/api/kakaomap?${params}`);

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `서버 오류 (${res.status})`);
      }

      const data = await res.json();
      const places = data.documents ?? [];

      setRawList(places);

      // ─── 4. 이번 주 히스토리 메뉴 필터링 ───────────────────────────────
      const filtered = places
        .map(toMenuCard)
        .filter((card) => !weekMenuSet.has(card.name));

      setRestaurants(filtered);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [radius, weekMenuSet]);

  // ─── 5. 위치 가져오기 + 검색 통합 실행 ───────────────────────────────────
  const fetchNearby = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const coords = await getCurrentLocation();
      setLocation(coords);
      await searchNearby(coords);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  }, [getCurrentLocation, searchNearby]);

  // ─── 6. 좌표가 이미 있을 때 재검색 (weekMenuSet 변경 시 필터 재적용) ───────
  const refilter = useCallback(() => {
    if (!rawList.length) return;
    const filtered = rawList
      .map(toMenuCard)
      .filter((card) => !weekMenuSet.has(card.name));
    setRestaurants(filtered);
  }, [rawList, weekMenuSet]);

  return {
    restaurants,   // 필터링된 메뉴 카드 배열
    location,      // { lat, lng } 현재 위치
    loading,
    error,
    fetchNearby,   // 위치 획득 + 검색 통합 실행
    searchNearby,  // 이미 좌표가 있을 때 재검색
    refilter,      // weekMenuSet만 바뀌었을 때 필터 재적용 (API 재호출 없음)
  };
}
