import { captureProjectContext, isProjectContextCurrent } from "../../utils/projects.js";
var app = getApp();
import api from "../../api/api.js";
import { legacyControlMessageBody } from "../../utils/controlMessage.js";
import { calculateDewPoint } from "../../utils/environment.js";
import {
  apiRequest,
  getErrorMessage,
  isCurrentPage,
} from "../../utils/request.js";
import {
  applyHomeProjects,
  fetchHomeProjects,
  filterProjects,
  restoreHomeProjects,
} from "../../utils/homeProjects.js";
Page({
  /**
   * 页面的初始数据
   */
  data: {
    isvisitor: false,
    projectReady: false,
    show: false, //控制下拉列表的显示隐藏，false隐藏、true显示
    homes: [], //下拉列表的数据
    showList: [],
    showname: "",
    selectedProjectId: "",
    searchedList:[],
    // display:"contents",
    homes_id: [], //下拉列表数据对应的数据库id
    index: 0, //选择的下拉列表下标
    filter: "",
    mode: [],
    mode_icon: "",
    show_mode: "",
    content: "",
    home_mode: 1,
    deviceName: "",
    interval: "", //定时器
    backData: "",
    deviceData: [],
    offline: null,
    refreshInterval: null, // 用于保存刷新定时器的ID
  },

  // 点击下拉显示框
  selectTap() {
    var that = this;
    that.setData({
      show: !this.data.show,
      // showList: wx.getStorageSync("backfromhome1")? wx.getStorageSync("home1showlist"): that.data.homes,
      showList:that.data.homes,
      searchedList:that.data.homes,
    });
    // console.log(that.data.homes)
  },
  // 点击下拉列表
  optionTap(e) {
    let that = this;
    let searchedIndex = e.currentTarget.dataset.index;
    let selectedItem = that.data.searchedList[searchedIndex];
    if (!selectedItem) {
      wx.showToast({ title: "项目不存在，请刷新列表", icon: "none" });
      return;
    }
    let originalIndex = that.data.showList.findIndex(
      (item) => item.id === selectedItem.id,
    );
    if (originalIndex < 0) {
      wx.showToast({ title: "项目不存在，请刷新列表", icon: "none" });
      return;
    }

    if (selectedItem.app_name !== "单机版") {
      that.setData({ show: !that.data.show });
      wx.setStorageSync("isSingle", false);
      wx.setStorageSync("backfromhome2", true);
      wx.setStorageSync("home2index", originalIndex);
      wx.setStorageSync("home2showlist", that.data.showList);
      app.globalData.userInfo = { userName: "role1", role: 1 };
      app.switchTabWithRole(1);
    } else {
      wx.setStorageSync("isSingle", true);
      const project = applyHomeProjects(
        that,
        that.data.showList,
        originalIndex,
      );
      that.selectCurrentProject(project);
    }
  },

  healthCheck() {
    const context = captureProjectContext();
    if (!context.projectId || (this._healthContext && isProjectContextCurrent(this._healthContext))) return;
    this._healthContext = context;
    var that = this;
    api.control_healthy_check({
      method: "POST",
      data: {
        project_id: context.projectId,
      },
      header: {
        "content-type": "application/json",
        Authorization: context.accessToken,
      },
      success: function (res) {
        if (!isProjectContextCurrent(context) || that._destroyed) return;
        if (res.data.ok) {
          that.setData({
            offline: false,
          });
        } else {
          that.setData({
            offline: true,
          });
        }
      },
      fail(error) {
        if (!isProjectContextCurrent(context) || that._destroyed) return;
        that.setData({ offline: true });
        console.error("控制屏健康检查失败", error);
      },
      complete() {
        if (that._healthContext === context) that._healthContext = null;
      },
    });
  },

  async getDataFromScreen() {
    const context = captureProjectContext();
    if (!context.projectId || (this._screenContext && isProjectContextCurrent(this._screenContext))) return;
    this._screenContext = context;
    const projectId = context.projectId;
    const stateVersion = this._stateVersion || 0;
    try {
      const body = await legacyControlMessageBody({
        messageType: 100,
        projectId,
        accessToken: context.accessToken,
      });
      if (this._destroyed || !isProjectContextCurrent(context) || stateVersion !== (this._stateVersion || 0)) {
        return;
      }
      if (!body || typeof body !== "object") {
        return;
      }
      const modeIndex = body.currentMode;
      const sensors = Array.isArray(body.sensor)
        ? body.sensor.map((sensor) => ({
            ...sensor,
            dewPoint: calculateDewPoint(
              sensor.temperature,
              sensor.humidity,
            ),
          }))
        : [];

      wx.setStorageSync("mode_list", body.mode || []);
      this.setData({
        projectReady: true,
        filter: body.strainer === undefined ? "" : body.strainer,
        mode: body.mode || [],
        show_mode: "模式: " + (body.currentModeName || ""),
        mode_icon: modeIndex + 1,
        deviceData: sensors,
        home_mode: modeIndex === -1 ? 0 : 1,
      });
      wx.setStorageSync("current_mode", modeIndex);
    } catch (error) {
      console.error("单机版首页数据获取失败", error);
    } finally {
      if (this._screenContext === context) this._screenContext = null;
      if (!isProjectContextCurrent(context) && this._pageVisible && !this._destroyed) this.getDataFromScreen();
    }
  },

  getProject(event) {
    const value = event.detail.value;
    this.setData({
      searchedList:
        value === "" ? this.data.homes : filterProjects(value, this.data.homes),
    });
  },

  searchStr(value, list) {
    return filterProjects(value, list);
  },

  selectCurrentProject(project, refresh = true) {
    if (!project) {
      return;
    }
    if (refresh) {
      this.healthCheck();
      this.getDataFromScreen();
    }
  },

  async loadProjects(index = 0) {
    if (this._projectRequestPending) {
      return;
    }
    this._projectRequestPending = true;
    const context = captureProjectContext();
    try {
      const projects = await fetchHomeProjects();
      const current = captureProjectContext();
      if (this._destroyed || current.accessToken !== context.accessToken || current.revision !== context.revision) return;
      const selectedProject = applyHomeProjects(this, projects, index);
      if (selectedProject) {
        this.selectCurrentProject(selectedProject);
      }
      if (wx.getStorageSync("isAdmin")) {
        wx.setStorageSync("change_distributor", false);
      }
    } catch (error) {
      console.error("单机版首页项目列表获取失败", error);
      wx.showToast({
        title: (error && error.message) || "项目列表获取失败",
        icon: "none",
      });
    } finally {
      this._projectRequestPending = false;
    }
  },

  restoreFromHome1() {
    const selectedProject = restoreHomeProjects(
      this,
      "home1showlist",
      "home1index",
    );
    wx.setStorageSync("backfromhome1", false);
    if (selectedProject) {
      this.selectCurrentProject(selectedProject);
      return true;
    }
    return false;
  },

  ensureProjectReady() {
    if (wx.getStorageSync("haveProject") === false || !this.data.selectedProjectId) {
      wx.showToast({ title: "请先选择项目", icon: "none" });
      return false;
    }
    if (!this.data.projectReady) {
      wx.showToast({ title: "请等待项目数据加载完成", icon: "none" });
      return false;
    }
    return true;
  },

  onLoad() {
    this.setData({ isvisitor: app.globalData.isvisitor });
    if (
      !wx.getStorageSync("backfromhome1") ||
      !this.restoreFromHome1()
    ) {
      this.loadProjects();
    }
  },

  async changePowerMode(isOn) {
    if (!this.ensureProjectReady()) return;
    const context = captureProjectContext();
    this._stateVersion = (this._stateVersion || 0) + 1;
    if (this._powerModePending) {
      return;
    }
    this.clearTimeInterval();
    if (app.globalData.isvisitor) {
      wx.showToast({
        title: "访客模式不可操作",
        icon: "none",
      });
      this.startStatusPolling();
      return;
    }

    this._powerModePending = true;
    try {
      await apiRequest(api.ctrl_mode, {
        method: "POST",
        header: {
          "content-type": "application/json",
          Authorization: context.accessToken,
        },
        data: {
          project_id: context.projectId,
          target_mode: isOn ? 1000 : -1,
          target_mode_desc: isOn ? "开机" : "关机",
        },
      });
      if ((!isCurrentPage(this) || !isProjectContextCurrent(context))) {
        return;
      }
      this.setData({ home_mode: isOn ? 1 : 0 });
      this.getDataFromScreen();
    } catch (error) {
      if (isCurrentPage(this) && isProjectContextCurrent(context)) {
        wx.showToast({ title: getErrorMessage(error), icon: "none" });
      }
    } finally {
      this._powerModePending = false;
      if (this._pageVisible) {
        this.scheduleStatusRefresh();
      }
    }
  },

  backhome() {
    return this.changePowerMode(true);
  },

  leavehome() {
    return this.changePowerMode(false);
  },
  /**
   * 生命周期函数--监听页面初次渲染完成
   */
  onReady: function () {},

  /**
   * 生命周期函数--监听页面显示
   */
  onShow() {
    this._pageVisible = true;
    wx.setNavigationBarTitle({ title: "我的家" });

    if (typeof this.getTabBar === "function" && this.getTabBar()) {
      this.getTabBar().setData({ selected: 0 });
    }

    const backData = wx.getStorageSync("backData");
    if (backData) {
      this.setData({
        mode_icon: wx.getStorageSync("mode_icon"),
        show_mode: wx.getStorageSync("show_mode"),
      });
      wx.removeStorageSync("backData");
    }

    if (wx.getStorageSync("backfromhome1")) {
      this.restoreFromHome1();
    } else if (
      wx.getStorageSync("isAdmin") &&
      wx.getStorageSync("change_distributor")
    ) {
      this.loadProjects();
    }

    this.startStatusPolling();
  },

  startStatusPolling: function () {
    const that = this;
    if (that.data.refreshInterval) {
      return;
    }
    that.data.refreshInterval = setInterval(function () {
      if (
        that.data.skipRefresh ||
        wx.getStorageSync("haveProject") === false
      ) {
        return;
      }

      that.healthCheck();
      that.getDataFromScreen();
    }, 5000);
  },

  scheduleStatusRefresh: function (delay = 5000) {
    clearTimeout(this._statusRefreshTimer);
    this._statusRefreshTimer = setTimeout(() => {
      this._statusRefreshTimer = null;
      if (!this._pageVisible) {
        return;
      }
      this.healthCheck();
      this.getDataFromScreen();
      this.startStatusPolling();
    }, delay);
  },

  clearStatusRefreshTimer: function () {
    clearTimeout(this._statusRefreshTimer);
    this._statusRefreshTimer = null;
  },

  /**
   * 清除interval
   * @param that
   */
  clearTimeInterval: function () {
    // console.log("ccc")
    clearInterval(this.data.refreshInterval);
    this.data.refreshInterval = null;
  },
  /**
   * 生命周期函数--监听页面隐藏
   */
  onHide: function () {
    this._pageVisible = false;
    this.clearTimeInterval();
    this.clearStatusRefreshTimer();
  },

  /**
   * 生命周期函数--监听页面卸载
   */
  onUnload: function () {
    this._destroyed = true;
    this._pageVisible = false;
    this.clearTimeInterval();
    this.clearStatusRefreshTimer();
  },

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
});
