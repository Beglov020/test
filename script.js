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
            clearCanvas();
            break;
        case 'image':
            addRemoteImage(data);
            break;
    }
}

// Отправка данных
function sendData(data) {
    if (conn && conn.open) {
        conn.send(data);
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
    document.getElementById('connect-btn').addEventListener('click', connectToPeer);
    document.getElementById('copy-id-btn').addEventListener('click', copyMyId);
    document.getElementById('color-picker').addEventListener('input', (e) => currentColor = e.target.value);
    document.getElementById('size-picker').addEventListener('input', (e) => {
        currentSize = e.target.value;
        document.getElementById('size-value').textContent = currentSize;
    });
    document.getElementById('image-upload').addEventListener('change', handleImageUpload);
}

// Работа с холстом
function setTool(tool) {
    currentTool = tool;
    document.querySelectorAll('.tool-btn.active').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
}

function toggleGrid() {
    hasGrid = !hasGrid;
    document.getElementById('grid-btn').classList.toggle('active', hasGrid);
    redrawAll();
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

// Обработка событий мыши
canvas.addEventListener('mousedown', startDrawing);
canvas.addEventListener('mousemove', draw);
canvas.addEventListener('mouseup', stopDrawing);
canvas.addEventListener('mouseout', stopDrawing);

function startDrawing(e) {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Проверка на клик по изображению
    for (let i = images.length - 1; i >= 0; i--) {
        const img = images[i];
        
        // Проверка на изменение размера
        if (Math.abs(x - (img.x + img.width)) < 15 && 
            Math.abs(y - (img.y + img.height)) < 15) {
            isResizingImage = true;
            selectedImage = img;
            startX = x;
            startY = y;
            return;
        }
        
        // Проверка на перемещение
        if (x >= img.x && x <= img.x + img.width && 
            y >= img.y && y <= img.y + img.height) {
            isDraggingImage = true;
            selectedImage = img;
            dragOffsetX = x - img.x;
            dragOffsetY = y - img.y;
            return;
        }
    }

    // Если не кликнули на изображение, начинаем рисование
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

    // Перемещение изображения
    if (isDraggingImage && selectedImage) {
        selectedImage.x = x - dragOffsetX;
        selectedImage.y = y - dragOffsetY;
        redrawAll();
        return;
    }

    // Изменение размера изображения
    if (isResizingImage && selectedImage) {
        const newWidth = Math.max(20, x - selectedImage.x);
        const newHeight = Math.max(20, y - selectedImage.y);
        
        if (e.shiftKey) { // Сохранение пропорций с Shift
            const ratio = selectedImage.img.width / selectedImage.img.height;
            selectedImage.width = newWidth;
            selectedImage.height = newWidth / ratio;
        } else {
            selectedImage.width = newWidth;
            selectedImage.height = newHeight;
        }
        
        redrawAll();
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
            redrawAll();
            drawShape(startX, startY, x, y);
            break;
    }
}

function stopDrawing() {
    if (isDrawing && ['line', 'rect', 'circle', 'triangle'].includes(currentTool)) {
        const rect = canvas.getBoundingClientRect();
        const endX = event.clientX - rect.left;
        const endY = event.clientY - rect.top;
        
        const newShape = {
            type: currentTool,
            x1: startX, y1: startY,
            x2: endX, y2: endY,
            color: currentColor,
            size: currentSize
        };
        
        drawings.push(newShape);
        redrawAll();
        sendData({
            type: 'shape',
            ...newShape
        });
    }
    
    isDrawing = false;
    isDraggingImage = false;
    isResizingImage = false;
    selectedImage = null;
}

// Рисование фигур
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

// Удаленное рисование
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

// Перерисовка всего холста
function redrawAll() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawBackground();
    
    // Рисуем все сохраненные фигуры
    drawings.forEach(shape => {
        ctx.beginPath();
        ctx.lineWidth = shape.size;
        ctx.strokeStyle = shape.color;
        ctx.fillStyle = shape.color;
        
        switch(shape.type) {
            case 'line':
                ctx.moveTo(shape.x1, shape.y1);
                ctx.lineTo(shape.x2, shape.y2);
                ctx.stroke();
                break;
                
            case 'rect':
                ctx.rect(shape.x1, shape.y1, shape.x2 - shape.x1, shape.y2 - shape.y1);
                ctx.stroke();
                break;
                
            case 'circle':
                const radius = Math.sqrt(Math.pow(shape.x2 - shape.x1, 2) + Math.pow(shape.y2 - shape.y1, 2));
                ctx.arc(shape.x1, shape.y1, radius, 0, Math.PI * 2);
                ctx.stroke();
                break;
                
            case 'triangle':
                ctx.moveTo(shape.x1, shape.y1);
                ctx.lineTo(shape.x2, shape.y2);
                ctx.lineTo(shape.x1 * 2 - shape.x2, shape.y2);
                ctx.closePath();
                ctx.stroke();
                break;
        }
    });
    
    // Рисуем все изображения
    images.forEach(img => {
        ctx.drawImage(img.img, img.x, img.y, img.width, img.height);
        
        // Маркер изменения размера (только для выбранного изображения)
        if (selectedImage === img) {
            ctx.fillStyle = 'red';
            ctx.fillRect(
                img.x + img.width - 10, 
                img.y + img.height - 10, 
                15, 
                15
            );
        }
    });
}

// Работа с изображениями
function handleImageUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
            const maxSize = 300;
            let width = img.width;
            let height = img.height;
            
            if (width > maxSize || height > maxSize) {
                const ratio = width / height;
                if (width > height) {
                    width = maxSize;
                    height = maxSize / ratio;
                } else {
                    height = maxSize;
                    width = maxSize * ratio;
                }
            }
            
            const newImage = {
                img: img,
                x: 50,
                y: 50,
                width: width,
                height: height
            };
            
            images.push(newImage);
            redrawAll();
            
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
        redrawAll();
    };
    img.src = data.data;
}

// Дополнительные функции
function clearCanvas() {
    drawings = [];
    images = [];
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawBackground();
    sendData({ type: 'clear' });
}

function saveCanvas() {
    const link = document.createElement('a');
    link.download = 'drawing.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
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
initTools();
drawBackground();