const http = require('http');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');
const url = require('url');
const db = require('./database');
const { parse } = require('querystring');
const apiHandlers = require('./api-handlers');

// 创建HTTP服务器
const server = http.createServer((req, res) => {
    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname;

    // API请求处理
    if (pathname.startsWith('/api/')) {
        handleApiRequest(req, res, pathname);
        return;
    }

    // 静态文件处理
    let filePath = path.join(__dirname, pathname === '/' ? 'index.html' : pathname);

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
                    if (err) {
                        res.writeHead(404, { 'Content-Type': 'text/html' });
                        res.end('<h1>404 Not Found</h1>', 'utf-8');
                    } else {
                        res.writeHead(404, { 'Content-Type': 'text/html' });
                        res.end(content, 'utf-8');
                    }
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

// 处理API请求
function handleApiRequest(req, res, pathname) {
    res.setHeader('Content-Type', 'application/json');

    // 处理CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    // 处理用户相关API
    if (apiHandlers.handleUserApi(req, res, pathname)) {
        return;
    }

    // 处理家庭成员相关API
    if (apiHandlers.handleFamilyMemberApi(req, res, pathname)) {
        return;
    }

    // 处理设备使用记录相关API
    if (apiHandlers.handleDeviceUsageApi(req, res, pathname)) {
        return;
    }

    // 获取场地列表
    if (pathname === '/api/venues' && req.method === 'GET') {
        db.getAllVenues((err, venues) => {
            if (err) {
                res.writeHead(500);
                res.end(JSON.stringify({ error: '获取场地列表失败' }));
            } else {
                res.writeHead(200);
                res.end(JSON.stringify({ venues }));
            }
        });
        return;
    }

    // 获取单个场地信息
    if (pathname.startsWith('/api/venue/') && req.method === 'GET') {
        const venueId = pathname.split('/').pop();

        if (!venueId) {
            res.writeHead(400);
            res.end(JSON.stringify({ error: '缺少场地ID参数' }));
            return;
        }

        db.getVenueById(venueId, (err, venue) => {
            if (err) {
                res.writeHead(500);
                res.end(JSON.stringify({ error: '获取场地信息失败' }));
            } else {
                res.writeHead(200);
                res.end(JSON.stringify({ venue }));
            }
        });
        return;
    }

    // 获取设备信息
    if (pathname === '/api/device' && req.method === 'GET') {
        const parsedUrl = url.parse(req.url, true);
        const deviceId = parsedUrl.query.deviceId;

        if (!deviceId) {
            res.writeHead(400);
            res.end(JSON.stringify({ error: '缺少deviceId参数' }));
            return;
        }

        db.getDeviceByDeviceId(deviceId, (err, device) => {
            if (err) {
                res.writeHead(500);
                res.end(JSON.stringify({ error: '获取设备信息失败' }));
            } else {
                res.writeHead(200);
                res.end(JSON.stringify({ device }));
            }
        });
        return;
    }

    // 获取所有设备
    if (pathname === '/api/devices' && req.method === 'GET') {
        db.getAllDevices((err, devices) => {
            if (err) {
                res.writeHead(500);
                res.end(JSON.stringify({ error: '获取设备列表失败' }));
            } else {
                res.writeHead(200);
                res.end(JSON.stringify({ devices }));
            }
        });
        return;
    }

    // 保存设备信息
    if (pathname === '/api/device' && req.method === 'POST') {
        let body = '';

        req.on('data', chunk => {
            body += chunk.toString();
        });

        req.on('end', () => {
            let deviceInfo;
            try {
                deviceInfo = JSON.parse(body);
            } catch (e) {
                res.writeHead(400);
                res.end(JSON.stringify({ error: '无效的JSON格式' }));
                return;
            }

            if (!deviceInfo.deviceId || !deviceInfo.roomId) {
                res.writeHead(400);
                res.end(JSON.stringify({ error: '缺少必要参数' }));
                return;
            }

            db.saveDevice(deviceInfo, (err, result) => {
                if (err) {
                    res.writeHead(500);
                    res.end(JSON.stringify({ error: '保存设备信息失败' }));
                } else {
                    res.writeHead(200);
                    res.end(JSON.stringify({ success: true, device: result }));
                }
            });
        });
        return;
    }

    // 记录PK会话开始
    if (pathname === '/api/pk/start' && req.method === 'POST') {
        let body = '';

        req.on('data', chunk => {
            body += chunk.toString();
        });

        req.on('end', () => {
            let pkInfo;
            try {
                pkInfo = JSON.parse(body);
            } catch (e) {
                res.writeHead(400);
                res.end(JSON.stringify({ error: '无效的JSON格式' }));
                return;
            }

            if (!pkInfo.roomId) {
                res.writeHead(400);
                res.end(JSON.stringify({ error: '缺少roomId参数' }));
                return;
            }

            db.startPKSession(pkInfo.roomId, pkInfo.venueId, (err, result) => {
                if (err) {
                    res.writeHead(500);
                    res.end(JSON.stringify({ error: '记录PK会话开始失败' }));
                } else {
                    res.writeHead(200);
                    res.end(JSON.stringify({ success: true, session: result }));
                }
            });
        });
        return;
    }

    // 记录PK会话结束
    if (pathname === '/api/pk/end' && req.method === 'POST') {
        let body = '';

        req.on('data', chunk => {
            body += chunk.toString();
        });

        req.on('end', () => {
            let pkInfo;
            try {
                pkInfo = JSON.parse(body);
            } catch (e) {
                res.writeHead(400);
                res.end(JSON.stringify({ error: '无效的JSON格式' }));
                return;
            }

            if (!pkInfo.roomId) {
                res.writeHead(400);
                res.end(JSON.stringify({ error: '缺少roomId参数' }));
                return;
            }

            db.endPKSession(pkInfo.roomId, pkInfo.participantsCount || 0, (err, result) => {
                if (err) {
                    res.writeHead(500);
                    res.end(JSON.stringify({ error: '记录PK会话结束失败' }));
                } else {
                    res.writeHead(200);
                    res.end(JSON.stringify({ success: true, result }));
                }
            });
        });
        return;
    }

    // 如果没有匹配的API路径
    res.writeHead(404);
    res.end(JSON.stringify({ error: 'API路径不存在' }));
}

// 设置服务器端口
const PORT = process.env.PORT || 8080;

// 启动HTTP服务器
server.listen(PORT, '0.0.0.0', () => {
    console.log(`服务器运行在 http://0.0.0.0:${PORT}`);
    console.log(`请使用 http://192.168.1.205:${PORT} 访问大屏端应用`);
});

// 创建WebSocket服务器
const wss = new WebSocket.Server({
    server,
    // 禁用协议头验证
    verifyClient: () => true,
    // 允许所有来源
    origin: '*',
    // 增加心跳超时
    clientTracking: true,
    // 增加最大消息大小
    maxPayload: 64 * 1024 * 1024 // 64MB
});

// 存储连接的客户端
const clients = new Map();

// 存储房间信息
const rooms = new Map();

// 存储设备信息
const devices = new Map();

// 打印服务器信息
console.log(`WebSocket服务器已启动，监听地址: ws://0.0.0.0:${PORT}`);

// 监听服务器错误
wss.on('error', (error) => {
    console.error('WebSocket服务器错误:', error);
});

// 监听服务器关闭
wss.on('close', () => {
    console.log('WebSocket服务器已关闭');
});

// 监听即将到来的连接
wss.on('headers', (headers, request) => {
    console.log('WebSocket握手头信息:', headers);
});

// 处理WebSocket连接
wss.on('connection', (ws, request) => {
    console.log('新的WebSocket连接');
    console.log('连接来源:', request.socket.remoteAddress);

    // 为客户端分配唯一ID
    const clientId = Date.now().toString(36) + Math.random().toString(36).substring(2);
    clients.set(clientId, {
        id: clientId,
        ws: ws,
        roomId: null,
        deviceId: null,
        clientType: null,
        lastActivity: Date.now()
    });

    // 处理接收到的消息
    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            console.log('收到消息:', data);

            // 处理不同类型的消息
            switch (data.type) {
                case 'join':
                    handleJoinRoom(clientId, data.roomId, data.deviceId, data.clientType);
                    break;

                case 'heartrate':
                    broadcastToRoom(clientId, data);
                    break;

                case 'pkstatus':
                    broadcastToRoom(clientId, data);
                    // 如果是开始 PK，记录会话
                    if (data.isPKMode) {
                        const client = clients.get(clientId);
                        if (client && client.deviceId) {
                            // 获取设备信息
                            db.getDeviceByDeviceId(client.deviceId, (err, device) => {
                                if (!err && device) {
                                    // 记录 PK 会话开始
                                    db.startPKSession(data.roomId, device.venue_id, (err, result) => {
                                        if (err) {
                                            console.error('记录 PK 会话开始失败:', err);
                                        } else {
                                            console.log('PK 会话已记录:', result);
                                        }
                                    });
                                }
                            });
                        }
                    }
                    break;

                case 'pkresults':
                    broadcastToRoom(clientId, data);
                    // 记录 PK 会话结束
                    const client = clients.get(clientId);
                    if (client && client.roomId) {
                        const participantsCount = data.results ? data.results.length : 0;
                        db.endPKSession(client.roomId, participantsCount, (err, result) => {
                            if (err) {
                                console.error('记录 PK 会话结束失败:', err);
                            } else {
                                console.log('PK 会话结束已记录:', result);
                            }
                        });
                    }
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

    // 处理客户端断开连接
    ws.on('close', () => {
        console.log(`客户端断开连接: ${clientId}`);

        // 获取客户端的房间ID
        const client = clients.get(clientId);
        if (client && client.roomId) {
            // 从房间中移除客户端
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
function handleJoinRoom(clientId, roomId, deviceId, clientType) {
    if (!roomId) return;

    const client = clients.get(clientId);
    if (!client) return;

    // 如果客户端已经在其他房间，先离开
    if (client.roomId && client.roomId !== roomId) {
        leaveRoom(clientId, client.roomId);
    }

    // 更新客户端的房间ID和设备ID
    client.roomId = roomId;
    if (deviceId) {
        client.deviceId = deviceId;
    }
    if (clientType) {
        client.clientType = clientType;
    }

    // 如果是大屏端并且有设备ID，检查设备信息
    if (clientType === 'screen' && deviceId) {
        db.getDeviceByDeviceId(deviceId, (err, device) => {
            if (err) {
                console.error('获取设备信息失败:', err);
            } else if (!device) {
                // 如果设备不存在，创建一个新记录
                db.saveDevice({
                    deviceId: deviceId,
                    roomId: roomId,
                    name: '大屏端'
                }, (err, result) => {
                    if (err) {
                        console.error('保存设备信息失败:', err);
                    } else {
                        console.log('设备信息已保存:', result);
                    }
                });
            }
        });
    }

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
