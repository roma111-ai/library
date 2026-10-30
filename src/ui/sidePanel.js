// src/ui/sidePanel.js
import {
  isBookFilled,
  countFilled,
  totalSlots,
  DEPTH_NAMES,
  takeBook,
  placeBook,
  hasBookInInventory,
  deleteNodeDeep,
  deleteBookEverywhere,
} from "../data/model.js";
import { openBookModal } from "./bookModal.js";

const PANEL_WIDTH = 380;

export function openSidePanel(world, node, { onClose, onOpenChild, onChange }) {
  const old = document.getElementById("side-panel");
  if (old) old.remove();

  const panel = document.createElement("div");
  panel.id = "side-panel";
  panel.style.cssText = `
    position: fixed; top: 0; right: 0; bottom: 0;
    width: ${PANEL_WIDTH}px;
    background: #1e1a14;
    border-left: 2px solid #8b5a2b;
    color: #e8d8a8;
    font-family: monospace;
    display: flex; flex-direction: column;
    z-index: 1000;
    transition: transform 0.2s ease;
    transform: translateX(100%);
  `;
  document.body.appendChild(panel);

  requestAnimationFrame(() => {
    panel.style.transform = "translateX(0)";
  });

  const canvas = document.querySelector("canvas");
  let oldCanvasStyle = "";
  if (canvas) {
    oldCanvasStyle = canvas.style.cssText;
    canvas.style.transition = "width 0.2s ease";
    canvas.style.width = `calc(100% - ${PANEL_WIDTH}px)`;
  }
  window.dispatchEvent(new Event("resize"));

  function closePanel() {
    if (canvas) canvas.style.cssText = oldCanvasStyle;
    window.dispatchEvent(new Event("resize"));
    panel.remove();
    onClose();
  }

  function render() {
    const filled = countFilled(world, node);
    const total = totalSlots(node);
    const name = node.category || "(без названия)";
    const depthName = DEPTH_NAMES[node.depth];
    const hasBook = hasBookInInventory(world);

    // найти родителя
    let parentNode = null;
    let parentName = "";
    let parentDepthName = "";
    if (node.parentId && world.nodes[node.parentId]) {
      parentNode = world.nodes[node.parentId];
      parentName = parentNode.category || "(без названия)";
      parentDepthName = DEPTH_NAMES[parentNode.depth];
    }

    let contentHtml = "";
    if (node.depth === 0) {
      contentHtml = `
        <div style="display:flex; gap:10px; align-items:flex-end; flex-wrap:wrap; min-height:180px;">
          ${node.bookIds.map((bookId, i) => renderBookSlot(world, bookId, i, hasBook)).join("")}
        </div>
        ${hasBook ? `<div style="margin-top:12px; color:#ffd966; font-size:12px;">У тебя в руках книга. Кликни на пустой слот, чтобы положить.</div>` : ""}
      `;
    } else {
      if (node.childIds.length === 0) {
        contentHtml = `
          <div style="color:#8b7a5a; padding:20px; font-size:13px;">
            Пусто. Заполни все слоты на этом уровне, чтобы здесь появились дочерние объекты.
          </div>
        `;
      } else {
        contentHtml = `
          <div style="display:flex; flex-direction:column; gap:10px;">
            ${node.childIds.map((id) => renderChildSlot(world, world.nodes[id])).join("")}
          </div>
        `;
      }
    }

    panel.innerHTML = `
      <div style="padding:16px; border-bottom:1px solid #5a4020;">
        ${parentNode ? `
          <button id="panel-back" style="
            width:100%;
            margin-bottom:12px;
            padding:8px 12px;
            background:#2a231a;
            border:1px solid #8b5a2b;
            border-radius:4px;
            color:#e8d8a8;
            font-family:monospace;
            font-size:13px;
            cursor:pointer;
            text-align:left;
            display:flex;
            align-items:center;
            gap:8px;
          ">
            <span style="color:#ffd966;">←</span>
            <span style="flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
              ${escapeHtml(parentName)}
            </span>
            <span style="color:#8b7a5a; font-size:11px;">
              ${escapeHtml(parentDepthName)}
            </span>
          </button>
        ` : ""}
        <div style="display:flex; justify-content:space-between; align-items:center; gap:8px;">
          <div style="flex:1; min-width:0;">
            <div id="panel-category" style="font-size:16px; cursor:pointer; border-bottom:1px dashed #8b7a5a; display:inline-block; max-width:100%; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
              ${escapeHtml(name)}
            </div>
            <div style="font-size:11px; color:#8b7a5a; margin-top:4px;">${depthName}</div>
          </div>
          <button id="panel-delete" style="flex-shrink:0; background:#5a2020; border-color:#8b2b2b; color:#ffcccc;" title="Удалить этот объект">🗑</button>
          <button id="panel-close" style="flex-shrink:0;">✕</button>
        </div>
      </div>

      <div style="flex:1; overflow-y:auto; padding:16px;">
        ${contentHtml}
      </div>

      <div style="padding:12px 16px; border-top:1px solid #5a4020; font-size:12px; color:#8b7a5a;">
        Заполнено: ${filled} / ${total}
      </div>
    `;

    // кнопка "Назад"
    const backBtn = document.getElementById("panel-back");
    if (backBtn && parentNode) {
      backBtn.onclick = () => {
        panel.remove();
        if (canvas) canvas.style.cssText = oldCanvasStyle;
        window.dispatchEvent(new Event("resize"));
        onOpenChild(parentNode.id);
      };
      backBtn.onmouseenter = () => { backBtn.style.background = "#3a2e1e"; };
      backBtn.onmouseleave = () => { backBtn.style.background = "#2a231a"; };
    }

    // переименование
    const catEl = document.getElementById("panel-category");
    catEl.onclick = () => {
      const next = prompt("Название:", node.category || "");
      if (next !== null) {
        node.category = next.trim();
        render();
      }
    };

    document.getElementById("panel-close").onclick = closePanel;

    document.getElementById("panel-delete").onclick = () => {
      const nm = node.category || "без названия";
      const dn = DEPTH_NAMES[node.depth];
      const confirmed = confirm(
        `Удалить ${dn.toLowerCase()} "${nm}" и всё, что внутри?`
      );
      if (!confirmed) return;

      const wasOpenId = node.id;
      deleteNodeDeep(world, wasOpenId);

      if (canvas) canvas.style.cssText = oldCanvasStyle;
      window.dispatchEvent(new Event("resize"));
      panel.remove();
      onClose();
    };

    // клик по книге
    panel.querySelectorAll("[data-book]").forEach((el) => {
      el.onclick = () => {
        const slotIndex = Number(el.dataset.slot);
        const bookId = node.bookIds[slotIndex];

        if (bookId) {
          const book = world.books[bookId];
          if (!book) return;
          openBookModal(book, world, () => {
            if (book.__deleted) {
              deleteBookEverywhere(world, book.id);
            }
            onChange && onChange();
            render();
          });
          return;
        }

        // пустой слот
        if (hasBookInInventory(world)) {
          if (placeBook(world, node, slotIndex)) {
            onChange && onChange();
            render();
          }
          return;
        }

        // создаём временную книгу
        const newId = `book_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
        const newBook = { id: newId, title: "", pages: [""], createdAt: Date.now() };
        world.books[newId] = newBook;

        openBookModal(newBook, world, () => {
          if (newBook.__deleted) {
            delete world.books[newId];
            onChange && onChange();
            render();
            return;
          }
          
          // ИСПОЛЬЗУЕМ НАШУ НОВУЮ УМНУЮ ПРОВЕРКУ
          if (isBookFilled(newBook)) {
            node.bookIds[slotIndex] = newId;
          } else {
            delete world.books[newId];
          }

          onChange && onChange();
          render();
        });
      };
    });

    // взять в руки
    panel.querySelectorAll("[data-take]").forEach((el) => {
      el.onclick = (e) => {
        e.stopPropagation();
        const slotIndex = Number(el.dataset.take);
        if (takeBook(world, node, slotIndex)) {
          onChange && onChange();
          render();
        }
      };
    });

    // дочерние узлы
    panel.querySelectorAll("[data-child]").forEach((el) => {
      el.onclick = () => {
        const childId = el.dataset.child;
        if (!childId) return;
        const child = world.nodes[childId];
        if (!child) return;
        panel.remove();
        if (canvas) canvas.style.cssText = oldCanvasStyle;
        window.dispatchEvent(new Event("resize"));
        onOpenChild(childId);
      };
    });

    panel
      .querySelectorAll("button, [data-book], [data-child], [data-take], #panel-category")
      .forEach((el) => {
        el.addEventListener("keydown", (e) => e.stopPropagation());
        el.addEventListener("keyup", (e) => e.stopPropagation());
      });
  }

  render();

  return { closePanel, rerender: render };
}

function renderBookSlot(world, bookId, slotIndex, hasBookInHand) {
  if (!bookId) {
    const style = hasBookInHand
      ? "background:#3a2e1e; border:2px solid #ffd966; box-shadow:0 0 10px #ffd96688; cursor:pointer;"
      : "background:#2a231a; border:2px dashed #5a4020; cursor:pointer;";

    return `
      <div data-book="${slotIndex}" data-slot="${slotIndex}" style="
        width:50px; height:80px;
        ${style}
        border-radius:2px 2px 0 0;
        display:flex; align-items:center; justify-content:center;
        color:#8b7a5a; font-size:10px;
      ">(пусто)</div>
    `;
  }

  const book = world.books[bookId];
  if (!book) {
    return `
      <div style="width:30px; height:80px; background:#3a2e1e; border:2px solid #5a4020; border-radius:2px 2px 0 0;"></div>
    `;
  }

  const filled = isBookFilled(book);
  
  // Считаем количество страниц (теперь это объекты)
  let pagesCount = 0;
  if (book.pages) {
    pagesCount = book.pages.filter((p) => {
      if (typeof p === "string") return p.trim() !== "";
      if (p && p.content) {
        const textOnly = p.content.replace(/<[^>]*>/g, "").trim();
        return textOnly !== "" || p.content.includes("<img");
      }
      return false;
    }).length;
  }

  const title = book.title ? escapeHtml(book.title) : "(пусто)";
  const width = Math.min(20 + pagesCount * 6, 70);
  const height = filled ? Math.min(80 + pagesCount * 8, 160) : 80;
  const bg = filled ? "#a06a3a" : "#3a2e1e";
  const border = filled ? "#e8d8a8" : "#5a4020";
  const color = filled ? "#1e1a14" : "#8b7a5a";

  const takeBtn = filled
    ? `<div data-take="${slotIndex}" style="
        position:absolute; top:-8px; right:-8px;
        background:#3a2e1e; border:1px solid #8b5a2b; border-radius:50%;
        width:20px; height:20px; display:flex; align-items:center; justify-content:center;
        font-size:12px; cursor:pointer; color:#e8d8a8;
      " title="Взять в руки">→</div>`
    : "";

  return `
    <div style="position:relative;">
      <div data-book="${slotIndex}" data-slot="${slotIndex}" style="
        width:${width}px; height:${height}px;
        background:${bg}; border:2px solid ${border};
        display:flex; align-items:flex-end; justify-content:center;
        cursor:pointer; border-radius:2px 2px 0 0;
        padding-bottom:6px;
      " title="${title}">
        <div style="writing-mode:vertical-rl; transform:rotate(180deg); font-size:11px; color:${color}; overflow:hidden; max-height:${height - 20}px; white-space:nowrap; text-overflow:ellipsis;">${title}</div>
      </div>
      ${takeBtn}
    </div>
  `;
}

function renderChildSlot(world, child) {
  if (!child) {
    return `
      <div style="
        height:60px; background:#2a231a; border:2px dashed #5a4020;
        display:flex; align-items:center; justify-content:center;
        border-radius:4px; color:#8b7a5a; font-size:12px;
      ">(пусто)</div>
    `;
  }

  const filled = countFilled(world, child);
  const total = totalSlots(child);
  const label = child.category ? escapeHtml(child.category) : "(без названия)";
  const depthName = DEPTH_NAMES[child.depth] || "";
  const isFilled = filled === total && total > 0;

  return `
    <div data-child="${child.id}" style="
      background:${isFilled ? "#3a2e1e" : "#2a231a"};
      border:2px solid ${isFilled ? "#c9a05a" : "#5a4020"};
      padding:10px; border-radius:4px; cursor:pointer;
      display:flex; justify-content:space-between; align-items:center; gap:8px;
    ">
      <div style="min-width:0;">
        <div style="font-size:10px; color:#8b7a5a;">${depthName}</div>
        <div style="font-size:14px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${label}</div>
      </div>
      <div style="font-size:12px; color:${isFilled ? "#ffd966" : "#8b7a5a"}; flex-shrink:0;">
        ${filled}/${total}
      </div>
    </div>
  `;
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