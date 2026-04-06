import { useState, useCallback } from 'react';

// ─── 모듈 레벨 상수/함수 (훅 외부) ───────────────────────────────────────────
// useCallback 의존성 배열에 추가할 필요 없음

const CATEGORY_KEYWORDS = {
  한식: ['한식', '국밥', '해장국', '삼겹살', '갈비', '불고기', '순대', '보쌈', '족발', '찜', '탕', '찌개', '설렁탕', '육류', '곱창', '막창', '백반', '냉면'],
  중식: ['중식', '중국식', '짜장', '짬뽕'],
  일식: ['일식', '초밥', '롤', '돈까스', '회,생선요리', '라멘', '우동', '소바', '덮밥', '일본식'],
  양식: ['양식', '스테이크', '파스타', '피자', '샌드위치', '햄버거', '패스트푸드', '브런치', '멕시칸', '인도음식'],
  분식: ['분식', '떡볶이', '라면', '김밥', '순대'],
};

function getMainCategory(fullCategory = '') {
  for (const [main, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some((kw) => fullCategory.includes(kw))) return main;
  }
  return '기타';
}

function toMenuCard(place) {
  const fullCategory = place.category_name ?? '';
  return {
    id: place.id,
    name: place.place_name,
    category: fullCategory.split(' > ').pop() ?? '',
    mainCategory: getMainCategory(fullCategory),
    distance: Number(place.distance),
    address: place.road_address_name || place.address_name,
    phone: place.phone || null,
    url: place.place_url,
    lat: Number(place.y),
    lng: Number(place.x),
  };
}

// ─── 훅 ──────────────────────────────────────────────────────────────────────

/**
 * 현재 위치 기반 주변 음식점 검색 훅
 * @param {Set<string>} weekMenuSet - useVotes에서 받은 이번 주 메뉴명 Set
 * @param {number} radius - 검색 반경(m), 기본 300
 */
export function useNearbyRestaurants(weekMenuSet = new Set(), radius = 1000) {
  const [restaurants, setRestaurants] = useState([]);
  const [rawList, setRawList] = useState([]);
  const [location, setLocation] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // ─── 1. 브라우저 Geolocation ─────────────────────────────────────────────
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

  // ─── 2. /api/kakaomap 호출 ──────────────────────────────────────────────
  const searchNearby = useCallback(async (coords) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ lat: coords.lat, lng: coords.lng, radius });
      const res = await fetch(`/api/naversearch?${params}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || data?.msg || `서버 오류 (${res.status})`);
      }

      const places = data.documents ?? [];
      setRawList(places);

      const filtered = places
        .map(toMenuCard)
        .filter((card) => !weekMenuSet.has(card.name));

      setRestaurants(filtered);

    } catch (err) {
      console.error('[useNearbyRestaurants]', err.message);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [radius, weekMenuSet]);

  // ─── 3. 위치 + 검색 통합 실행 ──────────────────────────────────────────
  const fetchNearby = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const coords = await getCurrentLocation();
      setLocation(coords);
      await searchNearby(coords);
    } catch (err) {
      console.error('[useNearbyRestaurants] 위치 오류:', err.message);
      setError(err.message);
      setLoading(false);
    }
  }, [getCurrentLocation, searchNearby]);

  // ─── 4. weekMenuSet 변경 시 필터 재적용 ────────────────────────────────
  const refilter = useCallback(() => {
    if (!rawList.length) return;
    const filtered = rawList.map(toMenuCard).filter((card) => !weekMenuSet.has(card.name));
    setRestaurants(filtered);
  }, [rawList, weekMenuSet]);

  return { restaurants, location, loading, error, fetchNearby, searchNearby, refilter };
}
