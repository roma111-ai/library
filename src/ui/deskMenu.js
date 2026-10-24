// src/ui/deskMenu.js
import {
  DEPTH_NAMES,
  countFilled,
  totalSlots,
  isNodeFilled,
  isBookFilled,
  getHallRootNodes,
} from "../data/model.js";
import { renderBuildMap } from "./buildMap.js";
import { exportWorldToFile, importWorldFromFile, saveToCloud, loadFromCloud } from "../data/storage.js";

const DEPTH_ICONS = ["📕", "📚", "🗄", "🏛", "🏢"];

export function openDeskMenu(world, hallId, { onClose, getPlayerPos, onChange }) {
  let modal = document.getElementById("desk-menu");
  if (modal) modal.remove();

  const hall = world.halls[hallId];
  if (!hall) return;

  modal = document.createElement("div");
  modal.id = "desk-menu";
  modal.style.cssText = `
    position: fixed; inset: 0;
    background: #0e0e12;
    color: #e8d8a8;
    font-family: monospace;
    display: flex; flex-direction: column;
    z-index: 3000;
  `;
  document.body.appendChild(modal);

  const canvas = document.querySelector("canvas");
  let oldCanvasStyle = "";
  if (canvas) {
    oldCanvasStyle = canvas.style.cssText;
    canvas.style.visibility = "hidden";
  }

  let activeTab = "library";

  function close() {
    if (canvas) canvas.style.cssText = oldCanvasStyle;
    modal.remove();
    onClose();
  }

  function render() {
    modal.innerHTML = `
      <div style="
        display:flex; justify-content:space-between; align-items:center;
        padding:16px 24px;
        border-bottom:2px solid #8b5a2b;
        background:#1e1a14;
        gap:12px;
      ">
        <div style="font-size:20px; flex-shrink:0;">
          🪑 Стол библиотекаря — <span style="color:#ffd966;">${escapeHtml(hall.name)}</span>
        </div>
        <div style="display:flex; gap:8px; flex-wrap:wrap;">
          <button id="tab-library" style="
            padding:6px 14px;
            background:${activeTab === "library" ? "#3a2e1e" : "#1e1a14"};
            border:1px solid ${activeTab === "library" ? "#ffd966" : "#8b5a2b"};
            border-radius:4px; font-size:14px;
            color:#e8d8a8; cursor:pointer;
          ">📚 Библиотека</button>
          <button id="tab-build" style="
            padding:6px 14px;
            background:${activeTab === "build" ? "#3a2e1e" : "#1e1a14"};
            border:1px solid ${activeTab === "build" ? "#ffd966" : "#8b5a2b"};
            border-radius:4px; font-size:14px;
            color:#e8d8a8; cursor:pointer;
          ">🏗 Строительство</button>
          <button id="btn-export" style="padding:6px 14px;">💾 Экспорт</button>
          <button id="btn-import" style="padding:6px 14px;">📂 Импорт</button>
          <button id="btn-cloud-save" style="padding:6px 14px; background:#2e4a3a; border-color:#4a8b5a; color:#ccffdd;">☁️ В облако</button>
          <button id="btn-cloud-load" style="padding:6px 14px; background:#3a2e4a; border-color:#8b5a8b; color:#ffccff;">☁️ Из облака</button>
          <button id="desk-close" style="padding:6px 14px;">Закрыть</button>
        </div>
      </div>

      <div id="tab-content" style="flex:1; overflow-y:auto; padding:24px;"></div>

      <input id="import-file" type="file" accept=".json" style="display:none;" />
    `;

    document.getElementById("desk-close").onclick = close;
    document.getElementById("tab-library").onclick = () => {
      activeTab = "library";
      render();
    };
    document.getElementById("tab-build").onclick = () => {
      activeTab = "build";
      render();
    };

    // Экспорт
    document.getElementById("btn-export").onclick = () => {
      exportWorldToFile(world);
    };

    // Импорт
    const fileInput = document.getElementById("import-file");
    document.getElementById("btn-import").onclick = () => {
      fileInput.click();
    };
    fileInput.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const confirmed = confirm("Импортировать мир из файла? Текущий мир будет заменён.");
      if (!confirmed) {
        fileInput.value = "";
        return;
      }
      importWorldFromFile(file, (newWorld) => {
        alert("Мир импортирован. Игра перезагрузится.");
        location.reload();
      });
    };

        // Сохранить в облако
    document.getElementById("btn-cloud-save").onclick = async () => {
      try {
        const btn = document.getElementById("btn-cloud-save");
        btn.textContent = "⏳ Сохранение...";
        btn.disabled = true;

        await saveToCloud(world);

        btn.textContent = "✅ Сохранено!";
        setTimeout(() => {
          btn.textContent = "☁️ В облако";
          btn.disabled = false;
        }, 2000);
      } catch (err) {
        if (!err.message.includes("отменено")) {
          alert(err.message);
        }
        document.getElementById("btn-cloud-save").textContent = "☁️ В облако";
        document.getElementById("btn-cloud-save").disabled = false;
      }
    };

    // НОВОЕ: Загрузить из облака
        document.getElementById("btn-cloud-load").onclick = async () => {
      const confirmed = confirm("Загрузить мир из облака? Текущий мир будет заменён.");
      if (!confirmed) return;

      try {
        const btn = document.getElementById("btn-cloud-load");
        btn.textContent = "⏳ Загрузка...";
        btn.disabled = true;

        const cloudWorld = await loadFromCloud();
        
        if (!cloudWorld || Object.keys(cloudWorld).length === 0) {
          alert("В облаке пока нет сохранений.");
          btn.textContent = "☁️ Из облака";
          btn.disabled = false;
          return;
        }

        localStorage.setItem("knowledge-library-world-v6", JSON.stringify(cloudWorld));
        
        alert("Мир загружен из облака. Игра перезагрузится.");
        location.reload();
      } catch (err) {
        if (!err.message.includes("отменена") && !err.message.includes("Неверный")) {
          alert("Ошибка загрузки: " + err.message);
        } else if (err.message.includes("Неверный")) {
          alert("Неверный пароль");
        }
        document.getElementById("btn-cloud-load").textContent = "☁️ Из облака";
        document.getElementById("btn-cloud-load").disabled = false;
      }
    };

    const content = document.getElementById("tab-content");

    if (activeTab === "library") {
      renderLibraryTab(content);
    } else {
      renderBuildTab(content);
    }

    modal.querySelectorAll("button, [data-toggle]").forEach((el) => {
      el.addEventListener("keydown", (e) => e.stopPropagation());
      el.addEventListener("keyup", (e) => e.stopPropagation());
    });
  }

  function renderLibraryTab(container) {
    const rootNodes = getHallRootNodes(world, hallId);

    container.innerHTML = rootNodes.length === 0
      ? `<div style="color:#8b7a5a; font-size:14px;">В зале пока нет объектов.</div>`
      : `<div id="tree-container" style="display:flex; flex-direction:column; gap:4px;"></div>
         <div style="margin-top:20px; padding-top:12px; border-top:1px solid #5a4020; font-size:12px; color:#8b7a5a;">
           Всего объектов верхнего уровня: ${rootNodes.length}
         </div>`;

    const treeContainer = document.getElementById("tree-container");
    if (treeContainer) {
      for (const node of rootNodes) {
        treeContainer.appendChild(renderNodeRow(world, node, 0));
      }
    }
  }

  function renderBuildTab(container) {
    const playerPos = getPlayerPos ? getPlayerPos() : { x: 0, y: 0 };
    const mapEl = renderBuildMap(world, hallId, playerPos, {
      onChange: () => {
        if (onChange) onChange();
        render();
      },
    });
    container.appendChild(mapEl);
  }

  render();
}

function renderNodeRow(world, node, level) {
  const wrapper = document.createElement("div");
  wrapper.style.cssText = "display:flex; flex-direction:column;";

  const row = document.createElement("div");
  row.style.cssText = `
    display:flex; align-items:center; gap:10px;
    padding:6px 10px;
    border-radius:4px;
    margin-left:${level * 24}px;
    font-size:14px;
  `;

  const filled = countFilled(world, node);
  const total = totalSlots(node);
  const isFilled = isNodeFilled(world, node);
  const name = node.category || "(без названия)";
  const icon = DEPTH_ICONS[node.depth] || "?";

  const isShelf = node.depth === 0;
  const hasBookChildren = isShelf && node.bookIds.length > 0;
  const hasNodeChildren = node.childIds.length > 0;
  const hasChildren = hasNodeChildren || hasBookChildren;

  row.style.cursor = hasChildren ? "pointer" : "default";

  row.innerHTML = `
    <span style="width:16px; color:#8b7a5a;">${hasChildren ? "▶" : " "}</span>
    <span style="font-size:16px;">${icon}</span>
    <span style="flex:1;">${escapeHtml(name)}</span>
    <span style="color:${isFilled ? "#ffd966" : "#8b7a5a"};">
      ${filled}/${total}${isFilled ? " ✓" : ""}
    </span>
    <span style="color:#5a4020; font-size:11px;">${DEPTH_NAMES[node.depth]}</span>
  `;

  wrapper.appendChild(row);

  let childrenContainer = null;
  let expanded = false;

  if (hasChildren) {
    row.onmouseenter = () => { row.style.background = "#2a231a"; };
    row.onmouseleave = () => { row.style.background = ""; };

    row.onclick = () => {
      expanded = !expanded;
      row.querySelector("span:first-child").textContent = expanded ? "▼" : "▶";

      if (expanded) {
        childrenContainer = document.createElement("div");
        childrenContainer.style.cssText = "display:flex; flex-direction:column; gap:4px;";

        if (hasBookChildren) {
          node.bookIds.forEach((bookId, idx) => {
            childrenContainer.appendChild(renderBookRow(world, bookId, idx, level + 1));
          });
        } else {
          for (const childId of node.childIds) {
            const child = world.nodes[childId];
            if (!child) continue;
            childrenContainer.appendChild(renderNodeRow(world, child, level + 1));
          }
        }

        wrapper.appendChild(childrenContainer);
      } else {
        if (childrenContainer) {
          childrenContainer.remove();
          childrenContainer = null;
        }
      }
    };
  }

  return wrapper;
}

function renderBookRow(world, bookId, slotIndex, level) {
  const row = document.createElement("div");
  row.style.cssText = `
    display:flex; align-items:center; gap:10px;
    padding:4px 10px;
    margin-left:${level * 24}px;
    font-size:13px;
    color:#8b7a5a;
  `;

  if (!bookId) {
    row.innerHTML = `
      <span style="width:16px;"></span>
      <span style="font-size:14px;">📄</span>
      <span style="flex:1; font-style:italic;">(пусто)</span>
    `;
    return row;
  }

  const book = world.books[bookId];
  if (!book) {
    row.innerHTML = `
      <span style="width:16px;"></span>
      <span style="font-size:14px;">📄</span>
      <span style="flex:1; font-style:italic;">(не найдена)</span>
    `;
    return row;
  }

  const filled = isBookFilled(book);
  const pagesCount = book.pages.filter((p) => p && p.trim() !== "").length;
  const title = book.title ? escapeHtml(book.title) : "(без названия)";

  row.innerHTML = `
    <span style="width:16px;"></span>
    <span style="font-size:14px;">${filled ? "📖" : "📄"}</span>
    <span style="flex:1; color:${filled ? "#e8d8a8" : "#8b7a5a"};">${title}</span>
    <span style="color:#5a4020; font-size:11px;">
      ${filled ? `${pagesCount} стр.` : "пустая"}
    </span>
  `;

  return row;
}

function escapeHtml(s) {
  return (s || "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[c]));
}