// pages/about/about.js
Page({
  data: {
    version: '1.0.0',
    appName: '心率PK',
    copyright: '© 2023-2024 All Rights Reserved'
  },

  onLoad: function (options) {
    // 获取系统信息
    const systemInfo = wx.getSystemInfoSync();
    this.setData({
      systemInfo: systemInfo
    });
  },

  // 复制微信号
  copyWechat: function() {
    wx.setClipboardData({
      data: 'your-wechat-id',
      success: function() {
        wx.showToast({
          title: '微信号已复制',
          icon: 'success'
        });
      }
    });
  },

  // 拨打电话
  callPhone: function() {
    wx.makePhoneCall({
      phoneNumber: '10086',
      fail: function() {
        wx.showToast({
          title: '拨打失败',
          icon: 'none'
        });
      }
    });
  }
});
