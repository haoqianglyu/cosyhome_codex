import api from "../../api/api.js";
var app = getApp();
Page({
  /**
   * 页面的初始数据
   */
  data: {
    CustomBar: app.globalData.CustomBar,
    buttons: [],
    msg: "",
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad: function (options) {
    let that = this;
    let mode_id = wx.getStorageSync("current_mode");
    let mode_list = wx.getStorageSync("mode_list")
    console.log(mode_list)

    // 将mode_list的mode字段映射为id字段，并赋值给buttons
    let buttons = mode_list.map(item => {
      return {
        id: item.mode,
        name: item.name,
      };
    });

    that.setData({
      buttons: buttons,
    });

    for (var i = 0; i < that.data.buttons.length; i++) {
      if (that.data.buttons[i].id === mode_id) {
        console.log(that.data.buttons[i].id);
        that.data.buttons[i].checked = true;
      }
    }

    // this.data.buttons[mode_id-1].checked = true;
    that.setData({
      buttons: that.data.buttons,
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

  /**
   * 事件监听,实现单选效果
   * e是获取e.currentTarget.dataset.id所以是必备的，跟前端的data-id获取的方式差不多
   */
  radioButtonTap: function (e) {
    let that = this;
    let click_mode = null;
    let message = null;
    let id = e.currentTarget.dataset.id;
    console.log(id);
    if (app.globalData.isvisitor) {
      wx.showToast({
        title: "访客模式不可操作",
        icon: "none",
      });
    } else {
      for (var i = 0; i < that.data.buttons.length; i++) {
        if (that.data.buttons[i].id === id) {
          click_mode = that.data.buttons[i].name;
          message = "确认切换为“" + click_mode + "”模式?";
        }
      }

      console.log(id);
      console.log(click_mode);
      wx.showModal({
        title: "提示",
        cancelText: "取消",
        confirmText: "确认",
        content: message,
        success: (res) => {
          if (res.confirm) {
            console.log("用户点击确定"), console.log(e);

            console.log(id);
            for (let i = 0; i < this.data.buttons.length; i++) {
              if (this.data.buttons[i].id == id) {
                //当前点击的位置为true即选中
                this.data.buttons[i].checked = true;
              } else {
                //其他的位置为false
                this.data.buttons[i].checked = false;
              }
            }
            this.setData({
              buttons: this.data.buttons,
              msg: "id:" + id,
            });

            api.ctrl_mode({
              method: "POST",
              header: {
                "content-type": "application/json",
                Authorization: wx.getStorageSync("access_token"),
              },
              data: {
                project_id: wx.getStorageSync("selected_home"),
                target_mode: id,
                target_mode_desc: click_mode,
              },
              success: function (res) {
                console.log(res);

                wx.setStorageSync("backData", id);
                wx.setStorageSync("mode_icon", id + 1);
                wx.setStorageSync("current_mode", id);
                wx.setStorageSync(
                  "show_mode",
                  wx.getStorageSync("isSingle")
                    ? "模式: " + click_mode
                    : click_mode,
                );
              },
            });
          } else if (res.cancel) {
            console.log("用户点击取消");
          }
        },
      });
    }
  },
  
});
