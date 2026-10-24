// src/data/storage.js
import {
  createEmptyWorld,
  createBook,
  CART_INVENTORY_SIZE,
  CELL,
  updateUnlocks,
} from "./model.js";

const KEY = "knowledge-library-world-v6";

export function loadWorld() {
  const raw = localStorage.getItem(KEY);
  if (!raw) {
    const world = createEmptyWorld();
    hydrateBooks(world);
    saveWorld(world);
    return world;
  }
  try {
    const world = JSON.parse(raw);
    hydrateBooks(world);
    return world;
  } catch (e) {
    console.error("Failed to parse world, resetting", e);
    const world = createEmptyWorld();
    hydrateBooks(world);
    saveWorld(world);
    return world;
  }
}

export function saveWorld(world) {
  updateUnlocks(world);
  localStorage.setItem(KEY, JSON.stringify(world));
}

export function hydrateBooks(world) {
  if (!world || !world.nodes) return;

  if (!world.inventory) {
    world.inventory = [null, null];
  }

  if (!world.cartInventory) {
    world.cartInventory = new Array(CART_INVENTORY_SIZE).fill(null);
  } else if (world.cartInventory.length !== CART_INVENTORY_SIZE) {
    const arr = world.cartInventory.slice(0, CART_INVENTORY_SIZE);
    while (arr.length < CART_INVENTORY_SIZE) arr.push(null);
    world.cartInventory = arr;
  }

  // миграция unlocks
  if (!world.unlocks) {
    world.unlocks = { shelf: true, cabinet: false, section: false, block: false };
  }
  updateUnlocks(world);

  for (const hallId of Object.keys(world.halls || {})) {
    const hall = world.halls[hallId];
    if (hall.desk === undefined) hall.desk = null;
    if (hall.cart === undefined) hall.cart = null;

    if (hall.cart && hall.cart.gx !== undefined && hall.cart.x === undefined) {
      hall.cart.x = hall.cart.gx * CELL + CELL / 2;
      hall.cart.y = hall.cart.gy * CELL + CELL / 2;
      delete hall.cart.gx;
      delete hall.cart.gy;
    }
  }

  for (const node of Object.values(world.nodes)) {
    if (!node.type) node.type = "slot";
    if (!node.hallId && world.currentHallId) node.hallId = world.currentHallId;
  }
}

export function wipeWorld() {
  localStorage.removeItem(KEY);
  location.reload();
}

// ─────────────────────────────────────────────────────────────
// ЭКСПОРТ / ИМПОРТ

export function exportWorldToFile(world) {
  const data = JSON.stringify(world, null, 2);
  const blob = new Blob([data], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  const date = new Date().toISOString().slice(0, 10);
  a.download = `library-world-${date}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function importWorldFromFile(file, callback) {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const world = JSON.parse(e.target.result);
      if (!world.nodes || !world.halls) {
        alert("Неверный файл: нет nodes или halls.");
        return;
      }
      hydrateBooks(world);
      saveWorld(world);
      if (callback) callback(world);
    } catch (err) {
      console.error(err);
      alert("Не удалось прочитать файл.");
    }
  };
  reader.readAsText(file);
}

// ─────────────────────────────────────────────────────────────
// ОБЛАЧНОЕ СОХРАНЕНИЕ (Layero + Neon)

const CLOUD_URL = "https://library-backend-cli.layero.app";

export async function saveToCloud(world) {
  try {
    const res = await fetch(`${CLOUD_URL}/api/save`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(world),
    });
    
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || `Ошибка сервера: ${res.status}`);
    }
    return await res.json();
  } catch (err) {
    console.error("Ошибка сохранения в облако:", err);
    throw err;
  }
}

export async function loadFromCloud() {
  try {
    // Добавляем случайный параметр, чтобы браузер не кэшировал ответ
    const res = await fetch(`${CLOUD_URL}/api/save?t=${Date.now()}`);
    
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || `Ошибка сервера: ${res.status}`);
    }
    return await res.json();
  } catch (err) {
    console.error("Ошибка загрузки из облака:", err);
    throw err;
  }
}