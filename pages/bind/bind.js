// pages/test3/test3.js
const app = getApp();
import lottie from "lottie-miniprogram";
import api from "../../api/api.js";
import {
  enterProjectRole,
  normalizeProjects,
} from "../../utils/projects.js";

function requestResponse(method, options) {
  return new Promise((resolve, reject) => {
    method({ ...options, success: resolve, fail: reject });
  });
}

function getWechatLoginCode() {
  return new Promise((resolve, reject) => {
    wx.login({
      success: ({ code, errMsg }) =>
        code ? resolve(code) : reject(new Error(errMsg || "微信登录失败")),
      fail: reject,
    });
  });
}

Page({
  /**
   * 页面的初始数据
   */
  data: {
    isCheckboxChecked: false,
    showDrawer: false,
    inputFocused: false,
    inputValue: "",
    inputError: false,
    errorMessage: "手机号",
    isGuestModeEnabled: false, // 添加此行来跟踪访客模式是否被激活
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad: function (options) {
    this._pageVisible = true;
    this.init(); // 在页面加载时自动调用 init 方法，开始动画
  },

  /**
   * 生命周期函数--监听页面初次渲染完成
   */
  onReady: function () { },

  /**
   * 生命周期函数--监听页面显示
   */
  onShow: function () { },

  init() {
    if (this._inited) {
      return;
    }
    wx.createSelectorQuery()
      .selectAll("#c1")
      .node((res) => {
        if (!this._pageVisible || !res || !res[0] || !res[0].node) {
          return;
        }
        const canvas = res[0].node;
        const context = canvas.getContext("2d");
        const pixelRatio = this.getPixelRatio();

        canvas.width = 120 * pixelRatio;
        canvas.height = 120 * pixelRatio;
        context.scale(pixelRatio, pixelRatio);

        lottie.setup(canvas);

        this.ani = lottie.loadAnimation({
          loop: true,
          autoplay: true,
          path: "https://cosyminiprogram.oss-cn-hangzhou.aliyuncs.com/cloud_pic/animation_ll4jd7cu.json",
          // animationData: require("./tutu.js"),
          rendererSettings: {
            context,
          },
        });
        this._inited = true;
      })
      .exec();
  },

  //获取设备的像素比
  getPixelRatio() {
    try {
      const windowInfo =
        typeof wx.getWindowInfo === "function"
          ? wx.getWindowInfo()
          : wx.getSystemInfoSync();
      return windowInfo.pixelRatio || 1;
    } catch (error) {
      return 1;
    }
  },

  onFocus() {
    this.setData({
      inputFocused: true,
    });
  },

  onBlur() {
    if (!this.data.inputValue) {
      this.setData({
        inputFocused: false,
      });
    }
  },

  onInput(e) {
    const inputValue = String(e.detail.value || "").replace(/\D/g, "").slice(0, 11);
    this.setData({
      inputValue,
      inputError: false, // Reset the error state
      errorMessage: "手机号", // Reset the error message
    });

    if (inputValue.length === 11) {
      wx.hideKeyboard(); // Hide the keyboard when there are 11 digits
    }
  },

  onGuestModeChange: function (e) {
    // 'e.detail.value' 是一个数组，包含所有选中的复选框的值。
    // 通过查找 'guestMode' 来判断“访客模式登录”的复选框是否被选中。
    const isGuestModeEnabled = e.detail.value.includes("guestMode");

    // 使用 'setData' 更新数据对象中的 'isGuestModeEnabled' 属性。
    this.setData({
      isGuestModeEnabled: isGuestModeEnabled,
    });

    // 可选：输出当前的勾选状态以便于调试。
  },

  // Add the validate and navigate function
  validateAndNavigate: function () {
    const inputValue = String(this.data.inputValue || "").trim();

    // 检查手机号格式是否正确
    if (/^1[3-9]\d{9}$/.test(inputValue)) {
      // 显示drawer，独立于访客模式是否启用
      this.setData({
        showDrawer: true,
      });
    } else {
      // 如果手机号格式不正确，显示错误信息
      this.setData({
        inputError: true,
        errorMessage: "错误的手机号",
      });
    }
  },

  closeDrawer() {
    this.setData({
      showDrawer: false,
    });
  },

  onCheckboxChange: function (e) {
    this.setData({
      isCheckboxChecked: e.detail.value.length > 0,
    });
  },

  confirmDrawer: function () {
    if (!this.data.isCheckboxChecked) {
      // 如果用户没有勾选同意条款，显示提示
      wx.showToast({
        title: "请先同意条款",
        icon: "none",
        duration: 2000,
      });
    } else if (this.data.isGuestModeEnabled) {
      this.loginAsGuest();
    } else {
      // 如果不是访客模式，并且用户已经勾选同意条款，正常跳转到验证页面
      wx.setStorageSync("userPhoneNumber", this.data.inputValue);
      wx.navigateTo({
        url: "../verification/verification",
      });
    }
  },

  async loginAsGuest() {
    if (this._visitorLoginPending) {
      return;
    }
    this._visitorLoginPending = true;
    wx.showLoading({ title: "正在登录", mask: true });
    try {
      const code = await getWechatLoginCode();
      const loginResponse = await requestResponse(api.visitor_login, {
        method: "POST",
        header: { "content-type": "application/json" },
        data: {
          wx_code: code,
          distributor_phone: this.data.inputValue,
        },
      });
      const token = loginResponse.data && loginResponse.data.access_token;
      if (!token) {
        throw new Error("访客登录结果缺少 access_token");
      }
      const accessToken = `Bearer ${token}`;
      const projectResponse = await requestResponse(api.visitor_projects, {
        method: "POST",
        data: {},
        header: {
          "content-type": "application/json",
          Authorization: accessToken,
        },
      });
      const projects = normalizeProjects(projectResponse.data, true);
      if (!projects.length) {
        wx.showToast({ title: "暂无访客项目", icon: "none" });
        return;
      }
      this.setData({ homes: projects });
      wx.setStorageSync("access_token", accessToken);
      app.setVisitorMode(true, true);
      wx.setStorageSync("login", "distributor");
      enterProjectRole(projects);
    } catch (error) {
      wx.showToast({
        title:
          (error && error.data && error.data.message) ||
          (error && error.message) ||
          "访客登录失败",
        icon: "none",
      });
    } finally {
      this._visitorLoginPending = false;
      wx.hideLoading();
    }
  },

  /**
   * 生命周期函数--监听页面隐藏
   */
  onHide: function () { },

  /**
   * 生命周期函数--监听页面卸载
   */
  onUnload: function () {
    this._pageVisible = false;
    if (this.ani && typeof this.ani.destroy === "function") {
      this.ani.destroy();
    }
    this.ani = null;
    this._inited = false;
  },

  /**
   * 页面相关事件处理函数--监听用户下拉动作
   */
  onPullDownRefresh: function () { },

  /**
   * 页面上拉触底事件的处理函数
   */
  onReachBottom: function () { },

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
