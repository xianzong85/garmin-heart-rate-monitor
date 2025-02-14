const app = getApp()
const { WxChart } = require('../../utils/wxcharts.js');
let charts = new Map(); // 存储每个设备的图表实例

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

  startSearch: function () {
    const that = this;
    if (that.data.isSearching) return;

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
              services: ['180D'],
              allowDuplicatesKey: false,
              success: (res) => {
                console.log('开始搜索设备');
                wx.onBluetoothDeviceFound((res) => {
                  res.devices.forEach(device => {
                    // 检查是否已存在，只通过deviceId判断
                    const existingDevice = that.data.devices.find(d => d.deviceId === device.deviceId);
                    if (!existingDevice) {
                      // 尝试连接设备并检查心率通知
                      wx.createBLEConnection({
                        deviceId: device.deviceId,
                        success: function (res) {
                          // 获取服务
                          wx.getBLEDeviceServices({
                            deviceId: device.deviceId,
                            success: function (res) {
                              for (let service of res.services) {
                                if (service.uuid.toLowerCase().includes('180d')) {
                                  // 找到心率服务,获取特征值
                                  wx.getBLEDeviceCharacteristics({
                                    deviceId: device.deviceId,
                                    serviceId: service.uuid,
                                    success: function (res) {
                                      for (let characteristic of res.characteristics) {
                                        if (characteristic.uuid.toLowerCase().includes('2a37')) {
                                          // 找到心率特征值,检查通知
                                          wx.notifyBLECharacteristicValueChange({
                                            deviceId: device.deviceId,
                                            serviceId: service.uuid,
                                            characteristicId: characteristic.uuid,
                                            state: true,
                                            success: function (res) {
                                              console.log('设备支持心率通知:', device.deviceId);
                                              // 添加设备到列表
                                              const devices = that.data.devices;
                                              // 再次检查是否已存在，只通过deviceId判断
                                              const deviceExists = devices.some(d => d.deviceId === device.deviceId);
                                              if (!deviceExists) {
                                                device.hasHeartRate = true;
                                                device.serviceId = service.uuid;
                                                device.characteristicId = characteristic.uuid;
                                                devices.push(device);
                                                that.setData({ devices });
                                              }
                                              // 断开连接
                                              wx.closeBLEConnection({
                                                deviceId: device.deviceId
                                              });
                                            },
                                            fail: function (err) {
                                              console.log('设备不支持心率通知:', device.deviceId);
                                              wx.closeBLEConnection({
                                                deviceId: device.deviceId
                                              });
                                            }
                                          });
                                          break;
                                        }
                                      }
                                    },
                                    fail: function (err) {
                                      console.log('获取特征值失败:', err);
                                      wx.closeBLEConnection({
                                        deviceId: device.deviceId
                                      });
                                    }
                                  });
                                  break;
                                }
                              }
                            },
                            fail: function (err) {
                              console.log('获取服务失败:', err);
                              wx.closeBLEConnection({
                                deviceId: device.deviceId
                              });
                            }
                          });
                        },
                        fail: function (err) {
                          console.log('连接设备失败:', err);
                        }
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

    // 设置连接状态
    const devices = that.data.devices.map(d => {
      if (d.deviceId === device.deviceId) {
        d.connecting = true;
      }
      return d;
    });

    that.setData({ devices });

    // 停止搜索
    wx.stopBluetoothDevicesDiscovery();

    // 连接设备
    wx.createBLEConnection({
      deviceId: device.deviceId,
      success: function (res) {
        console.log('连接设备成功:', device.deviceId);
        
        // 获取服务
        wx.getBLEDeviceServices({
          deviceId: device.deviceId,
          success: function (res) {
            console.log('获取服务列表:', res.services);
            let found = false;
            for (let service of res.services) {
              if (service.uuid.toLowerCase().includes('180d')) {
                console.log('找到心率服务:', service.uuid);
                found = true;
                
                wx.showToast({
                  title: '连接成功',
                  icon: 'success',
                  success: () => {
                    // 跳转到PK页面，通过URL参数传递数据
                    const deviceData = {
                      deviceId: device.deviceId,
                      name: device.name || '未知设备',
                      serviceId: service.uuid
                    };
                    wx.navigateTo({
                      url: `/pages/pk/pk?device=${JSON.stringify(deviceData)}`
                    });
                  }
                });
                break;
              }
            }
            if (!found) {
              console.log('未找到心率服务');
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
        wx.showToast({
          title: '连接失败',
          icon: 'error'
        });
        
        // 清除连接状态
        const devices = that.data.devices.map(d => {
          if (d.deviceId === device.deviceId) {
            d.connecting = false;
          }
          return d;
        });
        
        that.setData({
          devices,
          statusText: '连接设备失败'
        });
      }
    });
  },

  disconnectDevice: function (deviceId) {
    wx.closeBLEConnection({
      deviceId: deviceId,
      success: function (res) {
        console.log('断开设备连接成功:', deviceId);
      },
      fail: function (err) {
        console.log('断开设备连接失败:', err);
      }
    });
  }
});
