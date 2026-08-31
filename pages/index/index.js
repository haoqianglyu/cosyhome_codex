import api from "../../api/api.js";
import {
  apiRequest,
  enterProjectRole,
  normalizeProjects,
} from "../../utils/projects.js";

const app = getApp();
const ADMIN_PHONES = ["15006181214", "18888888888"];
const SESSION_KEYS = [
  "userInfo",
  "mode_list",
  "isAdmin",
  "access_token",
  "isdistributor",
  "haveProject",
  "selected_home",
  "selected_region",
  "selected_homename",
  "current_mode",
  "current_distributor",
  "current_distributorid",
  "selected_year",
  "selected_month",
  "isSingle",
  "backfromhome2",
  "home2index",
  "home2showlist",
  "backfromhome1",
  "home1index",
  "home1showlist",
  "clock_info",
  "selected_project_info",
  "change_distributor",
];

function miniLogin(data) {
  return new Promise((resolve, reject) => {
    api.mini_login({
      method: "POST",
      data,
      header: { "content-type": "application/json" },
      success: (response) => resolve(response.data || {}),
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

Page({
  data: {
    homes: [],
  },

  onLoad() {
    this.resetSession();
    this.saveWindowSize();
    this.login();
  },

  resetSession() {
    SESSION_KEYS.forEach((key) => wx.removeStorageSync(key));
    wx.setStorageSync("isSingle", false);
    app.globalData.isvisitor = false;
    app.globalData.isdistributor_visitor = false;
  },

  saveWindowSize() {
    const { windowWidth, windowHeight } = wx.getSystemInfoSync();
    wx.setStorageSync("windowWidth", windowWidth);
    wx.setStorageSync("windowHeight", windowHeight);
  },

  async login() {
    try {
      const code = await wechatLogin();
      const deviceInfo = wx.getDeviceInfo ? wx.getDeviceInfo() : {};
      const loginData = await miniLogin({
        wx_code: code,
        device: deviceInfo.model || "",
      });

      if (loginData.code === 3) {
        wx.showToast({ title: "微信登录凭证错误", icon: "none" });
        return;
      }
      if (!loginData.access_token) {
        throw new Error("登录结果缺少 access_token");
      }

      wx.setStorageSync("access_token", `Bearer ${loginData.access_token}`);
      if (loginData.is_member_login) {
        wx.setStorageSync("is_member_login", true);
      } else {
        wx.removeStorageSync("is_member_login");
      }

      if (loginData.unbinded) {
        this.goBindPage("您的账号尚未绑定，请绑定");
        return;
      }

      if (loginData.is_distributor) {
        await this.loginDistributor(loginData);
      } else {
        await this.loginUser();
      }
    } catch (error) {
      console.error("登录失败", error);
      wx.showToast({ title: "登录失败，请稍后重试", icon: "none" });
    }
  },

  async loginDistributor(loginData) {
    if (ADMIN_PHONES.includes(loginData.customer_phone)) {
      wx.setStorageSync("isdistributor", true);
      wx.setStorageSync("isAdmin", true);
      app.globalData.isvisitor = false;
      setTimeout(() => wx.navigateTo({ url: "../admin/admin" }), 1000);
      return;
    }

    const userProjectData = await apiRequest(api.user_projects);
    const userProjects = normalizeProjects(userProjectData);

    if (!userProjects.length) {
      app.globalData.isvisitor = true;
      wx.setStorageSync("isdistributor", false);
      const distributorData = await apiRequest(api.distributor_projects);
      this.enterProjects(normalizeProjects(distributorData, true));
      return;
    }

    const loginRole = wx.getStorageSync("login");
    if (!loginRole) {
      wx.setStorageSync("isdistributor", true);
      setTimeout(
        () => wx.navigateTo({ url: "../distributor/distributor" }),
        1000,
      );
      return;
    }

    wx.setStorageSync("isdistributor", true);
    if (loginRole === "user") {
      app.globalData.isvisitor = false;
      this.enterProjects(userProjects, 1000);
    } else {
      app.globalData.isvisitor = true;
      const distributorData = await apiRequest(api.distributor_projects);
      this.enterProjects(normalizeProjects(distributorData, true));
    }
    wx.showToast({ title: "登录成功", icon: "none", duration: 1500 });
  },

  async loginUser() {
    app.globalData.isvisitor = false;
    wx.showToast({ title: "登录成功", icon: "none", duration: 1500 });
    const projectData = await apiRequest(api.user_projects);
    const projects = normalizeProjects(projectData);
    wx.setStorageSync("isdistributor", false);
    this.enterProjects(projects, 1000, true);
  },

  enterProjects(projects, delay = 0, bindWhenEmpty = false) {
    this.setData({ homes: projects });
    if (enterProjectRole(projects, delay)) {
      return;
    }

    wx.showToast({ title: "无项目可查看", icon: "none" });
    if (bindWhenEmpty) {
      setTimeout(() => wx.navigateTo({ url: "/pages/bind/bind" }), 1000);
    }
  },

  goBindPage(message) {
    wx.showToast({ title: message, icon: "none", duration: 1500 });
    setTimeout(() => wx.navigateTo({ url: "../bind/bind" }), 1000);
  },

  onShareAppMessage() {
    return {
      title: "HC健康舒适家",
      path: "/pages/index/index",
    };
  },
});
