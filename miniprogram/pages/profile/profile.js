// pages/profile/profile.js
const app = getApp();
const config = require('../../utils/config');

Page({
  data: {
    userInfo: null,
    hasUserInfo: false,
    canIUseGetUserProfile: wx.canIUse('getUserProfile'),
    familyMembers: [],
    isLoading: false
  },

  onLoad: function (options) {
    console.log('个人中心页面加载');
    // 检查是否已有用户信息
    if (app.checkLoginStatus()) {
      this.setData({
        userInfo: app.globalData.userInfo,
        hasUserInfo: true
      });
      console.log('用户已登录，加载家庭成员');
      this.loadFamilyMembers();
    } else {
      console.log('用户未登录，显示登录按钮');
      this.setData({
        hasUserInfo: false
      });
    }
  },

  onShow: function () {
    console.log('个人中心页面显示');
    // 每次显示页面时检查登录状态并刷新家庭成员列表
    if (app.checkLoginStatus()) {
      // 确保数据一致性
      if (!this.data.hasUserInfo) {
        this.setData({
          userInfo: app.globalData.userInfo,
          hasUserInfo: true
        });
      }
      this.loadFamilyMembers();
    } else if (this.data.hasUserInfo) {
      // 登录状态不一致，更新UI
      this.setData({
        hasUserInfo: false
      });
    }
  },

  // 获取用户信息
  getUserProfile: function () {
    wx.getUserProfile({
      desc: '用于完善用户资料',
      success: (res) => {
        console.log('获取用户信息成功:', res.userInfo.nickName);

        // 保存用户信息到全局数据
        app.globalData.userInfo = res.userInfo;

        // 保存用户信息到本地存储
        wx.setStorageSync('userInfo', res.userInfo);
        console.log('用户信息已保存到本地存储');

        // 保存用户信息到服务器
        this.saveUserInfo(res.userInfo);

        this.setData({
          userInfo: res.userInfo,
          hasUserInfo: true
        });

        // 加载家庭成员
        this.loadFamilyMembers();
      }
    });
  },

  // 保存用户信息到服务器
  saveUserInfo: function (userInfo) {
    const openId = wx.getStorageSync('openId') || app.globalData.openId;
    if (!openId) {
      console.error('未找到openId');
      return;
    }

    wx.request({
      url: `${config.apiBaseUrl}/api/user`,
      method: 'POST',
      data: {
        openId: openId,
        nickname: userInfo.nickName,
        avatarUrl: userInfo.avatarUrl,
        gender: userInfo.gender
      },
      success: (res) => {
        if (res.data.success) {
          console.log('用户信息保存成功');
          // 保存用户ID
          app.globalData.userId = res.data.user.id;
          wx.setStorageSync('userId', res.data.user.id);
        } else {
          console.error('保存用户信息失败:', res.data.error);
        }
      },
      fail: (err) => {
        console.error('请求失败:', err);
      }
    });
  },

  // 加载家庭成员列表
  loadFamilyMembers: function () {
    const userId = wx.getStorageSync('userId') || app.globalData.userId;
    if (!userId) {
      console.error('未找到userId');
      return;
    }

    this.setData({ isLoading: true });

    wx.request({
      url: `${config.apiBaseUrl}/api/family-members?userId=${userId}`,
      method: 'GET',
      success: (res) => {
        if (res.data.members) {
          this.setData({
            familyMembers: res.data.members,
            isLoading: false
          });
        } else {
          console.error('获取家庭成员失败:', res.data.error);
          this.setData({ isLoading: false });
        }
      },
      fail: (err) => {
        console.error('请求失败:', err);
        this.setData({ isLoading: false });
      }
    });
  },

  // 跳转到家庭成员管理页面
  navigateToFamilyManagement: function () {
    wx.navigateTo({
      url: '/pages/family/family'
    });
  },

  // 跳转到设备使用记录页面
  navigateToDeviceUsage: function () {
    wx.navigateTo({
      url: '/pages/device-usage/device-usage'
    });
  },

  // 跳转到关于页面
  navigateToAbout: function () {
    wx.navigateTo({
      url: '/pages/about/about'
    });
  }
});
