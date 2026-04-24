import { useEffect } from "react";
import { useState } from "react";

/**
 * WaitingScreen
 *
 * Props:
 *   members         { id, name }[]   — 전체 팀원 목록
 *   completedNames  Set<string>      — 투표 완료한 voter_name Set
 *                                      (Vote.jsx의 useVotes 실시간 구독으로 최신 유지)
 *   onAllCompleted  () => void       — 전원 완료 시 호출
 */
export default function WaitingScreen({ members, completedNames, onAllCompleted }) {
  // 전원 완료 감지
  useEffect(() => {
    if (members.length > 0 && completedNames.size >= members.length) {
      onAllCompleted();
    }
  }, [completedNames, members, onAllCompleted]);

  const completedCount = completedNames.size;
  const totalCount = members.length;

  return (
    <div style={styles.bg}>
      <div style={styles.card}>
        {/* 완료 메시지 */}
        <div style={styles.topSection}>
          <span style={styles.trophy}>🎉</span>
          <h2 style={styles.title}>투표 완료!</h2>
          <p style={styles.subtitle}>다른 팀원들의 투표를 기다리는 중이에요</p>
        </div>

        {/* 진행 현황 */}
        <div style={styles.progressSection}>
          <span style={styles.progressText}>
            <span style={styles.progressCount}>{completedCount}</span>
            {" / "}
            <span style={styles.progressTotal}>{totalCount}</span>
            명 완료
          </span>
          <div style={styles.progressBarBg}>
            <div
              style={{
                ...styles.progressBarFill,
                width: totalCount > 0 ? `${(completedCount / totalCount) * 100}%` : "0%",
              }}
            />
          </div>
        </div>

        {/* 팀원 목록 */}
        <ul style={styles.memberList}>
          {members.map((member) => {
            const done = completedNames.has(member.name);
            return (
              <li key={member.id} style={styles.memberItem}>
                <span style={done ? styles.iconDone : styles.iconWaiting}>
                  {done ? "✅" : "🕐"}
                </span>
                <span style={done ? styles.memberNameDone : styles.memberNameWaiting}>
                  {member.name}
                </span>
                {done && <span style={styles.doneTag}>완료</span>}
              </li>
            );
          })}
        </ul>

        {/* 로딩 애니메이션 */}
        <div style={styles.loaderRow}>
          <span style={styles.loaderLabel}>집계 중</span>
          <LoadingDots />
        </div>
      </div>
    </div>
  );
}

/* 점 세 개 깜빡임 애니메이션 컴포넌트 */
function LoadingDots() {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setStep((prev) => (prev + 1) % 4);
    }, 450);
    return () => clearInterval(timer);
  }, []);

  return (
    <span style={styles.dots}>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          style={{
            ...styles.dot,
            opacity: step > i ? 1 : 0.2,
            transform: step > i ? "translateY(-3px)" : "translateY(0)",
          }}
        />
      ))}
    </span>
  );
}

const styles = {
  bg: {
    minHeight: "100dvh",
    background: "var(--bg-gradient)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "24px 16px",
    fontFamily: "var(--font-family)",
  },

  card: {
    width: "100%",
    maxWidth: "420px",
    background: "var(--bg-card)",
    border: "1px solid var(--border-card)",
    borderRadius: "var(--radius-xl)",
    boxShadow: "var(--shadow-card)",
    padding: "32px 28px",
    display: "flex",
    flexDirection: "column",
    gap: "28px",
    animation: "fadeInUp 0.4s ease",
  },

  /* 상단 */
  topSection: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "8px",
  },
  trophy: {
    fontSize: "52px",
    lineHeight: 1,
  },
  title: {
    margin: 0,
    fontSize: "26px",
    fontWeight: "800",
    color: "var(--text-primary)",
  },
  subtitle: {
    margin: 0,
    fontSize: "14px",
    color: "var(--text-muted)",
    textAlign: "center",
  },

  /* 진행 현황 */
  progressSection: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  progressText: {
    textAlign: "center",
    fontSize: "16px",
    color: "var(--text-secondary)",
    fontWeight: "600",
  },
  progressCount: {
    fontSize: "22px",
    fontWeight: "800",
    color: "var(--accent-green)",
  },
  progressTotal: {
    fontSize: "18px",
    fontWeight: "700",
    color: "var(--text-muted)",
  },
  progressBarBg: {
    width: "100%",
    height: "10px",
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: "var(--radius-full)",
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: "var(--accent-green)",
    borderRadius: "var(--radius-full)",
    transition: "width 0.5s ease",
  },

  /* 팀원 목록 */
  memberList: {
    listStyle: "none",
    margin: 0,
    padding: 0,
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  memberItem: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    padding: "12px 16px",
    backgroundColor: "rgba(255,255,255,0.05)",
    border: "1px solid var(--border-subtle)",
    borderRadius: "12px",
  },
  iconDone: {
    fontSize: "20px",
    flexShrink: 0,
  },
  iconWaiting: {
    fontSize: "20px",
    flexShrink: 0,
    filter: "grayscale(1)",
    opacity: 0.5,
  },
  memberNameDone: {
    flex: 1,
    fontSize: "15px",
    fontWeight: "600",
    color: "var(--text-primary)",
  },
  memberNameWaiting: {
    flex: 1,
    fontSize: "15px",
    fontWeight: "500",
    color: "var(--text-muted)",
  },
  doneTag: {
    fontSize: "12px",
    fontWeight: "700",
    color: "var(--accent-green)",
    backgroundColor: "rgba(34,197,94,0.15)",
    borderRadius: "var(--radius-full)",
    padding: "2px 10px",
    flexShrink: 0,
  },

  /* 로딩 */
  loaderRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
  },
  loaderLabel: {
    fontSize: "13px",
    color: "var(--text-muted)",
    fontWeight: "500",
  },
  dots: {
    display: "flex",
    gap: "5px",
    alignItems: "center",
  },
  dot: {
    display: "inline-block",
    width: "7px",
    height: "7px",
    borderRadius: "50%",
    backgroundColor: "var(--accent-orange)",
    transition: "opacity 0.2s ease, transform 0.2s ease",
  },
};
