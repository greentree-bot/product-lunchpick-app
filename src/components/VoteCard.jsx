import { useRef, useState } from "react";
import TinderCard from "react-tinder-card";

export default function VoteCard({ menus, currentIndex, onSwipe }) {
  const [swipeDirection, setSwipeDirection] = useState(null);
  const cardRef = useRef(null);

  const currentMenu = menus[currentIndex];
  const total = menus.length;

  const handleSwipe = (direction) => {
    setSwipeDirection(null);
    onSwipe(direction === "right" ? "ok" : "pass");
  };

  const handleCardLeftScreen = () => {
    setSwipeDirection(null);
  };

  const handleSwipeRequirementFulfilled = (direction) => {
    setSwipeDirection(direction);
  };

  const handleSwipeRequirementUnfulfilled = () => {
    setSwipeDirection(null);
  };

  const triggerSwipe = (direction) => {
    if (cardRef.current) {
      cardRef.current.swipe(direction);
    }
  };

  const watermarkStyle = {
    position: "absolute",
    top: "24px",
    fontSize: "32px",
    fontWeight: "900",
    letterSpacing: "4px",
    opacity: 0.85,
    pointerEvents: "none",
    borderWidth: "4px",
    borderStyle: "solid",
    borderRadius: "8px",
    padding: "4px 14px",
    transform: "rotate(-15deg)",
    userSelect: "none",
  };

  const okWatermark = swipeDirection === "right" ? (
    <span style={{ ...watermarkStyle, color: "#22c55e", borderColor: "#22c55e", right: "24px" }}>
      OK
    </span>
  ) : null;

  const passWatermark = swipeDirection === "left" ? (
    <span style={{ ...watermarkStyle, color: "#ef4444", borderColor: "#ef4444", left: "24px" }}>
      PASS
    </span>
  ) : null;

  const cardBorderColor =
    swipeDirection === "right"
      ? "#22c55e"
      : swipeDirection === "left"
      ? "#ef4444"
      : "#e5e7eb";

  return (
    <div style={styles.wrapper}>
      {/* 진행바 */}
      <div style={styles.progressContainer}>
        <div style={styles.progressLabel}>
          {currentIndex + 1} / {total}
        </div>
        <div style={styles.progressBarBg}>
          <div
            style={{
              ...styles.progressBarFill,
              width: `${((currentIndex + 1) / total) * 100}%`,
            }}
          />
        </div>
      </div>

      {/* 카드 영역 */}
      <div style={styles.cardArea}>
        {currentMenu ? (
          <TinderCard
            ref={cardRef}
            key={currentMenu}
            onSwipe={handleSwipe}
            onCardLeftScreen={handleCardLeftScreen}
            onSwipeRequirementFulfilled={handleSwipeRequirementFulfilled}
            onSwipeRequirementUnfulfilled={handleSwipeRequirementUnfulfilled}
            preventSwipe={["up", "down"]}
            swipeRequirementType="position"
            swipeThreshold={80}
          >
            <div
              style={{
                ...styles.card,
                borderColor: cardBorderColor,
                borderWidth: "3px",
                borderStyle: "solid",
              }}
            >
              {passWatermark}
              {okWatermark}
              <span style={styles.menuName}>{currentMenu}</span>
            </div>
          </TinderCard>
        ) : (
          <div style={styles.doneCard}>
            <span style={styles.doneText}>모든 메뉴를 확인했어요!</span>
          </div>
        )}
      </div>

      {/* 힌트 텍스트 */}
      <p style={styles.hint}>카드를 밀거나 버튼을 눌러 투표하세요</p>

      {/* 버튼 영역 */}
      <div style={styles.buttonRow}>
        <button
          style={styles.passButton}
          onClick={() => triggerSwipe("left")}
          disabled={!currentMenu}
          aria-label="PASS"
        >
          👎 PASS
        </button>
        <button
          style={styles.okButton}
          onClick={() => triggerSwipe("right")}
          disabled={!currentMenu}
          aria-label="OK"
        >
          👍 OK
        </button>
      </div>
    </div>
  );
}

const styles = {
  wrapper: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    padding: "16px",
    maxWidth: "480px",
    margin: "0 auto",
    fontFamily: "'Segoe UI', sans-serif",
  },

  /* 진행바 */
  progressContainer: {
    width: "100%",
    marginBottom: "20px",
  },
  progressLabel: {
    textAlign: "center",
    fontSize: "14px",
    fontWeight: "600",
    color: "#6b7280",
    marginBottom: "6px",
  },
  progressBarBg: {
    width: "100%",
    height: "8px",
    backgroundColor: "#e5e7eb",
    borderRadius: "999px",
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: "#f97316",
    borderRadius: "999px",
    transition: "width 0.4s ease",
  },

  /* 카드 */
  cardArea: {
    width: "80%",
    position: "relative",
    display: "flex",
    justifyContent: "center",
  },
  card: {
    width: "100%",
    height: "300px",
    backgroundColor: "#ffffff",
    borderRadius: "20px",
    boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    overflow: "hidden",
    cursor: "grab",
    transition: "border-color 0.15s ease",
    userSelect: "none",
  },
  menuName: {
    fontSize: "clamp(24px, 6vw, 40px)",
    fontWeight: "800",
    color: "#1f2937",
    textAlign: "center",
    padding: "0 20px",
    pointerEvents: "none",
  },

  /* 완료 카드 */
  doneCard: {
    width: "100%",
    height: "300px",
    backgroundColor: "#f9fafb",
    borderRadius: "20px",
    boxShadow: "0 4px 16px rgba(0,0,0,0.06)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  doneText: {
    fontSize: "18px",
    fontWeight: "600",
    color: "#9ca3af",
  },

  /* 힌트 */
  hint: {
    marginTop: "14px",
    fontSize: "13px",
    color: "#9ca3af",
  },

  /* 버튼 */
  buttonRow: {
    display: "flex",
    gap: "24px",
    marginTop: "8px",
  },
  passButton: {
    padding: "14px 32px",
    fontSize: "18px",
    fontWeight: "700",
    backgroundColor: "#fee2e2",
    color: "#ef4444",
    border: "none",
    borderRadius: "50px",
    cursor: "pointer",
    transition: "transform 0.1s, background-color 0.2s",
    boxShadow: "0 2px 8px rgba(239,68,68,0.15)",
  },
  okButton: {
    padding: "14px 32px",
    fontSize: "18px",
    fontWeight: "700",
    backgroundColor: "#dcfce7",
    color: "#22c55e",
    border: "none",
    borderRadius: "50px",
    cursor: "pointer",
    transition: "transform 0.1s, background-color 0.2s",
    boxShadow: "0 2px 8px rgba(34,197,94,0.15)",
  },
};
