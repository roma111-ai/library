// src/data/model.js

export const DEPTH_NAMES = ["Полка", "Шкаф", "Отсек", "Блок", "Зал"];
export const MAX_DEPTH = 4;
export const SLOTS_PER_NODE = 5;
export const INVENTORY_SIZE = 2;
export const CART_INVENTORY_SIZE = 25;

export const CELL = 200;
export const HALL_CELLS = 10;
export const HALL_SIZE = CELL * HALL_CELLS;
export const MAX_HALLS = 5;

export const NODE_SIZE_IN_CELLS = {
  0: { w: 1, h: 1 },
  1: { w: 1, h: 1 },
  2: { w: 1, h: 2 },
  3: { w: 5, h: 2 },
  4: { w: 1, h: 1 },
};

export function cellToPixel(gx, gy) {
  return { x: gx * CELL + CELL / 2, y: gy * CELL + CELL / 2 };
}

export function pixelToCell(x, y) {
  return {
    gx: Math.round((x - CELL / 2) / CELL),
    gy: Math.round((y - CELL / 2) / CELL),
  };
}

export function nodeCenterPixel(node) {
  const size = NODE_SIZE_IN_CELLS[node.depth] || { w: 1, h: 1 };
  return {
    x: (node.gx + size.w / 2) * CELL,
    y: (node.gy + size.h / 2) * CELL,
  };
}

let idCounter = 1;
export function nextId(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${(idCounter++).toString(36)}`;
}

export function createEmptyWorld() {
  const hallId = nextId("hall");
  const hall = createHall({ id: hallId, name: "Главный зал" });

  return {
    version: 6,
    currentHallId: hallId,
    halls: { [hallId]: hall },
    nodes: {},
    books: {},
    inventory: [null, null],
    cartInventory: new Array(CART_INVENTORY_SIZE).fill(null),
    unlocks: {
      shelf: true,
      cabinet: false,
      section: false,
      block: false,
    },
  };
}

export function createHall({ id, name }) {
  return {
    id,
    name: name || "Новый зал",
    size: { w: HALL_SIZE, h: HALL_SIZE },
    rootIds: [],
    desk: null,
    cart: null,
    cartIds: [],
    doors: [],
  };
}

export function createNode({
  id, depth, type = "slot", category, parentId, hallId,
  gx = 0, gy = 0, unlocked = false,
}) {
  const node = {
    id, depth, type, category, parentId, hallId, gx, gy, unlocked,
    bookIds: [], childIds: [], createdAt: Date.now(),
  };
  if (depth === 0) {
    for (let i = 0; i < SLOTS_PER_NODE; i++) node.bookIds.push(null);
  }
  return node;
}

export function createBook(id) {
  return { id, title: "", pages: [""], createdAt: Date.now() };
}

export function isBookFilled(book) {
  if (!book) return false;
  
  // 1. Проверяем заголовок
  if (book.title && book.title.trim().length > 0) return true;
  
  // 2. Проверяем страницы
  if (!book.pages || !Array.isArray(book.pages)) return false;
  
  return book.pages.some((p) => {
    // Если страница — это старая строка (до миграции)
    if (typeof p === "string") {
      return p.trim().length > 0;
    }
    
    // Если страница — это новый объект
    if (typeof p === "object" && p !== null) {
      // Проверяем, есть ли в HTML хоть какой-то текст или картинка (тег <img>)
      const hasContent = p.content && (
        p.content.replace(/<[^>]*>/g, "").trim().length > 0 || 
        p.content.includes("<img")
      );
      
      // Проверяем, есть ли прикрепленные файлы
      const hasFiles = p.files && p.files.length > 0;
      
      return hasContent || hasFiles;
    }
    
    return false;
  });
}

export function isNodeFilled(world, node) {
  if (!node) return false;
  if (node.depth === 0) {
    if (node.bookIds.length === 0) return false;
    return node.bookIds.every((id) => id !== null && isBookFilled(world.books[id]));
  }
  if (node.childIds.length === 0) return false;
  return node.childIds.every((id) => isNodeFilled(world, world.nodes[id]));
}

export function countFilled(world, node) {
  if (!node) return 0;
  if (node.depth === 0) {
    return node.bookIds.filter((id) => id !== null && isBookFilled(world.books[id])).length;
  }
  return node.childIds.filter((id) => {
    const child = world.nodes[id];
    return child && isNodeFilled(world, child);
  }).length;
}

export function countFilledBooksDeep(world, node) {
  if (!node) return 0;
  if (node.depth === 0) {
    return node.bookIds.filter((id) => id !== null && isBookFilled(world.books[id])).length;
  }
  return node.childIds.reduce((sum, id) => {
    const child = world.nodes[id];
    return sum + (child ? countFilledBooksDeep(world, child) : 0);
  }, 0);
}

export function totalSlots(node) {
  if (!node) return 0;
  if (node.depth === 0) return node.bookIds.length;
  return node.childIds.length;
}

export function nodeLabel(node) {
  return `${DEPTH_NAMES[node.depth]} «${node.category || "без названия"}»`;
}

export function getNodeSize(node) {
  return NODE_SIZE_IN_CELLS[node.depth] || { w: 1, h: 1 };
}

export function isAreaFree(world, hallId, gx, gy, w, h) {
  if (gx < 0 || gy < 0) return false;
  if (gx + w > HALL_CELLS || gy + h > HALL_CELLS) return false;

  const hall = world.halls[hallId];
  if (hall && hall.desk) {
    const dgx = hall.desk.gx, dgy = hall.desk.gy;
    if (dgx >= gx && dgx < gx + w && dgy >= gy && dgy < gy + h) return false;
  }

  for (const node of Object.values(world.nodes)) {
    if (!node.unlocked) continue;
    if (node.type !== "world") continue;
    if (node.hallId !== hallId) continue;

    const nSize = getNodeSize(node);
    const nx1 = node.gx, ny1 = node.gy;
    const nx2 = nx1 + nSize.w, ny2 = ny1 + nSize.h;
    const ox1 = gx, oy1 = gy;
    const ox2 = gx + w, oy2 = gy + h;

    if (!(ox2 <= nx1 || ox1 >= nx2 || oy2 <= ny1 || oy1 >= ny2)) return false;
  }
  return true;
}

export function isCellOccupied(world, hallId, gx, gy) {
  return !isAreaFree(world, hallId, gx, gy, 1, 1);
}

export function buildNode(world, { depth, gx, gy, hallId, category = "" }) {
  if (!world) return null;
  const hall = world.halls[hallId];
  if (!hall) return null;

  const size = NODE_SIZE_IN_CELLS[depth] || { w: 1, h: 1 };
  if (!isAreaFree(world, hallId, gx, gy, size.w, size.h)) return null;

  const id = nextId("node");
  const node = createNode({
    id, depth, type: "world", category, parentId: null,
    hallId, gx, gy, unlocked: true,
  });
  world.nodes[id] = node;

  createChildrenRecursive(world, node, hallId);
  hall.rootIds.push(id);
  return id;
}

function createChildrenRecursive(world, node, hallId) {
  if (node.depth === 0) return;
  if (node.childIds.length > 0) return;

  node.childIds = [];
  for (let i = 0; i < SLOTS_PER_NODE; i++) {
    const childId = nextId("node");
    const child = createNode({
      id: childId,
      depth: node.depth - 1,
      type: "slot",
      category: "",
      parentId: node.id,
      hallId,
      gx: node.gx,
      gy: node.gy,
      unlocked: true,
    });
    world.nodes[childId] = child;
    createChildrenRecursive(world, child, hallId);
    node.childIds.push(childId);
  }
}

export function shouldBuildDesk(world, hallId) {
  const hall = world.halls[hallId];
  if (!hall || hall.desk) return false;
  for (const nodeId of hall.rootIds) {
    const node = world.nodes[nodeId];
    if (!node) continue;
    if (node.depth === 0 && isNodeFilled(world, node)) return true;
  }
  return false;
}

export function buildDesk(world, hallId) {
  const hall = world.halls[hallId];
  if (!hall || hall.desk) return null;
  const pos = findFreeCellNear(world, hallId, 5, 5);
  if (!pos) return null;
  hall.desk = { gx: pos.gx, gy: pos.gy, builtAt: Date.now() };
  return hall.desk;
}

function findFreeCellNear(world, hallId, cx, cy) {
  const half = Math.floor(HALL_CELLS / 2);
  if (isAreaFree(world, hallId, cx, cy, 1, 1)) return { gx: cx, gy: cy };

  for (let radius = 1; radius <= half; radius++) {
    for (let dx = -radius; dx <= radius; dx++) {
      for (let dy = -radius; dy <= radius; dy++) {
        if (Math.abs(dx) !== radius && Math.abs(dy) !== radius) continue;
        const gx = cx + dx, gy = cy + dy;
        if (gx < 0 || gy < 0 || gx >= HALL_CELLS || gy >= HALL_CELLS) continue;
        if (isAreaFree(world, hallId, gx, gy, 1, 1)) return { gx, gy };
      }
    }
  }
  return null;
}

export function getUnlockedBuildings(world, hallId) {
  const hall = world.halls[hallId];
  if (!hall || !hall.desk) return [];

  const unlocks = world.unlocks || {};

  const unlocked = ["shelf"];
  if (unlocks.cabinet) unlocked.push("cabinet");
  if (unlocks.section) unlocked.push("section");
  if (unlocks.block) unlocked.push("block");

  return unlocked;
}

// Проверяет все узлы в мире и обновляет флаги разблокировки.
// Флаги не сбрасываются — если разблокировано, остаётся навсегда.
//
// Логика:
//   shelf    — всегда
//   cabinet  — после 1 заполненного шкафа (depth 1)
//   section  — после 1 заполненного отсека (depth 2)
//   block    — после 1 заполненного отсека (depth 2)
//
// Важно: block разблокируется заполнением ОТСЕКА, а не блока.
// Иначе — замкнутый круг: не могу строить блок → не могу заполнить → не разблокировать.
export function updateUnlocks(world) {
  if (!world.unlocks) {
    world.unlocks = { shelf: true, cabinet: false, section: false, block: false };
  }

  // cabinet — после 1 заполненного шкафа
  if (!world.unlocks.cabinet) {
    const has = Object.values(world.nodes).some(
      (n) => n.depth === 1 && isNodeFilled(world, n)
    );
    if (has) world.unlocks.cabinet = true;
  }

  // section — после 1 заполненного отсека
  if (!world.unlocks.section) {
    const has = Object.values(world.nodes).some(
      (n) => n.depth === 2 && isNodeFilled(world, n)
    );
    if (has) world.unlocks.section = true;
  }

  // block — после 1 заполненного отсека (НЕ блока!)
  if (!world.unlocks.block) {
    const has = Object.values(world.nodes).some(
      (n) => n.depth === 2 && isNodeFilled(world, n)
    );
    if (has) world.unlocks.block = true;
  }
}

export function hasFreeInventorySlot(world) {
  return world.inventory.some((b) => b === null);
}

export function hasBookInInventory(world) {
  return world.inventory.some((b) => b !== null);
}

export function canTakeBook(world, book) {
  if (!book) return false;
  if (!isBookFilled(book)) return false;
  return hasFreeInventorySlot(world);
}

export function takeBook(world, node, slotIndex) {
  if (node.depth !== 0) return false;
  const bookId = node.bookIds[slotIndex];
  if (!bookId) return false;
  const book = world.books[bookId];
  if (!book) return false;
  if (!isBookFilled(book)) return false;
  if (!hasFreeInventorySlot(world)) return false;

  const freeIdx = world.inventory.indexOf(null);
  world.inventory[freeIdx] = bookId;
  node.bookIds[slotIndex] = null;
  return true;
}

export function placeBook(world, node, slotIndex) {
  if (node.depth !== 0) return false;
  if (node.bookIds[slotIndex] !== null) return false;
  const bookId = world.inventory.find((b) => b !== null);
  if (!bookId) return false;

  node.bookIds[slotIndex] = bookId;
  const idx = world.inventory.indexOf(bookId);
  world.inventory[idx] = null;
  return true;
}

export function deleteBookAtSlot(world, node, slotIndex) {
  if (node.depth !== 0) return false;
  const bookId = node.bookIds[slotIndex];
  if (!bookId) return false;
  if (world.inventory.includes(bookId)) return false;
  if (world.cartInventory && world.cartInventory.includes(bookId)) return false;
  delete world.books[bookId];
  node.bookIds[slotIndex] = null;
  return true;
}

export function deleteBookEverywhere(world, bookId) {
  if (!bookId) return;
  for (const node of Object.values(world.nodes)) {
    if (node.depth !== 0 || !node.bookIds) continue;
    for (let i = 0; i < node.bookIds.length; i++) {
      if (node.bookIds[i] === bookId) node.bookIds[i] = null;
    }
  }
  world.inventory = world.inventory.map((id) => (id === bookId ? null : id));
  if (world.cartInventory) {
    world.cartInventory = world.cartInventory.map((id) => (id === bookId ? null : id));
  }
  delete world.books[bookId];
}

export function deleteNodeDeep(world, nodeId) {
  const node = world.nodes[nodeId];
  if (!node) return false;

  for (const childId of [...node.childIds]) deleteNodeDeep(world, childId);

  for (const bookId of node.bookIds) {
    if (bookId && !world.inventory.includes(bookId) &&
        !(world.cartInventory && world.cartInventory.includes(bookId))) {
      delete world.books[bookId];
    }
  }

  if (node.parentId) {
    const parent = world.nodes[node.parentId];
    if (parent) parent.childIds = parent.childIds.filter((id) => id !== nodeId);
  }

  const hall = world.halls[node.hallId];
  if (hall) {
    hall.rootIds = hall.rootIds.filter((id) => id !== nodeId);
  }

  delete world.nodes[nodeId];
  return true;
}

export function getCurrentHall(world) {
  return world.halls[world.currentHallId] || null;
}

export function getHallRootNodes(world, hallId) {
  const hall = world.halls[hallId];
  if (!hall) return [];
  return hall.rootIds.map((id) => world.nodes[id]).filter((n) => n && n.unlocked);
}

// ─────────────────────────────────────────────────────────────
// ТЕЛЕГА

export function shouldBuildCart(world, hallId) {
  const hall = world.halls[hallId];
  if (!hall || hall.cart) return false;

  for (const node of Object.values(world.nodes)) {
    if (!node.unlocked) continue;
    if (node.hallId !== hallId) continue;
    if (node.depth === 2 && isNodeFilled(world, node)) return true;
  }
  return false;
}

export function buildCart(world, hallId) {
  const hall = world.halls[hallId];
  if (!hall || hall.cart) return null;

  let cx, cy;
  if (hall.desk) {
    cx = (hall.desk.gx + 1) * CELL + CELL / 2;
    cy = hall.desk.gy * CELL + CELL / 2;
  } else {
    cx = HALL_SIZE / 2;
    cy = HALL_SIZE / 2;
  }

  hall.cart = {
    x: cx,
    y: cy,
    attached: false,
    createdAt: Date.now(),
  };
  return hall.cart;
}

export function attachCart(world, hallId) {
  const hall = world.halls[hallId];
  if (!hall || !hall.cart) return false;
  if (hall.cart.attached) return false;
  hall.cart.attached = true;
  return true;
}

export function detachCart(world, hallId, x, y) {
  const hall = world.halls[hallId];
  if (!hall || !hall.cart) return false;
  if (!hall.cart.attached) return false;

  hall.cart.attached = false;
  if (typeof x === "number" && typeof y === "number") {
    hall.cart.x = x;
    hall.cart.y = y;
  }
  return true;
}

export function countCartBooks(world) {
  if (!world.cartInventory) return 0;
  return world.cartInventory.filter((b) => b !== null).length;
}

export function putBookToCart(world, handIdx) {
  const bookId = world.inventory[handIdx];
  if (!bookId) return false;
  if (!world.cartInventory) return false;
  const freeIdx = world.cartInventory.indexOf(null);
  if (freeIdx === -1) return false;

  world.cartInventory[freeIdx] = bookId;
  world.inventory[handIdx] = null;
  return true;
}

export function takeBookFromCart(world, cartIdx) {
  if (!world.cartInventory) return false;
  const bookId = world.cartInventory[cartIdx];
  if (!bookId) return false;
  const freeIdx = world.inventory.indexOf(null);
  if (freeIdx === -1) return false;

  world.inventory[freeIdx] = bookId;
  world.cartInventory[cartIdx] = null;
  return true;
}

export function getCartSpriteKey(world) {
  const count = countCartBooks(world);
  if (count === 0) return "cart_0";
  if (count >= CART_INVENTORY_SIZE) return "cart_2";
  return "cart_1";
}