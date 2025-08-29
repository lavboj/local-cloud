// ======================= Глобальные переменные =======================
const content = document.getElementById('content'),
      menu = document.getElementById('context-menu'),
      searchInput = document.getElementById('search-input'),
      selectBtn = document.getElementById('select-btn'),
      deleteSelBtn = document.getElementById('delete-selected'),
      downloadSelBtn = document.getElementById('download-selected'),
      createDirBtn = document.getElementById('create-dir'),
      pathDisplay = document.getElementById('current-path'),
      createModal = document.getElementById('create-modal'),
      createInput = document.getElementById('create-input');

let selectedMode = false,
    currentPath = '';

// ======================= Служебные функции ==========================
function updateDeleteBtn() {
    const selected = document.querySelectorAll('.item.selected');
    deleteSelBtn.style.display = selected.length ? 'inline-block' : 'none';
    updateDownloadBtn();
}

function updateDownloadBtn() {
    const selected = document.querySelectorAll('.item.selected');
    downloadSelBtn.style.display = selected.length ? 'inline-block' : 'none';
}

function updatePathDisplay() {
    pathDisplay.textContent = currentPath ? '/' + currentPath : '/';
}

async function isDirEmpty(p, n) {
    try {
        const path = (p ? p.replace(/\/$/, '') + '/' : '') + n,
              r = await fetch(`/api/storage/content?userPath=${encodeURIComponent(path)}`);
        if (!r.ok) return false;
        const d = await r.json();
        return !d.length;
    } catch { return false; }
}

// ======================= Загрузка и рендер элементов =================
async function fetchItems(filter = "") {
    try {
        const r = await fetch(`/api/storage/content?userPath=${encodeURIComponent(currentPath)}`),
              data = await r.json();
        let items = data;
        if (filter) items = items.filter(i => i.name.toLowerCase().includes(filter.toLowerCase()));
        items.sort((a, b) => a.directory !== b.directory ? a.directory ? -1 : 1 : a.name.localeCompare(b.name));
        renderItems(items);
        updatePathDisplay();
    } catch (e) { console.error("Ошибка получения:", e); }
}

function renderItems(items) {
    content.innerHTML = '';
    items.forEach(i => {
        const d = document.createElement('div');
        d.className = `item ${i.directory ? 'dir' : 'file'}`;
        d.dataset.fullname = i.name;
        d.dataset.directory = i.directory;
        d.textContent = i.name;

        // клик: select / переход в директорию
        d.onclick = async () => {
            if (selectedMode) {
                d.classList.toggle('selected');
                updateDeleteBtn();
            } else if (i.directory) {
                currentPath = currentPath ? currentPath + '/' + i.name : i.name;
                await fetchItems(searchInput.value);
            }
        };

        // контекстное меню
        d.oncontextmenu = e => {
            e.preventDefault();
            menu.style.top = e.pageY + 'px';
            menu.style.left = e.pageX + 'px';
            menu.style.display = 'flex';
            menu.dataset.target = i.name;
            menu.dataset.directory = i.directory;
        };

        content.appendChild(d);
    });
    updateDeleteBtn();
}

// ======================= Навигация по пути ==========================
pathDisplay.onclick = async () => {
    if (!currentPath) return;
    const parts = currentPath.split('/'); parts.pop();
    currentPath = parts.join('/');
    await fetchItems(searchInput.value);
};

// ======================= Создание папки =============================
createDirBtn.onclick = () => {
    createModal.style.display = 'flex';
    createInput.value = ''; createInput.focus();
};
document.getElementById('create-confirm').onclick = async () => {
    const name = createInput.value.trim();
    if (!name) return alert('Введите имя папки');
    createModal.style.display = 'none';
    try {
        const r = await fetch(`/api/storage/create?userPath=${encodeURIComponent(currentPath)}&directoryName=${encodeURIComponent(name)}`, { method: 'POST' });
        if (r.ok) fetchItems(searchInput.value);
    } catch (e) { console.error('Ошибка создания:', e); }
};
document.getElementById('create-cancel').onclick = () => createModal.style.display = 'none';

// ======================= Удаление элементов ========================
deleteSelBtn.onclick = () => {
    const items = [...document.querySelectorAll('.item.selected')].map(d => ({ name: d.dataset.fullname, directory: d.dataset.directory === 'true' }));
    if (!items.length) return;
    const m = document.getElementById('delete-modal'), inp = document.getElementById('delete-input');
    m.style.display = 'flex'; inp.value = '';
    document.getElementById('delete-confirm').onclick = async () => {
        if (inp.value !== "DELETE") return alert("Введите DELETE для подтверждения");
        m.style.display = 'none';
        try {
            for (const i of items) {
                if (i.directory)
                    await fetch(`/api/storage/deleteDirectory?userPath=${encodeURIComponent(currentPath)}&directoryName=${encodeURIComponent(i.name)}&confirmed=true`, { method: 'DELETE' });
                else
                    await fetch(`/api/storage/deleteFile?userPath=${encodeURIComponent(currentPath)}`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify([i.name]) });
            }
            fetchItems(searchInput.value);
        } catch (e) { console.error(e); alert("Ошибка при удалении"); }
    };
    document.getElementById('delete-cancel').onclick = () => m.style.display = 'none';
};

// ======================= Контекстное меню ==========================
['delete', 'rename', 'download'].forEach(id => {
    document.getElementById(id).onclick = async () => {
        const t = menu.dataset.target, isDir = menu.dataset.directory === 'true';
        try {
            if (id === 'download') {
                const url = isDir
                    ? `/api/storage/downloadDirectory?userPath=${encodeURIComponent(currentPath)}&directoryName=${encodeURIComponent(t)}`
                    : `/api/storage/download?userPath=${encodeURIComponent(currentPath)}&fileName=${encodeURIComponent(t)}`;
                const link = document.createElement('a');
                link.href = url;
                link.download = t;
                document.body.appendChild(link);
                link.click();
                link.remove();
            } else if (id === 'delete') {
                if (!isDir)
                    await fetch(`/api/storage/deleteFile?userPath=${encodeURIComponent(currentPath)}`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify([t]) });
                else if (await isDirEmpty(currentPath, t))
                    await fetch(`/api/storage/deleteDirectory?userPath=${encodeURIComponent(currentPath)}&directoryName=${encodeURIComponent(t)}&confirmed=true`, { method: 'DELETE' });
                else {
                    const m = document.getElementById('delete-modal'), inp = document.getElementById('delete-input');
                    m.style.display = 'flex'; inp.value = '';
                    document.getElementById('delete-confirm').onclick = async () => {
                        if (inp.value !== "DELETE") return alert("Введите DELETE для подтверждения");
                        m.style.display = 'none';
                        await fetch(`/api/storage/deleteDirectory?userPath=${encodeURIComponent(currentPath)}&directoryName=${encodeURIComponent(t)}&confirmed=true`, { method: 'DELETE' });
                        fetchItems(searchInput.value);
                    };
                    document.getElementById('delete-cancel').onclick = () => m.style.display = 'none';
                    return;
                }
            }
            menu.style.display = 'none';
            fetchItems(searchInput.value);
        } catch (e) { console.error(e); }
    };
});

// ======================= Верхнее меню ==============================
searchInput.oninput = e => fetchItems(e.target.value);

selectBtn.onclick = () => {
    selectedMode = !selectedMode;
    document.querySelectorAll('.item').forEach(d => d.classList.remove('selected'));
    selectBtn.textContent = selectedMode ? 'Unselect' : 'Select';
    updateDeleteBtn();
};

downloadSelBtn.onclick = () => {
    const items = [...document.querySelectorAll('.item.selected')].map(d => ({
        name: d.dataset.fullname,
        isDir: d.dataset.directory === 'true'
    }));

    if (!items.length) return alert('Нет выбранных файлов или папок для скачивания');

    items.forEach(item => {
        const url = item.isDir
            ? `/api/storage/downloadDirectory?userPath=${encodeURIComponent(currentPath)}&directoryName=${encodeURIComponent(item.name)}`
            : `/api/storage/download?userPath=${encodeURIComponent(currentPath)}&fileName=${encodeURIComponent(item.name)}`;
        const link = document.createElement('a');
        link.href = url;
        link.download = item.name;
        document.body.appendChild(link);
        link.click();
        link.remove();
    });
};

// ============================== Загрузка файлов =====================
const uploadBtn = document.getElementById('upload-btn');
const uploadInput = document.getElementById('upload-input');

uploadBtn.onclick = () => uploadInput.click();

uploadInput.onchange = async () => {
    const file = uploadInput.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);
    formData.append('userPath', currentPath);

    try {
        const res = await fetch('/api/storage/upload', { method: 'POST', body: formData });
        if (!res.ok) throw new Error(await res.text());
        fetchItems(searchInput.value);
        uploadInput.value = '';
        alert('Файл загружен!');
    } catch (e) {
        console.error(e);
        alert('Ошибка при загрузке файла: ' + e.message);
    }
};

// ======================= Глобальные события ========================
document.addEventListener('click', e => { if (!e.target.classList.contains('item')) menu.style.display = 'none'; });
document.addEventListener('DOMContentLoaded', () => fetchItems());
