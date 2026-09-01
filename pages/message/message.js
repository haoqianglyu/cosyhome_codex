//index.js
//获取应用实例
import { legacyControlMessageBody } from "../../utils/controlMessage.js";
const app = getApp()

Page({
  data: {
    CustomBar: app.globalData.CustomBar,
    arr: ["提示消息", "服务公告"],
    currentTab: 0,
    winHeight: "",
    listData: [],
    listData2:[],
    scrollTop:0,
    loading: true,
  },
  onLoad() {
    const windowInfo =
      typeof wx.getWindowInfo === "function"
        ? wx.getWindowInfo()
        : wx.getSystemInfoSync();
    this.setData({
      winHeight: windowInfo.windowHeight - 29,
    });
  },

  /**
   * 生命周期函数--监听页面显示
   */
  onShow: function () {
    this.loadMessages();
  },

  async loadMessages() {
    const requestSequence = (this._messageRequestSequence || 0) + 1;
    this._messageRequestSequence = requestSequence;
    this.setData({ loading: true });
    wx.showNavigationBarLoading();
    try {
      // 旧版控制屏回调接口共享项目级响应通道，串行请求可避免并发串包。
      const notices = await legacyControlMessageBody({ messageType: 200 });
      const announcements = await legacyControlMessageBody({ messageType: 201 });
      if (requestSequence !== this._messageRequestSequence) {
        return;
      }
      this.setData({
        listData: this.formatMessages(notices),
        listData2: this.formatMessages(announcements),
      });
    } catch (error) {
      if (requestSequence === this._messageRequestSequence) {
        wx.showToast({ title: "消息获取失败", icon: "none" });
      }
    } finally {
      if (requestSequence === this._messageRequestSequence) {
        this.setData({ loading: false });
        wx.hideNavigationBarLoading();
      }
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

  onUnload() {
    this._messageRequestSequence = (this._messageRequestSequence || 0) + 1;
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
