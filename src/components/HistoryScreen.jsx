import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

/**
 * HistoryScreen
 *
 * Props:
 *   teamId    string       — 팀 ID (null이면 솔로 모드)
 *   onClose   () => void   — 닫기 콜백
 */
export default function HistoryScreen({ teamId, onClose }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!teamId) {
      setLoading(false);
      return;
    }

    // 최근 30일 히스토리 조회
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const fromDate = thirtyDaysAgo.toISOString().slice(0, 10);

    supabase
      .from("history")
      .select("*")
      .eq("team_id", teamId)
      .gte("eaten_at", fromDate)
      .order("eaten_at", { ascending: false })
      .then(({ data, error }) => {
        if (!error && data) setHistory(data);
        setLoading(false);
      });
  }, [teamId]);

  // 날짜별 그룹핑
  const grouped = history.reduce((acc, item) => {
    const date = item.eaten_at;
    if (!acc[date]) acc[date] = [];
    acc[date].push(item);
    return acc;
  }, {});

  const formatDate = (dateStr) => {
    const d = new Date(dateStr + "T00:00:00");
    const weekday = ["일", "월", "화", "수", "목", "금", "토"][d.getDay()];
    return `${d.getMonth() + 1}/${d.getDate()} (${weekday})`;
  };

  const isToday = (dateStr) => {
    return dateStr === new Date().toISOString().slice(0, 10);
  };

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.panel} onClick={(e) => e.stopPropagation()}>
        <div style={styles.header}>
          <h3 style={styles.title}>📋 먹은 메뉴 히스토리</h3>
          <button style={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        <p style={styles.subtitle}>최근 30일간 기록</p>

        <div style={styles.content}>
          {loading && (
            <p style={styles.emptyText}>불러오는 중...</p>
          )}

          {!loading && history.length === 0 && (
            <div style={styles.emptyState}>
              <span style={styles.emptyEmoji}>📝</span>
              <p style={styles.emptyText}>아직 기록이 없어요</p>
              <p style={styles.emptyHint}>투표 결과에서 "오늘 메뉴로 저장"을 누르면 여기에 기록됩니다</p>
            </div>
          )}

          {!loading && Object.entries(grouped).map(([date, items]) => (
            <div key={date} style={styles.dateGroup}>
              <div style={styles.dateLabel}>
                <span style={styles.dateBadge}>
                  {isToday(date) ? "오늘" : formatDate(date)}
                </span>
              </div>
              {items.map((item) => (
                <div key={item.id} style={styles.menuItem}>
                  <span style={styles.menuEmoji}>🍱</span>
                  <span style={styles.menuName}>{item.menu_name}</span>
                  <a
                    href={`https://map.naver.com/v5/search/${encodeURIComponent(item.menu_name)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={styles.mapBtn}
                  >
                    지도
                  </a>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.6)",
    backdropFilter: "blur(4px)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 100,
    padding: "1rem",
    animation: "fadeIn 0.2s ease",
  },
  panel: {
    width: "100%",
    maxWidth: "420px",
    maxHeight: "80vh",
    background: "rgba(15,23,42,0.97)",
    border: "1px solid var(--border-card)",
    borderRadius: "var(--radius-xl)",
    boxShadow: "var(--shadow-card)",
    display: "flex",
    flexDirection: "column",
    animation: "slideUp 0.3s ease",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "20px 24px 0",
  },
  title: {
    margin: 0,
    fontSize: "18px",
    fontWeight: "800",
    color: "var(--text-primary)",
  },
  closeBtn: {
    background: "rgba(255,255,255,0.1)",
    border: "none",
    color: "var(--text-muted)",
    fontSize: "16px",
    width: "32px",
    height: "32px",
    borderRadius: "50%",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  subtitle: {
    margin: "6px 24px 0",
    fontSize: "12px",
    color: "var(--text-muted)",
  },
  content: {
    padding: "16px 24px 24px",
    overflowY: "auto",
    flex: 1,
  },

  /* 빈 상태 */
  emptyState: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    padding: "32px 0",
    gap: "8px",
  },
  emptyEmoji: {
    fontSize: "40px",
    marginBottom: "8px",
  },
  emptyText: {
    margin: 0,
    fontSize: "15px",
    color: "var(--text-secondary)",
    fontWeight: "600",
  },
  emptyHint: {
    margin: 0,
    fontSize: "13px",
    color: "var(--text-muted)",
    textAlign: "center",
    lineHeight: 1.5,
  },

  /* 날짜 그룹 */
  dateGroup: {
    marginBottom: "20px",
  },
  dateLabel: {
    marginBottom: "8px",
  },
  dateBadge: {
    fontSize: "12px",
    fontWeight: "700",
    color: "var(--accent-amber)",
    background: "rgba(245,158,11,0.12)",
    border: "1px solid rgba(245,158,11,0.25)",
    borderRadius: "var(--radius-full)",
    padding: "3px 10px",
  },

  /* 메뉴 아이템 */
  menuItem: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    padding: "10px 14px",
    background: "rgba(255,255,255,0.04)",
    border: "1px solid var(--border-subtle)",
    borderRadius: "var(--radius-sm)",
    marginBottom: "6px",
  },
  menuEmoji: {
    fontSize: "18px",
    flexShrink: 0,
  },
  menuName: {
    flex: 1,
    fontSize: "14px",
    fontWeight: "600",
    color: "var(--text-primary)",
  },
  mapBtn: {
    fontSize: "12px",
    fontWeight: "600",
    color: "#4ade80",
    background: "rgba(34,197,94,0.1)",
    border: "1px solid rgba(34,197,94,0.25)",
    borderRadius: "var(--radius-sm)",
    padding: "3px 10px",
    textDecoration: "none",
    flexShrink: 0,
  },
};
