// 全局变量
let socket = null;
let roomId = null;
let participants = new Map();
let isPKMode = false;
let pkTimer = null;
let pkTimeLeft = 0;
let heartRateChart = null;
let chartData = {
    labels: [],
    datasets: []
};

// 颜色列表
const COLORS = [
    '#f56c6c', // 红色
    '#409eff', // 蓝色
    '#67c23a', // 绿色
    '#e6a23c', // 橙色
    '#909399', // 灰色
    '#9c27b0', // 紫色
    '#2196f3', // 天蓝色
    '#ff9800', // 橙黄色
    '#4caf50', // 草绿色
    '#795548'  // 棕色
];

// 初始化
document.addEventListener('DOMContentLoaded', function() {
    // 生成随机房间ID
    generateRoomId();

    // 生成二维码
    generateQRCode();

    // 初始化图表
    initChart();

    // 连接WebSocket服务器
    connectToServer();
});

// 生成随机房间ID
function generateRoomId() {
    // 生成6位随机数字
    roomId = Math.floor(100000 + Math.random() * 900000).toString();
    document.getElementById('room-id-display').textContent = roomId;
}

// 生成二维码
function generateQRCode() {
    const qrcodeContainer = document.getElementById('qrcode');

    // 清空容器
    qrcodeContainer.innerHTML = '';

    // 生成二维码
    // 注意：实际使用时，这里应该是小程序的页面路径或带有参数的URL
    const qrcodeData = `heartrate://connect?roomId=${roomId}`;

    // 使用qrcode.js库生成二维码
    new QRCode(qrcodeContainer, {
        text: qrcodeData,
        width: 200,
        height: 200,
        colorDark: '#000000',
        colorLight: '#ffffff',
        correctLevel: QRCode.CorrectLevel.H
    });
}

// 初始化图表
function initChart() {
    const ctx = document.getElementById('heart-rate-chart').getContext('2d');

    // 初始化空数据
    chartData = {
        labels: Array(30).fill(''),
        datasets: []
    };

    // 创建图表
    heartRateChart = new Chart(ctx, {
        type: 'line',
        data: chartData,
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: {
                duration: 0 // 禁用动画以提高性能
            },
            scales: {
                x: {
                    display: false
                },
                y: {
                    min: 40,
                    max: 200,
                    title: {
                        display: true,
                        text: '心率 (BPM)'
                    }
                }
            },
            plugins: {
                legend: {
                    position: 'top',
                    labels: {
                        boxWidth: 15,
                        padding: 15,
                        font: {
                            size: 14
                        }
                    }
                },
                tooltip: {
                    mode: 'index',
                    intersect: false
                }
            }
        }
    });
}

// 连接到WebSocket服务器
function connectToServer() {
    // 实际使用时，这里应该是你的WebSocket服务器地址
    const serverUrl = 'ws://192.168.1.125:3000'; // 开发环境使用ws://
    // const serverUrl = 'wss://192.168.1.125:3000'; // 正式环境使用wss://

    // 连接WebSocket服务器
    socket = new WebSocket(serverUrl);

    socket.onopen = function(event) {
        console.log('WebSocket连接已建立', event);

        // 发送加入房间消息
        sendMessage({
            type: 'join',
            roomId: roomId
        });

        // 发送测试消息
        sendMessage({
            type: 'test',
            message: '测试消息从大屏端发送',
            timestamp: Date.now()
        });
    };

    socket.onmessage = function(event) {
        const data = JSON.parse(event.data);
        handleMessage(data);
    };

    socket.onclose = function() {
        console.log('WebSocket连接已关闭');

        // 尝试重新连接
        setTimeout(connectToServer, 5000);
    };

    socket.onerror = function(error) {
        console.error('WebSocket错误:', error);
        console.error('WebSocket错误详情:', JSON.stringify(error));

        // 显示错误提示
        const errorContainer = document.createElement('div');
        errorContainer.className = 'error-message';
        errorContainer.innerHTML = `
            <div class="error-title">WebSocket连接错误</div>
            <div class="error-details">请检查网络连接和服务器状态</div>
        `;
        document.body.appendChild(errorContainer);

        // 3秒后移除错误提示
        setTimeout(() => {
            document.body.removeChild(errorContainer);
        }, 3000);
    };

    // 如果需要模拟数据，可以取消下面的注释
    // simulateMessages();
}

// 发送消息
function sendMessage(data) {
    if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify(data));
    } else {
        console.warn('WebSocket未连接，无法发送消息');
    }
}

// 处理接收到的消息
function handleMessage(data) {
    console.log('收到消息:', data);

    switch (data.type) {
        case 'heartrate':
            updateHeartRateData(data.devices);
            break;

        case 'pkstatus':
            updatePKStatus(data.isPKMode, data.timeLeft);
            break;

        case 'pkresults':
            showPKResults(data.results);
            break;

        default:
            console.warn('未知消息类型:', data.type);
    }
}

// 更新心率数据
function updateHeartRateData(devices) {
    if (!devices || !Array.isArray(devices)) return;

    // 更新参与者列表
    devices.forEach((device, index) => {
        // 如果是新设备，添加到Map中
        if (!participants.has(device.deviceId)) {
            // 为新设备分配颜色
            const colorIndex = participants.size % COLORS.length;
            device.color = COLORS[colorIndex];

            // 为图表添加新数据集
            addChartDataset(device);
        }

        // 更新设备数据
        participants.set(device.deviceId, {
            ...participants.get(device.deviceId),
            ...device
        });
    });

    // 更新UI
    updateParticipantsList();
    updateChart();
}

// 添加图表数据集
function addChartDataset(device) {
    // 创建新的数据集
    const newDataset = {
        label: device.name,
        data: Array(30).fill(null),
        borderColor: device.color,
        backgroundColor: device.color + '20',
        borderWidth: 2,
        pointRadius: 0,
        pointHoverRadius: 5,
        tension: 0.3,
        fill: false
    };

    // 添加到图表数据中
    chartData.datasets.push(newDataset);
}

// 更新参与者列表
function updateParticipantsList() {
    const listContainer = document.getElementById('participants-list');

    // 清空列表
    listContainer.innerHTML = '';

    // 按排名排序
    const sortedParticipants = Array.from(participants.values())
        .sort((a, b) => {
            // 未佩戴的设备排在最后
            if (a.isWorn === false && b.isWorn !== false) return 1;
            if (a.isWorn !== false && b.isWorn === false) return -1;

            // 按排名排序
            return (a.rank || 999) - (b.rank || 999);
        });

    // 创建参与者卡片
    sortedParticipants.forEach(participant => {
        const card = document.createElement('div');
        card.className = 'participant-card';

        // 添加领先和未佩戴状态
        if (participant.rank === 1 && participant.isWorn !== false) {
            card.classList.add('leading');
        }

        if (participant.isWorn === false) {
            card.classList.add('not-worn');
        }

        // 设置卡片内容
        card.innerHTML = `
            <div class="participant-rank rank-${participant.rank || ''}">
                ${participant.rank || '-'}
            </div>
            <div class="participant-info">
                <div class="participant-name">${participant.name}</div>
                <div class="participant-status">
                    ${participant.isWorn === false ? '未佩戴' : '已连接'}
                </div>
            </div>
            <div class="participant-heart-rate" style="color: ${participant.color}">
                ${participant.isWorn === false ? '--' : (participant.heartRate || '--')}
                <span>BPM</span>
            </div>
        `;

        listContainer.appendChild(card);
    });
}

// 更新图表
function updateChart() {
    // 更新每个数据集的数据
    participants.forEach((participant, deviceId) => {
        // 查找对应的数据集
        const datasetIndex = chartData.datasets.findIndex(dataset => dataset.label === participant.name);

        if (datasetIndex !== -1) {
            // 如果设备未佩戴，不更新数据
            if (participant.isWorn === false) return;

            // 获取当前数据
            const currentData = chartData.datasets[datasetIndex].data;

            // 移除最早的数据点，添加新的数据点
            currentData.shift();
            currentData.push(participant.heartRate || null);

            // 更新数据集
            chartData.datasets[datasetIndex].data = currentData;
        }
    });

    // 更新图表
    heartRateChart.update();
}

// 更新PK状态
function updatePKStatus(newIsPKMode, newTimeLeft) {
    // 更新PK模式状态
    isPKMode = newIsPKMode;

    // 更新倒计时
    pkTimeLeft = newTimeLeft;

    // 更新UI
    if (isPKMode) {
        // 显示PK界面
        showScreen('pk-screen');

        // 更新状态文本
        document.getElementById('pk-status').textContent = 'PK进行中';

        // 更新倒计时
        updateTimer();

        // 启动倒计时
        if (pkTimer) clearInterval(pkTimer);
        pkTimer = setInterval(updateTimer, 1000);
    } else {
        // 停止倒计时
        if (pkTimer) {
            clearInterval(pkTimer);
            pkTimer = null;
        }

        // 更新状态文本
        document.getElementById('pk-status').textContent = '等待开始...';

        // 如果不是因为显示结果而结束PK，则显示等待界面
        if (!document.getElementById('result-screen').classList.contains('active')) {
            showScreen('waiting-screen');
        }
    }
}

// 更新倒计时
function updateTimer() {
    // 减少剩余时间
    if (pkTimeLeft > 0) {
        pkTimeLeft--;
    }

    // 格式化时间
    const minutes = Math.floor(pkTimeLeft / 60);
    const seconds = pkTimeLeft % 60;
    const formattedTime = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

    // 更新UI
    document.getElementById('timer-value').textContent = formattedTime;

    // 如果倒计时结束，停止计时器
    if (pkTimeLeft <= 0 && pkTimer) {
        clearInterval(pkTimer);
        pkTimer = null;
    }
}

// 显示PK结果
function showPKResults(results) {
    if (!results || !Array.isArray(results) || results.length === 0) return;

    // 显示结果界面
    showScreen('result-screen');

    // 更新前三名
    if (results.length > 0) {
        updatePodiumItem('first-place', results[0]);
    }

    if (results.length > 1) {
        updatePodiumItem('second-place', results[1]);
    }

    if (results.length > 2) {
        updatePodiumItem('third-place', results[2]);
    }

    // 更新其他参与者
    const resultList = document.getElementById('result-list');
    resultList.innerHTML = '';

    for (let i = 3; i < results.length; i++) {
        const result = results[i];
        const item = document.createElement('div');
        item.className = 'result-item';

        item.innerHTML = `
            <div class="result-rank">${i + 1}</div>
            <div class="result-info">
                <div class="result-name">${result.name}</div>
            </div>
            <div class="result-heart-rate">
                ${result.heartRate || '--'}<span>BPM</span>
            </div>
        `;

        resultList.appendChild(item);
    }
}

// 更新领奖台项目
function updatePodiumItem(id, data) {
    const item = document.getElementById(id);
    if (!item || !data) return;

    // 更新名称
    item.querySelector('.name').textContent = data.name;

    // 更新心率
    item.querySelector('.heart-rate').innerHTML = `${data.heartRate || '--'} <span>BPM</span>`;

    // 更新头像（这里使用名称的首字母）
    const avatar = item.querySelector('.avatar');
    avatar.textContent = data.name.charAt(0).toUpperCase();
}

// 显示指定屏幕
function showScreen(screenId) {
    // 隐藏所有屏幕
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
    });

    // 显示指定屏幕
    document.getElementById(screenId).classList.add('active');
}

// 模拟接收消息（仅用于演示）
function simulateMessages() {
    // 模拟设备连接
    setTimeout(() => {
        const devices = [
            {
                deviceId: 'device1',
                name: '张三的手表',
                heartRate: 75,
                isWorn: true,
                rank: 2
            },
            {
                deviceId: 'device2',
                name: '李四的手表',
                heartRate: 82,
                isWorn: true,
                rank: 1
            }
        ];

        handleMessage({
            type: 'heartrate',
            devices: devices
        });
    }, 2000);

    // 模拟心率数据更新
    let heartRateUpdateInterval = setInterval(() => {
        const devices = Array.from(participants.values()).map(participant => {
            // 如果设备未佩戴，不更新心率
            if (participant.isWorn === false) return participant;

            // 随机更新心率（上下浮动5个点）
            const heartRateChange = Math.floor(Math.random() * 11) - 5;
            const newHeartRate = Math.max(60, Math.min(180, (participant.heartRate || 75) + heartRateChange));

            return {
                ...participant,
                heartRate: newHeartRate
            };
        });

        // 按心率排序
        devices.sort((a, b) => {
            if (a.isWorn === false && b.isWorn !== false) return 1;
            if (a.isWorn !== false && b.isWorn === false) return -1;
            return b.heartRate - a.heartRate;
        });

        // 更新排名
        devices.forEach((device, index) => {
            if (device.isWorn !== false) {
                device.rank = index + 1;
            }
        });

        handleMessage({
            type: 'heartrate',
            devices: devices
        });
    }, 2000);

    // 模拟5秒后添加新设备
    setTimeout(() => {
        const devices = Array.from(participants.values());
        devices.push({
            deviceId: 'device3',
            name: '王五的手表',
            heartRate: 68,
            isWorn: true,
            rank: 3
        });

        // 更新排名
        devices.sort((a, b) => {
            if (a.isWorn === false && b.isWorn !== false) return 1;
            if (a.isWorn !== false && b.isWorn === false) return -1;
            return b.heartRate - a.heartRate;
        });

        devices.forEach((device, index) => {
            if (device.isWorn !== false) {
                device.rank = index + 1;
            }
        });

        handleMessage({
            type: 'heartrate',
            devices: devices
        });
    }, 5000);

    // 模拟10秒后开始PK
    setTimeout(() => {
        handleMessage({
            type: 'pkstatus',
            isPKMode: true,
            timeLeft: 180
        });
    }, 10000);

    // 模拟30秒后结束PK并显示结果
    setTimeout(() => {
        // 停止心率更新
        clearInterval(heartRateUpdateInterval);

        // 结束PK
        handleMessage({
            type: 'pkstatus',
            isPKMode: false,
            timeLeft: 0
        });

        // 显示结果
        const results = Array.from(participants.values())
            .filter(participant => participant.isWorn !== false)
            .sort((a, b) => b.heartRate - a.heartRate)
            .map((participant, index) => ({
                deviceId: participant.deviceId,
                name: participant.name,
                heartRate: participant.heartRate,
                rank: index + 1
            }));

        handleMessage({
            type: 'pkresults',
            results: results
        });
    }, 30000);
}
