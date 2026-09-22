// src/ui/miniMap.js
import {
  CELL,
  HALL_CELLS,
  DEPTH_NAMES,
  getHallRootNodes,
  getNodeSize,
} from "../data/model.js";

const MAP_VIEW_SIZE = 300;    // видимое окно миникарты
const MAP_FULL_SIZE = 600;    // размер полного зала (виртуально)
const CELL_SIZE = MAP_FULL_SIZE / HALL_CELLS;   // 60px на клетку
const DEPTH_ICONS = ["📕", "📚", "🗄", "🏛", "🏢"];

let mapEl = null;         // окно
let mapContentEl = null;  // контейнер со всем залом
let playerDotEl = null;

export function createMiniMap(world, hallId) {
  const old = document.getElementById("mini-map");
  if (old) old.remove();

  // окно миникарты
  mapEl = document.createElement("div");
  mapEl.id = "mini-map";
  mapEl.style.cssText = `
    position: fixed;
    left: 16px;
    bottom: 16px;
    width: ${MAP_VIEW_SIZE}px;
    height: ${MAP_VIEW_SIZE}px;
    background: #1e1a14ee;
    border: 2px solid #8b5a2b;
    border-radius: 6px;
    z-index: 500;
    overflow: hidden;
    pointer-events: none;
    user-select: none;
  `;
  document.body.appendChild(mapEl);

  // контейнер со всем залом
  mapContentEl = document.createElement("div");
  mapContentEl.id = "mini-map-content";
  mapContentEl.style.cssText = `
    position: absolute;
    width: ${MAP_FULL_SIZE}px;
    height: ${MAP_FULL_SIZE}px;
    left: 0;
    top: 0;
    transition: left 0.1s linear, top 0.1s linear;
  `;
  mapEl.appendChild(mapContentEl);

  // точка игрока
  playerDotEl = document.createElement("div");
  playerDotEl.style.cssText = `
    position: absolute;
    width: 12px; height: 12px;
    background: #ffdd00;
    border: 2px solid #000000;
    border-radius: 50%;
    transform: translate(-50%, -50%);
    z-index: 9999;
    box-shadow: 0 0 6px #ffdd00, 0 0 12px #ff8800;
  `;
  mapContentEl.appendChild(playerDotEl);

  renderObjects(world, hallId);
}

export function renderObjects(world, hallId) {
  if (!mapContentEl) return;

  // удаляем всё, кроме точки игрока
  const children = Array.from(mapContentEl.children);
  for (const c of children) {
    if (c !== playerDotEl) c.remove();
  }

  const hall = world.halls[hallId];
  if (!hall) return;

  // сетка
  const grid = document.createElement("div");
  grid.style.cssText = `
    position:absolute; inset:0;
    background-image:
      linear-gradient(#2a2a33 1px, transparent 1px),
      linear-gradient(90deg, #2a2a33 1px, transparent 1px);
    background-size: ${CELL_SIZE}px ${CELL_SIZE}px;
    opacity: 0.5;
    pointer-events: none;
  `;
  mapContentEl.insertBefore(grid, playerDotEl);

  // объекты
  const roots = getHallRootNodes(world, hallId);
  for (const node of roots) {
    const size = getNodeSize(node);

    const x = node.gx * CELL_SIZE;
    const y = node.gy * CELL_SIZE;
    const w = size.w * CELL_SIZE;
    const h = size.h * CELL_SIZE;

    const icon = DEPTH_ICONS[node.depth] || "?";

    const el = document.createElement("div");
    el.style.cssText = `
      position: absolute;
      left: ${x}px;
      top: ${y}px;
      width: ${w}px;
      height: ${h}px;
      background: #3a2e1e;
      border: 1px solid #8b5a2b;
      border-radius: 3px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: ${Math.min(w, h) * 0.5}px;
      line-height: 1;
      overflow: hidden;
      pointer-events: none;
    `;
    el.textContent = icon;

    mapContentEl.insertBefore(el, playerDotEl);
  }

  // стол
  if (hall.desk) {
    const x = hall.desk.gx * CELL_SIZE;
    const y = hall.desk.gy * CELL_SIZE;

    const el = document.createElement("div");
    el.style.cssText = `
      position: absolute;
      left: ${x}px;
      top: ${y}px;
      width: ${CELL_SIZE}px;
      height: ${CELL_SIZE}px;
      background: #3a2e1e;
      border: 2px solid #ffd966;
      border-radius: 3px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: ${CELL_SIZE * 0.6}px;
      line-height: 1;
      pointer-events: none;
    `;
    el.textContent = "🪑";
    mapContentEl.insertBefore(el, playerDotEl);
  }

  // точка игрока — поверх всего
  if (playerDotEl) {
    mapContentEl.appendChild(playerDotEl);
  }
}

export function updatePlayerPosition(playerX, playerY) {
  if (!mapEl || !mapContentEl || !playerDotEl) return;

  // позиция игрока на полной карте
  const fullX = (playerX / (CELL * HALL_CELLS)) * MAP_FULL_SIZE;
  const fullY = (playerY / (CELL * HALL_CELLS)) * MAP_FULL_SIZE;

  // ставим точку
  playerDotEl.style.left = `${fullX}px`;
  playerDotEl.style.top = `${fullY}px`;

  // сдвигаем контейнер, чтобы игрок был в центре окна
  const viewHalf = MAP_VIEW_SIZE / 2;
  const offsetX = viewHalf - fullX;
  const offsetY = viewHalf - fullY;

  mapContentEl.style.left = `${offsetX}px`;
  mapContentEl.style.top = `${offsetY}px`;
}