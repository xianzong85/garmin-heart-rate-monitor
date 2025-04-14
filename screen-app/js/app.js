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

// 当前活动的屏幕
let currentScreen = 'waiting-screen';

// 界面切换锁定状态
let screenLocked = false;

// 最后一次切换屏幕的时间
let lastScreenChangeTime = 0;

// 颜色列表
const COLORS = [
    '#ff5e62', // 亮橙红
    '#ff9966', // 橙色
    '#feb47b', // 浅橙色
    '#ffcc33', // 金黄色
    '#00b8d4', // 蓝绿色
    '#2979ff', // 蓝色
    '#00e676', // 绿色
    '#aa00ff', // 紫色
    '#ff4081', // 粉色
    '#ff6d00'  // 深橙色
];

// 获取设备ID
function getDeviceId() {
    // 首先尝试从 localStorage 获取
    let deviceId = localStorage.getItem('deviceId');

    // 如果没有，生成一个新的
    if (!deviceId) {
        deviceId = 'device-' + Math.random().toString(36).substring(2, 15) +
                  Math.random().toString(36).substring(2, 15);
        localStorage.setItem('deviceId', deviceId);
    }

    return deviceId;
}

// 初始化
document.addEventListener('DOMContentLoaded', function() {
    // 获取设备ID
    const deviceId = getDeviceId();
    console.log('设备ID:', deviceId);

    // 获取房间ID的优先顺序：
    // 1. URL参数
    // 2. localStorage保存的房间ID
    // 3. 随机生成
    const urlParams = new URLSearchParams(window.location.search);
    const urlRoomId = urlParams.get('roomId');
    const storedRoomId = localStorage.getItem('roomId');

    if (urlRoomId) {
        // 使用URL中的房间ID
        roomId = urlRoomId;
        // 并保存到localStorage
        localStorage.setItem('roomId', roomId);
        console.log('使用URL中的房间ID:', roomId);
    } else if (storedRoomId) {
        // 使用存储的房间ID
        roomId = storedRoomId;
        console.log('使用存储的房间ID:', roomId);
    } else {
        // 生成随机房间ID
        generateRoomId();
        console.log('生成随机房间ID:', roomId);
    }

    // 显示房间ID
    updateRoomIdDisplay();

    // 生成二维码
    generateQRCode();

    // 初始化图表
    initChart();

    // 连接WebSocket服务器
    connectToServer();

    // 添加调试信息
    console.log('大屏端初始化完成，房间ID:', roomId);

    // 添加调试按钮事件
    document.getElementById('debug-test-data').addEventListener('click', function() {
        console.log('点击了模拟测试数据按钮');
        simulateTestData();
    });

    document.getElementById('debug-switch-screen').addEventListener('click', function() {
        console.log('点击了切换到PK界面按钮');
        showScreen('pk-screen');
    });

    // 添加设置按钮事件
    document.getElementById('open-settings').addEventListener('click', function() {
        console.log('点击了设备设置按钮');
        window.location.href = '/settings.html';
    });

    // 添加PK页面的设置按钮事件
    const pkSettingsBtn = document.getElementById('pk-settings-btn');
    if (pkSettingsBtn) {
        pkSettingsBtn.addEventListener('click', function() {
            console.log('点击了PK页面的设备设置按钮');
            window.location.href = '/settings.html';
        });
    }
});

// 生成随机房间ID
function generateRoomId() {
    // 生成6位随机数字
    roomId = Math.floor(100000 + Math.random() * 900000).toString();
    // 保存到localStorage
    localStorage.setItem('roomId', roomId);
    updateRoomIdDisplay();
}

// 更新所有房间ID显示
function updateRoomIdDisplay() {
    // 更新等待界面的房间ID
    const waitingRoomIdDisplay = document.getElementById('room-id-display');
    if (waitingRoomIdDisplay) {
        waitingRoomIdDisplay.textContent = roomId;
    }

    // 更新PK界面的房间ID
    const pkRoomIdDisplay = document.getElementById('pk-room-id');
    if (pkRoomIdDisplay) {
        pkRoomIdDisplay.textContent = roomId;
    }

    console.log('房间ID显示已更新:', roomId);
}

// 生成二维码
function generateQRCode() {
    try {
        // 生成二维码的URL，包含房间ID
        const qrcodeData = `heartrate://connect?roomId=${roomId}`;
        console.log('尝试生成二维码，数据:', qrcodeData);

        // 生成等待页面的二维码
        const qrcodeContainer = document.getElementById('qrcode');
        if (qrcodeContainer) {
            // 清空容器
            qrcodeContainer.innerHTML = '';

            // 检查QRCode库是否已加载
            if (typeof QRCode === 'undefined') {
                console.error('QRCode库未加载，使用文本替代');
                const textNode = document.createElement('div');
                textNode.className = 'qrcode-text';
                textNode.textContent = `房间ID: ${roomId}`;
                qrcodeContainer.appendChild(textNode);
            } else {
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
        }

        // 生成PK页面的二维码
        const pkQrcodeContainer = document.getElementById('pk-qrcode');
        if (pkQrcodeContainer && typeof QRCode !== 'undefined') {
            // 清空容器
            pkQrcodeContainer.innerHTML = '';

            // 使用qrcode.js库生成二维码
            new QRCode(pkQrcodeContainer, {
                text: qrcodeData,
                width: 60,
                height: 60,
                colorDark: '#000000',
                colorLight: '#ffffff',
                correctLevel: QRCode.CorrectLevel.H
            });
        }
    } catch (error) {
        console.error('生成二维码时出错:', error);

        // 在出错时显示文本
        const qrcodeContainer = document.getElementById('qrcode');
        if (qrcodeContainer) {
            qrcodeContainer.innerHTML = '';
            const textNode = document.createElement('div');
            textNode.className = 'qrcode-text';
            textNode.textContent = `房间ID: ${roomId}`;
            qrcodeContainer.appendChild(textNode);
        }
    }
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
    Chart.defaults.color = 'rgba(255, 255, 255, 0.8)';
    Chart.defaults.borderColor = 'rgba(255, 255, 255, 0.1)';

    // 全局禁用数据集的初始动画
    Chart.defaults.datasets.line.animation = false;

    heartRateChart = new Chart(ctx, {
        type: 'line',
        data: chartData,
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: {
                duration: 0 // 禁用动画效果
            },
            transitions: {
                active: {
                    animation: {
                        duration: 0 // 禁用过渡动画
                    }
                }
            },
            scales: {
                x: {
                    display: false
                },
                y: {
                    min: 40,
                    max: 200,
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)',
                        borderColor: 'rgba(255, 255, 255, 0.2)',
                        lineWidth: 1
                    },
                    ticks: {
                        color: 'rgba(255, 255, 255, 0.8)',
                        font: {
                            size: 12,
                            weight: 'bold'
                        },
                        stepSize: 20,
                        padding: 10
                    },
                    title: {
                        display: false
                    },
                    position: 'left'
                }
            },
            plugins: {
                legend: {
                    position: 'top',
                    align: 'center',
                    labels: {
                        color: 'rgba(255, 255, 255, 0.9)',
                        boxWidth: 18,
                        padding: 20,
                        font: {
                            size: 16,
                            weight: 'bold'
                        },
                        usePointStyle: true,
                        pointStyle: 'circle'
                    }
                },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    titleColor: 'rgba(255, 255, 255, 1)',
                    bodyColor: 'rgba(255, 255, 255, 0.9)',
                    borderColor: 'rgba(255, 255, 255, 0.2)',
                    borderWidth: 1,
                    cornerRadius: 10,
                    padding: 12,
                    titleFont: {
                        weight: 'bold',
                        size: 14
                    },
                    bodyFont: {
                        size: 14
                    },
                    displayColors: true,
                    boxWidth: 8,
                    boxHeight: 8,
                    boxPadding: 4,
                    usePointStyle: true
                }
            }
        }
    });
}

// 获取并显示场地信息
function getVenueInfo() {
    const deviceId = getDeviceId();

    // 使用fetch API获取设备信息
    fetch(`/api/device?deviceId=${deviceId}`)
        .then(response => response.json())
        .then(data => {
            if (data.device && data.device.venue_id) {
                // 获取场地信息
                fetch(`/api/venue/${data.device.venue_id}`)
                    .then(response => response.json())
                    .then(venueData => {
                        if (venueData.venue) {
                            // 显示场地名称
                            const venueNameElement = document.getElementById('venue-name');
                            if (venueNameElement) {
                                venueNameElement.textContent = venueData.venue.name;
                            }
                            console.log('已显示场地信息:', venueData.venue.name);
                        }
                    })
                    .catch(error => {
                        console.error('获取场地信息失败:', error);
                    });
            }
        })
        .catch(error => {
            console.error('获取设备信息失败:', error);
        });
}

// 连接到WebSocket服务器
function connectToServer() {
    // 如果已经有连接，先关闭
    if (socket && socket.readyState !== WebSocket.CLOSED) {
        console.log('关闭现有WebSocket连接');
        socket.close();
    }

    // 获取当前主机地址
    const host = '192.168.1.205';
    const port = 8080;
    const serverUrl = `ws://${host}:${port}`;

    console.log('连接到WebSocket服务器:', serverUrl);

    try {
        socket = new WebSocket(serverUrl);

        socket.onopen = function() {
            console.log('WebSocket连接已建立');

            // 获取设备ID
            const deviceId = getDeviceId();

            // 获取场地信息
            getVenueInfo();

            // 发送加入房间消息
            sendMessage({
                type: 'join',
                roomId: roomId,
                deviceId: deviceId,
                clientType: 'screen' // 标记为大屏端
            });

            console.log('已发送加入房间消息，房间ID:', roomId, '设备ID:', deviceId);
        };

        socket.onmessage = function(event) {
            console.log('收到WebSocket消息原始数据:', event.data);

            try {
                const data = JSON.parse(event.data);
                console.log('解析后的消息数据:', data);
                handleMessage(data);
            } catch (error) {
                console.error('解析WebSocket消息失败:', error);
                console.error('原始消息内容:', event.data);
            }
        };

        socket.onclose = function(event) {
            console.log('WebSocket连接关闭:', event.code, event.reason);

            // 尝试重新连接
            setTimeout(connectToServer, 5000);
        };

        socket.onerror = function(error) {
            console.error('WebSocket错误:', error);
        };

    } catch (error) {
        console.error('WebSocket创建失败:', error);
    }

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

// 模拟测试数据
function simulateTestData() {
    console.log('模拟测试数据');

    // 模拟心率数据
    const heartRateData = {
        type: 'heartrate',
        roomId: roomId,
        devices: [
            {
                deviceId: 'E6519775-2004-C370-D9E4-643592C28190',
                name: 'Forerunner',
                heartRate: 91,
                isWorn: true,
                rank: 1,
                maxHeartRate: 91,
                minHeartRate: 84,
                avgHeartRate: 88
            },
            {
                deviceId: 'test-device-2',
                name: '测试设备2',
                heartRate: 85,
                isWorn: true,
                rank: 2,
                maxHeartRate: 88,
                minHeartRate: 80,
                avgHeartRate: 84
            }
        ],
        timestamp: Date.now()
    };

    // 先处理心率数据
    console.log('先处理模拟心率数据');
    handleMessage(heartRateData);

    // 等待一下，确保心率数据已经处理完毕
    setTimeout(() => {
        // 模拟PK状态数据
        const pkStatusData = {
            type: 'pkstatus',
            roomId: roomId,
            isPKMode: true,
            timeLeft: 180,
            timestamp: Date.now()
        };

        console.log('处理模拟PK状态数据');
        handleMessage(pkStatusData);

        // 强制切换到PK界面
        setTimeout(() => {
            console.log('强制切换到PK界面');
            showScreen('pk-screen', true); // 使用强制模式
        }, 500);
    }, 300);
}

// 处理接收到的消息
function handleMessage(data) {
    console.log('开始处理消息:', data.type);

    // 检查房间ID是否匹配
    if (data.roomId && data.roomId !== roomId) {
        console.warn(`消息房间ID(${data.roomId})与当前房间ID(${roomId})不匹配，忽略消息`);
        return;
    }

    // 处理欢迎消息和加入房间消息
    if (data.type === 'welcome' || data.type === 'joined') {
        console.log(`收到${data.type}消息:`, data);
        // 可以在这里添加特殊处理
        return;
    }

    // 处理测试消息
    if (data.type === 'test') {
        console.log('收到测试消息:', data.message);
        return;
    }

    // 处理心跳消息
    if (data.type === 'ping' || data.type === 'pong') {
        console.log(`收到${data.type}消息`);
        return;
    }

    switch (data.type) {
        case 'heartrate':
            console.log('处理心率数据:', data.devices);
            updateHeartRateData(data.devices);
            break;

        case 'pkstatus':
            console.log('处理PK状态:', data.isPKMode, data.timeLeft);
            updatePKStatus(data.isPKMode, data.timeLeft);
            break;

        case 'pkresults':
            console.log('处理PK结果:', data.results);
            showPKResults(data.results);
            break;

        default:
            console.warn('未知消息类型:', data.type);
    }
}

// 更新心率数据
function updateHeartRateData(devices) {
    if (!devices || !Array.isArray(devices)) {
        console.warn('无效的设备数据:', devices);
        return;
    }

    console.log('开始更新心率数据，设备数量:', devices.length);

    // 更新参与者列表
    devices.forEach((device, index) => {
        if (!device.deviceId) {
            console.warn('设备缺少deviceId:', device);
            return;
        }

        console.log(`处理设备 ${index+1}/${devices.length}:`, device.deviceId, device.name);

        // 如果是新设备，添加到Map中
        if (!participants.has(device.deviceId)) {
            console.log('发现新设备:', device.deviceId, device.name);

            // 为新设备分配颜色
            const colorIndex = participants.size % COLORS.length;
            device.color = COLORS[colorIndex];

            // 为图表添加新数据集
            addChartDataset(device);
        }

        // 更新设备数据
        const updatedDevice = {
            ...participants.get(device.deviceId),
            ...device
        };

        participants.set(device.deviceId, updatedDevice);
        console.log('设备数据已更新:', updatedDevice.deviceId, updatedDevice.name, updatedDevice.heartRate);
    });

    // 如果有设备数据且当前在等待界面，切换到PK界面
    if (devices.length > 0 && currentScreen === 'waiting-screen' && !screenLocked) {
        console.log('有设备数据且当前在等待界面，切换到PK界面');
        // 使用延时确保数据已完全处理
        setTimeout(() => {
            showScreen('pk-screen');
        }, 200);
    }

    // 更新UI
    updateParticipantsList();
    updateChart();

    console.log('心率数据更新完成，当前参与者数量:', participants.size);
}

// 添加图表数据集
function addChartDataset(device) {
    // 创建新的数据集
    const newDataset = {
        label: device.name,
        // 初始化数据数组，如果有心率数据，则预填充相同的值
        data: Array(30).fill(device.heartRate || null),
        borderColor: device.color,
        backgroundColor: `${device.color}33`, // 使用设备颜色作为半透明填充
        borderWidth: 3, // 增加线条宽度
        pointRadius: 0,
        pointHoverRadius: 8,
        tension: 0.3, // 调整平滑度
        fill: true, // 启用填充
        cubicInterpolationMode: 'monotone', // 使线条更平滑
        borderCapStyle: 'round', // 圆角线条
        borderJoinStyle: 'round', // 圆角连接
        segment: {
            borderColor: ctx => ctx.p0.parsed.y > 160 ? 'rgba(255, 0, 0, 0.8)' : device.color, // 高心率区域显示红色
        },
        spanGaps: true // 跨越空值
    };

    // 添加到图表数据中
    chartData.datasets.push(newDataset);
}

// 更新参与者列表
function updateParticipantsList() {
    console.log('开始更新参与者列表');

    const listContainer = document.getElementById('participants-list');
    if (!listContainer) {
        console.error('找不到participants-list元素');
        return;
    }

    // 清空列表
    listContainer.innerHTML = '';

    // 检查是否有参与者
    if (participants.size === 0) {
        console.log('没有参与者数据');
        const emptyMessage = document.createElement('div');
        emptyMessage.className = 'empty-participants';
        emptyMessage.textContent = '暂无参与者数据';
        listContainer.appendChild(emptyMessage);
        return;
    }

    // 按排名排序
    const sortedParticipants = Array.from(participants.values())
        .sort((a, b) => {
            // 未佩戴的设备排在最后
            if (a.isWorn === false && b.isWorn !== false) return 1;
            if (a.isWorn !== false && b.isWorn === false) return -1;

            // 按排名排序
            return (a.rank || 999) - (b.rank || 999);
        });

    console.log('排序后的参与者:', sortedParticipants.map(p => `${p.name}(${p.heartRate || '--'})`).join(', '));

    // 创建参与者卡片
    sortedParticipants.forEach((participant, index) => {
        console.log(`创建参与者卡片 ${index+1}/${sortedParticipants.length}:`, participant.name);

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
            <div class="participant-avatar">
                <div class="participant-rank rank-${participant.rank || ''}">
                    ${participant.rank || '-'}
                </div>
            </div>
            <div class="participant-info">
                <div class="participant-name">${participant.name || '未命名设备'}</div>
                <div class="participant-status">
                    ${participant.isWorn === false ? '未佩戴' : '已连接'}
                </div>
            </div>
            <div class="participant-data">
                <div class="participant-heart-rate">
                    ${participant.isWorn === false ? '--' : (participant.heartRate || '--')}
                    <span>BPM</span>
                </div>
                <div class="participant-metrics">
                    <div class="metric heart-metric">
                        <i class="heart-icon">❤️</i>
                        ${participant.isWorn === false ? '--' : (participant.heartRate || '--')}
                    </div>
                    <div class="metric energy-metric">
                        <i class="energy-icon">🔥</i>
                        ${Math.floor(Math.random() * 50) + 10}
                    </div>
                </div>
                <div class="participant-progress">
                    <div class="progress-bar" style="background: linear-gradient(to right, #4CAF50, #FFC107, #F44336); width: ${participant.heartRate ? Math.min(100, participant.heartRate / 2) : 0}%;"></div>
                </div>
            </div>
        `;

        // 设置卡片背景色，使用设备颜色作为微妙的背景
        if (participant.color) {
            card.style.borderLeft = `4px solid ${participant.color}`;
            // 如果是第一名，使用更明显的样式
            if (participant.rank === 1 && participant.isWorn !== false) {
                card.style.boxShadow = `0 5px 15px ${participant.color}33`;
            }
        }

        listContainer.appendChild(card);
    });

    console.log('参与者列表更新完成');
}

// 更新图表
function updateChart() {
    // 更新每个数据集的数据
    participants.forEach((participant) => {
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

    // 更新图表，禁用动画以避免生硬的过渡
    if (heartRateChart) {
        heartRateChart.update('none'); // 使用 'none' 参数禁用动画
    }
}

// 更新PK状态
function updatePKStatus(newIsPKMode, newTimeLeft) {
    console.log('更新PK状态:', newIsPKMode, newTimeLeft);

    // 如果PK模式状态没有变化，只更新倒计时
    if (isPKMode === newIsPKMode) {
        console.log('PK模式状态未变化，只更新倒计时');
        pkTimeLeft = newTimeLeft;
        if (isPKMode) {
            updateTimer();
        }
        return;
    }

    // 更新PK模式状态
    isPKMode = newIsPKMode;

    // 更新倒计时
    pkTimeLeft = newTimeLeft;

    // 更新UI
    if (isPKMode) {
        console.log('进入PK模式，切换到PK界面');

        // 更新状态文本
        const pkStatus = document.getElementById('pk-status');
        if (pkStatus) {
            pkStatus.textContent = 'PK进行中';
        } else {
            console.error('找不到pk-status元素');
        }

        // 更新倒计时
        updateTimer();

        // 启动倒计时
        if (pkTimer) clearInterval(pkTimer);
        pkTimer = setInterval(updateTimer, 1000);

        // 强制显示PK界面
        setTimeout(() => {
            showScreen('pk-screen', true); // 使用强制模式
        }, 100);
    } else {
        console.log('退出PK模式');

        // 停止倒计时
        if (pkTimer) {
            clearInterval(pkTimer);
            pkTimer = null;
        }

        // 更新状态文本
        const pkStatus = document.getElementById('pk-status');
        if (pkStatus) {
            pkStatus.textContent = '等待开始...';
        }

        // 如果不是因为显示结果而结束PK，则显示等待界面
        if (!document.getElementById('result-screen').classList.contains('active')) {
            // 使用延时确保其他操作已完成
            setTimeout(() => {
                showScreen('waiting-screen', true); // 使用强制模式
            }, 100);
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
    const formattedTime = `${minutes.toString().padStart(2, '0')} : ${seconds.toString().padStart(2, '0')}`;

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

    console.log('显示PK结果，切换到结果界面');

    // 强制显示结果界面
    showScreen('result-screen', true);

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
function showScreen(screenId, force = false) {
    // 如果当前屏幕已经是目标屏幕，且不是强制切换，则不做任何操作
    if (currentScreen === screenId && !force) {
        console.log('当前已经在', screenId, '屏幕，不需要切换');
        return;
    }

    // 确保房间ID显示正确
    updateRoomIdDisplay();

    // 检查是否在锁定状态
    const now = Date.now();
    if (screenLocked && !force) {
        console.log('屏幕切换已锁定，忽略切换请求:', screenId);
        return;
    }

    // 检查是否过于频繁切换
    if (now - lastScreenChangeTime < 1000 && !force) {
        console.log('屏幕切换过于频繁，忽略切换请求:', screenId);
        return;
    }

    console.log('切换到屏幕:', screenId, force ? '(强制切换)' : '');

    // 检查目标屏幕是否存在
    const targetScreen = document.getElementById(screenId);
    if (!targetScreen) {
        console.error('目标屏幕不存在:', screenId);
        return;
    }

    // 锁定屏幕切换
    screenLocked = true;

    // 隐藏所有屏幕
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
        console.log('移除屏幕激活状态:', screen.id);
    });

    // 强制重绘
    void targetScreen.offsetWidth;

    // 显示指定屏幕
    targetScreen.classList.add('active');
    console.log('激活屏幕:', screenId);

    // 更新当前屏幕和最后切换时间
    currentScreen = screenId;
    lastScreenChangeTime = now;

    // 如果是PK屏幕，确保图表正确显示
    if (screenId === 'pk-screen' && heartRateChart) {
        setTimeout(() => {
            heartRateChart.update();
            console.log('心率图表已更新');
        }, 100);
    }

    // 延时解锁屏幕切换
    setTimeout(() => {
        screenLocked = false;
        console.log('屏幕切换锁定已解除');
    }, 2000);
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

            // 使用更平滑的心率变化
            // 保存上一次的变化方向，增加连续性
            if (!participant.lastChangeDirection) {
                participant.lastChangeDirection = Math.random() > 0.5 ? 1 : -1;
            }

            // 70%的概率保持相同的变化方向，30%的概率改变
            const keepDirection = Math.random() < 0.7;
            const direction = keepDirection ? participant.lastChangeDirection : -participant.lastChangeDirection;

            // 更小的变化幅度，使更新更平滑
            const heartRateChange = (Math.random() * 2 + 0.5) * direction;
            const newHeartRate = Math.max(60, Math.min(180, (participant.heartRate || 75) + heartRateChange));

            return {
                ...participant,
                heartRate: Math.round(newHeartRate),
                lastChangeDirection: direction
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
