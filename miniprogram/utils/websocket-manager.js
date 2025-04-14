/**
 * WebSocket连接管理器
 * 用于管理与大屏幕的WebSocket连接
 */

class WebSocketManager {
  constructor() {
    this.socketUrl = ''; // WebSocket服务器地址
    this.socketTask = null; // WebSocket任务对象
    this.isConnected = false; // 连接状态
    this.reconnectTimer = null; // 重连定时器
    this.reconnectInterval = 3000; // 重连间隔（毫秒）
    this.reconnectAttempts = 0; // 重连尝试次数
    this.maxReconnectAttempts = 5; // 最大重连尝试次数
    this.heartbeatTimer = null; // 心跳定时器
    this.heartbeatInterval = 15000; // 心跳间隔（毫秒）
    this.messageCallback = null; // 消息回调函数
    this.connectionCallback = null; // 连接状态回调函数
    this.roomId = ''; // 房间ID
  }

  /**
   * 连接到WebSocket服务器
   * @param {string} url WebSocket服务器地址
   * @param {string} roomId 房间ID
   * @param {Function} messageCallback 消息回调函数
   * @param {Function} connectionCallback 连接状态回调函数
   */
  connect(url, roomId, messageCallback, connectionCallback) {
    // 如果已经连接，先断开
    if (this.isConnected) {
      this.disconnect();
    }

    this.socketUrl = url;
    this.roomId = roomId;
    this.messageCallback = messageCallback;
    this.connectionCallback = connectionCallback;

    // 重置重连计数
    this.reconnectAttempts = 0;

    // 创建WebSocket连接
    this.createConnection();
  }

  /**
   * 创建WebSocket连接
   */
  createConnection() {
    try {
      console.log('正在连接WebSocket服务器:', this.socketUrl);

      // 创建WebSocket任务
      this.socketTask = wx.connectSocket({
        url: this.socketUrl,
        // 添加协议头信息
        header: {
          'content-type': 'application/json'
        },
        // 不指定协议，使用默认协议
        // protocols: ['protocol1'],
        // 超时时间
        timeout: 5000,
        success: () => {
          console.log('WebSocket连接创建成功');
        },
        fail: (err) => {
          console.error('WebSocket连接创建失败:', err);
          this.reconnect();
        },
        complete: () => {
          console.log('WebSocket连接创建完成');
        }
      });

      // 监听WebSocket连接打开事件
      this.socketTask.onOpen(() => {
        console.log('WebSocket连接已打开');
        this.isConnected = true;

        // 加入房间
        this.joinRoom();

        // 开始心跳
        this.startHeartbeat();

        // 调用连接状态回调
        if (this.connectionCallback) {
          this.connectionCallback(true);
        }
      });

      // 监听WebSocket接收到服务器的消息事件
      this.socketTask.onMessage((res) => {
        console.log('收到WebSocket消息:', res.data);

        try {
          const data = JSON.parse(res.data);

          // 处理心跳响应
          if (data.type === 'pong') {
            console.log('收到心跳响应');
            return;
          }

          // 调用消息回调
          if (this.messageCallback) {
            this.messageCallback(data);
          }
        } catch (e) {
          console.error('解析WebSocket消息失败:', e);
        }
      });

      // 监听WebSocket错误事件
      this.socketTask.onError((err) => {
        console.error('WebSocket发生错误:', err);
        this.isConnected = false;

        // 调用连接状态回调
        if (this.connectionCallback) {
          this.connectionCallback(false);
        }

        this.reconnect();
      });

      // 监听WebSocket连接关闭事件
      this.socketTask.onClose(() => {
        console.log('WebSocket连接已关闭');
        this.isConnected = false;

        // 停止心跳
        this.stopHeartbeat();

        // 调用连接状态回调
        if (this.connectionCallback) {
          this.connectionCallback(false);
        }

        this.reconnect();
      });
    } catch (err) {
      console.error('创建WebSocket连接时发生异常:', err);
      this.reconnect();
    }
  }

  /**
   * 加入房间
   */
  joinRoom() {
    if (!this.isConnected || !this.roomId) return;

    const message = {
      type: 'join',
      roomId: this.roomId
    };

    this.sendMessage(message);
  }

  /**
   * 发送消息
   * @param {Object} data 要发送的数据
   */
  sendMessage(data) {
    if (!this.isConnected) {
      console.warn('WebSocket未连接，无法发送消息');
      return false;
    }

    try {
      const message = typeof data === 'string' ? data : JSON.stringify(data);

      this.socketTask.send({
        data: message,
        success: () => {
          console.log('WebSocket消息发送成功:', data);
        },
        fail: (err) => {
          console.error('WebSocket消息发送失败:', err);
        }
      });

      return true;
    } catch (err) {
      console.error('发送WebSocket消息时发生异常:', err);
      return false;
    }
  }

  /**
   * 发送心率数据
   * @param {Array} deviceList 设备列表
   */
  sendHeartRateData(deviceList) {
    if (!this.isConnected || !this.roomId) return false;

    // 提取需要发送的数据
    const devices = deviceList.map(device => ({
      deviceId: device.deviceId,
      name: device.name,
      heartRate: device.heartRate,
      isWorn: device.isWorn !== false,
      rank: device.rank || 0,
      maxHeartRate: device.maxHeartRate,
      minHeartRate: device.minHeartRate,
      avgHeartRate: device.avgHeartRate
    }));

    const message = {
      type: 'heartrate',
      roomId: this.roomId,
      devices,
      timestamp: Date.now()
    };

    return this.sendMessage(message);
  }

  /**
   * 发送PK状态
   * @param {boolean} isPKMode 是否处于PK模式
   * @param {number} timeLeft 剩余时间（秒）
   */
  sendPKStatus(isPKMode, timeLeft) {
    if (!this.isConnected || !this.roomId) return false;

    const message = {
      type: 'pkstatus',
      roomId: this.roomId,
      isPKMode,
      timeLeft,
      timestamp: Date.now()
    };

    return this.sendMessage(message);
  }

  /**
   * 发送PK结果
   * @param {Array} results PK结果
   */
  sendPKResults(results) {
    if (!this.isConnected || !this.roomId) return false;

    const message = {
      type: 'pkresults',
      roomId: this.roomId,
      results,
      timestamp: Date.now()
    };

    return this.sendMessage(message);
  }

  /**
   * 开始心跳
   */
  startHeartbeat() {
    this.stopHeartbeat();

    this.heartbeatTimer = setInterval(() => {
      if (this.isConnected) {
        const message = {
          type: 'ping',
          timestamp: Date.now()
        };

        this.sendMessage(message);
      }
    }, this.heartbeatInterval);
  }

  /**
   * 停止心跳
   */
  stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  /**
   * 重新连接
   */
  reconnect() {
    // 清除之前的重连定时器
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    // 增加重连尝试次数
    this.reconnectAttempts++;

    // 检查是否超过最大重连次数
    if (this.reconnectAttempts > this.maxReconnectAttempts) {
      console.log(`超过最大重连次数 ${this.maxReconnectAttempts}，停止重连`);

      // 调用连接状态回调
      if (this.connectionCallback) {
        this.connectionCallback(false);
      }

      return;
    }

    // 计算指数退避的重连间隔
    const delay = this.reconnectInterval * Math.pow(1.5, this.reconnectAttempts - 1);
    console.log(`将在 ${delay}ms 后进行第 ${this.reconnectAttempts} 次重连尝试`);

    // 设置重连定时器
    this.reconnectTimer = setTimeout(() => {
      console.log('正在尝试重新连接WebSocket...');
      this.createConnection();
    }, delay);
  }

  /**
   * 断开连接
   */
  disconnect() {
    // 停止心跳
    this.stopHeartbeat();

    // 清除重连定时器
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    // 重置重连计数
    this.reconnectAttempts = 0;

    // 关闭WebSocket连接
    if (this.socketTask) {
      try {
        this.socketTask.close({
          code: 1000, // 正常关闭
          reason: 'User closed connection',
          success: () => {
            console.log('WebSocket连接已关闭');
          },
          fail: (err) => {
            console.error('关闭WebSocket连接失败:', err);
          },
          complete: () => {
            console.log('WebSocket关闭操作完成');
          }
        });
      } catch (err) {
        console.error('关闭WebSocket连接时发生异常:', err);
      }
    }

    this.isConnected = false;
    this.socketTask = null;

    // 调用连接状态回调
    if (this.connectionCallback) {
      this.connectionCallback(false);
    }
  }
}

module.exports = {
  WebSocketManager
};
