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
      mode: clockInfo.timeMode ? "away" : "home",
      noticeText: that.generateNoticeText(
        clockInfo.timingMode[3][0],
        clockInfo.timingMode[3][1]
      ), // 生成初始提示文字
    });
    console.log(that.data.clock_info);
    console.log(that.data.currentTab);
  },

 
// 生成提示文字的方法
generateNoticeText: function(startTime, endTime) {
  const startHour = parseInt(startTime.split(':')[0], 10);
  const endHour = parseInt(endTime.split(':')[0], 10);

  // 获取当前模式（"在家" 或 "离家"）
  const currentMode = this.data.mode === 'away' ? '离家' : '在家';

  if (endHour < startHour) {
    // 如果结束时间早于开始时间，提示跨天
    return `*今日 ${startTime} - 明日 ${endTime} ${currentMode}，其余时间段均为 ${currentMode === '离家' ? '在家' : '离家'}`;
  } else {
    // 如果结束时间晚于开始时间，提示当天
    return `*今日 ${startTime} - ${endTime} ${currentMode}，其余时间段均为 ${currentMode === '离家' ? '在家' : '离家'}`;
  }
},


  bindTimeChangeDailyStart: function (e) {
    var that = this;
    var updatedClockInfo = that.data.clock_info;
    updatedClockInfo.timingMode[0][0] = e.detail.value; // 更新开始时间
    that.setData({
      clock_info: updatedClockInfo,
    });
  },
  bindTimeChangeDailyEnd: function (e) {
    var that = this;
    var updatedClockInfo = that.data.clock_info;
    updatedClockInfo.timingMode[0][1] = e.detail.value; // 更新开始时间
    that.setData({
      clock_info: updatedClockInfo,
    });
  },

  bindTimeChangeHolidayStart: function (e) {
    var that = this;
    var updatedClockInfo = that.data.clock_info;
    updatedClockInfo.timingMode[1][0] = e.detail.value; // 更新开始时间
    that.setData({
      clock_info: updatedClockInfo,
    });
  },
  bindTimeChangeHolidayEnd: function (e) {
    var that = this;
    var updatedClockInfo = that.data.clock_info;
    updatedClockInfo.timingMode[1][1] = e.detail.value; // 更新开始时间
    that.setData({
      clock_info: updatedClockInfo,
    });
  },

  bindTimeChangeWorkdayStart: function (e) {
    var that = this;
    var updatedClockInfo = that.data.clock_info;
    updatedClockInfo.timingMode[2][0] = e.detail.value; // 更新开始时间
    that.setData({
      clock_info: updatedClockInfo,
    });
  },
  bindTimeChangeWorkdayEnd: function (e) {
    var that = this;
    var updatedClockInfo = that.data.clock_info;
    updatedClockInfo.timingMode[2][1] = e.detail.value; // 更新开始时间
    that.setData({
      clock_info: updatedClockInfo,
    });
  },

  bindTimeChangeOnceStart: function(e) {
    const newStart = e.detail.value;
    const newNoticeText = this.generateNoticeText(newStart, this.data.clock_info.timingMode[3][1]);
    
    this.setData({
      "clock_info.timingMode[3][0]": newStart, // 更新开始时间
      noticeText: newNoticeText // 更新提示文字
    });
  },
  
  bindTimeChangeOnceEnd: function(e) {
    const newEnd = e.detail.value;
    const newNoticeText = this.generateNoticeText(this.data.clock_info.timingMode[3][0], newEnd);
    
    this.setData({
      "clock_info.timingMode[3][1]": newEnd, // 更新结束时间
      noticeText: newNoticeText // 更新提示文字
    });
  },
  

  setMode: function (e) {
    var that = this;
    var newMode = e.currentTarget.dataset.mode; // 获取点击的模式 ('home' 或 'away')
  
    // 更新 mode 和 timeMode
    var mode = newMode === "home" ? "home" : "away"; // 判断模式
    var timeMode = newMode === "home" ? 0 : 1; // 在家为 0，离家为 1
  
    // 更新 clock_info 数据
    var updatedClockInfo = that.data.clock_info;
    updatedClockInfo.timeMode = timeMode; // 设置 timeMode 为 0 或 1
  
    // 更新视图
    that.setData({
      mode: mode, // 更新模式
      clock_info: updatedClockInfo, // 更新 clock_info 数据
    });
  
    // 计算提示文字并更新
    const newNoticeText = that.generateNoticeText(
      that.data.clock_info.timingMode[3][0],
      that.data.clock_info.timingMode[3][1]
    );
    that.setData({
      noticeText: newNoticeText // 更新提示文字
    });
  
    console.log(that.data.clock_info); // 可以查看更新后的 clock_info 数据
  },
  

  confirm: function () {
    let that = this;
    if (this._confirmPending) return;
    if (app.globalData.isvisitor) {
      wx.showToast({
        title: "访客模式不可操作",
        icon: "none",
      });
    } else {
      this._confirmPending = true;
      var body_json = JSON.stringify({
        timeMode: that.data.clock_info.timeMode,
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
            wx.navigateBack({
              delta: 1, // 这里的数字表示返回的层数，1 表示返回上一层页面
            });
          }, 1500); // 延迟时间与showToast相同，2000毫秒
        })
        .catch(function (error) {
          wx.showToast({
            title: "定时指令发送失败",
            icon: "none",
          });
          console.error(error);
        })
        .finally(function () {
          that._confirmPending = false;
        });
    }
  },
  

  cancel: function () {
    console.log("取消");
    wx.navigateBack({
      delta: 1, // 这里的数字表示返回的层数，1 表示返回上一层页面
    });
  },

  // 判断是否跨天
  isCrossDay: function (startTime, endTime) {
    const startHour = parseInt(startTime.split(":")[0], 10);
    const endHour = parseInt(endTime.split(":")[0], 10);
    console.log(startHour);
    console.log(endHour);
    // 判断结束小时数是否小于开始小时数
    return endHour < startHour;
  },

  // 将时间（HH:mm）转换为分钟数，方便比较
  timeToMinutes: function (time) {
    const [hour, minute] = time.split(":").map((num) => parseInt(num, 10));
    return hour * 60 + minute;
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
    // console.log(e)
    // console.log(e.currentTarget.dataset.id);
    that.setData({
      currentTab: e.currentTarget.dataset.id,
    });
    // console.log(that.data.currentTab)
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
