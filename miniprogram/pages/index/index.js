const app = getApp()
const { WxChart } = require('../../utils/wxcharts.js');
let lineChart = null;

Page({
  data: {
    connected: false,
    statusText: '请点击搜索设备按钮',
    heartRate: '--',
    deviceId: '',
    serviceId: '',
    characteristicId: '',
    heartRateData: [],
    timeData: [],
    isSearching: false,
    devices: [] // 存储搜索到的设备
  },

  onLoad: function () {
    const that = this;
    const systemInfo = wx.getWindowInfo();
    const chartWidth = systemInfo.windowWidth * 0.9; // 90%的屏幕宽度
    
    // 延迟初始化图表，确保canvas已经渲染
    setTimeout(() => {
      lineChart = new WxChart({
        canvasId: 'heartRateChart',
        width: chartWidth,
        height: 300,
        yAxis: {
          min: 0,
          max: 200
        }
      });
      
      // 绘制初始空图表
      lineChart.updateData({
        categories: [],
        series: [{
          name: '心率',
          data: []
        }]
      });
    }, 300);
  },

  updateChart: function (heartRate) {
    if (!lineChart) {
      console.warn('图表未初始化');
      return;
    }

    const now = new Date();
    const timeStr = now.getHours().toString().padStart(2, '0') + ':' + 
                  now.getMinutes().toString().padStart(2, '0') + ':' + 
                  now.getSeconds().toString().padStart(2, '0');
    
    // 获取现有数据
    const data = this.data.heartRateData;
    const categories = this.data.timeData;
    
    // 添加新数据
    categories.push(timeStr);
    data.push(heartRate);
    
    // 保持最近30个数据点
    if (categories.length > 30) {
      categories.shift();
      data.shift();
    }
    
    // 更新图表
    lineChart.updateData({
      categories: categories,
      series: [{
        name: '心率',
        data: data
      }]
    });
    
    // 保存数据
    this.setData({
      heartRateData: data,
      timeData: categories
    });
  },

  startSearch: function () {
    const that = this;
    
    if (that.data.isSearching) {
      console.log('已经在搜索中...');
      return;
    }

    // 清空设备列表
    that.setData({
      isSearching: true,
      statusText: '正在初始化蓝牙...',
      devices: []
    });
    
    // 初始化蓝牙模块
    wx.openBluetoothAdapter({
      success: function (res) {
        console.log('蓝牙初始化成功');
        that.setData({
          statusText: '正在搜索设备...'
        });
        
        // 开始搜索设备
        wx.startBluetoothDevicesDiscovery({
          allowDuplicatesKey: false,
          success: function (res) {
            console.log('开始搜索设备');
            
            // 设置搜索超时
            setTimeout(() => {
              if (that.data.isSearching) {
                console.log('停止搜索');
                wx.stopBluetoothDevicesDiscovery();
                that.setData({
                  statusText: '搜索完成，请选择设备',
                  isSearching: false
                });
              }
            }, 10000); // 10秒超时
            
            // 监听发现新设备事件
            wx.onBluetoothDeviceFound(function (res) {
              if (!that.data.isSearching) return;
              
              console.log('发现新设备:', res.devices);
              const newDevices = res.devices;
              
              // 更新设备列表，避免重复
              const existingDevices = that.data.devices;
              const uniqueNewDevices = newDevices.filter(newDevice => {
                return !existingDevices.some(existingDevice => 
                  existingDevice.deviceId === newDevice.deviceId
                );
              });
              
              if (uniqueNewDevices.length > 0) {
                that.setData({
                  devices: existingDevices.concat(uniqueNewDevices)
                });
              }
            });
          },
          fail: function (err) {
            console.log('搜索设备失败:', err);
            that.setData({
              statusText: '搜索设备失败: ' + (err.errMsg || '未知错误'),
              isSearching: false
            });
          }
        });
      },
      fail: function (err) {
        console.log('蓝牙初始化失败:', err);
        that.setData({
          statusText: '初始化蓝牙失败，请确保蓝牙已开启',
          isSearching: false
        });
      }
    });
  },

  connectToDevice: function (e) {
    const that = this;
    const device = e.currentTarget.dataset.device;
    
    if (!device || !device.deviceId) {
      console.log('无效的设备信息');
      return;
    }

    wx.stopBluetoothDevicesDiscovery();
    that.setData({
      statusText: '正在连接到设备...',
      isSearching: false
    });
    
    wx.createBLEConnection({
      deviceId: device.deviceId,
      success: function (res) {
        console.log('连接设备成功');
        that.setData({
          deviceId: device.deviceId,
          statusText: '正在获取服务...'
        });
        
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
                that.setData({
                  serviceId: service.uuid
                });
                that.getCharacteristics(device.deviceId, service.uuid);
                break;
              }
            }
            if (!found) {
              console.log('未找到心率服务');
              that.setData({
                statusText: '设备不支持心率服务',
                isSearching: false
              });
              that.disconnectDevice();
            }
          },
          fail: function (err) {
            console.log('获取服务失败:', err);
            that.setData({
              statusText: '获取服务失败',
              isSearching: false
            });
            that.disconnectDevice();
          }
        });
      },
      fail: function (err) {
        console.log('连接设备失败:', err);
        that.setData({
          statusText: '连接设备失败',
          isSearching: false
        });
      }
    });
  },

  getCharacteristics: function (deviceId, serviceId) {
    const that = this;
    
    wx.getBLEDeviceCharacteristics({
      deviceId: deviceId,
      serviceId: serviceId,
      success: function (res) {
        console.log('获取特征值列表:', res.characteristics);
        let found = false;
        for (let characteristic of res.characteristics) {
          if (characteristic.uuid.toLowerCase().includes('2a37')) {
            console.log('找到心率特征值:', characteristic.uuid);
            found = true;
            that.setData({
              characteristicId: characteristic.uuid
            });
            that.notifyHeartRate();
            break;
          }
        }
        if (!found) {
          console.log('未找到心率特征值');
          that.setData({
            statusText: '设备不支持心率特征值',
            isSearching: false
          });
          that.disconnectDevice();
        }
      },
      fail: function (err) {
        console.log('获取特征值失败:', err);
        that.setData({
          statusText: '获取特征值失败',
          isSearching: false
        });
        that.disconnectDevice();
      }
    });
  },

  notifyHeartRate: function () {
    const that = this;
    
    wx.notifyBLECharacteristicValueChange({
      deviceId: that.data.deviceId,
      serviceId: that.data.serviceId,
      characteristicId: that.data.characteristicId,
      state: true,
      success: function (res) {
        console.log('启用心率通知成功');
        that.setData({
          connected: true,
          statusText: '设备已连接',
          isSearching: false
        });
        
        // 监听心率数据
        wx.onBLECharacteristicValueChange(function (res) {
          console.log('收到心率数据通知:', res);
          
          // 将ArrayBuffer转换为Uint8Array
          const value = new Uint8Array(res.value);
          console.log('心率数据内容:', Array.from(value));
          
          // 心率数据格式解析 (标准蓝牙心率服务格式)
          // 第一个字节是标志位，表示数据格式
          // 第二个字节开始是心率值
          const flags = value[0];
          console.log('心率数据标志位:', flags.toString(2));
          
          let heartRate;
          if ((flags & 0x01) === 0) {
            // 8位心率值
            heartRate = value[1];
          } else {
            // 16位心率值
            heartRate = (value[2] << 8) + value[1];
          }
          
          console.log('解析后的心率值:', heartRate);
          
          if (heartRate > 0 && heartRate < 255) {
            that.setData({
              heartRate: heartRate,
              statusText: '心率: ' + heartRate + ' BPM'
            });
            
            // 更新图表
            const now = new Date();
            const timeStr = now.getHours().toString().padStart(2, '0') + ':' + 
                          now.getMinutes().toString().padStart(2, '0') + ':' + 
                          now.getSeconds().toString().padStart(2, '0');
            
            that.data.heartRateData.push(heartRate);
            that.data.timeData.push(timeStr);
            
            // 保持最近30个数据点
            if (that.data.heartRateData.length > 30) {
              that.data.heartRateData.shift();
              that.data.timeData.shift();
            }
            
            that.updateChart(heartRate);
          } else {
            console.warn('收到无效的心率值:', heartRate);
          }
        });
      },
      fail: function (err) {
        console.error('启用心率通知失败:', err);
        that.setData({
          statusText: '启用心率通知失败',
          isSearching: false
        });
        that.disconnectDevice();
      }
    });
  },

  disconnectDevice: function () {
    const that = this;
    
    if (that.data.deviceId) {
      wx.closeBLEConnection({
        deviceId: that.data.deviceId,
        success: function (res) {
          console.log('断开设备连接');
          that.setData({
            connected: false,
            statusText: '设备已断开连接',
            heartRate: '--',
            deviceId: '',
            serviceId: '',
            characteristicId: '',
            heartRateData: [],
            timeData: [],
            isSearching: false
          });
          
          // 重置图表
          lineChart.updateData({
            categories: [],
            series: [{
              name: '心率',
              data: []
            }]
          });
        }
      });
    }
  },

  onUnload: function () {
    this.disconnectDevice();
    wx.closeBluetoothAdapter();
  }
});
