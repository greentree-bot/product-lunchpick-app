import { useEffect, useRef, useState } from "react";
import confetti from "canvas-confetti";
import { supabase } from "../lib/supabase";

/**
 * ResultScreen
 *
 * Props:
 *   roomId      string           — 현재 투표방 ID
 *   results     Array<{          — 집계된 메뉴별 결과
 *     name: string,
 *     ok:   number,
 *     pass: number,
 *   }>
 *   onRestart   () => void       — "다시 투표하기" 콜백
 */
export default function ResultScreen({ teamId, results = [], onRestart }) {
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
        <p style={{ color: "#9ca3af", fontSize: "16px" }}>결과가 없습니다.</p>
      </div>
    );
  }

  return (
    <div style={styles.bg}>
      <div style={styles.inner}>
        {/* ── 1등 카드 ── */}
        <div style={styles.winnerCard}>
          <span style={styles.trophy}>🏆</span>
          <p style={styles.winnerLabel}>오늘의 점심은</p>
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
                  <span style={styles.rankIndex}>{idx + 1}</span>
                  <div style={styles.rankContent}>
                    <span style={styles.rankMenuName}>{menu.name}</span>
                    <VoteBar ok={menu.ok} pass={menu.pass} />
                  </div>
                </li>
              ))}
            </ol>
          </div>
        )}

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
        <span style={{ ...barStyles.label, color: "#22c55e" }}>
          👍 OK {ok}표
        </span>
        <span style={{ ...barStyles.label, color: "#ef4444" }}>
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
              borderRadius: passPct === 0 ? "999px" : "999px 0 0 999px",
            }}
          />
        )}
        {passPct > 0 && (
          <div
            style={{
              ...barStyles.passFill,
              width: `${passPct}%`,
              height: "100%",
              borderRadius: okPct === 0 ? "999px" : "0 999px 999px 0",
            }}
          />
        )}
      </div>
      <div style={barStyles.pctRow}>
        <span style={{ color: "#22c55e", fontSize: "12px", fontWeight: 600 }}>{okPct}%</span>
        <span style={{ color: "#ef4444", fontSize: "12px", fontWeight: 600 }}>{passPct}%</span>
      </div>
    </div>
  );
}

/* ────── 스타일 ────── */
const styles = {
  bg: {
    minHeight: "100dvh",
    backgroundColor: "#ffffff",
    display: "flex",
    justifyContent: "center",
    padding: "32px 16px 48px",
    fontFamily: "'Segoe UI', sans-serif",
  },
  inner: {
    width: "100%",
    maxWidth: "440px",
    display: "flex",
    flexDirection: "column",
    gap: "24px",
  },

  /* 1등 카드 */
  winnerCard: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    padding: "32px 28px 28px",
    border: "3px solid #f59e0b",
    borderRadius: "24px",
    background: "linear-gradient(145deg, #fffbeb 0%, #ffffff 100%)",
    boxShadow: "0 6px 32px rgba(245,158,11,0.18)",
    textAlign: "center",
  },
  trophy: {
    fontSize: "64px",
    lineHeight: 1,
    marginBottom: "8px",
    filter: "drop-shadow(0 4px 6px rgba(0,0,0,0.15))",
  },
  winnerLabel: {
    margin: "0 0 4px",
    fontSize: "15px",
    color: "#92400e",
    fontWeight: 600,
  },
  winnerName: {
    margin: 0,
    fontSize: "clamp(28px, 7vw, 42px)",
    fontWeight: "900",
    color: "#1f2937",
    letterSpacing: "-0.5px",
  },

  /* 순위 리스트 */
  rankSection: {
    backgroundColor: "#f9fafb",
    borderRadius: "20px",
    padding: "20px 20px 16px",
  },
  rankTitle: {
    margin: "0 0 16px",
    fontSize: "15px",
    fontWeight: "700",
    color: "#6b7280",
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
    backgroundColor: "#e5e7eb",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "13px",
    fontWeight: "800",
    color: "#374151",
    marginTop: "2px",
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
    color: "#1f2937",
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
    backgroundColor: "#f3f4f6",
    color: "#374151",
    border: "none",
    borderRadius: "14px",
    cursor: "pointer",
  },
  saveBtn: {
    width: "100%",
    padding: "16px",
    fontSize: "16px",
    fontWeight: "700",
    backgroundColor: "#f97316",
    color: "#ffffff",
    border: "none",
    borderRadius: "14px",
    cursor: "pointer",
    boxShadow: "0 4px 14px rgba(249,115,22,0.35)",
  },
  errorText: {
    textAlign: "center",
    color: "#ef4444",
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
    backgroundColor: "#f3f4f6",
    borderRadius: "999px",
    overflow: "hidden",
  },
  okFill: {
    backgroundColor: "#22c55e",
    transition: "width 0.6s ease",
  },
  passFill: {
    backgroundColor: "#ef4444",
    transition: "width 0.6s ease",
  },
  pctRow: {
    display: "flex",
    justifyContent: "space-between",
    marginTop: "3px",
  },
};
