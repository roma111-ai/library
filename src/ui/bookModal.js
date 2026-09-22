export function openBookModal(book, world, onSave) {
  let modal = document.getElementById("book-modal");
  if (modal) modal.remove();

  modal = document.createElement("div");
  modal.id = "book-modal";
  modal.style.cssText = `
    position: fixed; inset: 0; background: #000000cc;
    display: flex; align-items: center; justify-content: center;
    z-index: 2000; font-family: monospace;
  `;

  document.body.appendChild(modal);

  let pageIndex = 0;

  function render() {
    const page = book.pages[pageIndex] ?? "";

    modal.innerHTML = `
      <div style="background:#1e1a14; border:2px solid #8b5a2b; padding:20px; width:600px; color:#e8d8a8;">
        <input id="book-title" placeholder="Название книги" value="${escapeAttr(book.title)}"
          style="width:100%; background:#2a231a; color:#e8d8a8; border:1px solid #5a4020; padding:8px; font-size:16px; margin-bottom:12px; font-family:inherit; box-sizing:border-box;" />
        <div style="background:#2a231a; border:1px solid #5a4020; padding:12px; height:340px;">
          <textarea id="page-content" placeholder="Страница ${pageIndex + 1}..."
            style="width:100%; height:100%; background:transparent; color:#e8d8a8; border:none; resize:none; outline:none; font-family:inherit; font-size:14px; line-height:1.6; box-sizing:border-box;"
          >${escapeHtml(page)}</textarea>
        </div>
        <div style="display:flex; justify-content:space-between; align-items:center; margin-top:12px;">
          <div>
            <button id="prev-page" ${pageIndex === 0 ? "disabled" : ""}>◀</button>
            <span style="margin:0 12px;">${pageIndex + 1} / ${book.pages.length}</span>
            <button id="next-page" ${pageIndex === book.pages.length - 1 ? "disabled" : ""}>▶</button>
            <button id="add-page" style="margin-left:12px;">+ страница</button>
          </div>
          <div style="display:flex; gap:8px;">
            <button id="book-delete" style="background:#5a2020; border-color:#8b2b2b; color:#ffcccc;">Удалить</button>
            <button id="close-book">Закрыть</button>
          </div>
        </div>
      </div>
    `;

    const titleInput = document.getElementById("book-title");
    const pageArea = document.getElementById("page-content");
    const prevBtn = document.getElementById("prev-page");
    const nextBtn = document.getElementById("next-page");
    const addBtn = document.getElementById("add-page");
    const closeBtn = document.getElementById("close-book");
    const deleteBtn = document.getElementById("book-delete");

    titleInput.addEventListener("input", () => {
      book.title = titleInput.value;
    });

    pageArea.addEventListener("input", () => {
      book.pages[pageIndex] = pageArea.value;
    });

    [titleInput, pageArea].forEach((el) => {
      el.addEventListener("keydown", (e) => e.stopPropagation());
      el.addEventListener("keyup", (e) => e.stopPropagation());
      el.addEventListener("keypress", (e) => e.stopPropagation());
    });

    [prevBtn, nextBtn, addBtn, closeBtn, deleteBtn].forEach((el) => {
      el.addEventListener("keydown", (e) => e.stopPropagation());
      el.addEventListener("keyup", (e) => e.stopPropagation());
    });

    prevBtn.onclick = () => {
      if (pageIndex > 0) { pageIndex--; render(); }
    };

    nextBtn.onclick = () => {
      if (pageIndex < book.pages.length - 1) { pageIndex++; render(); }
    };

    addBtn.onclick = () => {
      book.pages.push("");
      pageIndex = book.pages.length - 1;
      render();
    };

    closeBtn.onclick = () => {
      modal.remove();
      onSave();
    };

    deleteBtn.onclick = () => {
      const confirmed = confirm("Удалить эту книгу?");
      if (!confirmed) return;
      book.__deleted = true;
      modal.remove();
      onSave();
    };

    if (book.title && book.title.trim().length > 0) {
      pageArea.focus();
    } else {
      titleInput.focus();
    }
  }

  render();
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

function escapeAttr(s) {
  return escapeHtml(s);
}