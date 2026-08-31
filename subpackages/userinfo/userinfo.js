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
        console.log(res)
        that.setData({
          customer_info: res.data.customer_info
        })
        console.log(that.data.customer_info)
        that.setData({
          phone : that.data.customer_info.hasOwnProperty("service_phone")?that.data.customer_info.service_phone:that.data.customer_info.distributor_phone
        })
        console.log(that.data.phone)
      }
    });
  },
  onHide: function() {

  },
  onUnload: function() {

  },
  onPullDownRefresh: function() {

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
  