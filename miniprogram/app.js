const config = require('./utils/config');

App({
  onLaunch() {
    // 初始化用户信息
    this.initUserInfo();

    // 检查更新
    this.checkUpdate();
  },

  // 初始化用户信息
  initUserInfo() {
    // 从本地存储中获取用户信息
    const userInfo = wx.getStorageSync('userInfo');
    const userId = wx.getStorageSync('userId');
    const openId = wx.getStorageSync('openId');

    if (userInfo) {
      this.globalData.userInfo = userInfo;
      console.log('从本地存储加载用户信息成功');
    } else {
      console.log('本地存储中没有用户信息');
    }

    if (userId) {
      this.globalData.userId = userId;
      console.log('从本地存储加载用户ID成功:', userId);
    } else {
      console.log('本地存储中没有用户ID');
    }

    if (openId) {
      this.globalData.openId = openId;
      console.log('从本地存储加载 OpenID 成功');
    } else {
      // 模拟生成openId，实际应用中应该从服务器获取
      const simulatedOpenId = 'simulated_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
      wx.setStorageSync('openId', simulatedOpenId);
      this.globalData.openId = simulatedOpenId;
      console.log('生成模拟 OpenID 成功');
    }
  },

  // 检查登录状态
  checkLoginStatus() {
    const userInfo = this.globalData.userInfo || wx.getStorageSync('userInfo');
    const userId = this.globalData.userId || wx.getStorageSync('userId');

    const isLoggedIn = !!(userInfo && userId);
    console.log('检查登录状态:', isLoggedIn ? '已登录' : '未登录');
    return isLoggedIn;
  },

  // 检查应用更新
  checkUpdate() {
    if (wx.canIUse('getUpdateManager')) {
      const updateManager = wx.getUpdateManager();
      updateManager.onCheckForUpdate(function (res) {
        if (res.hasUpdate) {
          updateManager.onUpdateReady(function () {
            wx.showModal({
              title: '更新提示',
              content: '新版本已经准备好，是否重启应用？',
              success: function (res) {
                if (res.confirm) {
                  updateManager.applyUpdate();
                }
              }
            });
          });

          updateManager.onUpdateFailed(function () {
            wx.showModal({
              title: '更新提示',
              content: '新版本下载失败，请检查网络后重试',
              showCancel: false
            });
          });
        }
      });
    }
  },

  globalData: {
    userInfo: null,
    userId: null,
    openId: null,
    apiBaseUrl: config.apiBaseUrl
  }
})
