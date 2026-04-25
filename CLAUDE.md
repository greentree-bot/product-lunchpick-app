# 🍱 LunchPick — CLAUDE.md

## 프로젝트 개요
- **서비스명:** 런치픽 (LunchPick)
- **목적:** 직장인 팀이 함께 점심 메뉴를 결정하는 소셜 투표 앱 (솔로 모드 지원)
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
| 식당 검색 | 네이버 지역검색 API (Nominatim 역지오코딩 + Naver Local Search) |
| 버전관리 | GitHub |

---

## 프로젝트 구조
```
lunchpick/
├── public/
├── src/
│   ├── App.js              ← 라우팅 (Home, Join, Vote)
│   ├── pages/
│   │   ├── Home.jsx         ← 메인 (팀 만들기/참여/솔로)
│   │   ├── Join.jsx         ← 초대코드 참여
│   │   └── Vote.jsx         ← 투표 화면 (상태 머신: vote→waiting→result)
│   ├── components/
│   │   ├── VoteCard.jsx      ← 틴더 카드 UI (되돌리기 포함)
│   │   ├── WaitingScreen.jsx ← 팀원 대기 화면
│   │   ├── ResultScreen.jsx  ← 투표 결과 화면
│   │   └── HistoryScreen.jsx ← 먹은 메뉴 히스토리
│   ├── hooks/
│   │   ├── useVotes.js          ← 투표 상태 관리 + Realtime
│   │   ├── useNearbyRestaurants.js  ← 네이버 맛집 검색 + 카테고리 필터
│   │   ├── useTeam.js           ← 팀 생성/참여
│   │   └── useTeamSettings.js   ← 팀 설정 (마감시간, 최소인원)
│   └── lib/
│       ├── supabase.js      ← Supabase 클라이언트
│       └── storage.js       ← localStorage 관리 (솔로모드 포함)
├── functions/              ← Cloudflare Workers
│   └── api/
│       ├── naversearch.js   ← 네이버 지역검색 프록시
│       └── notify.js        ← 카카오톡 알림 Worker
├── .env                    ← 로컬 환경변수 (git 제외)
└── .env.example
```

---

## 주요 기능
- **솔로 모드:** 팀 없이 혼자서 주변 식당 중 점심 선택
- **팀 투표:** 팀 생성 → 초대 → 스와이프 투표 → 결과 집계
- **카테고리 필터:** 한식/중식/일식/양식/분식 필터로 원하는 종류만 투표
- **투표 되돌리기:** 실수로 누른 투표를 이전으로 되돌리기
- **히스토리:** 최근 30일간 먹은 메뉴 기록 조회
- **실시간 동기화:** Supabase Realtime으로 팀원 투표 현황 실시간 반영

---

## 환경변수
### 로컬 (.env)
```
REACT_APP_SUPABASE_URL=https://iorpbcjnjcvqkocujjib.supabase.co
REACT_APP_SUPABASE_ANON_KEY=...
```
### Cloudflare Pages (Settings → Variables and Secrets)
```
NAVER_CLIENT_ID=...
NAVER_CLIENT_SECRET=...
```

---

## Supabase 테이블 구조
```sql
teams     -- 팀 정보 (invite_code, vote_deadline, min_voters)
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
- [x] 네이버 검색 API 연동
- [x] Supabase Realtime 투표 기능
- [x] 솔로 모드
- [x] 카테고리 필터
- [x] 투표 되돌리기
- [x] 히스토리 탭
- [x] 다크 모드 통일 UI
- [ ] Supabase RLS 보안 정책 적용

---

## 코딩 컨벤션
- 컴포넌트명: PascalCase
- 훅: use + 기능명 (예: useVotes)
- Supabase 쿼리: hooks 폴더에서만 호출
- 환경변수: REACT_APP_ 접두어 (브라우저 노출용)
- Cloudflare Workers용 변수: REACT_APP_ 없이 사용
- 스타일: CSS 변수(--bg-base 등) 기반 다크 테마

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
- Supabase 무료 플랜: 프로젝트 2개, 500MB DB, 2GB 스토리지
