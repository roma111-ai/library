// src/ui/inventoryBar.js
import { isBookFilled } from "../data/model.js";

const BAR_HEIGHT = 90;

export function renderInventoryBar(world, { onPlaceFromInventory, onPutToCart }) {
  const old = document.getElementById("inventory-bar");
  if (old) old.remove();

  const bar = document.createElement("div");
  bar.id = "inventory-bar";
  bar.style.cssText = `
    position: fixed; left: 0; right: 0; bottom: 0;
    height: ${BAR_HEIGHT}px;
    background: #1e1a14;
    border-top: 2px solid #8b5a2b;
    color: #e8d8a8;
    font-family: monospace;
    display: flex; align-items: center;
    padding: 0 20px; gap: 16px;
    z-index: 900;
  `;

  const canvas = document.querySelector("canvas");
  let oldCanvasStyle = "";
  if (canvas) {
    oldCanvasStyle = canvas.style.cssText;
    canvas.style.height = `calc(100% - ${BAR_HEIGHT}px)`;
  }

  const slotsHtml = world.inventory.map((bookId, i) => {
    if (!bookId) {
      return `
        <div style="
          width:80px; height:60px;
          background:#2a231a; border:2px dashed #5a4020;
          border-radius:4px; display:flex; align-items:center; justify-content:center;
          color:#5a4020; font-size:11px;
        ">пусто</div>
      `;
    }

    const book = world.books[bookId];
    const title = book && book.title ? escapeHtml(book.title) : "(без названия)";
    return `
      <div style="position:relative;">
        <div style="
          width:80px; height:60px;
          background:#a06a3a; border:2px solid #e8d8a8;
          border-radius:4px; display:flex; align-items:center; justify-content:center;
          color:#1e1a14; font-size:10px; text-align:center; padding:4px;
          overflow:hidden;
        " title="${title}">${title}</div>
        <div data-place="${i}" style="
          position:absolute; top:-8px; right:-8px;
          background:#3a2e1e; border:1px solid #8b5a2b; border-radius:50%;
          width:22px; height:22px; display:flex; align-items:center; justify-content:center;
          font-size:13px; cursor:pointer; color:#e8d8a8;
        " title="Положить в открытую полку">←</div>
        <div data-put-cart="${i}" style="
          position:absolute; top:-8px; left:-8px;
          background:#3a2e1e; border:1px solid #8b5a2b; border-radius:50%;
          width:22px; height:22px; display:flex; align-items:center; justify-content:center;
          font-size:11px; cursor:pointer; color:#e8d8a8;
        " title="Положить в телегу">🛒</div>
      </div>
    `;
  }).join("");

  bar.innerHTML = `
    <div style="font-size:12px; color:#8b7a5a;">В руках:</div>
    <div style="display:flex; gap:14px;">${slotsHtml}</div>
  `;

  document.body.appendChild(bar);
  window.dispatchEvent(new Event("resize"));

  bar.querySelectorAll("[data-place]").forEach((el) => {
    el.onclick = () => {
      const invIdx = Number(el.dataset.place);
      onPlaceFromInventory && onPlaceFromInventory(invIdx);
    };
  });

  bar.querySelectorAll("[data-put-cart]").forEach((el) => {
    el.onclick = () => {
      const invIdx = Number(el.dataset.putCart);
      onPutToCart && onPutToCart(invIdx);
    };
  });

  bar.querySelectorAll("button, [data-place], [data-put-cart]").forEach((el) => {
    el.addEventListener("keydown", (e) => e.stopPropagation());
    el.addEventListener("keyup", (e) => e.stopPropagation());
  });

  return {
    destroy: () => {
      if (canvas) canvas.style.cssText = oldCanvasStyle;
      window.dispatchEvent(new Event("resize"));
      bar.remove();
    },
  };
}

function escapeHtml(s) {
  return (s || "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}