const CONNECTION_STATES = {
  DISCONNECTED: 'disconnected',
  CONNECTING: 'connecting',
  CONNECTED: 'connected',
  RECONNECTING: 'reconnecting',
  ERROR: 'error'
};

class ConnectionStateManager {
  constructor() {
    this.deviceStates = new Map();
  }

  // 更新设备状态
  updateDeviceState(deviceId, state) {
    this.deviceStates.set(deviceId, state);
  }

  // 获取设备状态
  getDeviceState(deviceId) {
    return this.deviceStates.get(deviceId) || CONNECTION_STATES.DISCONNECTED;
  }

  // 获取状态显示文本
  getStatusText(state) {
    const textMap = {
      [CONNECTION_STATES.DISCONNECTED]: '未连接',
      [CONNECTION_STATES.CONNECTING]: '连接中',
      [CONNECTION_STATES.CONNECTED]: '已连接',
      [CONNECTION_STATES.RECONNECTING]: '重连中',
      [CONNECTION_STATES.ERROR]: '连接错误'
    };
    return textMap[state] || '未知状态';
  }
}

module.exports = {
  ConnectionStateManager,
  CONNECTION_STATES
}; 