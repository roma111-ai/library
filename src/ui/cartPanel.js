// src/ui/cartPanel.js
import {
  isBookFilled,
  countCartBooks,
  takeBookFromCart,
} from "../data/model.js";

let panelEl = null;
let currentWorld = null;
let currentOnChange = null;

export function toggleCartPanel(world, { onChange }) {
  if (panelEl) {
    closeCartPanel();
    return;
  }
  openCartPanel(world, { onChange });
}

export function openCartPanel(world, { onChange }) {
  if (panelEl) return;

  currentWorld = world;
  currentOnChange = onChange;

  panelEl = document.createElement("div");
  panelEl.id = "cart-panel";
  panelEl.style.cssText = `
    position: fixed;
    left: 50%;
    bottom: 110px;
    transform: translateX(-50%);
    background: #1e1a14;
    border: 2px solid #8b5a2b;
    border-radius: 8px;
    padding: 16px;
    font-family: monospace;
    color: #e8d8a8;
    z-index: 800;
    box-shadow: 0 4px 20px #000000aa;
  `;
  document.body.appendChild(panelEl);

  render();
}

export function closeCartPanel() {
  if (panelEl) {
    panelEl.remove();
    panelEl = null;
  }
  currentWorld = null;
  currentOnChange = null;
}

export function isCartPanelOpen() {
  return panelEl !== null;
}

export function rerenderCartPanel() {
  if (panelEl) render();
}

function render() {
  if (!panelEl || !currentWorld) return;

  const world = currentWorld;
  const onChange = currentOnChange;

  const count = countCartBooks(world);
  const slots = world.cartInventory || [];

  const slotsHtml = slots.map((bookId, idx) => {
    if (!bookId) {
      return `
        <div data-cart-slot="${idx}" style="
          width:40px; height:40px;
          background:#2a231a; border:2px dashed #5a4020;
          border-radius:4px; display:flex; align-items:center; justify-content:center;
          color:#5a4020; font-size:10px;
        ">·</div>
      `;
    }
    const book = world.books[bookId];
    const title = book && book.title ? escapeHtml(book.title).slice(0, 10) : "?";
    const filled = book && isBookFilled(book);
    return `
      <div data-cart-slot="${idx}" style="
        width:40px; height:40px;
        background:${filled ? "#a06a3a" : "#3a2e1e"};
        border:2px solid ${filled ? "#e8d8a8" : "#5a4020"};
        border-radius:4px; display:flex; align-items:center; justify-content:center;
        cursor:pointer; color:#1e1a14; font-size:9px; text-align:center;
        padding:2px; overflow:hidden;
      " title="${title}">${title}</div>
    `;
  }).join("");

  panelEl.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; gap:12px;">
      <div style="font-size:14px; color:#ffd966;">
        🛒 Телега — ${count} / 25
      </div>
      <button id="cart-close" style="padding:4px 10px;">Закрыть</button>
    </div>
    <div style="
      display:grid;
      grid-template-columns: repeat(5, 40px);
      gap:6px;
    ">
      ${slotsHtml}
    </div>
    <div style="font-size:11px; color:#8b7a5a; margin-top:10px;">
      Клик по книге — взять в руки. В руках: ${world.inventory.filter(b => b).length} / 2.
    </div>
  `;

  document.getElementById("cart-close").onclick = () => {
    closeCartPanel();
    if (onChange) onChange();
  };

  panelEl.querySelectorAll("[data-cart-slot]").forEach((el) => {
    el.onclick = () => {
      const idx = Number(el.dataset.cartSlot);
      if (world.cartInventory[idx]) {
        if (takeBookFromCart(world, idx)) {
          render();
          if (onChange) onChange();
        }
      }
    };
    el.addEventListener("keydown", (e) => e.stopPropagation());
    el.addEventListener("keyup", (e) => e.stopPropagation());
  });
}

function escapeHtml(s) {
  return (s || "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}