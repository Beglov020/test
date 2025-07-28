// Настройки
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const GRID_SIZE = 20;
let isDrawing = false;
let currentTool = 'pencil';
let startX, startY;
let currentColor = '#000000';
let currentSize = 5;
let hasGrid = false;
let images = [];
let selectedImage = null;
let isDraggingImage = false;
let isResizingImage = false;

// PeerJS соединение
let peer;
let conn;
let myPeerId;

// Инициализация PeerJS
function initPeerJS() {
    peer = new Peer({
        host: '0.peerjs.com',
        port: 443,
        path: '/',
        pingInterval: 5000
    });

    peer.on('open', (id) => {
        myPeerId = id;
        document.getElementById('users').textContent = `Ваш ID: ${id}`;
    });

    peer.on('connection', (connection) => {
        conn = connection;
        setupConnection(conn);
    });
}

function setupConnection(connection) {
    connection.on('open', () => {
        document.getElementById('users').textContent = `Подключено к: ${connection.peer}`;
    });

    connection.on('data', (data) => {
        handleRemoteAction(data);
    });

    connection.on('close', () => {
        document.getElementById('users').textContent = 'Соединение закрыто';
    });
}

// Обработка действий от удаленного пользователя
function handleRemoteAction(data) {
    switch(data.type) {
        case 'draw':
            drawRemote(data.x, data.y, data.color, data.size);
            break;
        case 'shape':
            drawRemoteShape(data);
            break;
        case 'clear':
            clearCanvas();
            break;
        case 'image':
            addRemoteImage(data);
            break;
    }
}

// Отправка действий другому пользователю
function sendData(data) {
    if (conn && conn.open) {
        conn.send(data);
    }
}

// Инструменты рисования
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
document.getElementById('connect-btn').addEventListener('click', connectToPeer);
document.getElementById('copy-id-btn').addEventListener('click', copyMyId);
document.getElementById('color-picker').addEventListener('input', (e) => currentColor = e.target.value);
document.getElementById('size-picker').addEventListener('input', (e) => {
    currentSize = e.target.value;
    document.getElementById('size-value').textContent = currentSize;
});
document.getElementById('image-upload').addEventListener('change', handleImageUpload);

// Обработка событий холста
canvas.addEventListener('mousedown', startDrawing);
canvas.addEventListener('mousemove', draw);
canvas.addEventListener('mouseup', stopDrawing);
canvas.addEventListener('mouseout', stopDrawing);

function setTool(tool) {
    currentTool = tool;
    document.querySelectorAll('.tool-btn.active').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
}

function toggleGrid() {
    hasGrid = !hasGrid;
    document.getElementById('grid-btn').classList.toggle('active', hasGrid);
    drawBackground();
}

function drawBackground() {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    if (hasGrid) {
        ctx.strokeStyle = '#e0e0e0';
        ctx.lineWidth = 1;
        
        for (let x = 0; x <= canvas.width; x += GRID_SIZE) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, canvas.height);
            ctx.stroke();
        }
        
        for (let y = 0; y <= canvas.height; y += GRID_SIZE) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(canvas.width, y);
            ctx.stroke();
        }
    }
}

function startDrawing(e) {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Проверяем, не выбрано ли изображение
    for (let i = images.length - 1; i >= 0; i--) {
        const img = images[i];
        if (x >= img.x && x <= img.x + img.width && y >= img.y && y <= img.y + img.height) {
            // Проверяем, не в углу ли для изменения размера
            if (Math.abs(x - (img.x + img.width)) < 20 && Math.abs(y - (img.y + img.height)) < 20) {
                isResizingImage = true;
            } else {
                isDraggingImage = true;
            }
            selectedImage = img;
            return;
        }
    }
    
    isDrawing = true;
    startX = x;
    startY = y;
    
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineWidth = currentTool === 'eraser' ? currentSize * 2 : currentSize;
    ctx.strokeStyle = currentTool === 'eraser' ? '#ffffff' : currentColor;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
}

function draw(e) {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    if (isDraggingImage && selectedImage) {
        selectedImage.x += x - startX;
        selectedImage.y += y - startY;
        startX = x;
        startY = y;
        redrawCanvas();
        return;
    }
    
    if (isResizingImage && selectedImage) {
        selectedImage.width = Math.max(20, selectedImage.width + (x - startX));
        selectedImage.height = Math.max(20, selectedImage.height + (y - startY));
        startX = x;
        startY = y;
        redrawCanvas();
        return;
    }
    
    if (!isDrawing) return;
    
    switch(currentTool) {
        case 'pencil':
        case 'eraser':
            ctx.lineTo(x, y);
            ctx.stroke();
            sendData({
                type: 'draw',
                x, y,
                color: currentTool === 'eraser' ? '#ffffff' : currentColor,
                size: currentTool === 'eraser' ? currentSize * 2 : currentSize
            });
            break;
            
        case 'line':
        case 'rect':
        case 'circle':
        case 'triangle':
            redrawCanvas();
            drawShape(startX, startY, x, y);
            break;
    }
}

function stopDrawing() {
    if (isDrawing && ['line', 'rect', 'circle', 'triangle'].includes(currentTool)) {
        const rect = canvas.getBoundingClientRect();
        const endX = event.clientX - rect.left;
        const endY = event.clientY - rect.top;
        
        sendData({
            type: 'shape',
            shapeType: currentTool,
            x1: startX, y1: startY,
            x2: endX, y2: endY,
            color: currentColor,
            size: currentSize
        });
    }
    
    isDrawing = false;
    isDraggingImage = false;
    isResizingImage = false;
    selectedImage = null;
}

function drawShape(x1, y1, x2, y2) {
    ctx.beginPath();
    ctx.lineWidth = currentSize;
    ctx.strokeStyle = currentColor;
    ctx.fillStyle = currentColor;
    
    switch(currentTool) {
        case 'line':
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();
            break;
            
        case 'rect':
            ctx.rect(x1, y1, x2 - x1, y2 - y1);
            ctx.stroke();
            break;
            
        case 'circle':
            const radius = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
            ctx.arc(x1, y1, radius, 0, Math.PI * 2);
            ctx.stroke();
            break;
            
        case 'triangle':
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.lineTo(x1 * 2 - x2, y2);
            ctx.closePath();
            ctx.stroke();
            break;
    }
}

function drawRemote(x, y, color, size) {
    ctx.lineWidth = size;
    ctx.strokeStyle = color;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, y);
}

function drawRemoteShape(data) {
    ctx.lineWidth = data.size;
    ctx.strokeStyle = data.color;
    ctx.fillStyle = data.color;
    
    ctx.beginPath();
    
    switch(data.shapeType) {
        case 'line':
            ctx.moveTo(data.x1, data.y1);
            ctx.lineTo(data.x2, data.y2);
            ctx.stroke();
            break;
            
        case 'rect':
            ctx.rect(data.x1, data.y1, data.x2 - data.x1, data.y2 - data.y1);
            ctx.stroke();
            break;
            
        case 'circle':
            const radius = Math.sqrt(Math.pow(data.x2 - data.x1, 2) + Math.pow(data.y2 - data.y1, 2));
            ctx.arc(data.x1, data.y1, radius, 0, Math.PI * 2);
            ctx.stroke();
            break;
            
        case 'triangle':
            ctx.moveTo(data.x1, data.y1);
            ctx.lineTo(data.x2, data.y2);
            ctx.lineTo(data.x1 * 2 - data.x2, data.y2);
            ctx.closePath();
            ctx.stroke();
            break;
    }
}

function clearCanvas() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawBackground();
    images = [];
    sendData({ type: 'clear' });
}

function saveCanvas() {
    const link = document.createElement('a');
    link.download = 'drawing.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
}

function handleImageUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
            const newImage = {
                img: img,
                x: 50,
                y: 50,
                width: img.width > 300 ? 300 : img.width,
                height: img.height > 300 ? 300 : img.height
            };
            images.push(newImage);
            redrawCanvas();
            
            // Отправляем изображение другому пользователю
            sendData({
                type: 'image',
                data: event.target.result,
                x: newImage.x,
                y: newImage.y,
                width: newImage.width,
                height: newImage.height
            });
        };
        img.src = event.target.result;
    };
    reader.readAsDataURL(file);
}

function addRemoteImage(data) {
    const img = new Image();
    img.onload = () => {
        images.push({
            img: img,
            x: data.x,
            y: data.y,
            width: data.width,
            height: data.height
        });
        redrawCanvas();
    };
    img.src = data.data;
}

function redrawCanvas() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawBackground();
    
    // Рисуем все изображения
    images.forEach(img => {
        ctx.drawImage(img.img, img.x, img.y, img.width, img.height);
        
        // Рисуем маркер для изменения размера
        ctx.fillStyle = 'red';
        ctx.fillRect(img.x + img.width - 5, img.y + img.height - 5, 10, 10);
    });
}

function connectToPeer() {
    const peerId = document.getElementById('peer-id-input').value.trim();
    if (!peerId) return;
    
    conn = peer.connect(peerId);
    setupConnection(conn);
}

function copyMyId() {
    navigator.clipboard.writeText(myPeerId);
    alert('ID скопирован в буфер обмена!');
}

// Инициализация
initPeerJS();
drawBackground();