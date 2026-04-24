import { useEffect, useRef, useState } from "react";
import confetti from "canvas-confetti";
import { supabase } from "../lib/supabase";

/**
 * ResultScreen
 *
 * Props:
 *   teamId      string           — 현재 투표방 ID (null이면 솔로 모드)
 *   results     Array<{          — 집계된 메뉴별 결과
 *     name: string,
 *     ok:   number,
 *     pass: number,
 *   }>
 *   onRestart   () => void       — "다시 투표하기" 콜백
 *   isSolo      boolean          — 솔로 모드 여부
 */
export default function ResultScreen({ teamId, results = [], onRestart, isSolo = false }) {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const confettiFired = useRef(false);

  /* 득표수(ok) 내림차순 정렬 */
  const sorted = [...results].sort((a, b) => b.ok - a.ok || a.pass - b.pass);
  const winner = sorted[0];
  const runners = sorted.slice(1);

  /* confetti — 최초 진입 1회만 */
  useEffect(() => {
    if (confettiFired.current) return;
    confettiFired.current = true;

    const duration = 3000;
    const end = Date.now() + duration;

    const frame = () => {
      confetti({
        particleCount: 6,
        angle: 60,
        spread: 55,
        origin: { x: 0, y: 0.7 },
        colors: ["#f97316", "#facc15", "#22c55e", "#3b82f6", "#ec4899"],
      });
      confetti({
        particleCount: 6,
        angle: 120,
        spread: 55,
        origin: { x: 1, y: 0.7 },
        colors: ["#f97316", "#facc15", "#22c55e", "#3b82f6", "#ec4899"],
      });
      if (Date.now() < end) requestAnimationFrame(frame);
    };

    frame();
  }, []);

  /* history 테이블에 저장 */
  const handleSave = async () => {
    if (!winner || saving || saved) return;

    // 솔로 모드에서는 DB 저장 없이 성공 표시
    if (isSolo || !teamId) {
      setSaved(true);
      return;
    }

    setSaving(true);
    setSaveError(null);

    const { error } = await supabase.from("history").insert({
      team_id: teamId,
      menu_name: winner.name,
      eaten_at: new Date().toISOString().slice(0, 10),
    });

    setSaving(false);
    if (error) {
      setSaveError("저장 실패. 다시 시도해 주세요.");
    } else {
      setSaved(true);
    }
  };

  if (!winner) {
    return (
      <div style={styles.bg}>
        <p style={{ color: "var(--text-muted)", fontSize: "16px" }}>결과가 없습니다.</p>
      </div>
    );
  }

  return (
    <div style={styles.bg}>
      <div style={styles.inner}>
        {/* ── 1등 카드 ── */}
        <div style={styles.winnerCard}>
          <span style={styles.trophy}>🏆</span>
          <p style={styles.winnerLabel}>
            {isSolo ? '오늘의 선택은' : '오늘의 점심은'}
          </p>
          <h1 style={styles.winnerName}>{winner.name}!</h1>
          <VoteBar ok={winner.ok} pass={winner.pass} large />
        </div>

        {/* ── 나머지 순위 ── */}
        {runners.length > 0 && (
          <div style={styles.rankSection}>
            <h3 style={styles.rankTitle}>전체 순위</h3>
            <ol style={styles.rankList}>
              {sorted.map((menu, idx) => (
                <li key={menu.name} style={styles.rankItem}>
                  <span style={{
                    ...styles.rankIndex,
                    ...(idx === 0 ? styles.rankIndexFirst : {}),
                  }}>{idx + 1}</span>
                  <div style={styles.rankContent}>
                    <span style={styles.rankMenuName}>{menu.name}</span>
                    <VoteBar ok={menu.ok} pass={menu.pass} />
                  </div>
                </li>
              ))}
            </ol>
          </div>
        )}

        {/* ── 네이버 지도 링크 ── */}
        <a
          href={`https://map.naver.com/v5/search/${encodeURIComponent(winner.name)}`}
          target="_blank"
          rel="noopener noreferrer"
          style={styles.mapLink}
        >
          🗺️ 네이버 지도에서 보기
        </a>

        {/* ── 버튼 영역 ── */}
        <div style={styles.buttonRow}>
          <button style={styles.restartBtn} onClick={onRestart}>
            🔄 다시 투표하기
          </button>
          <button
            style={{
              ...styles.saveBtn,
              opacity: saved || saving ? 0.6 : 1,
              cursor: saved || saving ? "default" : "pointer",
            }}
            onClick={handleSave}
            disabled={saved || saving}
          >
            {saving ? "저장 중…" : saved ? "✅ 저장됨" : "📌 오늘 메뉴로 저장"}
          </button>
        </div>

        {saveError && <p style={styles.errorText}>{saveError}</p>}
      </div>
    </div>
  );
}

/* ── 바 차트 서브컴포넌트 ── */
function VoteBar({ ok, pass, large = false }) {
  const total = ok + pass || 1;
  const okPct = Math.round((ok / total) * 100);
  const passPct = 100 - okPct;

  return (
    <div style={{ width: "100%", marginTop: large ? "16px" : "8px" }}>
      {/* 레이블 */}
      <div style={barStyles.labels}>
        <span style={{ ...barStyles.label, color: "var(--accent-green)" }}>
          👍 OK {ok}표
        </span>
        <span style={{ ...barStyles.label, color: "var(--accent-red)" }}>
          👎 PASS {pass}표
        </span>
      </div>
      {/* 바 */}
      <div style={{ ...barStyles.track, height: large ? "14px" : "10px" }}>
        {okPct > 0 && (
          <div
            style={{
              ...barStyles.okFill,
              width: `${okPct}%`,
              height: "100%",
              borderRadius: passPct === 0 ? "var(--radius-full)" : "999px 0 0 999px",
            }}
          />
        )}
        {passPct > 0 && (
          <div
            style={{
              ...barStyles.passFill,
              width: `${passPct}%`,
              height: "100%",
              borderRadius: okPct === 0 ? "var(--radius-full)" : "0 999px 999px 0",
            }}
          />
        )}
      </div>
      <div style={barStyles.pctRow}>
        <span style={{ color: "var(--accent-green)", fontSize: "12px", fontWeight: 600 }}>{okPct}%</span>
        <span style={{ color: "var(--accent-red)", fontSize: "12px", fontWeight: 600 }}>{passPct}%</span>
      </div>
    </div>
  );
}

/* ────── 스타일 ────── */
const styles = {
  bg: {
    minHeight: "100dvh",
    background: "var(--bg-gradient)",
    display: "flex",
    justifyContent: "center",
    padding: "32px 16px 48px",
    fontFamily: "var(--font-family)",
  },
  inner: {
    width: "100%",
    maxWidth: "440px",
    display: "flex",
    flexDirection: "column",
    gap: "24px",
    animation: "fadeInUp 0.5s ease",
  },

  /* 1등 카드 */
  winnerCard: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    padding: "32px 28px 28px",
    border: "2px solid rgba(245,158,11,0.4)",
    borderRadius: "var(--radius-xl)",
    background: "linear-gradient(145deg, rgba(245,158,11,0.12) 0%, rgba(255,255,255,0.05) 100%)",
    boxShadow: "0 6px 32px rgba(245,158,11,0.15)",
    textAlign: "center",
  },
  trophy: {
    fontSize: "64px",
    lineHeight: 1,
    marginBottom: "8px",
    filter: "drop-shadow(0 4px 6px rgba(0,0,0,0.3))",
  },
  winnerLabel: {
    margin: "0 0 4px",
    fontSize: "15px",
    color: "var(--accent-amber)",
    fontWeight: 600,
  },
  winnerName: {
    margin: 0,
    fontSize: "clamp(28px, 7vw, 42px)",
    fontWeight: "900",
    color: "var(--text-primary)",
    letterSpacing: "-0.5px",
  },

  /* 순위 리스트 */
  rankSection: {
    backgroundColor: "var(--bg-card)",
    border: "1px solid var(--border-card)",
    borderRadius: "var(--radius-lg)",
    padding: "20px 20px 16px",
  },
  rankTitle: {
    margin: "0 0 16px",
    fontSize: "15px",
    fontWeight: "700",
    color: "var(--text-muted)",
    textTransform: "uppercase",
    letterSpacing: "1px",
  },
  rankList: {
    margin: 0,
    padding: 0,
    listStyle: "none",
    display: "flex",
    flexDirection: "column",
    gap: "16px",
  },
  rankItem: {
    display: "flex",
    alignItems: "flex-start",
    gap: "12px",
  },
  rankIndex: {
    flexShrink: 0,
    width: "28px",
    height: "28px",
    borderRadius: "50%",
    backgroundColor: "rgba(255,255,255,0.1)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "13px",
    fontWeight: "800",
    color: "var(--text-secondary)",
    marginTop: "2px",
  },
  rankIndexFirst: {
    background: "var(--accent-gradient)",
    color: "#fff",
  },
  rankContent: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    gap: "2px",
  },
  rankMenuName: {
    fontSize: "15px",
    fontWeight: "700",
    color: "var(--text-primary)",
  },

  /* 네이버 지도 링크 */
  mapLink: {
    display: "block",
    textAlign: "center",
    padding: "12px",
    background: "rgba(3,199,90,0.1)",
    border: "1px solid rgba(3,199,90,0.25)",
    borderRadius: "var(--radius-md)",
    color: "#4ade80",
    fontSize: "14px",
    fontWeight: "600",
    textDecoration: "none",
  },

  /* 버튼 */
  buttonRow: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  restartBtn: {
    width: "100%",
    padding: "16px",
    fontSize: "16px",
    fontWeight: "700",
    backgroundColor: "rgba(255,255,255,0.07)",
    border: "1px solid var(--border-card)",
    color: "var(--text-secondary)",
    borderRadius: "var(--radius-md)",
    cursor: "pointer",
  },
  saveBtn: {
    width: "100%",
    padding: "16px",
    fontSize: "16px",
    fontWeight: "700",
    background: "var(--accent-gradient)",
    color: "#ffffff",
    border: "none",
    borderRadius: "var(--radius-md)",
    cursor: "pointer",
    boxShadow: "var(--shadow-glow-orange)",
  },
  errorText: {
    textAlign: "center",
    color: "var(--accent-red)",
    fontSize: "13px",
    margin: 0,
  },
};

const barStyles = {
  labels: {
    display: "flex",
    justifyContent: "space-between",
    marginBottom: "4px",
  },
  label: {
    fontSize: "12px",
    fontWeight: "600",
  },
  track: {
    display: "flex",
    width: "100%",
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: "var(--radius-full)",
    overflow: "hidden",
  },
  okFill: {
    backgroundColor: "var(--accent-green)",
    transition: "width 0.6s ease",
  },
  passFill: {
    backgroundColor: "var(--accent-red)",
    transition: "width 0.6s ease",
  },
  pctRow: {
    display: "flex",
    justifyContent: "space-between",
    marginTop: "3px",
  },
};
