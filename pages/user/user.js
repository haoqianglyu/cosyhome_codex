import api from "../../api/api.js";
import {
  apiRequest,
  enterProjectRole,
  normalizeProjects,
} from "../../utils/projects.js";

const app = getApp();

Page({
  data: {
    isMemberLogin: false,
    userinfo: {},
    homes: [],
    num: 0,
    isSingle: false,
    btn2show: false,
    reportshow: false,
    username: "",
    buttonMessage: "",
    buttonShow: false,
    isXinLiangLianGong: false,
    showProjectStatus: false,
  },

  onLoad() {
    this.setData({
      isMemberLogin: Boolean(wx.getStorageSync("is_member_login")),
    });
  },

  onShow() {
    this.refreshPageState();
    this.loadCustomerInfo();
    if (typeof this.getTabBar === "function" && this.getTabBar()) {
      this.getTabBar().setData({ selected: 2 });
    }
  },

  refreshPageState() {
    const project = wx.getStorageSync("selected_project_info") || {};
    const isAdmin = Boolean(wx.getStorageSync("isAdmin"));
    const isDistributor = Boolean(wx.getStorageSync("isdistributor"));
    const isVisitor = Boolean(app.globalData.isvisitor);
    const isDistributorVisitor = Boolean(
      app.globalData.isdistributor_visitor,
    );
    const storedSingle = wx.getStorageSync("isSingle");
    const isSingle =
      storedSingle === true ||
      (typeof storedSingle === "string" && storedSingle === "true");

    this.setData({
      isSingle,
      btn2show: isAdmin,
      showProjectStatus: isAdmin || isDistributor,
      isXinLiangLianGong: project.app_name === "新两联供",
      reportshow: project.level === "5级" || project.level === "6级",
      buttonShow:
        isDistributor && !isAdmin && !isDistributorVisitor,
      buttonMessage: isVisitor ? "切换至用户模式" : "切换至管理模式",
    });
  },

  async loadCustomerInfo() {
    const projectId = wx.getStorageSync("selected_home");
    if (!projectId) {
      this.setData({ username: "" });
      return;
    }
    try {
      const data = await apiRequest(api.customer_info, {
        project_id: projectId,
      });
      this.setData({
        username:
          (data.customer_info && data.customer_info.customer_name) || "",
      });
    } catch (error) {
      console.error("业主信息获取失败", error);
    }
  },

  goReport() {
    if (this.data.isXinLiangLianGong) {
      wx.showToast({ title: "正在开发中", icon: "none" });
      return;
    }
    wx.navigateTo({
      url: this.data.isSingle
        ? "/pages/singlereport/singlereport"
        : "/pages/report/report",
    });
  },

  switchLogin() {
    const toUser = Boolean(app.globalData.isvisitor);
    wx.showModal({
      title: "提示",
      cancelText: "取消",
      confirmText: "确认",
      content: toUser
        ? "是否需要切换为用户模式?"
        : "是否需要切换为管理模式?",
      success: ({ confirm }) => {
        if (confirm) {
          this.changeLoginRole(toUser);
        }
      },
    });
  },

  async changeLoginRole(toUser) {
    const loginRole = toUser ? "user" : "distributor";
    const request = toUser ? api.user_projects : api.distributor_projects;
    wx.setStorageSync("login", loginRole);
    app.globalData.isvisitor = !toUser;

    try {
      const data = await apiRequest(request);
      const projects = normalizeProjects(data, !toUser);
      this.setData({ homes: projects });
      if (!enterProjectRole(projects, 1000)) {
        wx.showToast({ title: "无项目可查看", icon: "none" });
      }
    } catch (error) {
      console.error("身份切换失败", error);
      wx.showToast({ title: "身份切换失败", icon: "none" });
    }
  },

  onShareAppMessage() {
    return {
      title: "HC健康舒适家",
      path: "/pages/index/index",
    };
  },
});
