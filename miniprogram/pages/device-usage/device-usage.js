// pages/device-usage/device-usage.js
const app = getApp();
const config = require('../../utils/config');

Page({
  data: {
    usageRecords: [],
    isLoading: false
  },

  onLoad: function (options) {
    this.loadDeviceUsageRecords();
  },

  onShow: function () {
    this.loadDeviceUsageRecords();
  },

  // 加载设备使用记录
  loadDeviceUsageRecords: function () {
    const userId = wx.getStorageSync('userId') || app.globalData.userId;
    if (!userId) {
      wx.showToast({
        title: '请先登录',
        icon: 'none'
      });
      return;
    }

    this.setData({ isLoading: true });

    wx.request({
      url: `${app.globalData.apiBaseUrl}/api/device-usage?userId=${userId}`,
      method: 'GET',
      success: (res) => {
        if (res.data.usages) {
          // 处理日期格式
          const usages = res.data.usages.map(usage => {
            // 格式化开始时间
            if (usage.start_time) {
              const startDate = new Date(usage.start_time);
              usage.formattedStartTime = this.formatDateTime(startDate);
            }
            
            // 格式化结束时间
            if (usage.end_time) {
              const endDate = new Date(usage.end_time);
              usage.formattedEndTime = this.formatDateTime(endDate);
              
              // 计算使用时长
              if (usage.start_time) {
                const startTime = new Date(usage.start_time).getTime();
                const endTime = new Date(usage.end_time).getTime();
                const duration = (endTime - startTime) / 1000; // 秒
                usage.duration = this.formatDuration(duration);
              }
            } else {
              usage.status = '使用中';
            }
            
            return usage;
          });
          
          this.setData({
            usageRecords: usages,
            isLoading: false
          });
        } else {
          console.error('获取设备使用记录失败:', res.data.error);
          this.setData({ isLoading: false });
          wx.showToast({
            title: '获取记录失败',
            icon: 'none'
          });
        }
      },
      fail: (err) => {
        console.error('请求失败:', err);
        this.setData({ isLoading: false });
        wx.showToast({
          title: '网络请求失败',
          icon: 'none'
        });
      }
    });
  },

  // 格式化日期时间
  formatDateTime: function (date) {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    
    return `${year}-${month}-${day} ${hours}:${minutes}`;
  },

  // 格式化时长
  formatDuration: function (seconds) {
    if (seconds < 60) {
      return `${Math.floor(seconds)}秒`;
    } else if (seconds < 3600) {
      const minutes = Math.floor(seconds / 60);
      const remainingSeconds = Math.floor(seconds % 60);
      return `${minutes}分${remainingSeconds}秒`;
    } else {
      const hours = Math.floor(seconds / 3600);
      const remainingMinutes = Math.floor((seconds % 3600) / 60);
      return `${hours}小时${remainingMinutes}分钟`;
    }
  }
});
