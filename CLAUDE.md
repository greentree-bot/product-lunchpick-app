# 🍱 LunchPick — CLAUDE.md

## 프로젝트 개요
- **서비스명:** 런치픽 (LunchPick)
- **목적:** 직장인 팀이 함께 점심 메뉴를 결정하는 소셜 투표 앱
- **배포 URL:** https://lunchpick.pages.dev
- **앱 카테고리:** 소셜네트워킹 (주) / 식음료 (부)

---

## 기술 스택
| 구분 | 기술 |
|------|------|
| 프론트엔드 | React (Create React App) |
| 백엔드/DB | Supabase (PostgreSQL + Realtime) |
| 배포 | Cloudflare Pages |
| 서버리스 | Cloudflare Workers (functions/) |
| 지도/검색 | 카카오맵 API (JavaScript 키 + REST API 키) |
| 버전관리 | GitHub |

---

## 프로젝트 구조
```
lunchpick/
├── public/
├── src/
│   ├── App.js              ← 메인 컴포넌트 (LunchPick)
│   ├── lib/
│   │   └── supabase.js     ← Supabase 클라이언트
│   └── hooks/
│       ├── useVotes.js         ← 투표 상태 관리
│       └── useNearbyRestaurants.js  ← 카카오 맛집 검색
├── functions/              ← Cloudflare Workers
│   └── api/
│       └── notify.js       ← 카카오톡 알림 Worker
├── .env                    ← 로컬 환경변수 (git 제외)
├── .env.example
└── wrangler.toml           ← Cloudflare 설정
```

---

## 환경변수
### 로컬 (.env)
```
REACT_APP_SUPABASE_URL=https://iorpbcjnjcvqkocujjib.supabase.co
REACT_APP_SUPABASE_ANON_KEY=...
REACT_APP_KAKAO_MAP_KEY=...   # JavaScript 키
KAKAO_MAP_KEY=...              # REST API 키
```
### Cloudflare Pages (Settings → Variables and Secrets)
위 4개 동일하게 등록됨 ✅

---

## Supabase 테이블 구조
```sql
teams     -- 팀 정보 (invite_code 포함)
members   -- 팀원 목록
votes     -- 투표 기록 (action: 'ok' | 'pass')
history   -- 먹은 메뉴 기록
```
- votes, members 테이블에 REPLICA IDENTITY FULL 설정 (Realtime용)

---

## 현재 상태 (2026-04 기준)
- [x] MVP 코드 완성
- [x] GitHub 연결
- [x] Cloudflare Pages 배포
- [x] Supabase 환경변수 등록
- [x] 카카오맵 키 등록
- [ ] **Supabase 투표 기능 완성** ← 다음 작업
- [ ] **UI 개선** ← 다음 작업

---

## 다음 작업 우선순위
1. Supabase Realtime 투표 기능 완성
   - 팀원 전원이 투표하면 자동으로 결과 집계
   - 과반수 'ok' 메뉴 자동 선정
2. UI/UX 개선
   - 모바일 최적화 (점심시간 스마트폰 사용 고려)
   - 투표 애니메이션 추가
   - 결과 화면 개선

---

## 코딩 컨벤션
- 컴포넌트명: PascalCase
- 훅: use + 기능명 (예: useVotes)
- Supabase 쿼리: hooks 폴더에서만 호출
- 환경변수: REACT_APP_ 접두어 (브라우저 노출용)
- Cloudflare Workers용 변수: REACT_APP_ 없이 사용

---

## 배포 프로세스
```bash
# 로컬 테스트
npm start

# 배포 (GitHub push → Cloudflare 자동 빌드)
git add .
git commit -m "feat: 기능명"
git push origin main
# → Cloudflare Pages 자동 빌드 (약 2~3분)
```

---

## 주요 참고 사항
- PowerShell에서 curl 명령어 사용 불가 → Git Bash 사용
- Cloudflare Pages 빌드 후 강제 새로고침 필요 (Ctrl+Shift+R)
- 카카오 개발자 콘솔에서 도메인 등록 필수 (lunchpick.pages.dev)
- Supabase 무료 플랜: 프로젝트 2개, 500MB DB, 2GB 스토리지
