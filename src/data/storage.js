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
  // 1. Спрашиваем пароль каждый раз
  const token = prompt("Введи пароль для сохранения в облако:");
  
  // Если нажали "Отмена" или ввели пустоту
  if (!token) {
    throw new Error("Сохранение отменено");
  }

  try {
    const res = await fetch(`${CLOUD_URL}/api/save`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-save-token": token.trim(), // .trim() на случай лишних пробелов
      },
      body: JSON.stringify(world),
    });

    if (res.status === 403) {
      throw new Error("Неверный пароль");
    }

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
  // Спрашиваем пароль
  const token = prompt("Введи пароль для загрузки из облака:");
  
  if (!token) {
    throw new Error("Загрузка отменена");
  }

  try {
    const res = await fetch(`${CLOUD_URL}/api/save?t=${Date.now()}`, {
      method: "GET",
      headers: {
        "x-save-token": token.trim(), // передаём пароль на сервер
      },
    });

    if (res.status === 403) {
      throw new Error("Неверный пароль");
    }

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

// ─────────────────────────────────────────────────────────────
// ЗАГРУЗКА ФАЙЛОВ В GITHUB

const GITHUB_OWNER = "roma111-ai";
const GITHUB_REPO = "library-files";

export async function uploadFileToGitHub(file) {
  // 1. Спрашиваем токен, если его нет в памяти
  let token = localStorage.getItem("github-files-token");
  if (!token) {
    token = prompt("Введи GitHub Token для загрузки файлов (Fine-grained):");
    if (!token) throw new Error("Загрузка отменена — нет токена");
    localStorage.setItem("github-files-token", token);
  }

  // 2. Читаем файл в Base64
  const reader = new FileReader();
  const base64Content = await new Promise((resolve, reject) => {
    reader.onload = () => {
      const base64 = reader.result.split(",")[1]; // Убираем префикс data:...
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  // 3. Формируем путь и отправляем
  const filePath = `uploads/${Date.now()}_${file.name}`;
  const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${filePath}`;

  const res = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github.v3+json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message: `Upload ${file.name}`,
      content: base64Content,
    }),
  });

  if (!res.ok) {
    const error = await res.json();
    if (res.status === 401 || res.status === 403) {
      localStorage.removeItem("github-files-token"); // Сброс неверного токена
      throw new Error("Неверный токен GitHub. Попробуй заново.");
    }
    throw new Error(`Ошибка GitHub: ${error.message || res.status}`);
  }

  const data = await res.json();
  return data.content.download_url; // Возвращаем прямую ссылку
}