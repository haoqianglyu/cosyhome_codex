// pages/addMember/addMember.js
import Toast from "@vant/weapp/toast/toast";
import api from "../../api/api.js";

Page({
  /**
   * 页面的初始数据
   */
  data: {
    memberName: "",
    memberPhone: "",
    isLoading: false,
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    if (wx.getStorageSync("is_member_login")) {
      wx.showToast({ title: "成员账号无管理权限", icon: "none" });
      wx.switchTab({ url: "/pages/user/user" });
      return;
    }
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
  onHide() {
    this.clearNavigateTimer();
  },

  /**
   * 生命周期函数--监听页面卸载
   */
  onUnload() {
    this.clearNavigateTimer(false);
  },

  /**
   * 页面相关事件处理函数--监听用户下拉动作
   */
  onPullDownRefresh() {},

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

  /**
   * 成员姓名输入变化
   */
  onNameChange(event) {
    this.setData({
      memberName: event.detail,
    });
  },

  /**
   * 成员手机号输入变化
   */
  onPhoneChange(event) {
    this.setData({
      memberPhone: event.detail,
    });
  },

  /**
   * 保存成员
   */
  onSaveMember() {
    // 防止重复提交
    if (this.data.isLoading) {
      return;
    }

    const memberName = String(this.data.memberName || "").trim();
    const memberPhone = String(this.data.memberPhone || "").trim();

    // 验证成员姓名
    if (!memberName) {
      Toast({
        type: "fail",
        message: "请输入成员姓名",
        context: this, // <--- 已修改
      });
      return;
    }

    if (memberName.length > 30) {
      Toast({
        type: "fail",
        message: "成员姓名不能超过30个字符",
        context: this,
      });
      return;
    }

    // 验证手机号格式
    if (!/^1[3-9]\d{9}$/.test(memberPhone)) {
      Toast({
        type: "fail",
        message: "请输入正确的手机号码",
        context: this, // <--- 已修改
      });
      return;
    }

    // 显示加载状态
    this.setData({ isLoading: true });
    wx.showLoading({
      title: "添加中...",
      mask: true,
    });

    // 调用API创建成员
    api.create_customer({
      method: "POST",
      header: {
        "content-type": "application/json",
        Authorization: wx.getStorageSync("access_token"),
      },
      data: {
        customer_phone: memberPhone,
        customer_name: memberName,
      },
      success: (res) => {
        if (res.statusCode === 200) {
          Toast({
            type: "success",
            message: "成员添加成功",
            context: this, // <--- 已修改
          });

          // 延迟返回上一页，让用户看到成功提示
          this._navigateTimer = setTimeout(() => {
            wx.navigateBack({
              delta: 1,
            });
          }, 1500);
        } else {
          Toast({
            type: "fail",
            message: (res.data && res.data.message) || "添加失败，请重试",
            context: this, // <--- 已修改
          });
        }
      },
      fail: (err) => {
        console.error("创建成员失败:", err);
        Toast({
          type: "fail",
          message: "网络错误，添加失败",
          context: this, // <--- 已修改
        });
      },
      complete: () => {
        // 无论成功或失败，都隐藏加载状态
        wx.hideLoading();
        if (!this._navigateTimer) {
          this.setData({ isLoading: false });
        }
      },
    });
  },

  clearNavigateTimer(updateView = true) {
    clearTimeout(this._navigateTimer);
    this._navigateTimer = null;
    if (updateView && this.data.isLoading) {
      this.setData({ isLoading: false });
    }
  },
});
