import Quill from "quill";
import "quill/dist/quill.snow.css";
import { uploadFileToGitHub } from "../data/storage.js";

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

  // --- АВАРИЙНАЯ МИГРАЦИЯ СТАРЫХ КНИГ ---
  if (book.pages && book.pages.length > 0 && typeof book.pages[0] === "string") {
    book.pages = book.pages.map((text, i) => ({
      id: `page_${book.id}_${i}_${Date.now()}`,
      content: text ? `<p>${text.replace(/\n/g, "<br>")}</p>` : "",
      files: []
    }));
  }

  let pageIndex = 0;
  let quillInstance = null;

  function render() {
    const pageObj = book.pages[pageIndex];
    const pageContent = pageObj ? pageObj.content : "";
    const pageFiles = pageObj ? pageObj.files : [];

    modal.innerHTML = `
      <div style="background:#1e1a14; border:2px solid #8b5a2b; padding:20px; width:900px; max-width:98vw; color:#e8d8a8; display:flex; flex-direction:column; height: 95vh; box-sizing: border-box; border-radius: 8px;">
        
        <input id="book-title" placeholder="Название книги" value="${escapeAttr(book.title)}"
          style="width:100%; background:#2a231a; color:#e8d8a8; border:1px solid #5a4020; padding:10px; font-size:16px; margin-bottom:12px; font-family:inherit; box-sizing:border-box; border-radius: 4px;" />
        
        <!-- Контейнер для Quill -->
        <div style="flex:1; overflow:hidden; display:flex; flex-direction:column; border:1px solid #5a4020; border-radius: 4px; background: #f3f0e8;">
          <div id="editor-container" style="flex:1; overflow-y:auto;"></div>
        </div>

        <!-- Прикрепленные файлы -->
        <div id="files-list" style="margin-top:10px; display:flex; flex-wrap:wrap; gap:8px;">
          ${pageFiles.map(f => `<a href="${f.url}" target="_blank" style="color:#ffd966; font-size:12px; background:#3a2e1e; padding:4px 8px; border-radius:4px; text-decoration:none; border: 1px solid #5a4020;">📎 ${escapeHtml(f.name)}</a>`).join("")}
        </div>

        <div style="display:flex; justify-content:space-between; align-items:center; margin-top:12px; flex-wrap: wrap; gap: 10px;">
          <div style="display:flex; align-items:center; gap: 8px;">
            <button id="prev-page" ${pageIndex === 0 ? "disabled" : ""}>◀</button>
            <span style="margin:0 8px;">${pageIndex + 1} / ${book.pages.length}</span>
            <button id="next-page" ${pageIndex === book.pages.length - 1 ? "disabled" : ""}>▶</button>
            <button id="add-page">+ страница</button>
            <button id="attach-file" title="Прикрепить файл или картинку">📎 Файл</button>
          </div>
          <div style="display:flex; gap:8px;">
            <button id="book-delete" style="background:#5a2020; border-color:#8b2b2b; color:#ffcccc;">Удалить</button>
            <button id="close-book">Закрыть</button>
          </div>
        </div>
      </div>
    `;

    // Инициализация Quill
    quillInstance = new Quill("#editor-container", {
      theme: "snow",
      modules: {
        toolbar: [
          [{ 'header': [1, 2, 3, false] }],
          ['bold', 'italic', 'underline', 'strike'],
          [{ 'color': [] }, { 'background': [] }],
          [{ 'list': 'ordered'}, { 'list': 'bullet' }],
          ['link', 'image', 'table'],
          ['clean']
        ]
      }
    });

        // Блокируем передачу клавиш в Phaser
    quillInstance.root.addEventListener("keydown", (e) => e.stopPropagation());
    quillInstance.root.addEventListener("keyup", (e) => e.stopPropagation());
    quillInstance.root.addEventListener("keypress", (e) => e.stopPropagation());

    quillInstance.clipboard.dangerouslyPasteHTML(pageContent);

    quillInstance.on("text-change", () => {
      book.pages[pageIndex].content = quillInstance.root.innerHTML;
    });

    const titleInput = document.getElementById("book-title");
    const prevBtn = document.getElementById("prev-page");
    const nextBtn = document.getElementById("next-page");
    const addBtn = document.getElementById("add-page");
    const closeBtn = document.getElementById("close-book");
    const deleteBtn = document.getElementById("book-delete");
    const attachBtn = document.getElementById("attach-file");

    titleInput.addEventListener("input", () => { book.title = titleInput.value; });

    [titleInput, closeBtn, deleteBtn, attachBtn, prevBtn, nextBtn, addBtn].forEach((el) => {
      el.addEventListener("keydown", (e) => e.stopPropagation());
      el.addEventListener("keyup", (e) => e.stopPropagation());
    });

    prevBtn.onclick = () => { if (pageIndex > 0) { pageIndex--; render(); } };
    nextBtn.onclick = () => { if (pageIndex < book.pages.length - 1) { pageIndex++; render(); } };
    
    addBtn.onclick = () => {
      book.pages.push({ id: `page_${Date.now()}`, content: "", files: [] });
      pageIndex = book.pages.length - 1;
      render();
    };

    closeBtn.onclick = () => { modal.remove(); onSave(); };
    
    deleteBtn.onclick = () => {
      if (!confirm("Удалить эту книгу?")) return;
      book.__deleted = true;
      modal.remove();
      onSave();
    };

    attachBtn.onclick = () => {
      const fileInput = document.createElement("input");
      fileInput.type = "file";
      
      fileInput.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        attachBtn.textContent = "⏳ Загрузка...";
        attachBtn.disabled = true;

        try {
          const fileUrl = await uploadFileToGitHub(file);
          
          if (file.type.startsWith("image/")) {
            const range = quillInstance.getSelection(true);
            quillInstance.insertEmbed(range.index, 'image', fileUrl);
            quillInstance.setSelection(range.index + 1);
          } else {
            book.pages[pageIndex].files.push({ name: file.name, url: fileUrl });
            const filesList = document.getElementById("files-list");
            const a = document.createElement("a");
            a.href = fileUrl;
            a.target = "_blank";
            a.style.cssText = "color:#ffd966; font-size:12px; background:#3a2e1e; padding:4px 8px; border-radius:4px; text-decoration:none; border: 1px solid #5a4020;";
            a.textContent = `📎 ${file.name}`;
            filesList.appendChild(a);
          }

          attachBtn.textContent = "✅ Готово!";
          setTimeout(() => { attachBtn.textContent = "📎 Файл"; attachBtn.disabled = false; }, 2000);
        } catch (err) {
          alert(err.message);
          attachBtn.textContent = "📎 Файл";
          attachBtn.disabled = false;
        }
      };
      
      fileInput.click();
    };

    if (book.title && book.title.trim().length > 0) {
      quillInstance.focus();
    } else {
      titleInput.focus();
    }
  }

  render();
}

function escapeHtml(s) {
  return (s || "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

function escapeAttr(s) { return escapeHtml(s); }