// src/ui/mobileControls.js

export function createMobileControls(onAction) {
  // Проверяем и тачскрин, и ширину экрана (чтобы на ноутбуках с тачскрином не было джойстика)
  const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  const isMobileScreen = window.innerWidth <= 1024;
  
  // Если это ПК или широкий экран — ничего не создаём
  if (!isTouch || !isMobileScreen) return null;

  // --- 1. ДЖОЙСТИК (левая сторона) ---
  const joystickContainer = document.createElement("div");
  joystickContainer.id = "mobile-joystick";
  joystickContainer.style.cssText = `
    position: fixed;
    bottom: 100px;
    left: 30px;
    width: 140px;
    height: 140px;
    background: rgba(255, 255, 255, 0.1);
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-radius: 50%;
    z-index: 2000;
    touch-action: none;
  `;

  const joystickKnob = document.createElement("div");
  joystickKnob.style.cssText = `
    position: absolute;
    top: 50%;
    left: 50%;
    width: 60px;
    height: 60px;
    background: rgba(255, 255, 255, 0.5);
    border-radius: 50%;
    transform: translate(-50%, -50%);
    pointer-events: none;
  `;
  joystickContainer.appendChild(joystickKnob);
  document.body.appendChild(joystickContainer);

  // --- 2. КНОПКА ДЕЙСТВИЯ (правая сторона) ---
  const actionBtn = document.createElement("div");
  actionBtn.id = "mobile-action-btn";
  actionBtn.textContent = "E";
  actionBtn.style.cssText = `
    position: fixed;
    bottom: 120px;
    right: 40px;
    width: 90px;
    height: 90px;
    background: rgba(255, 217, 102, 0.2);
    border: 3px solid #ffd966;
    border-radius: 50%;
    color: #ffd966;
    font-family: monospace;
    font-size: 36px;
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

    const maxDist = rect.width / 2 - 30; // 30 - половина размера ручки
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

  // --- 4. ЛОГИКА КНОПКИ E ---
  actionBtn.addEventListener("touchstart", (e) => {
    e.preventDefault();
    actionBtn.style.background = "rgba(255, 217, 102, 0.5)";
    if (onAction) onAction();
  }, { passive: false });

  actionBtn.addEventListener("touchend", (e) => {
    e.preventDefault();
    actionBtn.style.background = "rgba(255, 217, 102, 0.2)";
  }, { passive: false });

  return {
    getVector: () => joystickVector
  };
}