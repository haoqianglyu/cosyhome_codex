//Page Object
import api from "../../api/api.js";
Page({
  data: {
    customer_info : "",
    phone:"",
  },

  onLoad: function(options) {
    wx.setNavigationBarTitle({
      title: "用户信息"
     })
  },
  onReady: function() {
    
    
  },
  onShow: function() {
    this.loadCustomerInfo();
  },
  loadCustomerInfo: function() {
    var that = this
    api.customer_info({
      method: 'POST',
      header: {
        "content-type": "application/json",
        "Authorization": wx.getStorageSync("access_token"),
      },
      data: {
        "project_id":wx.getStorageSync("selected_home"),
      },
      success: function(res){
        const customerInfo =
          (res.data && res.data.customer_info) || {};
        that.setData({
          customer_info: customerInfo,
          phone:
            customerInfo.service_phone ||
            customerInfo.distributor_phone ||
            "-",
        });
      },
      fail() {
        wx.showToast({ title: "项目信息加载失败", icon: "none" });
      },
    });
  },
  onHide: function() {

  },
  onUnload: function() {

  },
  onPullDownRefresh: function() {
    this.loadCustomerInfo();
    wx.stopPullDownRefresh();
  },
  onReachBottom: function() {

  },
  onShareAppMessage: function () {
    return {
      // 这里的 title 会显示在分享卡片上
      title: "HC健康舒适家",

      // 关键：把路径固定为你的 index 登录页
      path: "/pages/index/index",
    };
  },
  onPageScroll: function() {

  },
 

});
