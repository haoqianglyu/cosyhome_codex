Page({

  /**
   * 页面的初始数据
   */
  data: {
    date: '',
    start_date:'',
    end_date:'',
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad: function (options) {
    wx.setNavigationBarTitle({
      title: '运行月报'
    })

    var nowdate = new Date();
    nowdate.setMonth(nowdate.getMonth());
    var y = nowdate.getFullYear();
    var last_y = nowdate.getFullYear()-1;
    var m = (nowdate.getMonth()+1).toString().padStart(2,'0');
    var start_date = last_y+'-'+m;
    var end_date = y+'-'+m;
    this.setData({
      date: end_date,
      start_date:start_date,
      end_date:end_date,
    })
    
    wx.setStorageSync("selected_year", y);
    wx.setStorageSync("selected_month", m.replace(/\b(0+)/gi,""));
 

  },
  bindDateChange: function(e) {
    this.setData({
      date: e.detail.value
    })

    wx.setStorageSync("selected_year", e.detail.value.slice(0,4));
    wx.setStorageSync("selected_month", e.detail.value.slice(-2).replace(/\b(0+)/gi,""));
    
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
})
