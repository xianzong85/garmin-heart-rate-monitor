const app = getApp();
const { WxChart } = require('../../utils/wxcharts.js');

// 设备曲线颜色
const LINE_COLORS = ['#f56c6c', '#409eff', '#67c23a', '#e6a23c', '#909399'];

Page({
  data: {
    connectedDeviceList: [],
    isPKMode: false,
    pkDuration: 180, // 3分钟
    pkStartTime: null,
    pkEndTime: null,
    pkTimeLeft: 180,
    pkTimer: null,
    statusText: '请连接设备',
    showSearchModal: false,
    // 添加心率监听状态
    lastHeartRateTime: {},  // 记录每个设备最后一次收到心率的时间
    heartRateCheckTimer: null,  // 心率检查定时器
    isLandscape: false,
    chart: null,
    chartRendered: false,
    // 添加PK结果相关数据
    showPKResult: false,
    pkResults: []
  },

  onLoad: function (options) {
    const that = this;

    // 初始化蓝牙监听器
    that.hasInitializedBLEListener = false;
    that.initBLECharacteristicValueChangeListener();

    if (options.device) {
      try {
        const deviceData = JSON.parse(options.device);
        const device = {
          ...deviceData,
          heartRate: null,
          heartRateData: [],
          timeData: [],
          maxHeartRate: null,
          minHeartRate: null,
          avgHeartRate: null,
          rank: 1,
          lineColor: LINE_COLORS[0], // 默认使用第一个颜色
          isLeading: false,
          isWorn: false, // 默认设置为未佩戴状态
          staticHeartRateCount: 0,
          dynamicHeartRateCount: 0,
          unwornSince: Date.now(), // 记录初始未佩戴时间
          // 添加历史统计数据
          historicalMaxHeartRate: null,
          historicalMinHeartRate: null,
          historicalAvgHeartRate: null,
          historicalDataPoints: 0
        };

        that.setData({
          connectedDeviceList: [device],
          statusText: '已连接1台设备'
        });

        // 初始化图表
        that.initChart();

        // 启动心率检查
        that.startHeartRateCheck();

        // 获取心率特征值
        wx.getBLEDeviceCharacteristics({
          deviceId: device.deviceId,
          serviceId: device.serviceId,
          success: function (res) {
            console.log('获取特征值列表:', res.characteristics);
            for (let characteristic of res.characteristics) {
              if (characteristic.uuid.toLowerCase().includes('2a37')) {
                console.log('找到心率特征值:', characteristic.uuid);
                that.startHeartRateNotification(device.deviceId, device.serviceId, characteristic.uuid);
                break;
              }
            }
          },
          fail: function (err) {
            console.log('获取特征值失败:', err);
          }
        });
      } catch (e) {
        console.error('解析设备数据失败:', e);
        wx.showToast({
          title: '获取设备数据失败',
          icon: 'none'
        });
      }
    } else {
      console.error('未接收到设备数据');
      wx.showToast({
        title: '未接收到设备数据',
        icon: 'none'
      });
    }

    // 获取系统信息
    const systemInfo = wx.getSystemInfoSync();
    const isLandscape = systemInfo.windowWidth > systemInfo.windowHeight;
    that.setData({ isLandscape });

    // 监听屏幕方向
    wx.onDeviceMotionChange((res) => {
      const isLandscape = Math.abs(res.beta) > 45;
      if (isLandscape !== that.data.isLandscape) {
        that.setData({ isLandscape });
        // 延迟更新图表大小，等待布局完成
        setTimeout(() => {
          that.updateChartSize();
        }, 300);
      }
    });
  },

  onShow: function () {
    // 恢复监听
    if (this.data.connectedDeviceList.length > 0) {
      this.data.connectedDeviceList.forEach(device => {
        if (device.serviceId) {
          // 重新获取特征值
          wx.getBLEDeviceCharacteristics({
            deviceId: device.deviceId,
            serviceId: device.serviceId,
            success: (res) => {
              console.log('重新获取特征值列表:', res.characteristics);
              for (let characteristic of res.characteristics) {
                if (characteristic.uuid.toLowerCase().includes('2a37')) {
                  console.log('重新找到心率特征值:', characteristic.uuid);
                  this.startHeartRateNotification(device.deviceId, device.serviceId, characteristic.uuid);
                  break;
                }
              }
            },
            fail: (err) => {
              console.log('重新获取特征值失败:', err);
            }
          });
        }
      });
    }
  },

  onHide: function () {
    // 停止监听
    if (this.data.connectedDeviceList.length > 0) {
      this.data.connectedDeviceList.forEach(device => {
        this.stopHeartRateNotification(device.deviceId);
      });
    }
  },

  onUnload: function () {
    // 清除心率检查定时器
    if (this.data.heartRateCheckTimer) {
      clearInterval(this.data.heartRateCheckTimer);
    }

    // 断开所有连接
    if (this.data.connectedDeviceList.length > 0) {
      this.data.connectedDeviceList.forEach(device => {
        this.disconnectDevice(device.deviceId);
      });
    }

    if (this.data.pkTimer) {
      clearInterval(this.data.pkTimer);
    }
  },

  showSearchDevices: function () {
    this.setData({
      showSearchModal: true,
      devices: [],
      isSearching: false
    });
    this.startSearch();
  },

  hideSearchModal: function () {
    this.setData({
      showSearchModal: false,
      devices: [],
      isSearching: false
    });
    wx.stopBluetoothDevicesDiscovery();
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
              services: ['180D'],
              allowDuplicatesKey: false,
              success: (res) => {
                console.log('开始搜索设备');
                wx.onBluetoothDeviceFound((res) => {
                  res.devices.forEach(device => {
                    // 检查是否已存在，只通过deviceId判断
                    const existingDevice = that.data.devices.find(d => d.deviceId === device.deviceId);
                    if (!existingDevice) {
                      // 检查是否已连接
                      const isConnected = that.data.connectedDeviceList.some(d => d.deviceId === device.deviceId);
                      device.connectionState = isConnected ? 'CONNECTED' : 'DISCONNECTED';
                      device.statusText = isConnected ? '已连接' : '点击连接';

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

    // 检查是否已连接
    if (that.data.connectedDeviceList.find(d => d.deviceId === device.deviceId)) {
      wx.showToast({
        title: '设备已连接',
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

        wx.showToast({
          title: '连接成功',
          icon: 'success'
        });

        // 添加到已连接列表
        // 为新设备选择一个不同的颜色
        const currentDeviceCount = that.data.connectedDeviceList.length;
        const colorIndex = currentDeviceCount % LINE_COLORS.length;

        const newDevice = {
          deviceId: device.deviceId,
          name: device.name || '未知设备',
          heartRate: null,
          heartRateData: [],
          timeData: [],
          maxHeartRate: null,
          minHeartRate: null,
          avgHeartRate: null,
          rank: 1,
          lineColor: LINE_COLORS[colorIndex], // 使用不同的颜色
          isLeading: false,
          isWorn: false, // 默认设置为未佩戴状态
          staticHeartRateCount: 0,
          dynamicHeartRateCount: 0,
          unwornSince: Date.now(), // 记录初始未佩戴时间
          // 添加历史统计数据
          historicalMaxHeartRate: null,
          historicalMinHeartRate: null,
          historicalAvgHeartRate: null,
          historicalDataPoints: 0
        };

        const connectedDeviceList = that.data.connectedDeviceList;
        connectedDeviceList.push(newDevice);

        that.setData({
          connectedDeviceList,
          showSearchModal: false,
          statusText: `已连接${connectedDeviceList.length}台设备`
        });

        // 初始化图表
        that.initChart();

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
                that.getCharacteristics(device.deviceId, service.uuid);
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

  disconnectDevice: function (e) {
    let deviceId;

    // 支持直接传入 deviceId 或从事件中获取
    if (typeof e === 'string') {
      deviceId = e;
    } else if (e && e.currentTarget && e.currentTarget.dataset) {
      deviceId = e.currentTarget.dataset.deviceId;
    } else {
      console.error('无效的设备ID');
      return;
    }

    wx.closeBLEConnection({
      deviceId: deviceId,
      success: (res) => {
        console.log('断开连接成功:', deviceId);
        // 从已连接列表中移除
        const connectedDeviceList = this.data.connectedDeviceList.filter(
          device => device.deviceId !== deviceId
        );

        this.setData({
          connectedDeviceList,
          statusText: connectedDeviceList.length ?
            `已连接${connectedDeviceList.length}台设备` :
            '请连接设备'
        });

        // 如果没有设备了，返回首页
        if (connectedDeviceList.length === 0) {
          wx.navigateBack();
        }
      },
      fail: (err) => {
        console.error('断开连接失败:', err);
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
        for (let characteristic of res.characteristics) {
          if (characteristic.uuid.toLowerCase().includes('2a37')) {
            console.log('找到心率特征值:', characteristic.uuid);
            that.startHeartRateNotification(deviceId, serviceId, characteristic.uuid);
            break;
          }
        }
      },
      fail: function (err) {
        console.log('获取特征值失败:', err);
      }
    });
  },

  // 初始化蓝牙通知回调
  initBLECharacteristicValueChangeListener: function() {
    const that = this;

    // 如果已经初始化过回调，则不重复初始化
    if (that.hasInitializedBLEListener) {
      return;
    }

    // 标记为已初始化
    that.hasInitializedBLEListener = true;

    // 设置全局回调
    wx.onBLECharacteristicValueChange(function (res) {
      // 获取设备ID
      const deviceId = res.deviceId;

      // 检查设备ID是否有效
      if (!deviceId) {
        console.error('接收到心率数据但设备ID无效');
        return;
      }

      // 检查设备是否在已连接列表中
      const deviceExists = that.data.connectedDeviceList.some(device => device.deviceId === deviceId);
      if (!deviceExists) {
        console.error('接收到未知设备的心率数据:', deviceId);
        return;
      }

      // 解析心率数据
      const dataView = new DataView(res.value);
      const flags = dataView.getUint8(0);

      // 检查传感器接触状态位
      const sensorContactStatusBits = (flags >> 1) & 0x03;
      const isSensorContactSupported = (sensorContactStatusBits & 0x02) === 0x02;
      const isSensorContactDetected = (sensorContactStatusBits & 0x01) === 0x01;

      // 获取心率值
      const heartRate = dataView.getUint8(1);

      console.log(`接收到设备 ${deviceId} 的心率数据:`, {
        heartRate,
        flags,
        sensorContactStatusBits,
        isSensorContactSupported,
        isSensorContactDetected
      });

      // 如果设备支持传感器接触检测并且检测到传感器未接触，则不处理该心率数据
      if (isSensorContactSupported && !isSensorContactDetected) {
        console.log(`设备 ${deviceId} 传感器未接触，忽略心率数据`);
        // 将设备标记为未佩戴
        that.markDeviceAsUnworn(deviceId);
        return;
      }

      // 如果心率值为0或者异常高，则认为无效
      if (heartRate === 0 || heartRate > 220) {
        console.log(`设备 ${deviceId} 心率值异常，忽略数据:`, heartRate);
        return;
      }

      // 处理有效的心率数据
      that.processHeartRateData(deviceId, heartRate, isSensorContactDetected);
    });

    console.log('初始化蓝牙特征值变化监听器成功');
  },

  startHeartRateNotification: function (deviceId, serviceId, characteristicId) {
    const that = this;

    // 确保已初始化蓝牙监听器
    that.initBLECharacteristicValueChangeListener();

    wx.notifyBLECharacteristicValueChange({
      deviceId: deviceId,
      serviceId: serviceId,
      characteristicId: characteristicId,
      state: true,
      success: function (res) {
        console.log(`开启设备 ${deviceId} 的心率通知成功`);
      },
      fail: function (err) {
        console.log(`开启设备 ${deviceId} 的心率通知失败:`, err);
      }
    });
  },

  // 标记设备为未佩戴
  markDeviceAsUnworn: function(deviceId) {
    const that = this;
    const connectedDeviceList = that.data.connectedDeviceList.map(device => {
      if (device.deviceId === deviceId && device.isWorn !== false) {
        // 如果设备当前不是未佩戴状态，则切换为未佩戴
        device.isWorn = false;

        // 在清除心率数据前，保存当前会话的统计数据
        if (device.heartRateData && device.heartRateData.length > 0) {
          // 保存当前会话的最高心率
          if (device.maxHeartRate) {
            device.historicalMaxHeartRate = Math.max(device.historicalMaxHeartRate || 0, device.maxHeartRate);
          }

          // 保存当前会话的最低心率
          if (device.minHeartRate) {
            device.historicalMinHeartRate = device.historicalMinHeartRate ?
              Math.min(device.historicalMinHeartRate, device.minHeartRate) :
              device.minHeartRate;
          }

          // 更新历史平均心率
          if (device.avgHeartRate) {
            // 如果已有历史数据，计算加权平均值
            if (device.historicalAvgHeartRate && device.historicalDataPoints) {
              const totalPoints = device.historicalDataPoints + device.heartRateData.length;
              device.historicalAvgHeartRate =
                (device.historicalAvgHeartRate * device.historicalDataPoints +
                 device.avgHeartRate * device.heartRateData.length) / totalPoints;
              device.historicalDataPoints = totalPoints;
            } else {
              // 如果没有历史数据，直接使用当前平均值
              device.historicalAvgHeartRate = device.avgHeartRate;
              device.historicalDataPoints = device.heartRateData.length;
            }
          }

          console.log('已保存历史统计数据:', {
            max: device.historicalMaxHeartRate,
            min: device.historicalMinHeartRate,
            avg: device.historicalAvgHeartRate,
            points: device.historicalDataPoints
          });
        }

        // 清除当前心率数据（但保留历史统计数据）
        device.heartRateData = [];
        device.timeData = [];
        device.heartRate = null;

        // 清除当前会话的统计数据，但保留历史统计数据
        device.maxHeartRate = null;
        device.minHeartRate = null;
        device.avgHeartRate = null;

        device.unwornSince = Date.now();
        console.log('设备标记为未佩戴:', deviceId);
      }
      return device;
    });

    that.setData({ connectedDeviceList });
  },

  stopHeartRateNotification: function (deviceId, serviceId, characteristicId) {
    wx.notifyBLECharacteristicValueChange({
      deviceId: deviceId,
      serviceId: serviceId,
      characteristicId: characteristicId,
      state: false
    });
  },

  processHeartRateData: function (deviceId, heartRate, isSensorContactDetected) {
    // 更新最后收到心率的时间
    this.data.lastHeartRateTime[deviceId] = Date.now();

    const that = this;
    let dataChanged = false;

    const connectedDeviceList = that.data.connectedDeviceList.map(device => {
      if (device.deviceId === deviceId) {
        const now = new Date();

        // 使用传感器接触状态来确定设备是否被佩戴
        // 如果提供了传感器接触状态，则直接使用该状态
        const wasWorn = device.isWorn !== false;

        if (isSensorContactDetected !== undefined) {
          // 如果有传感器接触状态信息，直接使用
          if (device.isWorn !== isSensorContactDetected) {
            device.isWorn = isSensorContactDetected;
            console.log('根据传感器接触状态更新佩戴状态:', isSensorContactDetected ? '已佩戴' : '未佩戴');
          }
        } else {
          // 如果没有传感器接触状态信息，使用心率数据来判断
          const previousHeartRate = device.heartRate;

          // 初始化计数器
          if (!device.staticHeartRateCount) {
            device.staticHeartRateCount = 0;
          }

          if (!device.dynamicHeartRateCount) {
            device.dynamicHeartRateCount = 0;
          }

          // 判断心率是否静止
          const isStatic = previousHeartRate === heartRate && heartRate > 0;

          // 更新计数器
          if (isStatic) {
            device.staticHeartRateCount++;
            // 静止心率计数增加，动态心率计数减少
            device.dynamicHeartRateCount = Math.max(0, device.dynamicHeartRateCount - 1);
          } else {
            // 动态心率计数增加，静止心率计数减少
            device.dynamicHeartRateCount++;
            device.staticHeartRateCount = Math.max(0, device.staticHeartRateCount - 1);
          }

          // 使用更稳定的状态切换逻辑
          if (wasWorn) {
            // 当前是佩戴状态，检查是否需要切换到未佩戴
            if (device.staticHeartRateCount > 10) {
              device.isWorn = false;
              console.log('检测到手表未佩戴，切换状态');
            }
          } else {
            // 当前是未佩戴状态，检查是否需要切换到佩戴
            if (device.dynamicHeartRateCount > 5) {
              device.isWorn = true;
              console.log('检测到手表已佩戴，切换状态');
            }
          }
        }

        // 如果状态从佩戴变为未佩戴，保存历史数据并清除当前数据
        if (wasWorn && device.isWorn === false) {
          // 在清除心率数据前，保存当前会话的统计数据
          if (device.heartRateData && device.heartRateData.length > 0) {
            // 保存当前会话的最高心率
            if (device.maxHeartRate) {
              device.historicalMaxHeartRate = Math.max(device.historicalMaxHeartRate || 0, device.maxHeartRate);
            }

            // 保存当前会话的最低心率
            if (device.minHeartRate) {
              device.historicalMinHeartRate = device.historicalMinHeartRate ?
                Math.min(device.historicalMinHeartRate, device.minHeartRate) :
                device.minHeartRate;
            }

            // 更新历史平均心率
            if (device.avgHeartRate) {
              // 如果已有历史数据，计算加权平均值
              if (device.historicalAvgHeartRate && device.historicalDataPoints) {
                const totalPoints = device.historicalDataPoints + device.heartRateData.length;
                device.historicalAvgHeartRate =
                  (device.historicalAvgHeartRate * device.historicalDataPoints +
                   device.avgHeartRate * device.heartRateData.length) / totalPoints;
                device.historicalDataPoints = totalPoints;
              } else {
                // 如果没有历史数据，直接使用当前平均值
                device.historicalAvgHeartRate = device.avgHeartRate;
                device.historicalDataPoints = device.heartRateData.length;
              }
            }
          }

          // 清除当前心率数据（但保留历史统计数据）
          device.heartRateData = [];
          device.timeData = [];
          device.heartRate = null;

          // 清除当前会话的统计数据，但保留历史统计数据
          device.maxHeartRate = null;
          device.minHeartRate = null;
          device.avgHeartRate = null;
          dataChanged = true;

          // 记录切换到未佩戴状态的时间
          device.unwornSince = Date.now();
        } else if (device.isWorn !== false) {
          // 只有在手表被佩戴时才更新心率数据
          device.heartRate = heartRate;
          device.heartRateData.push(heartRate);
          device.timeData.push(now);
          device.isConnected = true;
          dataChanged = true;

          // 更新统计数据
          device.maxHeartRate = Math.max(device.maxHeartRate || 0, heartRate);
          device.minHeartRate = Math.min(device.minHeartRate || Infinity, heartRate);
          device.avgHeartRate = Math.round(
            device.heartRateData.reduce((a, b) => a + b, 0) / device.heartRateData.length
          );

          // 清除未佩戴时间记录
          device.unwornSince = null;
        } else {
          // 手表未佩戴，但保持连接状态
          device.isConnected = true;

          // 如果未记录切换到未佩戴状态的时间，记录当前时间
          if (!device.unwornSince) {
            device.unwornSince = Date.now();
          }
        }

        // 保持数据点数量
        if (device.heartRateData.length > 100) {
          device.heartRateData.shift();
          device.timeData.shift();
        }
      }
      return device;
    });

    that.setData({ connectedDeviceList });

    // 只在数据变化时重新绘制图表
    if (dataChanged) {
      // 使用节流，不要太频繁更新图表
      if (!that.chartUpdateTimer) {
        that.chartUpdateTimer = setTimeout(() => {
          that.initChart();
          that.chartUpdateTimer = null;
        }, 2000); // 每2秒最多更新一次图表
      }
    }

    // 如果在PK模式下,更新排名
    if (that.data.isPKMode) {
      that.updateRanking();
    }
  },

  initChart: function () {
    const that = this;

    // 使用较长的延迟确保canvas已完全加载
    setTimeout(() => {
      try {
        console.log('正在初始化图表...');

        // 获取系统信息以设置图表大小
        const systemInfo = wx.getSystemInfoSync();
        const windowWidth = systemInfo.windowWidth;

        // 直接使用原生Canvas API绘制简单的折线图
        const ctx = wx.createCanvasContext('pkChart');

        // 设置画布背景色
        ctx.setFillStyle('#ffffff');
        ctx.fillRect(0, 0, windowWidth, 300);

        // 绘制图表边框和网格线
        ctx.setStrokeStyle('#eeeeee');
        ctx.strokeRect(50, 30, windowWidth - 100, 220);

        // 绘制网格线
        ctx.beginPath();
        for (let i = 1; i < 4; i++) {
          const y = 30 + i * (220 / 4);
          ctx.moveTo(50, y);
          ctx.lineTo(windowWidth - 50, y);
        }
        ctx.stroke();

        // 绘制Y轴标签
        ctx.setFontSize(12);
        ctx.setFillStyle('#666666');
        ctx.fillText('200', 30, 30);
        ctx.fillText('150', 30, 30 + 220 / 4);
        ctx.fillText('100', 30, 30 + 220 / 2);
        ctx.fillText('50', 30, 30 + 220 * 3 / 4);
        ctx.fillText('0', 30, 250);
        ctx.fillText('心率(BPM)', 10, 15);

        // 绘制X轴标签
        ctx.fillText('时间', windowWidth / 2, 270);

        // 为每个设备绘制心率曲线
        that.data.connectedDeviceList.forEach((device, deviceIndex) => {
          // 绘制设备名称
          ctx.setFillStyle('#333333');
          ctx.fillText(device.name, windowWidth - 100, 30 + deviceIndex * 20);

          // 如果设备未佩戴，显示未佩戴标记
          if (device.isWorn === false) {
            ctx.setFillStyle('#909399');
            ctx.fillText('未佩戴', windowWidth - 100, 50 + deviceIndex * 20);
            return; // 如果未佩戴，不绘制心率数据
          }

          // 确保设备有心率数据
          if (!device.heartRateData || device.heartRateData.length < 2) return;

          // 设置线条颜色
          ctx.setStrokeStyle(device.lineColor || LINE_COLORS[deviceIndex % LINE_COLORS.length]);
          ctx.setLineWidth(2);
          ctx.setLineDash([]); // 恢复实线样式

          // 绘制设备曲线
          ctx.beginPath();

          // 计算点位置
          const dataPoints = device.heartRateData.slice(-20); // 最多显示最近20个数据点
          const pointWidth = (windowWidth - 100) / (dataPoints.length - 1);

          dataPoints.forEach((heartRate, index) => {
            // 将心率值映射到画布高度范围内 (200bpm -> 30px, 0bpm -> 250px)
            const x = 50 + index * pointWidth;
            const y = 250 - (heartRate / 200) * 220;

            if (index === 0) {
              ctx.moveTo(x, y);
            } else {
              ctx.lineTo(x, y);
            }
          });

          ctx.stroke();

          // 绘制每个点
          ctx.setFillStyle(device.lineColor || LINE_COLORS[deviceIndex % LINE_COLORS.length]);
          dataPoints.forEach((heartRate, index) => {
            const x = 50 + index * pointWidth;
            const y = 250 - (heartRate / 200) * 220;

            ctx.beginPath();
            ctx.arc(x, y, 3, 0, 2 * Math.PI);
            ctx.fill();
          });
        });

        // 应用绘制
        ctx.draw(true, () => {
          console.log('图表绘制完成');
          that.setData({ chartRendered: true });
        });

      } catch (error) {
        console.error('图表初始化过程发生错误:', error);
        that.setData({ chartRendered: false });
      }
    }, 500);
  },

  updateChartSize: function () {
    const that = this;

    // 当布局改变时，重新初始化图表
    setTimeout(() => {
      try {
        that.initChart();
      } catch (error) {
        console.error('更新图表大小失败:', error);
      }
    }, 500);
  },

  startPK: function () {
    const that = this;

    if (that.data.isPKMode) {
      // 结束PK
      that.endPK();
      wx.showToast({
        title: 'PK已结束',
        icon: 'success'
      });
    } else {
      // 检查是否有足够的设备
      const wornDevices = that.data.connectedDeviceList.filter(device =>
        device.isWorn !== false && device.isConnected);

      if (wornDevices.length < 2) {
        wx.showModal({
          title: '无法开始PK',
          content: '需要至少2台已佩戴的设备才能开始PK',
          showCancel: false
        });
        return;
      }

      // 开始PK
      wx.showModal({
        title: '开始PK',
        content: `将开始${that.data.pkDuration/60}分钟的心率PK，准备好了吗？`,
        success: (res) => {
          if (res.confirm) {
            // 开始前先更新排名
            that.updateRanking();

            that.setData({
              isPKMode: true,
              pkStartTime: new Date(),
              pkTimeLeft: that.data.pkDuration,
              statusText: 'PK进行中...'
            });

            // 启动倒计时
            that.data.pkTimer = setInterval(() => {
              const timeLeft = that.data.pkTimeLeft - 1;
              if (timeLeft <= 0) {
                that.endPK();
              } else {
                that.setData({
                  pkTimeLeft: timeLeft
                });

                // 每10秒更新一次排名
                if (timeLeft % 10 === 0) {
                  that.updateRanking();
                }
              }
            }, 1000);

            wx.showToast({
              title: 'PK开始',
              icon: 'success'
            });
          }
        }
      });
    }
  },

  endPK: function () {
    if (this.data.pkTimer) {
      clearInterval(this.data.pkTimer);
    }

    // 排序设备列表，生成结果
    const pkResults = [...this.data.connectedDeviceList]
      .filter(device => device.isWorn !== false && device.heartRate)
      .sort((a, b) => b.heartRate - a.heartRate)
      .map((device, index) => ({
        deviceId: device.deviceId,
        name: device.name,
        heartRate: device.heartRate,
        rank: index + 1
      }));

    this.setData({
      isPKMode: false,
      pkStartTime: null,
      pkTimeLeft: this.data.pkDuration,
      statusText: `已连接${this.data.connectedDeviceList.length}台设备`,
      pkResults,
      showPKResult: pkResults.length > 0
    });
  },

  // 隐藏PK结果弹窗
  hidePKResult: function() {
    this.setData({
      showPKResult: false
    });
  },

  updateRanking: function () {
    const that = this;
    const devices = that.data.connectedDeviceList.map(device => ({
      ...device,
      avgHeartRate: (device.isWorn === false) ? 0 : (device.heartRate || 0)
    }));

    // 按心率排序，未佩戴的设备心率为0，排在最后
    devices.sort((a, b) => {
      // 如果两个设备都未佩戴，保持原来的顺序
      if (a.isWorn === false && b.isWorn === false) {
        return 0;
      }
      // 如果a未佩戴，排在后面
      if (a.isWorn === false) {
        return 1;
      }
      // 如果b未佩戴，排在后面
      if (b.isWorn === false) {
        return -1;
      }
      // 如果都佩戴了，按心率排序
      return b.avgHeartRate - a.avgHeartRate;
    });

    // 更新排名和领先状态
    devices.forEach((device, index) => {
      device.rank = index + 1;
      // 只有佩戴的设备才能成为领先者
      device.isLeading = index === 0 && device.isWorn !== false;
    });

    that.setData({
      connectedDeviceList: devices
    });
  },

  // 添加心率检查函数
  startHeartRateCheck: function() {
    // 每10秒检查一次心率数据和佩戴状态
    this.data.heartRateCheckTimer = setInterval(() => {
      const now = Date.now();
      const connectedDeviceList = this.data.connectedDeviceList.map(device => {
        const lastTime = this.data.lastHeartRateTime[device.deviceId] || 0;

        // 如果超过15秒没有收到心率数据，标记为断开连接
        if (now - lastTime > 15000) {
          device.isConnected = false;
          console.log('心率数据超时，尝试重新连接:', device.deviceId);
          this.reconnectHeartRate(device);
        }

        // 检查设备未佩戴状态的持续时间
        if (device.isWorn === false && device.unwornSince) {
          // 计算未佩戴的时间（秒）
          const unwornDuration = Math.floor((now - device.unwornSince) / 1000);

          // 更新未佩戴时间
          device.unwornDuration = unwornDuration;

          // 如果超过60秒未佩戴，确保状态不会意外切换
          if (unwornDuration > 60) {
            // 重置动态心率计数，防止意外切换到佩戴状态
            device.dynamicHeartRateCount = 0;
          }
        }

        return device;
      });

      this.setData({ connectedDeviceList });
    }, 10000);
  },

  // 添加重连函数
  reconnectHeartRate: function(device) {
    console.log('开始重连设备:', device.deviceId);

    // 先断开连接
    wx.closeBLEConnection({
      deviceId: device.deviceId,
      success: () => {
        console.log('断开连接成功，准备重连');
        // 重新连接
        wx.createBLEConnection({
          deviceId: device.deviceId,
          success: () => {
            console.log('重新连接成功');
            // 更新连接状态
            const connectedDeviceList = this.data.connectedDeviceList.map(d => {
              if (d.deviceId === device.deviceId) {
                d.isConnected = true;
              }
              return d;
            });
            this.setData({ connectedDeviceList });

            // 重新获取服务
            wx.getBLEDeviceServices({
              deviceId: device.deviceId,
              success: (res) => {
                console.log('重新获取服务列表:', res.services);
                // 查找心率服务
                for (let service of res.services) {
                  if (service.uuid.toLowerCase().includes('180d')) {
                    console.log('重新找到心率服务:', service.uuid);
                    // 获取特征值
                    wx.getBLEDeviceCharacteristics({
                      deviceId: device.deviceId,
                      serviceId: service.uuid,
                      success: (res) => {
                        console.log('重新获取特征值列表:', res.characteristics);
                        for (let characteristic of res.characteristics) {
                          if (characteristic.uuid.toLowerCase().includes('2a37')) {
                            console.log('重新找到心率特征值:', characteristic.uuid);
                            // 保存新的serviceId和characteristicId
                            const connectedDeviceList = this.data.connectedDeviceList.map(d => {
                              if (d.deviceId === device.deviceId) {
                                d.serviceId = service.uuid;
                                d.characteristicId = characteristic.uuid;
                              }
                              return d;
                            });
                            this.setData({ connectedDeviceList });

                            // 开启通知
                            this.startHeartRateNotification(device.deviceId, service.uuid, characteristic.uuid);
                            break;
                          }
                        }
                      },
                      fail: (err) => {
                        console.log('重新获取特征值失败:', err);
                      }
                    });
                    break;
                  }
                }
              },
              fail: (err) => {
                console.log('重新获取服务失败:', err);
                // 更新连接状态为断开
                const connectedDeviceList = this.data.connectedDeviceList.map(d => {
                  if (d.deviceId === device.deviceId) {
                    d.isConnected = false;
                  }
                  return d;
                });
                this.setData({ connectedDeviceList });
              }
            });
          },
          fail: (err) => {
            console.log('重新连接失败:', err);
            // 更新连接状态为断开
            const connectedDeviceList = this.data.connectedDeviceList.map(d => {
              if (d.deviceId === device.deviceId) {
                d.isConnected = false;
              }
              return d;
            });
            this.setData({ connectedDeviceList });
          }
        });
      },
      fail: (err) => {
        console.log('断开连接失败:', err);
      }
    });
  },

  // 切换屏幕方向
  toggleOrientation: function () {
    const that = this;
    const newIsLandscape = !that.data.isLandscape;
    that.setData({ isLandscape: newIsLandscape });

    // 延迟更新图表大小，等待布局完成
    setTimeout(() => {
      that.updateChartSize();
    }, 300);
  },

  // 切换PK模式
  togglePK: function () {
    if (this.data.isPKMode) {
      this.endPK();
    } else {
      this.startPK();
    }
  },

  // 添加触摸事件处理函数
  touchStart: function(e) {
    // 不执行任何操作
  },

  touchMove: function(e) {
    // 不执行任何操作
  },

  touchEnd: function(e) {
    // 不执行任何操作
  },

  onReady: function() {
    // 等待页面渲染完成后初始化图表
    setTimeout(() => {
      this.initChart();
    }, 300);
  },

  onUnload: function() {
    const that = this;

    // 清除定时器
    if (that.data.heartRateCheckTimer) {
      clearInterval(that.data.heartRateCheckTimer);
    }

    if (that.chartUpdateTimer) {
      clearTimeout(that.chartUpdateTimer);
    }

    // 断开所有设备连接
    that.data.connectedDeviceList.forEach(device => {
      wx.closeBLEConnection({
        deviceId: device.deviceId,
        complete: () => {
          console.log(`断开设备 ${device.deviceId} 连接`);
        }
      });
    });

    // 移除蓝牙监听器
    wx.offBLECharacteristicValueChange();
    that.hasInitializedBLEListener = false;

    console.log('页面卸载，清理资源完成');
  }
});
