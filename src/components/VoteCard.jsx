import { useRef, useState } from "react";

export default function VoteCard({ menus, currentIndex, onSwipe, onUndo, canUndo, restaurantInfo }) {
  const [swipeDirection, setSwipeDirection] = useState(null);
  const [dragX, setDragX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const startXRef = useRef(0);
  const cardRef = useRef(null);

  const currentMenu = menus[currentIndex];
  const total = menus.length;
  const info = restaurantInfo?.[currentIndex];

  const SWIPE_THRESHOLD = 80;

  // ── 터치/마우스 드래그 핸들러 ──
  const handleStart = (clientX) => {
    startXRef.current = clientX;
    setIsDragging(true);
  };

  const handleMove = (clientX) => {
    if (!isDragging) return;
    const diff = clientX - startXRef.current;
    setDragX(diff);
    if (diff > SWIPE_THRESHOLD) setSwipeDirection("right");
    else if (diff < -SWIPE_THRESHOLD) setSwipeDirection("left");
    else setSwipeDirection(null);
  };

  const handleEnd = () => {
    if (!isDragging) return;
    setIsDragging(false);
    if (dragX > SWIPE_THRESHOLD) {
      animateOut("right");
    } else if (dragX < -SWIPE_THRESHOLD) {
      animateOut("left");
    } else {
      setDragX(0);
      setSwipeDirection(null);
    }
  };

  const animateOut = (direction) => {
    const target = direction === "right" ? 400 : -400;
    setDragX(target);
    setTimeout(() => {
      setDragX(0);
      setSwipeDirection(null);
      onSwipe(direction === "right" ? "ok" : "pass");
    }, 200);
  };

  const triggerSwipe = (direction) => {
    animateOut(direction);
  };

  // ── 터치 이벤트 ──
  const onTouchStart = (e) => handleStart(e.touches[0].clientX);
  const onTouchMove = (e) => handleMove(e.touches[0].clientX);
  const onTouchEnd = () => handleEnd();

  // ── 마우스 이벤트 ──
  const onMouseDown = (e) => { e.preventDefault(); handleStart(e.clientX); };
  const onMouseMove = (e) => { if (isDragging) handleMove(e.clientX); };
  const onMouseUp = () => handleEnd();
  const onMouseLeave = () => { if (isDragging) handleEnd(); };

  const rotation = dragX * 0.08;
  const opacity = Math.max(0, 1 - Math.abs(dragX) / 500);

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
    <span style={{ ...watermarkStyle, color: "#22c55e", borderColor: "#22c55e", right: "24px" }}>OK</span>
  ) : null;

  const passWatermark = swipeDirection === "left" ? (
    <span style={{ ...watermarkStyle, color: "#ef4444", borderColor: "#ef4444", left: "24px" }}>PASS</span>
  ) : null;

  const cardBorderColor =
    swipeDirection === "right" ? "#22c55e" :
    swipeDirection === "left" ? "#ef4444" :
    "rgba(255,255,255,0.15)";

  return (
    <div style={styles.wrapper}>
      {/* 진행바 */}
      <div style={styles.progressContainer}>
        <div style={styles.progressLabel}>{currentIndex + 1} / {total}</div>
        <div style={styles.progressBarBg}>
          <div style={{ ...styles.progressBarFill, width: `${((currentIndex + 1) / total) * 100}%` }} />
        </div>
      </div>

      {/* 카드 영역 */}
      <div style={styles.cardArea}>
        {currentMenu ? (
          <div
            ref={cardRef}
            style={{
              ...styles.card,
              borderColor: cardBorderColor,
              borderWidth: "3px",
              borderStyle: "solid",
              transform: `translateX(${dragX}px) rotate(${rotation}deg)`,
              opacity: opacity,
              transition: isDragging ? "none" : "transform 0.2s ease, opacity 0.2s ease",
              cursor: isDragging ? "grabbing" : "grab",
            }}
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            onMouseLeave={onMouseLeave}
          >
            {passWatermark}
            {okWatermark}
            <span style={styles.menuName}>{currentMenu}</span>
            {info && (
              <div style={styles.infoSection}>
                {info.category && <span style={styles.categoryChip}>{info.category}</span>}
                {info.distance > 0 && (
                  <span style={styles.distanceText}>
                    📍 {info.distance >= 1000 ? `${(info.distance / 1000).toFixed(1)}km` : `${info.distance}m`}
                  </span>
                )}
              </div>
            )}
          </div>
        ) : (
          <div style={styles.doneCard}>
            <span style={styles.doneText}>모든 메뉴를 확인했어요!</span>
          </div>
        )}
      </div>

      <p style={styles.hint}>카드를 밀거나 버튼을 눌러 투표하세요</p>

      <div style={styles.buttonRow}>
        <button style={styles.passButton} onClick={() => triggerSwipe("left")} disabled={!currentMenu} aria-label="PASS">👎 PASS</button>
        <button style={styles.okButton} onClick={() => triggerSwipe("right")} disabled={!currentMenu} aria-label="OK">👍 OK</button>
      </div>

      {canUndo && (
        <button style={styles.undoButton} onClick={onUndo}>↩️ 이전 메뉴로 되돌리기</button>
      )}
    </div>
  );
}

const styles = {
  wrapper: { display: "flex", flexDirection: "column", alignItems: "center", padding: "16px", maxWidth: "480px", margin: "0 auto", fontFamily: "var(--font-family)" },
  progressContainer: { width: "100%", marginBottom: "20px" },
  progressLabel: { textAlign: "center", fontSize: "14px", fontWeight: "600", color: "var(--text-secondary)", marginBottom: "6px" },
  progressBarBg: { width: "100%", height: "8px", backgroundColor: "rgba(255,255,255,0.1)", borderRadius: "var(--radius-full)", overflow: "hidden" },
  progressBarFill: { height: "100%", background: "var(--accent-gradient)", borderRadius: "var(--radius-full)", transition: "width 0.4s ease" },
  cardArea: { width: "85%", position: "relative", display: "flex", justifyContent: "center" },
  card: {
    width: "100%", height: "320px",
    background: "linear-gradient(145deg, rgba(30,41,59,0.95) 0%, rgba(15,23,42,0.95) 100%)",
    borderRadius: "var(--radius-xl)", boxShadow: "var(--shadow-card)",
    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
    position: "relative", overflow: "hidden", userSelect: "none",
  },
  menuName: { fontSize: "clamp(24px, 6vw, 40px)", fontWeight: "800", color: "var(--text-primary)", textAlign: "center", padding: "0 20px", pointerEvents: "none" },
  infoSection: { display: "flex", alignItems: "center", gap: "8px", marginTop: "12px", pointerEvents: "none" },
  categoryChip: { fontSize: "12px", fontWeight: "600", color: "var(--accent-amber)", background: "rgba(245,158,11,0.15)", border: "1px solid rgba(245,158,11,0.3)", borderRadius: "var(--radius-full)", padding: "3px 10px" },
  distanceText: { fontSize: "12px", color: "var(--text-muted)" },
  doneCard: { width: "100%", height: "320px", background: "rgba(255,255,255,0.05)", borderRadius: "var(--radius-xl)", boxShadow: "0 4px 16px rgba(0,0,0,0.2)", display: "flex", alignItems: "center", justifyContent: "center" },
  doneText: { fontSize: "18px", fontWeight: "600", color: "var(--text-muted)" },
  hint: { marginTop: "14px", fontSize: "13px", color: "var(--text-muted)" },
  buttonRow: { display: "flex", gap: "24px", marginTop: "8px" },
  passButton: { padding: "14px 32px", fontSize: "18px", fontWeight: "700", backgroundColor: "rgba(239,68,68,0.15)", color: "#ef4444", border: "1.5px solid rgba(239,68,68,0.3)", borderRadius: "50px", cursor: "pointer", transition: "transform 0.1s", boxShadow: "0 2px 8px rgba(239,68,68,0.15)" },
  okButton: { padding: "14px 32px", fontSize: "18px", fontWeight: "700", backgroundColor: "rgba(34,197,94,0.15)", color: "#22c55e", border: "1.5px solid rgba(34,197,94,0.3)", borderRadius: "50px", cursor: "pointer", transition: "transform 0.1s", boxShadow: "0 2px 8px rgba(34,197,94,0.15)" },
  undoButton: { marginTop: "12px", padding: "8px 20px", fontSize: "14px", fontWeight: "600", background: "rgba(255,255,255,0.07)", color: "var(--text-secondary)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: "var(--radius-full)", cursor: "pointer" },
};
