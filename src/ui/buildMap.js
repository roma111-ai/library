// src/ui/buildMap.js
import {
  CELL,
  HALL_CELLS,
  HALL_SIZE,
  DEPTH_NAMES,
  buildNode,
  getUnlockedBuildings,
  getHallRootNodes,
  getNodeSize,
} from "../data/model.js";

const DEPTH_ICONS = ["📕", "📚", "🗄", "🏛", "🏢"];

const BUILDING_INFO = {
  shelf:    { depth: 0, icon: "📕", name: "Полка", w: 1, h: 1 },
  cabinet:  { depth: 1, icon: "📚", name: "Шкаф",  w: 1, h: 1 },
  section:  { depth: 2, icon: "🗄", name: "Отсек", w: 1, h: 2 },
  block:    { depth: 3, icon: "🏛", name: "Блок",  w: 5, h: 2 },
};

export function renderBuildMap(world, hallId, playerPos, { onChange }) {
  const hall = world.halls[hallId];
  if (!hall) return document.createElement("div");

  const wrapper = document.createElement("div");
  wrapper.style.cssText = `
    display:flex; gap:24px;
    height:100%;
  `;

  // ─────────── ЛЕВАЯ ЧАСТЬ: карта ───────────
  const mapWrap = document.createElement("div");
  mapWrap.style.cssText = `
    flex:1;
    display:flex; flex-direction:column;
    align-items:center; justify-content:center;
    gap:12px;
  `;

  const mapEl = document.createElement("div");
  mapEl.style.cssText = `
    display:grid;
    grid-template-columns: repeat(${HALL_CELLS}, 1fr);
    grid-template-rows: repeat(${HALL_CELLS}, 1fr);
    gap:2px;
    background:#2a231a;
    padding:8px;
    border:2px solid #8b5a2b;
    border-radius:6px;
    width:min(60vh, 100%);
    height:min(60vh, 100%);
    aspect-ratio:1;
  `;

  // индекс занятости клеток (учитывает размеры)
  const occupied = {};
  for (const node of getHallRootNodes(world, hallId)) {
    const nSize = getNodeSize(node);
    for (let dx = 0; dx < nSize.w; dx++) {
      for (let dy = 0; dy < nSize.h; dy++) {
        occupied[`${node.gx + dx},${node.gy + dy}`] = {
          type: "node",
          node,
          isFirst: dx === 0 && dy === 0,
        };
      }
    }
  }
  if (hall.desk) {
    occupied[`${hall.desk.gx},${hall.desk.gy}`] = { type: "desk" };
  }

  const playerGx = Math.floor(playerPos.x / CELL);
  const playerGy = Math.floor(playerPos.y / CELL);

  const unlocked = getUnlockedBuildings(world, hallId);
  let selectedType = unlocked[0] || null;

  function renderMap() {
    mapEl.innerHTML = "";

    for (let gy = 0; gy < HALL_CELLS; gy++) {
      for (let gx = 0; gx < HALL_CELLS; gx++) {
        const key = `${gx},${gy}`;
        const info = occupied[key];

        const cell = document.createElement("div");
        cell.style.cssText = `
          background:#1a1a22;
          border-radius:3px;
          display:flex; align-items:center; justify-content:center;
          cursor:pointer;
          font-size:18px;
          position:relative;
          transition:background 0.1s;
          user-select:none;
        `;

        if (info) {
          if (info.type === "desk") {
            cell.style.background = "#3a2e1e";
            cell.style.border = "2px solid #ffd966";
            cell.textContent = "🪑";
          } else {
            cell.style.background = "#3a2e1e";
            cell.style.border = "1px solid #8b5a2b";
            if (info.isFirst) {
              cell.textContent = DEPTH_ICONS[info.node.depth] || "?";
            }
          }
        } else {
          cell.onmouseenter = () => { cell.style.background = "#2a2a33"; };
          cell.onmouseleave = () => { cell.style.background = "#1a1a22"; };
        }

        // игрок
        if (gx === playerGx && gy === playerGy) {
          const dot = document.createElement("div");
          dot.style.cssText = `
            position:absolute;
            width:12px; height:12px;
            background:#7ec8ff;
            border-radius:50%;
            border:2px solid #ffffff;
            pointer-events:none;
            z-index:2;
          `;
          cell.appendChild(dot);
        }

        cell.onclick = () => {
          if (info) {
            if (info.type === "desk") {
              showMessage("Это стол библиотекаря — сюда ничего не поставить.");
            } else {
              const nm = info.node.category || "(без названия)";
              const dn = DEPTH_NAMES[info.node.depth];
              showMessage(`Здесь уже стоит ${dn} «${nm}».`);
            }
            return;
          }

          if (!selectedType) {
            showMessage("Нет доступных объектов для постройки.");
            return;
          }

          const bInfo = BUILDING_INFO[selectedType];
          if (!bInfo) return;

          // проверка границ
          if (gx + bInfo.w > HALL_CELLS || gy + bInfo.h > HALL_CELLS) {
            showMessage("Объект не влезает — граница зала.");
            return;
          }

          // проверка: все клетки области свободны?
          for (let dx = 0; dx < bInfo.w; dx++) {
            for (let dy = 0; dy < bInfo.h; dy++) {
              if (occupied[`${gx + dx},${gy + dy}`]) {
                showMessage("Не всё место свободно.");
                return;
              }
            }
          }

          const newId = buildNode(world, {
            depth: bInfo.depth,
            gx, gy,
            hallId,
          });

          if (!newId) {
            showMessage("Не удалось построить.");
            return;
          }

          // помечаем все клетки области
          for (let dx = 0; dx < bInfo.w; dx++) {
            for (let dy = 0; dy < bInfo.h; dy++) {
              occupied[`${gx + dx},${gy + dy}`] = {
                type: "node",
                node: world.nodes[newId],
                isFirst: dx === 0 && dy === 0,
              };
            }
          }

          renderMap();
          renderSidebar();
          showMessage(`Построено: ${bInfo.icon} ${bInfo.name}`);

          if (onChange) onChange();
        };

        mapEl.appendChild(cell);
      }
    }
  }

  // ─────────── ПРАВАЯ ЧАСТЬ: панель ───────────
  const sidebar = document.createElement("div");
  sidebar.style.cssText = `
    width:280px;
    background:#1e1a14;
    border:2px solid #8b5a2b;
    border-radius:6px;
    padding:16px;
    display:flex; flex-direction:column;
    gap:12px;
    overflow-y:auto;
  `;

  function renderSidebar() {
    const unlockedList = getUnlockedBuildings(world, hallId);

    let itemsHtml = "";
    for (const key of Object.keys(BUILDING_INFO)) {
      const info = BUILDING_INFO[key];
      const isUnlocked = unlockedList.includes(key);
      const isSelected = selectedType === key;

      const radio = isUnlocked
        ? `<span style="color:${isSelected ? "#ffd966" : "#8b7a5a"};">${isSelected ? "◉" : "○"}</span>`
        : `<span style="color:#3a2e1e;">○</span>`;

      const sizeLabel = (info.w > 1 || info.h > 1)
        ? ` <span style="font-size:10px; color:#5a4020;">${info.w}×${info.h}</span>`
        : "";

      itemsHtml += `
        <div data-type="${key}" data-unlocked="${isUnlocked}" style="
          display:flex; align-items:center; gap:10px;
          padding:8px 10px;
          border-radius:4px;
          cursor:${isUnlocked ? "pointer" : "default"};
          background:${isSelected ? "#3a2e1e" : "transparent"};
          border:1px solid ${isSelected ? "#ffd966" : "transparent"};
          opacity:${isUnlocked ? 1 : 0.4};
        ">
          ${radio}
          <span style="font-size:16px;">${info.icon}</span>
          <span style="flex:1;">${info.name}${sizeLabel}</span>
          ${!isUnlocked ? `<span style="font-size:11px; color:#8b7a5a;">🔒</span>` : ""}
        </div>
      `;
    }

    sidebar.innerHTML = `
      <div style="font-size:14px; color:#ffd966; margin-bottom:4px;">
        Доступно для постройки
      </div>
      <div style="display:flex; flex-direction:column; gap:6px;">
        ${itemsHtml}
      </div>
      <div style="
        margin-top:auto;
        padding-top:12px;
        border-top:1px solid #5a4020;
        font-size:12px; color:#8b7a5a;
      ">
        Выбрано: <span style="color:#e8d8a8;">${selectedType ? BUILDING_INFO[selectedType].name : "—"}</span>
      </div>
      <div id="build-msg" style="
        font-size:12px; color:#8b7a5a;
        min-height:32px;
      "></div>
    `;

    sidebar.querySelectorAll("[data-type]").forEach((el) => {
      el.onclick = () => {
        if (el.dataset.unlocked !== "true") return;
        selectedType = el.dataset.type;
        renderSidebar();
      };
      el.onmouseenter = () => {
        if (el.dataset.unlocked === "true" && selectedType !== el.dataset.type) {
          el.style.background = "#2a231a";
        }
      };
      el.onmouseleave = () => {
        if (selectedType !== el.dataset.type) {
          el.style.background = "transparent";
        }
      };
    });
  }

  function showMessage(text) {
    const msg = sidebar.querySelector("#build-msg");
    if (msg) {
      msg.textContent = text;
      msg.style.color = "#ffd966";
      clearTimeout(showMessage._t);
      showMessage._t = setTimeout(() => {
        if (msg) msg.textContent = "";
      }, 2500);
    }
  }

  renderMap();
  renderSidebar();

  mapWrap.appendChild(mapEl);
  mapWrap.appendChild(
    Object.assign(document.createElement("div"), {
      textContent: "Кликни по свободной клетке, чтобы построить выбранный объект",
      style: "font-size:12px; color:#8b7a5a;",
    })
  );

  wrapper.appendChild(mapWrap);
  wrapper.appendChild(sidebar);

  return wrapper;
}