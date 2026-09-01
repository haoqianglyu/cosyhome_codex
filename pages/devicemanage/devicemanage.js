// pages/devicemanage/devicemanage.js
import api from "../../api/api.js";
var app = getApp();
Page({
  /**
   * 页面的初始数据
   */
  data: {
    devices: [],
    loading: true,
    loadError: "",
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    this.getDeviceList();
  },

  getDeviceList(callback) {
    if (this._deviceRequestPending) {
      return;
    }
    this._deviceRequestPending = true;
    this.setData({ loading: true, loadError: "" });
    const that = this;
    api.get_devices({
      method: "GET",
      header: {
        "content-type": "application/json",
        Authorization: wx.getStorageSync("access_token"),
      },
      data: {},
      success: function (res) {
        if (res.data && Array.isArray(res.data.devices)) {
          // 第一步：预处理数据，计算出毫秒时间戳用于排序
          let devices = res.data.devices.map((item) => {
            let timestampMs = 0; // 默认为 0，表示未知时间

            if (item.last_login_time && item.last_login_time.length > 6) {
              // 纳秒转毫秒逻辑
              const msStr = item.last_login_time.substring(
                0,
                item.last_login_time.length - 6,
              );
              const parsed = parseInt(msStr);
              if (!isNaN(parsed)) {
                timestampMs = parsed;
              }
            }

            return {
              ...item,
              _sortTempTime: timestampMs, // 临时字段，用于排序
              deviceDisplay: item.device || "未知设备",
            };
          });

          // 第二步：排序
          devices.sort((a, b) => {
            const timeA = a._sortTempTime;
            const timeB = b._sortTempTime;

            // 两个都是未知时间，保持原顺序
            if (timeA === 0 && timeB === 0) return 0;

            // A 是未知时间(0)，放到后面 (返回正数)
            if (timeA === 0) return 1;

            // B 是未知时间(0)，A 放到前面 (返回负数)
            if (timeB === 0) return -1;

            // 都有时间，按倒序排列 (大数在前)
            return timeB - timeA;
          });

          // 第三步：格式化显示时间并清理临时字段
          devices = devices.map((item) => {
            let loginTimeStr = "未知时间";
            if (item._sortTempTime > 0) {
              loginTimeStr = that.formatTime(item._sortTempTime);
            }

            return {
              ...item,
              loginTimeDisplay: loginTimeStr,
            };
          });

          that.setData({
            devices: devices,
            loading: false,
          });
        } else {
          that.setData({ devices: [], loading: false, loadError: "设备数据格式异常" });
        }
      },
      fail: function (err) {
        console.error("fetch devices failed", err);
        that.setData({ devices: [], loading: false, loadError: "获取设备列表失败" });
        wx.showToast({
          title: "获取设备列表失败",
          icon: "none",
        });
      },
      complete() {
        that._deviceRequestPending = false;
        if (callback) callback();
      },
    });
  },

  formatTime(timestamp) {
    const date = new Date(timestamp);
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, "0");
    const day = date.getDate().toString().padStart(2, "0");
    const hour = date.getHours().toString().padStart(2, "0");
    const minute = date.getMinutes().toString().padStart(2, "0");
    const second = date.getSeconds().toString().padStart(2, "0");
    return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
  },

  handleLogout(e) {
    const that = this;
    const deviceId = e.currentTarget.dataset.id;
    const deviceName = e.currentTarget.dataset.name;

    wx.showModal({
      title: "提示",
      content: `确定要下线设备 "${deviceName}" 吗？`,
      success(res) {
        if (res.confirm) {
          that.executeLogout(deviceId);
        }
      },
    });
  },

  executeLogout(deviceId) {
    if (this._logoutPending) return;
    if (deviceId == null || deviceId === "") {
      wx.showToast({ title: "设备信息无效，请刷新后重试", icon: "none" });
      return;
    }
    this._logoutPending = true;
    const that = this;
    api.device_logout({
      method: "POST",
      header: {
        "content-type": "application/json",
        Authorization: wx.getStorageSync("access_token"),
      },
      data: {
        id: deviceId,
      },
      success: function (res) {
        if (res.statusCode === 200) {
          wx.showToast({
            title: "下线成功",
            icon: "success",
          });
          that.getDeviceList(); // Refresh list
        } else {
          wx.showToast({
            title: "下线失败",
            icon: "none",
          });
        }
      },
      fail: function (err) {
        wx.showToast({
          title: "网络错误",
          icon: "none",
        });
      },
      complete() {
        that._logoutPending = false;
      },
    });
  },

  /**
   * 生命周期函数--监听页面初次渲染完成
   */
  onReady() {},

  /**
   * 生命周期函数--监听页面显示
   */
  onShow() {},

  /**
   * 生命周期函数--监听页面隐藏
   */
  onHide() {},

  /**
   * 生命周期函数--监听页面卸载
   */
  onUnload() {},

  /**
   * 页面相关事件处理函数--监听用户下拉动作
   */
  onPullDownRefresh() {
    this.getDeviceList(() => wx.stopPullDownRefresh());
  },

  /**
   * 页面上拉触底事件的处理函数
   */
  onReachBottom() {},

  /**
   * 用户点击右上角分享
   */
  onShareAppMessage: function () {
    return {
      // 这里的 title 会显示在分享卡片上
      title: "HC健康舒适家",

      // 关键：把路径固定为你的 index 登录页
      path: "/pages/index/index",
    };
  },
});
