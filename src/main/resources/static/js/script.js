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

let selectedMode = false, currentPath = '';

// ======================= Служебные функции ==========================
const getSelectedItems = () => [...document.querySelectorAll('.item.selected')]
    .map(d => ({ name: d.dataset.fullname, isDir: d.dataset.directory === 'true' }));

const updateActionButtons = () => {
    const selected = getSelectedItems();
    const show = selectedMode || selected.length;
    deleteSelBtn.style.display = show ? 'inline-block' : 'none';
    downloadSelBtn.style.display = show ? 'inline-block' : 'none';
};

const updatePathDisplay = () => pathDisplay.textContent = currentPath ? '/' + currentPath : '/';

const isDirEmpty = async (p, n) => {
    try {
        const path = (p ? p.replace(/\/$/, '') + '/' : '') + n;
        const r = await fetch(`/api/storage/content?userPath=${encodeURIComponent(path)}`);
        if (!r.ok) return false;
        const d = await r.json();
        return !d.length;
    } catch { return false; }
};

const showToast = (msg, duration = 3000) => {
    const t = document.createElement('div');
    t.className = 'toast';
    t.textContent = msg;
    document.body.appendChild(t);
    requestAnimationFrame(() => t.classList.add('show'));
    setTimeout(() => {
        t.classList.remove('show');
        t.addEventListener('transitionend', () => t.remove());
    }, duration);
};

// ======================= Конвертация формата размеров =================

const formatSize = (bytes) => {
    if (!bytes) return '-';
    const units = ['KB','MB','GB','TB'];
    let i = Math.floor(Math.log(bytes) / Math.log(1024));
    i = Math.max(0, i - 1); // чтобы 1024 байт = 1 KB
    return (bytes / Math.pow(1024, i + 1)).toFixed(2) + ' ' + units[i];
};



// ======================= Загрузка и рендер элементов =================
const fetchItems = async (filter = '') => {
    try {
        const r = await fetch(`/api/storage/content?userPath=${encodeURIComponent(currentPath)}`);
        const data = await r.json();
        let items = filter ? data.filter(i => i.name.toLowerCase().includes(filter.toLowerCase())) : data;
        items.sort((a, b) => a.directory !== b.directory ? a.directory ? -1 : 1 : a.name.localeCompare(b.name));
        renderItems(items);
        updatePathDisplay();
    } catch (e) { console.error("Ошибка получения:", e); }
};

const renderItems = (items) => {
    content.innerHTML = '';
    items.forEach(i => {
        const row = document.createElement('div');
        row.className = `item ${i.directory ? 'dir' : 'file'}`;
        row.dataset.fullname = i.name;
        row.dataset.directory = i.directory;

        ['name','ext','size','date'].forEach(cls => {
            const col = document.createElement('div');
            col.className = 'col ' + cls;
            if(cls==='name') col.innerHTML = (i.directory ? '📁 ' : '📄 ') + i.name;
            if(cls==='ext') col.textContent = i.directory ? '' : (i.name.split('.').pop() || '');
            if(cls==='size') col.textContent = i.size ? formatSize(i.size) : '-';
            if(cls==='date') col.textContent = i.modified || '-';
            row.appendChild(col);
        });

        row.onclick = async () => {
            if (selectedMode) { row.classList.toggle('selected'); updateActionButtons(); }
            else if (i.directory) { currentPath = currentPath ? currentPath + '/' + i.name : i.name; await fetchItems(searchInput.value); }
        };

        row.oncontextmenu = e => {
            e.preventDefault();
            menu.style.top = e.pageY + 'px';
            menu.style.left = e.pageX + 'px';
            menu.style.display = 'flex';
            menu.dataset.target = i.name;
            menu.dataset.directory = i.directory;
        };

        content.appendChild(row);
    });
    updateActionButtons();
};

// ======================= Навигация по пути ==========================
pathDisplay.onclick = async () => {
    if (!currentPath) return;
    currentPath = currentPath.split('/').slice(0,-1).join('/');
    await fetchItems(searchInput.value);
};

// ======================= Создание папки =============================
createDirBtn.onclick = () => { createModal.style.display='flex'; createInput.value=''; createInput.focus(); };
document.getElementById('create-confirm').onclick = async () => {
    const name = createInput.value.trim();
    if(!name) return alert('Введите имя папки');
    createModal.style.display='none';
    try {
        const r = await fetch(`/api/storage/create?userPath=${encodeURIComponent(currentPath)}&directoryName=${encodeURIComponent(name)}`, {method:'POST'});
        if(r.ok) fetchItems(searchInput.value);
    } catch(e){ console.error('Ошибка создания:', e); }
};
document.getElementById('create-cancel').onclick = () => createModal.style.display='none';

// ======================= Удаление элементов ========================
deleteSelBtn.onclick = () => {
    const items = getSelectedItems();
    if (!items.length) return showToast('Нет выбранных файлов или папок', 5000);

    const m = document.getElementById('delete-modal'),
          inp = document.getElementById('delete-input');

    m.style.display = 'flex';
    inp.value = '';

    document.getElementById('delete-confirm').onclick = async () => {
        if (inp.value !== "DELETE") return alert("Введите DELETE для подтверждения");
        m.style.display = 'none';
        try {
            for (const i of items) {
                if (i.isDir)
                    await fetch(`/api/storage/deleteDirectory?userPath=${encodeURIComponent(currentPath)}&directoryName=${encodeURIComponent(i.name)}&confirmed=true`, { method: 'DELETE' });
                else
                    await fetch(`/api/storage/deleteFile?userPath=${encodeURIComponent(currentPath)}`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify([i.name]) });
            }
            fetchItems(searchInput.value);
        } catch (e) { console.error(e); showToast("Ошибка при удалении", 5000); }
    };
    document.getElementById('delete-cancel').onclick = () => m.style.display='none';
};

// ======================= Контекстное меню ==========================
['delete','rename','download'].forEach(id => {
    document.getElementById(id).onclick = async () => {
        const t = menu.dataset.target, isDir = menu.dataset.directory==='true';
        try {
            if(id==='download'){
                const url=`/api/storage/download?userPath=${encodeURIComponent(currentPath)}&fileName=${encodeURIComponent(t)}`;
                const link=document.createElement('a'); link.href=url; link.download=isDir?t+'.zip':t; document.body.appendChild(link); link.click(); link.remove();
            } else if(id==='delete'){
                if(!isDir) await fetch(`/api/storage/deleteFile?userPath=${encodeURIComponent(currentPath)}`,{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify([t])});
                else if(await isDirEmpty(currentPath,t)) await fetch(`/api/storage/deleteDirectory?userPath=${encodeURIComponent(currentPath)}&directoryName=${encodeURIComponent(t)}&confirmed=true`,{method:'DELETE'});
                else{
                    const m=document.getElementById('delete-modal'), inp=document.getElementById('delete-input');
                    m.style.display='flex'; inp.value='';
                    document.getElementById('delete-confirm').onclick=async()=>{
                        if(inp.value!=="DELETE") return alert("Введите DELETE для подтверждения");
                        m.style.display='none';
                        await fetch(`/api/storage/deleteDirectory?userPath=${encodeURIComponent(currentPath)}&directoryName=${encodeURIComponent(t)}&confirmed=true`,{method:'DELETE'});
                        fetchItems(searchInput.value);
                    };
                    document.getElementById('delete-cancel').onclick=()=>m.style.display='none';
                    return;
                }
            }
            menu.style.display='none';
            fetchItems(searchInput.value);
        } catch(e){ console.error(e); }
    };
});

// ======================= Верхнее меню ==============================
searchInput.oninput = e => fetchItems(e.target.value);

selectBtn.onclick = () => {
    selectedMode = !selectedMode;
    document.querySelectorAll('.item').forEach(d => d.classList.remove('selected'));
    selectBtn.textContent = selectedMode ? 'Unselect' : 'Select Mode';
    updateActionButtons();
};

downloadSelBtn.onclick = () => {
    const items = getSelectedItems();
    if (!items.length) return showToast('Нет выбранных файлов или папок', 5000);

    items.forEach(item => {
        const a = document.createElement('a');
        a.href = `/api/storage/download?userPath=${encodeURIComponent(currentPath)}&fileName=${encodeURIComponent(item.name)}`;
        a.download = item.isDir ? item.name + '.zip' : item.name;
        document.body.appendChild(a);
        a.click();
        a.remove();
    });
};

// ============================== Загрузка файлов =====================
const uploadBtn=document.getElementById('upload-btn'), uploadInput=document.getElementById('upload-input');
uploadBtn.onclick=()=>uploadInput.click();
uploadInput.onchange=async()=>{
    const file=uploadInput.files[0]; if(!file) return;
    const formData=new FormData(); formData.append('file',file); formData.append('userPath',currentPath);
    try{
        const res=await fetch('/api/storage/upload',{method:'POST',body:formData});
        if(!res.ok) throw new Error(await res.text());
        fetchItems(searchInput.value); uploadInput.value=''; showToast('Файл успешно загружен!');
    }catch(e){ console.error(e); showToast('Ошибка при загрузке файла: '+e.message); }
};

// ======================= Глобальные события ========================
document.addEventListener('click', e => { if(!e.target.classList.contains('item')) menu.style.display='none'; });
document.addEventListener('DOMContentLoaded', () => fetchItems());
