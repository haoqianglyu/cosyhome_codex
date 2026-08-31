import api from "../../api/api.js";
import {
  apiRequest,
  enterProjectRole,
  normalizeProjects,
} from "../../utils/projects.js";

const app = getApp();

Page({
  data: {
    homes: [],
  },

  userLogin() {
    this.loginWithProjects({
      loginRole: "user",
      visitor: false,
      request: api.user_projects,
      sort: false,
    });
  },

  distributorLogin() {
    this.loginWithProjects({
      loginRole: "distributor",
      visitor: true,
      request: api.distributor_projects,
      sort: true,
    });
  },

  async loginWithProjects({ loginRole, visitor, request, sort }) {
    wx.setStorageSync("login", loginRole);
    app.globalData.isvisitor = visitor;
    wx.showToast({ title: "登录成功", icon: "none", duration: 1500 });

    try {
      const data = await apiRequest(request);
      const projects = normalizeProjects(data, sort);
      this.setData({ homes: projects });
      if (!enterProjectRole(projects, 1000)) {
        wx.showToast({ title: "无项目可查看", icon: "none" });
      }
    } catch (error) {
      console.error("身份切换失败", error);
      wx.showToast({ title: "项目列表获取失败", icon: "none" });
    }
  },

  onShareAppMessage() {
    return {
      title: "HC健康舒适家",
      path: "/pages/index/index",
    };
  },
});
