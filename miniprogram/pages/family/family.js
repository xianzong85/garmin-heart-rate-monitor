// pages/family/family.js
const app = getApp();
const config = require('../../utils/config');

Page({
  data: {
    familyMembers: [],
    isLoading: false,
    showAddModal: false,
    showEditModal: false,
    editingMember: null,
    newMember: {
      nickname: '',
      gender: 0,
      birthDate: '',
      relationship: '自己'
    },
    relationships: ['自己', '父亲', '母亲', '子女', '配偶', '其他'],
    genders: ['未知', '男', '女']
  },

  onLoad: function (options) {
    this.loadFamilyMembers();
  },

  onShow: function () {
    this.loadFamilyMembers();
  },

  // 加载家庭成员列表
  loadFamilyMembers: function () {
    // 检查完整的登录状态
    if (!app.checkLoginStatus()) {
      console.log('未完全登录，不加载家庭成员');
      wx.showToast({
        title: '请先登录',
        icon: 'none'
      });

      // 跳转到个人中心页面进行登录
      wx.switchTab({
        url: '/pages/profile/profile'
      });
      return;
    }

    const userId = wx.getStorageSync('userId') || app.globalData.userId;

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
          wx.showToast({
            title: '获取家庭成员失败',
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

  // 显示添加成员弹窗
  showAddMemberModal: function () {
    this.setData({
      showAddModal: true,
      newMember: {
        nickname: '',
        gender: 0,
        birthDate: '',
        relationship: '自己'
      }
    });
  },

  // 隐藏添加成员弹窗
  hideAddMemberModal: function () {
    this.setData({
      showAddModal: false
    });
  },

  // 显示编辑成员弹窗
  showEditMemberModal: function (e) {
    const memberId = e.currentTarget.dataset.id;
    const member = this.data.familyMembers.find(m => m.id === memberId);

    if (member) {
      this.setData({
        showEditModal: true,
        editingMember: {
          id: member.id,
          nickname: member.nickname,
          gender: member.gender || 0,
          birthDate: member.birth_date || '',
          relationship: member.relationship || '自己'
        }
      });
    }
  },

  // 隐藏编辑成员弹窗
  hideEditMemberModal: function () {
    this.setData({
      showEditModal: false,
      editingMember: null
    });
  },

  // 输入框变化处理
  handleInputChange: function (e) {
    const { field } = e.currentTarget.dataset;
    const { value } = e.detail;

    if (this.data.showEditModal) {
      const editingMember = { ...this.data.editingMember };
      editingMember[field] = value;
      this.setData({
        editingMember
      });
    } else {
      const newMember = { ...this.data.newMember };
      newMember[field] = value;
      this.setData({
        newMember
      });
    }
  },

  // 选择器变化处理
  handlePickerChange: function (e) {
    const { field } = e.currentTarget.dataset;
    const { value } = e.detail;

    if (this.data.showEditModal) {
      const editingMember = { ...this.data.editingMember };

      if (field === 'relationship') {
        editingMember.relationship = this.data.relationships[value];
      } else if (field === 'gender') {
        editingMember.gender = parseInt(value);
      }

      this.setData({
        editingMember
      });
    } else {
      const newMember = { ...this.data.newMember };

      if (field === 'relationship') {
        newMember.relationship = this.data.relationships[value];
      } else if (field === 'gender') {
        newMember.gender = parseInt(value);
      }

      this.setData({
        newMember
      });
    }
  },

  // 日期选择器变化处理
  handleDateChange: function (e) {
    const { value } = e.detail;

    if (this.data.showEditModal) {
      const editingMember = { ...this.data.editingMember };
      editingMember.birthDate = value;
      this.setData({
        editingMember
      });
    } else {
      const newMember = { ...this.data.newMember };
      newMember.birthDate = value;
      this.setData({
        newMember
      });
    }
  },

  // 添加家庭成员
  addFamilyMember: function () {
    const { nickname, gender, birthDate, relationship } = this.data.newMember;

    if (!nickname) {
      wx.showToast({
        title: '请输入昵称',
        icon: 'none'
      });
      return;
    }

    const userId = wx.getStorageSync('userId') || app.globalData.userId;
    if (!userId) {
      wx.showToast({
        title: '请先登录',
        icon: 'none'
      });
      return;
    }

    wx.showLoading({
      title: '保存中...',
    });

    wx.request({
      url: `${config.apiBaseUrl}/api/family-member`,
      method: 'POST',
      data: {
        userId: userId,
        nickname: nickname,
        gender: gender,
        birthDate: birthDate,
        relationship: relationship
      },
      success: (res) => {
        wx.hideLoading();

        if (res.data.success) {
          wx.showToast({
            title: '添加成功',
            icon: 'success'
          });
          this.hideAddMemberModal();
          this.loadFamilyMembers();
        } else {
          wx.showToast({
            title: res.data.error || '添加失败',
            icon: 'none'
          });
        }
      },
      fail: (err) => {
        wx.hideLoading();
        console.error('请求失败:', err);
        wx.showToast({
          title: '网络请求失败',
          icon: 'none'
        });
      }
    });
  },

  // 更新家庭成员
  updateFamilyMember: function () {
    const { id, nickname, gender, birthDate, relationship } = this.data.editingMember;

    if (!nickname) {
      wx.showToast({
        title: '请输入昵称',
        icon: 'none'
      });
      return;
    }

    wx.showLoading({
      title: '保存中...',
    });

    wx.request({
      url: `${config.apiBaseUrl}/api/family-member?id=${id}`,
      method: 'PUT',
      data: {
        nickname: nickname,
        gender: gender,
        birthDate: birthDate,
        relationship: relationship
      },
      success: (res) => {
        wx.hideLoading();

        if (res.data.success) {
          wx.showToast({
            title: '更新成功',
            icon: 'success'
          });
          this.hideEditMemberModal();
          this.loadFamilyMembers();
        } else {
          wx.showToast({
            title: res.data.error || '更新失败',
            icon: 'none'
          });
        }
      },
      fail: (err) => {
        wx.hideLoading();
        console.error('请求失败:', err);
        wx.showToast({
          title: '网络请求失败',
          icon: 'none'
        });
      }
    });
  },

  // 删除家庭成员
  deleteFamilyMember: function (e) {
    const memberId = e.currentTarget.dataset.id;

    wx.showModal({
      title: '确认删除',
      content: '确定要删除这个家庭成员吗？',
      success: (res) => {
        if (res.confirm) {
          wx.showLoading({
            title: '删除中...',
          });

          wx.request({
            url: `${config.apiBaseUrl}/api/family-member?id=${memberId}`,
            method: 'DELETE',
            success: (res) => {
              wx.hideLoading();

              if (res.data.success) {
                wx.showToast({
                  title: '删除成功',
                  icon: 'success'
                });
                this.loadFamilyMembers();
              } else {
                wx.showToast({
                  title: res.data.error || '删除失败',
                  icon: 'none'
                });
              }
            },
            fail: (err) => {
              wx.hideLoading();
              console.error('请求失败:', err);
              wx.showToast({
                title: '网络请求失败',
                icon: 'none'
              });
            }
          });
        }
      }
    });
  }
});
