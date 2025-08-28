const content = document.getElementById('content');
const menu = document.getElementById('context-menu');
const searchInput = document.getElementById('search-input');
const selectBtn = document.getElementById('select-btn');
const deleteSelBtn = document.getElementById('delete-selected');
const createDirBtn = document.getElementById('create-dir');

let selectedMode = false;
let currentPath = ''; // текущий путь (корень)

// -------------------- Получение и отображение --------------------
async function fetchItems(filter="") {
    try {
        const res = await fetch(`/api/storage/content?userPath=${encodeURIComponent(currentPath)}`);
        const data = await res.json();

        let items = data;
        if(filter) items = items.filter(i => i.name.toLowerCase().includes(filter.toLowerCase()));

        // Сортировка: сначала папки, потом файлы
        items.sort((a,b)=> a.type !== b.type ? a.type === 'dir' ? -1 : 1 : a.name.localeCompare(b.name));

        renderItems(items);
    } catch(err) {
        console.error('Ошибка при получении элементов:', err);
    }
}

function renderItems(items){
    content.innerHTML = '';
    items.forEach(item => {
        const div = document.createElement('div');
        div.className = `item ${item.type}`;   // добавляем класс dir или file
        div.dataset.fullname = item.name;
        div.dataset.directory = item.directory; // true/false
        div.textContent = item.name;

        div.onclick = () => {
            if(selectedMode){
                div.classList.toggle('selected');
                updateDeleteBtn();
            }
        };

        div.oncontextmenu = e => {
            e.preventDefault();
            menu.style.top = e.pageY + 'px';
            menu.style.left = e.pageX + 'px';
            menu.style.display = 'flex';
            menu.dataset.target = item.name;
            menu.dataset.type = item.type;      // сохраняем тип для контекстного меню
        };

        content.appendChild(div);
    });

    updateDeleteBtn();
}


function updateDeleteBtn(){
    const selected = document.querySelectorAll('.item.selected');
    deleteSelBtn.style.display = selected.length ? 'inline-block' : 'none';
}

// -------------------- Поиск --------------------
searchInput.oninput = e => fetchItems(e.target.value);

// -------------------- Режим выбора --------------------
selectBtn.onclick = () => {
    selectedMode = !selectedMode;
    document.querySelectorAll('.item').forEach(d => d.classList.remove('selected'));
    selectBtn.textContent = selectedMode ? 'Unselect' : 'Select';
    updateDeleteBtn();
};

// -------------------- Создание директории --------------------
createDirBtn.onclick = async () => {
    const dirName = prompt('Введите имя новой папки');
    if(!dirName) return;

    try {
        const res = await fetch(`/api/storage/create?userPath=${encodeURIComponent(currentPath)}&directoryName=${encodeURIComponent(dirName)}`, {
            method: 'POST'
        });

        if(res.ok){
            alert('Папка создана');
            fetchItems(searchInput.value);
        } else {
            const text = await res.text();
            alert('Ошибка: ' + text);
        }
    } catch(err) {
        console.error('Ошибка при создании папки:', err);
    }
};

// -------------------- Удаление выбранных элементов --------------------
deleteSelBtn.onclick = async () => {
    // Собираем выбранные элементы
    const selectedItems = Array.from(document.querySelectorAll('.item.selected'))
        .map(d => ({
            name: d.dataset.fullname,
            directory: d.dataset.directory === 'true'  // преобразуем строку в boolean
        }));

    if (!selectedItems.length) return;

    if (!confirm(`Вы точно хотите удалить ${selectedItems.length} элемент(а/ов)?`)) return;

    try {
        for (const item of selectedItems) {
            if (item.directory) {
                // Папка — вызываем deleteDirectory
                const confirmed = confirm(`Папка "${item.name}" может содержать файлы. Подтвердите удаление.`);
                if (confirmed) {
                    await fetch(`/api/storage/deleteDirectory?userPath=${encodeURIComponent(currentPath)}&directoryName=${encodeURIComponent(item.name)}&confirmed=true`, {
                        method: 'DELETE'
                    });
                }
            } else {
                // Файл — вызываем deleteFile
                await fetch(`/api/storage/deleteFile?userPath=${encodeURIComponent(currentPath)}`, {
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify([item.name])
                });
            }
        }

        // Обновляем список после удаления
        fetchItems(searchInput.value);

    } catch (err) {
        console.error('Ошибка при удалении:', err);
        alert('Ошибка при удалении. Проверьте консоль.');
    }
};


// -------------------- Контекстное меню --------------------
['delete','rename','download'].forEach(id => {
    document.getElementById(id).onclick = async () => {
        const target = menu.dataset.target;
        const type = menu.dataset.type;

        try {
            if(id === 'delete'){
                if(type === 'file'){
                    await fetch(`/api/storage/deleteFile?userPath=${encodeURIComponent(currentPath)}`, {
                        method:'DELETE',
                        headers:{'Content-Type':'application/json'},
                        body: JSON.stringify([target])
                    });
                } else if(type === 'dir'){
                    if(confirm(`Удалить папку "${target}"?`)){
                        await fetch(`/api/storage/deleteDirectory?userPath=${encodeURIComponent(currentPath)}&directoryName=${encodeURIComponent(target)}&confirmed=true`, {method:'DELETE'});
                    }
                }
            } else if(id === 'rename'){
                const newName = prompt('Введите новое имя', target);
                if(newName){
                    await fetch('/api/storage/rename', {
                        method:'POST',
                        headers:{'Content-Type':'application/json'},
                        body: JSON.stringify({ oldName: target, newName: newName, userPath: currentPath })
                    });
                }
            } else if(id === 'download'){
                window.location.href = `/api/storage/download?userPath=${encodeURIComponent(currentPath)}&fileName=${encodeURIComponent(target)}`;
            }

            menu.style.display = 'none';
            fetchItems(searchInput.value);
        } catch(err){
            console.error(err);
        }
    };
});

// -------------------- Закрытие контекстного меню --------------------
document.addEventListener('click', e => {
    if(!e.target.classList.contains('item')) menu.style.display='none';
});

// -------------------- Инициализация --------------------
document.addEventListener('DOMContentLoaded', () => {
    fetchItems();
});
