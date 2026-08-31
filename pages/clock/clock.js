// pages/clock/clock.js
import { sendControlCommand } from "../../utils/controlMessage.js";
var app = getApp();
Page({
  /**
   * 页面的初始数据
   */
  data: {
    switch_on: true,
    currentTab: 1,
    clock_info: "",
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad: function (options) {
    var that = this;
    wx.setNavigationBarTitle({
      title: "定时设置",
    });
    var clockInfo = wx.getStorageSync("clock_info") || {}; // 获取存储的数据或默认为空对象
    that.setData({
      clock_info: clockInfo,
      currentTab: clockInfo.currentMode + 1, // 因为currentMode是从0开始的，而currentTab是从1开始的
      switch_on: clockInfo.isTiming,
    });
    console.log(that.data.clock_info);
  },

  bindTimeChangeMode1Start: function (e) {
    var that = this;
    var updatedClockInfo = that.data.clock_info;
    updatedClockInfo.timingMode[0][0] = e.detail.value; // 更新开始时间
    that.setData({
      clock_info: updatedClockInfo,
    });
  },
  bindTimeChangeMode1End: function (e) {
    var that = this;
    var updatedClockInfo = that.data.clock_info;
    updatedClockInfo.timingMode[0][1] = e.detail.value; // 更新开始时间
    that.setData({
      clock_info: updatedClockInfo,
    });
  },

  bindTimeChangeMode2Start: function (e) {
    var that = this;
    var updatedClockInfo = that.data.clock_info;
    updatedClockInfo.timingMode[1][0] = e.detail.value; // 更新开始时间
    that.setData({
      clock_info: updatedClockInfo,
    });
  },
  bindTimeChangeMode2End: function (e) {
    var that = this;
    var updatedClockInfo = that.data.clock_info;
    updatedClockInfo.timingMode[1][1] = e.detail.value; // 更新开始时间
    that.setData({
      clock_info: updatedClockInfo,
    });
  },

  bindTimeChangeMode3Start: function (e) {
    var that = this;
    var updatedClockInfo = that.data.clock_info;
    updatedClockInfo.timingMode[2][0] = e.detail.value; // 更新开始时间
    that.setData({
      clock_info: updatedClockInfo,
    });
  },
  bindTimeChangeMode3End: function (e) {
    var that = this;
    var updatedClockInfo = that.data.clock_info;
    updatedClockInfo.timingMode[2][1] = e.detail.value; // 更新开始时间
    that.setData({
      clock_info: updatedClockInfo,
    });
  },

  bindTimeChangeMode4Start: function (e) {
    var that = this;
    var updatedClockInfo = that.data.clock_info;
    updatedClockInfo.timingMode[3][0] = e.detail.value; // 更新开始时间
    that.setData({
      clock_info: updatedClockInfo,
    });
  },
  bindTimeChangeMode4End: function (e) {
    var that = this;
    var updatedClockInfo = that.data.clock_info;
    updatedClockInfo.timingMode[3][1] = e.detail.value; // 更新开始时间
    that.setData({
      clock_info: updatedClockInfo,
    });
  },

  confirm: function () {
    let that = this;
    if (app.globalData.isvisitor) {
      wx.showToast({
        title: "访客模式不可操作",
        icon: "none",
      });
    } else {
      var body_json = JSON.stringify({
        isTiming: that.data.switch_on, // 开关的状态
        currentMode: that.data.currentTab - 1, // 当前选中的模式，减1是因为Tab从1开始，而currentMode可能是从0开始
        timingMode: that.data.clock_info.timingMode, // timingMode的数据
      });
  
      sendControlCommand({ messageType: 17, body: body_json })
        .then(function () {
          wx.showToast({
            title: "定时指令已发送",
            icon: "success",
          });
  
          // 延迟返回上一页
          setTimeout(function () {
            let pages = getCurrentPages(); // 获取小程序页面栈
            let beforePage = pages[pages.length - 2]; // 获取上个页面的实例对象
            if (beforePage && typeof beforePage.onShow === "function") {
              beforePage.onShow();
            }
  
            wx.navigateBack({
              delta: 1, // 返回上一层页面
            });
          }, 1500); // 延迟2000ms，确保提示能够显示完整
        })
        .catch(function (error) {
          wx.showToast({
            title: "定时指令发送失败",
            icon: "none",
          });
          console.error(error);
        });
    }
  },
  

  cancel: function () {
    console.log("取消");
    wx.navigateBack({
        delta: 1 // 这里的数字表示返回的层数，1 表示返回上一层页面
    });
  },


  /**
   * 生命周期函数--监听页面初次渲染完成
   */
  onReady: function () {},

  /**
   * 生命周期函数--监听页面显示
   */
  onShow: function () {},

  switchTab: function (e) {
    var that = this;
    console.log(e.currentTarget.dataset.id);
    that.setData({
      currentTab: e.currentTarget.dataset.id,
    });
  },

  onChangePower(e) {
    var that = this;
    console.log(e.detail.value);
    if (app.globalData.isvisitor) {
      wx.showToast({
        title: "访客模式不可操作",
        icon: "none",
      });
    } else {
      that.setData({
        switch_on: e.detail.value,
      });
    }
  },

  /**
   * 生命周期函数--监听页面隐藏
   */
  onHide: function () {},

  /**
   * 生命周期函数--监听页面卸载
   */
  onUnload: function () {},

  /**
   * 页面相关事件处理函数--监听用户下拉动作
   */
  onPullDownRefresh: function () {},

  /**
   * 页面上拉触底事件的处理函数
   */
  onReachBottom: function () {},

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
