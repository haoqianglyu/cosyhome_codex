import api from "../../api/api.js";
import {
  apiRequest,
  enterProjectRole,
  normalizeProjects,
} from "../../utils/projects.js";
import { getMiniLoginState, isTrueFlag, isAdminPhone, parseLoginPayload } from "../../utils/login.js";

const app = getApp();
const LOGIN_SUCCESS_HOLD_MS = 1200;
function hasAdminRole(loginData) {
  return isAdminPhone(loginData.customer_phone);
}
function miniLogin(data) {
  return new Promise((resolve, reject) => {
    api.mini_login({
      method: "POST",
      data,
      header: { "content-type": "application/json" },
      skipAuthRedirect: true,
      success: (response) => resolve(parseLoginPayload(response.data) || {}),
      fail: reject,
    });
  });
}

function wechatLogin() {
  return new Promise((resolve, reject) => {
    wx.login({
      success: ({ code, errMsg }) =>
        code ? resolve(code) : reject(new Error(errMsg || "微信登录失败")),
      fail: reject,
    });
  });
}

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

Page({
  data: {
    homes: [],
    loginStatus: "loading",
    loginError: "",
  },

  onLoad() {
    this.saveWindowSize();
    this.login();
  },

  resetSession() {
    app.clearSession();
    wx.setStorageSync("isSingle", false);
  },

  saveWindowSize() {
    const { windowWidth, windowHeight } =
      typeof wx.getWindowInfo === "function"
        ? wx.getWindowInfo()
        : wx.getSystemInfoSync();
    wx.setStorageSync("windowWidth", windowWidth);
    wx.setStorageSync("windowHeight", windowHeight);
  },

  async login() {
    if (this._loginPending) return;
    this._loginPending = true;
    this.setData({ loginStatus: "loading", loginError: "" });
    this.resetSession();
    try {
      const code = await wechatLogin();
      if (this._destroyed) return;
      const deviceInfo = wx.getDeviceInfo ? wx.getDeviceInfo() : {};
      const loginData = await miniLogin({
        wx_code: code,
        device: deviceInfo.model || "",
      });
      const loginState = getMiniLoginState(loginData);
      if (this._destroyed) return;

      if (loginState === "unbound") {
        this.goBindPage("您的账号尚未绑定，请绑定");
        return;
      }
      if (loginState !== "authenticated") {
        throw new Error("登录结果缺少 access_token");
      }

      app.replaceSession({
        accessToken: `Bearer ${loginData.access_token}`,
        isMember: isTrueFlag(loginData.is_member_login),
        isDistributor: isTrueFlag(loginData.is_distributor),
        isAdmin: isTrueFlag(loginData.is_distributor) && hasAdminRole(loginData),
      });

      if (isTrueFlag(loginData.is_distributor)) {
        await this.loginDistributor(loginData);
      } else {
        await this.loginUser();
      }
    } catch (error) {
      if (this._destroyed) return;
      if (getMiniLoginState(error && error.data) === "unbound") {
        this.goBindPage("您的账号尚未绑定，请绑定");
        return;
      }
      console.error("登录失败", error);
      this.setData({ loginStatus: "error", loginError: "登录失败，请检查网络后重试" });
    } finally {
      this._loginPending = false;
    }
  },

  async loginDistributor(loginData) {
    if (hasAdminRole(loginData)) {
      wx.setStorageSync("isdistributor", true);
      wx.setStorageSync("isAdmin", true);
      app.setVisitorMode(false, false);
      wx.redirectTo({ url: "../admin/admin" });
      return;
    }

    const userProjectData = await apiRequest(api.user_projects);
    if (this._destroyed) return;
    const userProjects = normalizeProjects(userProjectData);

    if (!userProjects.length) {
      const distributorData = await apiRequest(api.distributor_projects);
      if (this._destroyed) return;
      const distributorProjects = normalizeProjects(distributorData, true);
      app.setVisitorMode(true, false);
      wx.setStorageSync("isdistributor", false);
      await this.enterProjects(distributorProjects);
      return;
    }

    const loginRole = wx.getStorageSync("login");
    if (!loginRole) {
      wx.setStorageSync("isdistributor", true);
      wx.redirectTo({ url: "../distributor/distributor" });
      return;
    }

    wx.setStorageSync("isdistributor", true);
    if (loginRole === "user") {
      app.setVisitorMode(false, false);
      await this.enterProjects(userProjects);
    } else {
      const distributorData = await apiRequest(api.distributor_projects);
      if (this._destroyed) return;
      app.setVisitorMode(true, false);
      await this.enterProjects(normalizeProjects(distributorData, true));
    }
  },

  async loginUser() {
    const projectData = await apiRequest(api.user_projects);
    if (this._destroyed) return;
    const projects = normalizeProjects(projectData);
    app.setVisitorMode(false, false);
    wx.setStorageSync("isdistributor", false);
    await this.enterProjects(projects, true);
  },

  async enterProjects(projects, bindWhenEmpty = true) {
    if (this._destroyed) return;
    this.setData({ homes: projects });
    if (projects.length) {
      wx.showToast({ title: "登录成功", icon: "none", duration: 1500 });
      await wait(LOGIN_SUCCESS_HOLD_MS);
      if (this._destroyed) return;
      enterProjectRole(projects);
      return;
    }

    wx.showToast({ title: "无项目可查看", icon: "none" });
    this.setData({ loginStatus: "empty", loginError: "当前账号暂无项目，请绑定项目后重试" });
    if (bindWhenEmpty) {
      wx.redirectTo({ url: "/pages/bind/bind" });
    }
  },

  goBindPage(message) {
    if (this._destroyed) return;
    wx.showToast({ title: message, icon: "none", duration: 1500 });
    wx.redirectTo({ url: "../bind/bind" });
  },

  retryLogin() {
    this.login();
  },

  openBindPage() {
    wx.redirectTo({ url: "/pages/bind/bind" });
  },

  onUnload() {
    this._destroyed = true;
  },

  onShareAppMessage() {
    return {
      title: "HC健康舒适家",
      path: "/pages/index/index",
    };
  },
});
