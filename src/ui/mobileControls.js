// src/ui/mobileControls.js

export function createMobileControls(onAction) {
  // Проверка на мобильное устройство и вертикальный экран
  const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  const isPortrait = window.innerHeight > window.innerWidth;
  
  if (!isTouch || (!isMobileUA && window.innerWidth > 1024) || !isPortrait) return null;

  // --- 1. ДЖОЙСТИК (слева) ---
  const joystickContainer = document.createElement("div");
  joystickContainer.id = "mobile-joystick";
  joystickContainer.style.cssText = `
    position: fixed;
    bottom: 80px;   /* Поднимаем над инвентарём */
    left: 20px;
    width: 130px;
    height: 130px;
    background: rgba(255, 255, 255, 0.1);
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-radius: 50%;
    z-index: 2000;
    touch-action: none;
  `;

  const joystickKnob = document.createElement("div");
    joystickContainer.style.cssText = `
    position: fixed;
    bottom: 80px;
    right: 20px; 
    width: 130px;
    height: 130px;
    background: rgba(255, 255, 255, 0.1);
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-radius: 50%;
    z-index: 2000;
    touch-action: none;
  `;
  joystickContainer.appendChild(joystickKnob);
  document.body.appendChild(joystickContainer);

  // --- 2. КНОПКА ДЕЙСТВИЯ E (справа) ---
  const actionBtn = document.createElement("div");
  actionBtn.id = "mobile-action-btn";
  actionBtn.textContent = "E";
    actionBtn.style.cssText = `
    position: fixed;
    bottom: 90px;
    left: 20px;   /* <-- ИЗМЕНИЛИ ЗДЕСЬ */
    width: 80px;
    height: 80px;
    background: rgba(255, 217, 102, 0.3);
    border: 3px solid #ffd966;
    border-radius: 50%;
    color: #ffd966;
    font-family: monospace;
    font-size: 32px;
    font-weight: bold;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 2000;
    touch-action: none;
    user-select: none;
    box-shadow: 0 4px 10px rgba(0,0,0,0.5);
  `;
  document.body.appendChild(actionBtn);

  // --- 3. ЛОГИКА ДЖОЙСТИКА ---
  let joystickVector = { x: 0, y: 0 };
  let touchId = null;

  const handleTouchStart = (e) => {
    e.preventDefault();
    const touch = e.changedTouches[0];
    touchId = touch.identifier;
    updateJoystick(touch);
  };

  const handleTouchMove = (e) => {
    e.preventDefault();
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === touchId) {
        updateJoystick(e.changedTouches[i]);
        break;
      }
    }
  };

  const handleTouchEnd = (e) => {
    e.preventDefault();
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === touchId) {
        joystickVector = { x: 0, y: 0 };
        joystickKnob.style.transform = `translate(-50%, -50%)`;
        touchId = null;
        break;
      }
    }
  };

  const updateJoystick = (touch) => {
    const rect = joystickContainer.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    let dx = touch.clientX - centerX;
    let dy = touch.clientY - centerY;

    const maxDist = rect.width / 2 - 25;
    const dist = Math.sqrt(dx * dx + dy * dy);
    
    if (dist > maxDist) {
      dx = (dx / dist) * maxDist;
      dy = (dy / dist) * maxDist;
    }

    joystickKnob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;

    joystickVector.x = dx / maxDist;
    joystickVector.y = dy / maxDist;
  };

  joystickContainer.addEventListener("touchstart", handleTouchStart, { passive: false });
  joystickContainer.addEventListener("touchmove", handleTouchMove, { passive: false });
  joystickContainer.addEventListener("touchend", handleTouchEnd, { passive: false });
  joystickContainer.addEventListener("touchcancel", handleTouchEnd, { passive: false });

  // --- 4. КНОПКА E ---
  actionBtn.addEventListener("touchstart", (e) => {
    e.preventDefault();
    actionBtn.style.background = "rgba(255, 217, 102, 0.7)";
    if (onAction) onAction();
  }, { passive: false });

  actionBtn.addEventListener("touchend", (e) => {
    e.preventDefault();
    actionBtn.style.background = "rgba(255, 217, 102, 0.3)";
  }, { passive: false });

  return {
    getVector: () => joystickVector
  };
}