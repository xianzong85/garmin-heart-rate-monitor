const app = getApp()
const { ConnectionStateManager, CONNECTION_STATES } = require('../../utils/connection-state');
const { WxChart } = require('../../utils/wxcharts.js');

// 服务UUID常量
const HEART_RATE_SERVICE = '180D';

let charts = new Map(); // 存储每个设备的图表实例
const stateManager = new ConnectionStateManager();

Page({
  data: {
    devices: [],
    isSearching: false,
    statusText: '请连接设备'
  },

  onLoad: function () {
    // 页面加载时自动开始搜索
    this.startSearch();
  },

  onShow: function () {
    // 页面显示时开始搜索
    this.startSearch();
  },

  onHide: function () {
    // 停止搜索
    wx.stopBluetoothDevicesDiscovery();
  },

  // 更新设备状态
  updateDeviceState: function(deviceId, state) {
    const devices = this.data.devices.map(device => {
      if (device.deviceId === deviceId) {
        device.connectionState = state;
        device.statusText = stateManager.getStatusText(state);
      }
      return device;
    });
    this.setData({ devices });
  },

  startSearch: function () {
    const that = this;
    if (that.data.isSearching) {
      // 如果正在搜索，则停止搜索
      wx.stopBluetoothDevicesDiscovery({
        success: () => {
          that.setData({
            isSearching: false,
            statusText: '搜索已停止'
          });
        }
      });
      return;
    }

    // 清空设备列表
    that.setData({
      isSearching: true,
      statusText: '正在搜索设备...',
      devices: []  // 清空设备列表
    });

    wx.openBluetoothAdapter({
      success: (res) => {
        console.log('初始化蓝牙适配器成功');
        // 先停止之前的搜索
        wx.stopBluetoothDevicesDiscovery({
          complete: () => {
            // 开始新的搜索
            wx.startBluetoothDevicesDiscovery({
              services: [HEART_RATE_SERVICE],
              allowDuplicatesKey: false,
              success: (res) => {
                console.log('开始搜索设备');
                wx.onBluetoothDeviceFound((res) => {
                  res.devices.forEach(device => {
                    // 检查是否已存在，只通过deviceId判断
                    const existingDevice = that.data.devices.find(d => d.deviceId === device.deviceId);
                    if (!existingDevice) {
                      device.connectionState = CONNECTION_STATES.DISCONNECTED;
                      device.statusText = stateManager.getStatusText(CONNECTION_STATES.DISCONNECTED);
                      const devices = that.data.devices;
                      devices.push(device);
                      that.setData({ 
                        devices,
                        statusText: `已发现 ${devices.length} 个设备`
                      });
                    }
                  });
                });
              },
              fail: (err) => {
                console.log('搜索设备失败:', err);
                that.setData({
                  isSearching: false,
                  statusText: '搜索设备失败'
                });
                wx.showToast({
                  title: '搜索失败',
                  icon: 'error'
                });
              }
            });
          }
        });
      },
      fail: (err) => {
        console.log('初始化蓝牙适配器失败:', err);
        that.setData({
          isSearching: false,
          statusText: '请检查蓝牙是否开启'
        });
        wx.showModal({
          title: '提示',
          content: '请打开蓝牙后重试',
          showCancel: false
        });
      }
    });
  },

  connectToDevice: function (e) {
    const that = this;
    const device = e.currentTarget.dataset.device;
    
    if (!device || !device.deviceId) {
      wx.showToast({
        title: '无效的设备信息',
        icon: 'none'
      });
      return;
    }

    // 如果设备已连接，则断开连接
    if (device.connectionState === CONNECTION_STATES.CONNECTED) {
      that.disconnectDevice(device.deviceId);
      return;
    }

    // 更新连接状态
    this.updateDeviceState(device.deviceId, CONNECTION_STATES.CONNECTING);

    // 停止搜索
    wx.stopBluetoothDevicesDiscovery();

    // 连接设备
    wx.createBLEConnection({
      deviceId: device.deviceId,
      success: function (res) {
        console.log('连接设备成功:', device.deviceId);
        that.updateDeviceState(device.deviceId, CONNECTION_STATES.CONNECTED);
        
        // 获取服务
        wx.getBLEDeviceServices({
          deviceId: device.deviceId,
          success: function (res) {
            console.log('获取服务列表:', res.services);
            let found = false;
            for (let service of res.services) {
              if (service.uuid.toLowerCase().includes(HEART_RATE_SERVICE.toLowerCase())) {
                console.log('找到心率服务:', service.uuid);
                found = true;
                
                wx.showToast({
                  title: '连接成功',
                  icon: 'success',
                  duration: 1500,
                  success: () => {
                    // 跳转到PK页面，通过URL参数传递数据
                    const deviceData = {
                      deviceId: device.deviceId,
                      name: device.name || '未知设备',
                      serviceId: service.uuid
                    };
                    setTimeout(() => {
                      wx.navigateTo({
                        url: `/pages/pk/pk?device=${JSON.stringify(deviceData)}`
                      });
                    }, 1500);
                  }
                });
                break;
              }
            }
            if (!found) {
              console.log('未找到心率服务');
              that.updateDeviceState(device.deviceId, CONNECTION_STATES.ERROR);
              wx.showModal({
                title: '连接失败',
                content: '未找到心率服务，请确保设备支持心率功能',
                showCancel: false,
                success: () => {
                  that.disconnectDevice(device.deviceId);
                }
              });
            }
          },
          fail: function (err) {
            console.log('获取服务失败:', err);
            that.updateDeviceState(device.deviceId, CONNECTION_STATES.ERROR);
            wx.showModal({
              title: '连接失败',
              content: '获取设备服务失败，请重试',
              showCancel: false,
              success: () => {
                that.disconnectDevice(device.deviceId);
              }
            });
          }
        });
      },
      fail: function (err) {
        console.log('连接设备失败:', err);
        that.updateDeviceState(device.deviceId, CONNECTION_STATES.ERROR);
        wx.showToast({
          title: '连接失败',
          icon: 'error'
        });
      }
    });
  },

  disconnectDevice: function (deviceId) {
    const that = this;
    wx.closeBLEConnection({
      deviceId: deviceId,
      success: function (res) {
        console.log('断开设备连接成功:', deviceId);
        that.updateDeviceState(deviceId, CONNECTION_STATES.DISCONNECTED);
        wx.showToast({
          title: '已断开连接',
          icon: 'success'
        });
      },
      fail: function (err) {
        console.log('断开设备连接失败:', err);
        that.updateDeviceState(deviceId, CONNECTION_STATES.ERROR);
        wx.showToast({
          title: '断开连接失败',
          icon: 'error'
        });
      }
    });
  }
});
