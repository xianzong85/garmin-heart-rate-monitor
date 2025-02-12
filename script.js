let bluetoothDevice;
let heartRateCharacteristic;
let chart;

// 检查浏览器是否支持Web Bluetooth API
function isWebBluetoothSupported() {
    return navigator.bluetooth && typeof navigator.bluetooth.requestDevice === 'function';
}

// 初始化图表
function initChart() {
    const ctx = document.getElementById('heartRateChart').getContext('2d');
    chart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: '心率',
                data: [],
                borderColor: 'rgb(255, 99, 132)',
                tension: 0.1
            }]
        },
        options: {
            responsive: true,
            scales: {
                y: {
                    beginAtZero: false,
                    min: 40,
                    max: 200
                }
            }
        }
    });
}

// 更新图表数据
function updateChart(heartRate) {
    const now = new Date();
    const timeStr = now.getHours() + ':' + now.getMinutes() + ':' + now.getSeconds();
    
    chart.data.labels.push(timeStr);
    chart.data.datasets[0].data.push(heartRate);
    
    // 保持最近30个数据点
    if (chart.data.labels.length > 30) {
        chart.data.labels.shift();
        chart.data.datasets[0].data.shift();
    }
    
    chart.update();
}

// 处理心率数据
function handleHeartRateData(event) {
    const value = event.target.value;
    const heartRate = value.getUint8(1);
    
    document.getElementById('currentHeartRate').textContent = heartRate;
    updateChart(heartRate);
}

// 连接设备
async function connectDevice() {
    // 检查浏览器兼容性
    if (!isWebBluetoothSupported()) {
        document.getElementById('statusText').innerHTML = '您的浏览器不支持Web Bluetooth API。<br>请使用Android版Chrome浏览器访问。';
        document.getElementById('statusText').className = 'alert alert-danger text-center';
        return;
    }

    try {
        bluetoothDevice = await navigator.bluetooth.requestDevice({
            filters: [
                { services: ['heart_rate'] }
            ]
        });

        document.getElementById('statusText').textContent = '正在连接设备...';
        
        const server = await bluetoothDevice.gatt.connect();
        const service = await server.getPrimaryService('heart_rate');
        heartRateCharacteristic = await service.getCharacteristic('heart_rate_measurement');
        
        await heartRateCharacteristic.startNotifications();
        heartRateCharacteristic.addEventListener('characteristicvaluechanged', handleHeartRateData);
        
        document.getElementById('statusText').textContent = '设备已连接';
        document.getElementById('statusText').className = 'alert alert-success text-center';
        document.getElementById('connectBtn').style.display = 'none';
        document.getElementById('disconnectBtn').style.display = 'inline-block';
        document.getElementById('heartRateDisplay').style.display = 'block';
        
    } catch (error) {
        console.error(error);
        document.getElementById('statusText').textContent = '连接失败: ' + error;
        document.getElementById('statusText').className = 'alert alert-danger text-center';
    }
}

// 断开连接
function disconnectDevice() {
    if (bluetoothDevice && bluetoothDevice.gatt.connected) {
        if (heartRateCharacteristic) {
            heartRateCharacteristic.stopNotifications();
            heartRateCharacteristic.removeEventListener('characteristicvaluechanged', handleHeartRateData);
        }
        bluetoothDevice.gatt.disconnect();
    }
    
    document.getElementById('statusText').textContent = '设备已断开连接';
    document.getElementById('statusText').className = 'alert alert-info text-center';
    document.getElementById('connectBtn').style.display = 'inline-block';
    document.getElementById('disconnectBtn').style.display = 'none';
    document.getElementById('heartRateDisplay').style.display = 'none';
    document.getElementById('currentHeartRate').textContent = '--';
}

// 初始化页面
document.addEventListener('DOMContentLoaded', () => {
    // 检查浏览器兼容性
    if (!isWebBluetoothSupported()) {
        document.getElementById('statusText').innerHTML = '您的浏览器不支持Web Bluetooth API。<br>请使用Android版Chrome浏览器访问。';
        document.getElementById('statusText').className = 'alert alert-danger text-center';
    }

    initChart();
    document.getElementById('connectBtn').addEventListener('click', connectDevice);
    document.getElementById('disconnectBtn').addEventListener('click', disconnectDevice);
});

// 处理页面关闭时断开连接
window.addEventListener('beforeunload', () => {
    disconnectDevice();
});
