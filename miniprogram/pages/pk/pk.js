Page({
  data: {
    connectedDeviceList: [],
    isPKMode: false,
    pkDuration: 180, // 3分钟
    pkTimeLeft: 180,
    pkTimer: null,
    pkStartTime: null,
    isSearching: false,
    devices: [],
    statusText: '已连接1台设备',
    showSearchModal: false
  },

  onLoad: function (options) {
    const that = this;
    const eventChannel = this.getOpenerEventChannel();
    eventChannel.on('acceptDeviceData', (data) => {
      that.setData({
        connectedDeviceList: [data.device],
        statusText: '已连接1台设备'
      });
      
      // 初始化图表
      that.initChart(data.device.deviceId);

      // 获取心率特征值
      that.getCharacteristics(data.device.deviceId, data.device.serviceId);
    });
  },

  onShow: function () {
    // 恢复监听
    if (this.data.connectedDeviceList.length > 0) {
      this.data.connectedDeviceList.forEach(device => {
        this.startHeartRateNotification(device.deviceId);
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
    if (that.data.isSearching) return;

    that.setData({
      isSearching: true,
      statusText: '正在搜索设备...'
    });

    wx.openBluetoothAdapter({
      success: (res) => {
        console.log('初始化蓝牙适配器成功');
        wx.startBluetoothDevicesDiscovery({
          services: ['180D'],
          allowDuplicatesKey: false,
          success: (res) => {
            console.log('开始搜索设备');
            wx.onBluetoothDeviceFound((res) => {
              res.devices.forEach(device => {
                // 检查是否已存在
                const existingDevice = that.data.devices.find(d => d.deviceId === device.deviceId);
                if (!existingDevice) {
                  const devices = that.data.devices;
                  devices.push(device);
                  that.setData({ devices });
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
        const newDevice = {
          deviceId: device.deviceId,
          name: device.name || '未知设备',
          heartRate: null,
          heartRateData: [],
          timeData: [],
          rank: 0
        };

        const connectedDeviceList = that.data.connectedDeviceList;
        connectedDeviceList.push(newDevice);
        
        that.setData({
          connectedDeviceList,
          showSearchModal: false,
          statusText: `已连接${connectedDeviceList.length}台设备`
        });

        // 初始化图表
        that.initChart(device.deviceId);
        
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
    const that = this;
    const deviceId = e.currentTarget.dataset.deviceId;
    
    wx.closeBLEConnection({
      deviceId: deviceId,
      success: function (res) {
        console.log('断开连接成功:', deviceId);
        
        // 从列表中移除
        const connectedDeviceList = that.data.connectedDeviceList.filter(
          device => device.deviceId !== deviceId
        );
        
        that.setData({
          connectedDeviceList,
          statusText: connectedDeviceList.length ? 
            `已连接${connectedDeviceList.length}台设备` : 
            '请连接设备'
        });

        // 如果没有设备了,返回首页
        if (connectedDeviceList.length === 0) {
          wx.navigateBack();
        }
      },
      fail: function (err) {
        console.log('断开连接失败:', err);
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

  startHeartRateNotification: function (deviceId, serviceId, characteristicId) {
    const that = this;
    wx.notifyBLECharacteristicValueChange({
      deviceId: deviceId,
      serviceId: serviceId,
      characteristicId: characteristicId,
      state: true,
      success: function (res) {
        console.log('开启心率通知成功');
        wx.onBLECharacteristicValueChange(function (res) {
          const heartRate = new DataView(res.value).getUint8(1);
          that.processHeartRateData(deviceId, heartRate);
        });
      },
      fail: function (err) {
        console.log('开启心率通知失败:', err);
      }
    });
  },

  stopHeartRateNotification: function (deviceId, serviceId, characteristicId) {
    wx.notifyBLECharacteristicValueChange({
      deviceId: deviceId,
      serviceId: serviceId,
      characteristicId: characteristicId,
      state: false
    });
  },

  processHeartRateData: function (deviceId, heartRate) {
    const that = this;
    const connectedDeviceList = that.data.connectedDeviceList.map(device => {
      if (device.deviceId === deviceId) {
        device.heartRate = heartRate;
        device.heartRateData.push(heartRate);
        device.timeData.push(new Date().getTime());
        
        // 保持数据点数量
        if (device.heartRateData.length > 30) {
          device.heartRateData.shift();
          device.timeData.shift();
        }
      }
      return device;
    });

    that.setData({ connectedDeviceList });
    
    // 更新图表
    that.updateChart(deviceId);
    
    // 如果在PK模式下,更新排名
    if (that.data.isPKMode) {
      that.updateRanking();
    }
  },

  initChart: function (deviceId) {
    const that = this;
    const query = wx.createSelectorQuery();
    query.select('#heartRateChart_' + deviceId)
      .fields({ node: true, size: true })
      .exec((res) => {
        const canvas = res[0].node;
        const ctx = canvas.getContext('2d');
        
        const dpr = wx.getSystemInfoSync().pixelRatio;
        canvas.width = res[0].width * dpr;
        canvas.height = res[0].height * dpr;
        ctx.scale(dpr, dpr);
        
        // 存储canvas上下文
        that.chartContexts = that.chartContexts || {};
        that.chartContexts[deviceId] = {
          canvas: canvas,
          ctx: ctx,
          width: res[0].width,
          height: res[0].height
        };
      });
  },

  updateChart: function (deviceId) {
    const that = this;
    const ctx = that.chartContexts[deviceId].ctx;
    const width = that.chartContexts[deviceId].width;
    const height = that.chartContexts[deviceId].height;
    
    const device = that.data.connectedDeviceList.find(d => d.deviceId === deviceId);
    if (!device) return;
    
    const data = device.heartRateData;
    const timeData = device.timeData;
    
    if (data.length < 2) return;
    
    // 清除画布
    ctx.clearRect(0, 0, width, height);
    
    // 设置样式
    ctx.strokeStyle = '#409eff';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    
    // 绘制心率曲线
    ctx.beginPath();
    const step = width / (data.length - 1);
    const scale = height / (Math.max(...data) - Math.min(...data));
    const minRate = Math.min(...data);
    
    data.forEach((rate, index) => {
      const x = index * step;
      const y = height - (rate - minRate) * scale;
      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    
    ctx.stroke();
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
      // 开始PK
      wx.showModal({
        title: '开始PK',
        content: '是否开始心率PK？',
        success: (res) => {
          if (res.confirm) {
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
                wx.showModal({
                  title: 'PK结束',
                  content: '时间到！查看排名结果',
                  showCancel: false
                });
              } else {
                that.setData({
                  pkTimeLeft: timeLeft
                });
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
    
    this.setData({
      isPKMode: false,
      pkStartTime: null,
      pkTimeLeft: this.data.pkDuration,
      statusText: `已连接${this.data.connectedDeviceList.length}台设备`
    });
  },

  updateRanking: function () {
    const that = this;
    const devices = that.data.connectedDeviceList.map(device => ({
      ...device,
      avgHeartRate: device.heartRate || 0
    }));
    
    // 按心率排序
    devices.sort((a, b) => b.avgHeartRate - a.avgHeartRate);
    
    // 更新排名
    devices.forEach((device, index) => {
      device.rank = index + 1;
    });
    
    that.setData({
      connectedDeviceList: devices
    });
  }
});
