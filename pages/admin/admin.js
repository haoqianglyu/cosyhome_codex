import api from "../../api/api.js";
import {
  apiRequest,
  enterProjectRole,
  normalizeProjects,
} from "../../utils/projects.js";

const app = getApp();

Page({
  data: {
    scrollTop: 0,
    distributors: [],
    showList: [],
    homes: [],
  },

  onLoad() {
    this.loadDistributors();
  },

  async loadDistributors() {
    try {
      const data = await apiRequest(api.distributors, {
        page_options: { page: 1, limit: 10000 },
      });
      const distributors = Array.isArray(data.distributor_entities)
        ? data.distributor_entities.map(({ name, id }) => ({ name, id }))
        : [];
      this.setData({
        distributors,
        showList: distributors,
        homes: [],
        showname: "",
      });
    } catch (error) {
      console.error("经销商列表获取失败", error);
      wx.showToast({ title: "经销商列表获取失败", icon: "none" });
    }
  },

  getDistributor(event) {
    const keyword = String(event.detail.value || "").trim();
    this.setData({
      showList: keyword
        ? this.searchStr(keyword, this.data.distributors)
        : this.data.distributors,
    });
  },

  searchStr(value, list) {
    return list.filter((item) => item.name.indexOf(value) >= 0);
  },

  selectDistributor(event) {
    const distributor = this.data.showList[event.currentTarget.dataset.index];
    if (!distributor) {
      return;
    }

    wx.showModal({
      title: "提示",
      cancelText: "取消",
      confirmText: "确认",
      content: `确认切换至 ${distributor.name}?`,
      success: ({ confirm }) => {
        if (confirm) {
          this.switchDistributor(distributor);
        }
      },
    });
  },

  async switchDistributor(distributor) {
    try {
      const data = await apiRequest(api.distributor_id_projects, {
        page_options: { page: 1, limit: 10000 },
        distributor_id: distributor.id,
      });
      const projects = normalizeProjects(data, true);
      this.setData({ homes: projects });
      if (!projects.length) {
        wx.showToast({ title: "该经销商无项目", icon: "none" });
        return;
      }
      wx.setStorageSync("login", "user");
      wx.setStorageSync("current_distributor", distributor.name);
      wx.setStorageSync("current_distributorid", distributor.id);
      wx.setStorageSync("change_distributor", true);
      app.setVisitorMode(false, false);
      enterProjectRole(projects);
    } catch (error) {
      console.error("经销商项目获取失败", error);
      wx.showToast({ title: "经销商项目获取失败", icon: "none" });
    }
  },

  onShareAppMessage() {
    return {
      title: "HC健康舒适家",
      path: "/pages/index/index",
    };
  },
});
