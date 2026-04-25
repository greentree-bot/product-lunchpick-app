import { useState, useCallback } from 'react';

// ─── 모듈 레벨 상수/함수 ─────────────────────────────────────────────────────

const SESSION_RESTAURANTS = 'lunchpick_restaurants';
const SESSION_RAWLIST = 'lunchpick_rawlist';

const CATEGORY_KEYWORDS = {
  한식: ['한식', '국밥', '해장국', '삼겹살', '갈비', '불고기', '순대', '보쌈', '족발', '찜', '탕', '찌개', '설렁탕', '육류', '곱창', '막창', '백반', '냉면'],
  중식: ['중식', '중국식', '짜장', '짬뽕'],
  일식: ['일식', '초밥', '롤', '돈까스', '회,생선요리', '라멘', '우동', '소바', '덮밥', '일본식'],
  양식: ['양식', '스테이크', '파스타', '피자', '샌드위치', '햄버거', '패스트푸드', '브런치', '멕시칸', '인도음식'],
  분식: ['분식', '떡볶이', '라면', '김밥', '순대'],
};

// 카테고리 목록을 export (Vote.jsx에서 필터 칩 UI에 사용)
export const CATEGORIES = ['전체', ...Object.keys(CATEGORY_KEYWORDS)];

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
    description: place.description || null,
    lat: Number(place.y),
    lng: Number(place.x),
  };
}

function loadSession(key) {
  try { return JSON.parse(sessionStorage.getItem(key) || '[]'); }
  catch { return []; }
}

function saveSession(key, data) {
  try { sessionStorage.setItem(key, JSON.stringify(data)); } catch {}
}

// ─── 훅 ──────────────────────────────────────────────────────────────────────

export function useNearbyRestaurants(weekMenuSet = new Set(), radius = 1000, provider = 'naver') {
  const [restaurants, setRestaurants] = useState(() => loadSession(SESSION_RESTAURANTS));
  const [rawList, setRawList] = useState(() => loadSession(SESSION_RAWLIST));
  const [location, setLocation] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState('전체');

  const saveRestaurants = useCallback((list) => {
    setRestaurants(list);
    saveSession(SESSION_RESTAURANTS, list);
  }, []);

  const saveRawList = useCallback((list) => {
    setRawList(list);
    saveSession(SESSION_RAWLIST, list);
  }, []);

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
            1: '위치 접근 권한이 거부되었습니다. 브라우저 설정에서 위치 권한을 허용해 주세요.',
            2: '위치 정보를 가져올 수 없습니다. 인터넷 연결을 확인해 주세요.',
            3: '위치 요청 시간이 초과되었습니다. 다시 시도해 주세요.',
          };
          reject(new Error(messages[err.code] || err.message));
        },
        { enableHighAccuracy: true, timeout: 8000 }
      );
    });
  }, []);

  // ─── 2. /api/naversearch 호출 ────────────────────────────────────────────
  const searchNearby = useCallback(async (coords) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ lat: coords.lat, lng: coords.lng, radius });

      // 로컬 개발 환경에서는 Cloudflare Workers가 없으므로 배포된 URL로 우회
      const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      const baseUrl = isLocal ? 'https://lunchpick.pages.dev' : '';
      const endpoint = provider === 'kakao' ? 'kakaosearch' : 'naversearch';
      const res = await fetch(`${baseUrl}/api/${endpoint}?${params}`);

      // 응답이 HTML인 경우 (서버가 index.html을 반환하는 경우) 방어
      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        throw new Error('식당 검색 서버에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.');
      }

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || data?.msg || `서버 오류 (${res.status})`);
      }

      const places = data.documents ?? [];
      saveRawList(places);

      if (places.length === 0) {
        setError('주변 식당을 찾지 못했습니다. 위치 권한을 확인해 주세요.');
      }

      const filtered = places
        .map(toMenuCard)
        .filter((card) => !weekMenuSet.has(card.name));

      saveRestaurants(filtered);

    } catch (err) {
      console.error('[useNearbyRestaurants]', err.message);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [radius, weekMenuSet, saveRawList, saveRestaurants, provider]);

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
    saveRestaurants(filtered);
  }, [rawList, weekMenuSet, saveRestaurants]);

  // ─── 5. 카테고리 필터 적용 ─────────────────────────────────────────────
  const filteredRestaurants = selectedCategory === '전체'
    ? restaurants
    : restaurants.filter((r) => r.mainCategory === selectedCategory);

  const filterByCategory = useCallback((category) => {
    setSelectedCategory(category);
  }, []);

  return {
    restaurants: filteredRestaurants,
    allRestaurants: restaurants,
    location,
    loading,
    error,
    fetchNearby,
    searchNearby,
    refilter,
    selectedCategory,
    filterByCategory,
  };
}
