// pages/roomstats2/roomstats2.js
import { legacyControlMessageBody } from "../../utils/controlMessage.js";
Page({

  /**
   * 页面的初始数据
   */
  data: {
    content: [],
    loading: true,
    loadError: "",
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad: function () {
    wx.showNavigationBarLoading();
    wx.setNavigationBarTitle({
      title: wx.getStorageSync("selected_month") + "月环境量统计",
    });
    this.loadStatistics();
  },

  async loadStatistics() {
    this.setData({ loading: true, loadError: "" });
    try {
      const body = await legacyControlMessageBody({
        messageType: 20,
        body: {
          requestId: Date.now(),
          month: wx.getStorageSync("selected_month"),
          year: wx.getStorageSync("selected_year"),
        },
      });
      const content = Array.isArray(body && body.data)
        ? body.data.map((item, index) => ({
            ...item,
            _key: item.id || item.address || item.name || index,
          }))
        : [];
      this.setData({ content, loading: false });
    } catch (error) {
      this.setData({ content: [], loading: false, loadError: "环境量数据获取失败" });
      wx.showToast({ title: "环境量数据获取失败", icon: "none" });
    } finally {
      wx.hideNavigationBarLoading();
    }
  },

  /**
   * 生命周期函数--监听页面初次渲染完成
   */
  onReady: function () {

  },

  /**
   * 生命周期函数--监听页面显示
   */
  onShow: function () {

  },

  /**
   * 生命周期函数--监听页面隐藏
   */
  onHide: function () {

  },

  /**
   * 生命周期函数--监听页面卸载
   */
  onUnload: function () {

  },

  /**
   * 页面相关事件处理函数--监听用户下拉动作
   */
  onPullDownRefresh: function () {
    this.loadStatistics().finally(() => wx.stopPullDownRefresh());
  },

  /**
   * 页面上拉触底事件的处理函数
   */
  onReachBottom: function () {

  },

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
