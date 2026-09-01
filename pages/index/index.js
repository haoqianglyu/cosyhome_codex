import api from "../../api/api.js";
import {
  apiRequest,
  enterProjectRole,
  normalizeProjects,
} from "../../utils/projects.js";

const app = getApp();
// 后端暂未完整返回管理员身份，保留前端管理员号码兼容名单。
const LEGACY_ADMIN_PHONES = new Set(["15006181214", "18888888888"]);

function isTrueFlag(value) {
  return value === true || value === 1 || value === "1" || value === "true";
}

function hasAdminRole(loginData) {
  if (LEGACY_ADMIN_PHONES.has(String(loginData.customer_phone || ""))) {
    return true;
  }
  if (Object.prototype.hasOwnProperty.call(loginData, "is_admin")) {
    return isTrueFlag(loginData.is_admin);
  }
  if (loginData.role) {
    return String(loginData.role).toLowerCase() === "admin";
  }
  return false;
}
function miniLogin(data) {
  return new Promise((resolve, reject) => {
    api.mini_login({
      method: "POST",
      data,
      header: { "content-type": "application/json" },
      skipAuthRedirect: true,
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
    try {
      const code = await wechatLogin();
      const deviceInfo = wx.getDeviceInfo ? wx.getDeviceInfo() : {};
      const loginData = await miniLogin({
        wx_code: code,
        device: deviceInfo.model || "",
      });

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
    if (hasAdminRole(loginData)) {
      wx.setStorageSync("isdistributor", true);
      wx.setStorageSync("isAdmin", true);
      app.setVisitorMode(false, false);
      wx.redirectTo({ url: "../admin/admin" });
      return;
    }

    const userProjectData = await apiRequest(api.user_projects);
    const userProjects = normalizeProjects(userProjectData);

    if (!userProjects.length) {
      const distributorData = await apiRequest(api.distributor_projects);
      const distributorProjects = normalizeProjects(distributorData, true);
      app.setVisitorMode(true, false);
      wx.setStorageSync("isdistributor", false);
      this.enterProjects(distributorProjects);
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
      this.enterProjects(userProjects);
    } else {
      const distributorData = await apiRequest(api.distributor_projects);
      app.setVisitorMode(true, false);
      this.enterProjects(normalizeProjects(distributorData, true));
    }
    wx.showToast({ title: "登录成功", icon: "none", duration: 1500 });
  },

  async loginUser() {
    wx.showToast({ title: "登录成功", icon: "none", duration: 1500 });
    const projectData = await apiRequest(api.user_projects);
    const projects = normalizeProjects(projectData);
    app.setVisitorMode(false, false);
    wx.setStorageSync("isdistributor", false);
    this.enterProjects(projects, true);
  },

  enterProjects(projects, bindWhenEmpty = false) {
    this.setData({ homes: projects });
    if (enterProjectRole(projects)) {
      return;
    }

    wx.showToast({ title: "无项目可查看", icon: "none" });
    if (bindWhenEmpty) {
      wx.redirectTo({ url: "/pages/bind/bind" });
    }
  },

  goBindPage(message) {
    wx.showToast({ title: message, icon: "none", duration: 1500 });
    wx.redirectTo({ url: "../bind/bind" });
  },

  onShareAppMessage() {
    return {
      title: "HC健康舒适家",
      path: "/pages/index/index",
    };
  },
});
