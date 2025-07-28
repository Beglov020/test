// Настройки
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const GRID_SIZE = 20;

// Состояние приложения
let isDrawing = false;
let currentTool = 'pencil';
let startX, startY;
let currentColor = '#000000';
let currentSize = 5;
let hasGrid = false;

// Хранение элементов
let drawings = [];
let images = [];
let selectedImage = null;
let isDraggingImage = false;
let isResizingImage = false;
let dragOffsetX = 0;
let dragOffsetY = 0;

// PeerJS соединение
let peer;
let conn;
let myPeerId;

// Инициализация PeerJS с улучшенной обработкой ошибок
function initPeerJS() {
    peer = new Peer({
        host: '0.peerjs.com',
        port: 443,
        path: '/',
        pingInterval: 5000,
        debug: 3
    });

    peer.on('open', (id) => {
        myPeerId = id;
        document.getElementById('users').innerHTML = `
            <strong>Ваш ID:</strong> ${id}<br>
            <button id="copy-id-btn" class="tool-btn">Копировать ID</button>
            <button id="disconnect-btn" class="tool-btn">Отключиться</button>
        `;
        
        // Обработчики для новых кнопок
        document.getElementById('copy-id-btn').addEventListener('click', copyMyId);
        document.getElementById('disconnect-btn').addEventListener('click', disconnect);
        
        // Автоподключение если в URL есть peer ID
        const urlParams = new URLSearchParams(window.location.search);
        const peerId = urlParams.get('peer');
        if (peerId && peerId !== myPeerId) {
            connectToPeer(peerId);
        }
    });

    peer.on('error', (err) => {
        console.error('PeerJS error:', err);
        document.getElementById('users').innerHTML += `<br><span style="color:red">Ошибка: ${err.type}</span>`;
    });

    peer.on('connection', (connection) => {
        conn = connection;
        setupConnection(conn);
    });
}

function setupConnection(connection) {
    connection.on('open', () => {
        document.getElementById('users').innerHTML += `<br><strong>Подключено к:</strong> ${connection.peer}`;
        
        // При подключении отправляем текущее состояние холста
        sendData({ type: 'clear' });
        drawings.forEach(drawing => {
            sendData({ type: 'shape', ...drawing });
        });
        images.forEach(image => {
            // Для изображений нужно преобразовать в base64
            const canvas = document.createElement('canvas');
            canvas.width = image.img.width;
            canvas.height = image.img.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(image.img, 0, 0);
            sendData({
                type: 'image',
                data: canvas.toDataURL(),
                x: image.x,
                y: image.y,
                width: image.width,
                height: image.height
            });
        });
    });

    connection.on('data', (data) => {
        handleRemoteAction(data);
    });

    connection.on('close', () => {
        document.getElementById('users').innerHTML += '<br>Соединение закрыто';
    });

    connection.on('error', (err) => {
        console.error('Connection error:', err);
        document.getElementById('users').innerHTML += `<br><span style="color:red">Ошибка соединения: ${err.message}</span>`;
    });
}

// Обработка удаленных действий
function handleRemoteAction(data) {
    switch(data.type) {
        case 'draw':
            drawRemote(data.x, data.y, data.color, data.size);
            break;
        case 'shape':
            drawings.push(data);
            redrawAll();
            break;
        case 'clear':
            drawings = [];
            images = [];
            clearCanvas();
            break;
        case 'image':
            addRemoteImage(data);
            break;
    }
}

// Отправка данных с обработкой ошибок
function sendData(data) {
    if (conn && conn.open) {
        try {
            conn.send(data);
        } catch (err) {
            console.error('Ошибка отправки данных:', err);
        }
    }
}

// Инициализация инструментов
function initTools() {
    document.getElementById('pencil-btn').addEventListener('click', () => setTool('pencil'));
    document.getElementById('eraser-btn').addEventListener('click', () => setTool('eraser'));
    document.getElementById('line-btn').addEventListener('click', () => setTool('line'));
    document.getElementById('rect-btn').addEventListener('click', () => setTool('rect'));
    document.getElementById('circle-btn').addEventListener('click', () => setTool('circle'));
    document.getElementById('triangle-btn').addEventListener('click', () => setTool('triangle'));
    document.getElementById('grid-btn').addEventListener('click', toggleGrid);
    document.getElementById('clear-btn').addEventListener('click', clearCanvas);
    document.getElementById('save-btn').addEventListener('click', saveCanvas);
    document.getElementById('upload-btn').addEventListener('click', () => document.getElementById('image-upload').click());
    document.getElementById('connect-btn').addEventListener('click', () => {
        const peerId = document.getElementById('peer-id-input').value.trim();
        connectToPeer(peerId);
    });
    document.getElementById('color-picker').addEventListener('input', (e) => currentColor = e.target.value);
    document.getElementById('size-picker').addEventListener('input', (e) => {
        currentSize = e.target.value;
        document.getElementById('size-value').textContent = currentSize;
    });
    document.getElementById('image-upload').addEventListener('change', handleImageUpload);
}

// Функция подключения к другому peer
function connectToPeer(peerId) {
    if (!peerId) {
        peerId = document.getElementById('peer-id-input').value.trim();
    }
    
    if (!peerId) {
        alert('Введите ID партнера');
        return;
    }
    
    if (peerId === myPeerId) {
        alert('Нельзя подключиться к самому себе');
        return;
    }
    
    if (conn && conn.open) {
        conn.close();
    }
    
    conn = peer.connect(peerId, {
        reliable: true,
        serialization: 'json'
    });
    
    document.getElementById('users').innerHTML += '<br>Пытаемся подключиться...';
    
    conn.on('open', () => {
        document.getElementById('users').innerHTML += `<br><strong>Успешно подключено к:</strong> ${peerId}`;
        
        // Обновляем URL с ID партнера
        const newUrl = new URL(window.location.href);
        newUrl.searchParams.set('peer', peerId);
        window.history.pushState({}, '', newUrl);
    });
    
    setupConnection(conn);
}

// Функция отключения
function disconnect() {
    if (conn) {
        conn.close();
    }
    document.getElementById('users').innerHTML = `<strong>Ваш ID:</strong> ${myPeerId}`;
    
    // Удаляем peer ID из URL
    const newUrl = new URL(window.location.href);
    newUrl.searchParams.delete('peer');
    window.history.pushState({}, '', newUrl);
}

// Копирование своего ID
function copyMyId() {
    navigator.clipboard.writeText(myPeerId).then(() => {
        alert('ID скопирован в буфер обмена!');
    }).catch(err => {
        console.error('Ошибка копирования:', err);
        prompt('Скопируйте ваш ID вручную:', myPeerId);
    });
}

// Остальные функции (рисование, работа с изображениями и т.д.) остаются без изменений
// ... [вставьте сюда все остальные функции из предыдущего кода] ...

// Инициализация при загрузке страницы
window.addEventListener('DOMContentLoaded', () => {
    initPeerJS();
    initTools();
    drawBackground();
    
    // Обработка кнопки копирования ID (если уже есть на странице)
    if (document.getElementById('copy-id-btn')) {
        document.getElementById('copy-id-btn').addEventListener('click', copyMyId);
    }
});