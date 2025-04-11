const http = require('http');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');

// 创建HTTP服务器
const server = http.createServer((req, res) => {
    // 获取请求的文件路径
    let filePath = path.join(__dirname, req.url === '/' ? 'index.html' : req.url);
    
    // 获取文件扩展名
    const extname = path.extname(filePath);
    
    // 设置默认的MIME类型
    let contentType = 'text/html';
    
    // 根据文件扩展名设置MIME类型
    switch (extname) {
        case '.js':
            contentType = 'text/javascript';
            break;
        case '.css':
            contentType = 'text/css';
            break;
        case '.json':
            contentType = 'application/json';
            break;
        case '.png':
            contentType = 'image/png';
            break;
        case '.jpg':
            contentType = 'image/jpg';
            break;
        case '.gif':
            contentType = 'image/gif';
            break;
    }
    
    // 读取文件
    fs.readFile(filePath, (err, content) => {
        if (err) {
            if (err.code === 'ENOENT') {
                // 文件不存在
                fs.readFile(path.join(__dirname, '404.html'), (err, content) => {
                    res.writeHead(404, { 'Content-Type': 'text/html' });
                    res.end(content, 'utf-8');
                });
            } else {
                // 服务器错误
                res.writeHead(500);
                res.end(`Server Error: ${err.code}`);
            }
        } else {
            // 成功响应
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content, 'utf-8');
        }
    });
});

// 设置服务器端口
const PORT = process.env.PORT || 3000;

// 启动HTTP服务器
server.listen(PORT, () => {
    console.log(`服务器运行在 http://localhost:${PORT}`);
});

// 创建WebSocket服务器
const wss = new WebSocket.Server({ server });

// 存储连接的客户端
const clients = new Map();

// 存储房间信息
const rooms = new Map();

// 处理WebSocket连接
wss.on('connection', (ws) => {
    console.log('新的WebSocket连接');
    
    // 为客户端分配唯一ID
    const clientId = Date.now().toString();
    clients.set(clientId, { ws, roomId: null });
    
    // 处理接收到的消息
    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            console.log('收到消息:', data);
            
            // 处理不同类型的消息
            switch (data.type) {
                case 'join':
                    handleJoinRoom(clientId, data.roomId);
                    break;
                    
                case 'heartrate':
                    broadcastToRoom(clientId, data);
                    break;
                    
                case 'pkstatus':
                    broadcastToRoom(clientId, data);
                    break;
                    
                case 'pkresults':
                    broadcastToRoom(clientId, data);
                    break;
                    
                case 'ping':
                    // 响应心跳
                    sendToClient(clientId, { type: 'pong', timestamp: Date.now() });
                    break;
                    
                default:
                    console.warn('未知消息类型:', data.type);
            }
        } catch (err) {
            console.error('解析消息失败:', err);
        }
    });
    
    // 处理连接关闭
    ws.on('close', () => {
        console.log('WebSocket连接关闭');
        
        // 从房间中移除客户端
        const client = clients.get(clientId);
        if (client && client.roomId) {
            leaveRoom(clientId, client.roomId);
        }
        
        // 从客户端列表中移除
        clients.delete(clientId);
    });
    
    // 发送欢迎消息
    sendToClient(clientId, {
        type: 'welcome',
        clientId,
        timestamp: Date.now()
    });
});

// 处理加入房间
function handleJoinRoom(clientId, roomId) {
    if (!roomId) return;
    
    const client = clients.get(clientId);
    if (!client) return;
    
    // 如果客户端已经在其他房间，先离开
    if (client.roomId && client.roomId !== roomId) {
        leaveRoom(clientId, client.roomId);
    }
    
    // 更新客户端的房间ID
    client.roomId = roomId;
    
    // 如果房间不存在，创建新房间
    if (!rooms.has(roomId)) {
        rooms.set(roomId, new Set());
    }
    
    // 将客户端添加到房间
    rooms.get(roomId).add(clientId);
    
    console.log(`客户端 ${clientId} 加入房间 ${roomId}`);
    
    // 发送加入成功消息
    sendToClient(clientId, {
        type: 'joined',
        roomId,
        timestamp: Date.now()
    });
}

// 离开房间
function leaveRoom(clientId, roomId) {
    if (!roomId || !rooms.has(roomId)) return;
    
    // 从房间中移除客户端
    rooms.get(roomId).delete(clientId);
    
    // 如果房间为空，删除房间
    if (rooms.get(roomId).size === 0) {
        rooms.delete(roomId);
        console.log(`房间 ${roomId} 已删除`);
    }
    
    console.log(`客户端 ${clientId} 离开房间 ${roomId}`);
}

// 向客户端发送消息
function sendToClient(clientId, data) {
    const client = clients.get(clientId);
    if (!client) return;
    
    try {
        client.ws.send(JSON.stringify(data));
    } catch (err) {
        console.error(`向客户端 ${clientId} 发送消息失败:`, err);
    }
}

// 向房间广播消息
function broadcastToRoom(senderId, data) {
    const sender = clients.get(senderId);
    if (!sender || !sender.roomId) return;
    
    const roomId = sender.roomId;
    if (!rooms.has(roomId)) return;
    
    // 获取房间中的所有客户端
    const roomClients = rooms.get(roomId);
    
    // 向房间中的所有客户端发送消息
    roomClients.forEach(clientId => {
        // 不向发送者发送消息
        if (clientId !== senderId) {
            sendToClient(clientId, data);
        }
    });
    
    console.log(`向房间 ${roomId} 广播消息:`, data.type);
}
