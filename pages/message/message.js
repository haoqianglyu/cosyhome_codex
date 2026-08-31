//index.js
//获取应用实例
import { controlMessageBody } from "../../utils/controlMessage.js";
const app = getApp()

Page({
  data: {
    CustomBar: app.globalData.CustomBar,
    arr: ["提示消息", "服务公告"],
    currentTab: 0,
    winHeight: "",
    listData: [],
    listData2:[],
    scrollTop:0
  },
  onLoad() {
    var that = this;
    wx.showNavigationBarLoading()
    wx.getSystemInfo({
      success: function (res) {
        console.log(res);
        that.setData({
          winHeight: res.windowHeight - 29, //这是减去tab导航的高度
        });
      },
    });
    setTimeout(function () {
      wx.hideNavigationBarLoading()
    }, 1000);
    
  },

  /**
   * 生命周期函数--监听页面显示
   */
  onShow: function () {
    this.loadMessages();
  },

  async loadMessages() {
    try {
      const [notices, announcements] = await Promise.all([
        controlMessageBody({ messageType: 200 }),
        controlMessageBody({ messageType: 201 }),
      ]);
      this.setData({
        listData: this.formatMessages(notices),
        listData2: this.formatMessages(announcements),
      });
    } catch (error) {
      wx.showToast({ title: "消息获取失败", icon: "none" });
    }
  },

  formatMessages(messages) {
    if (!Array.isArray(messages)) {
      return [];
    }
    return messages.map((item) => ({
      ...item,
      time: String(item.time || ""),
    }));
  },

  //第一步先完成导航tab切换样式
  swichNav(e) {
    var current = e.currentTarget.dataset.current;
    this.setData({
      currentTab: current,
    });
  },
  bindChange(e) {
    var current = e.detail.current;
    this.setData({
      currentTab: current,
    });
  },

  onShareAppMessage: function () {
    return {
      // 这里的 title 会显示在分享卡片上
      title: "HC健康舒适家",

      // 关键：把路径固定为你的 index 登录页
      path: "/pages/index/index",
    };
  },

});
