let current_region = null;
var app = getApp();
// 直辖市省级行政区代码
const MUNICIPALITY_CODES = ["110000", "120000", "310000", "500000"];
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
    show: false, //控制下拉列表的显示隐藏，false隐藏、true显示
    homes: [], //下拉列表的数据
    showList: [],
    searchedList: [],
    showname: "",
    selectedProjectId: "",
    // display:"contents",
    homes_id: [], //下拉列表数据对应的数据库id
    index: 0, //选择的下拉列表下标
    filter: "",
    mode: [],
    mode_icon: "",
    show_mode: "",
    content: "",
    clock_info: "",
    hasclock: false,
    home_mode: 1,
    clock_on: true,
    deviceName: "",
    interval: "", //定时器
    backData: "",
    deviceData: [],
    offline: null,
    refreshInterval: null, // 用于保存刷新定时器的ID
    dewPoint: null, // 存储计算的露点
    weatherDetail: {}, // 存储天气详情
    showWeatherBox: false, // 控制弹层显示
    weatherIconName: "", // 天气图标的名称
    isXinLiangLianGong: false, // 是否为"新两联供"项目
  },

  // 点击下拉显示框
  selectTap() {
    var that = this;
    console.log(that.data.homes);
    that.setData({
      show: !this.data.show,
      // showList: wx.getStorageSync("backfromhome2")?wx.getStorageSync("home2showlist"):that.data.homes,
      showList: that.data.homes,
      searchedList: that.data.homes,
    });
    console.log(that.data.homes);
    console.log(that.data.showList);
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

    if (selectedItem.app_name === "单机版") {
      wx.setStorageSync("isSingle", true);
      wx.setStorageSync("backfromhome1", true);
      wx.setStorageSync("home1index", originalIndex);
      wx.setStorageSync("home1showlist", that.data.showList);
      app.globalData.userInfo = { userName: "role2", role: 2 };
      app.switchTabWithRole(2);
    } else {
      wx.setStorageSync("isSingle", false);
      const project = applyHomeProjects(
        that,
        that.data.showList,
        originalIndex,
      );
      that.selectCurrentProject(project);
    }
  },

  /**
   * 获取实时天气（完整实现）
   * 依赖：
   *   · current_region 全局 / data 中可用，格式 "省/市/区"（行政区划代码）
   *   · calculateDewPoint(t, h) 计算露点的工具方法
   *   · api.get_weather() 接口：POST { city: <行政区划代码> }
   */
  weather_get() {
    const that = this;

    // ===== 1. 解析 city 参数 =====
    if (typeof current_region !== "string" || !current_region) {
      return;
    }
    const parts = current_region.split("/"); // ["省", "市", "区"]
    const provinceCode = parts[0]; // 省级代码
    const cityCode = MUNICIPALITY_CODES.includes(provinceCode)
      ? provinceCode // 直辖市 → 直接用省级代码
      : parts[1]; // 其它地区 → 用市级代码
    if (!cityCode) {
      return;
    }

    console.log("[weather_get] current_region:", current_region);
    console.log("[weather_get] 请求 cityCode:", cityCode);

    // ===== 2. 发起 API 请求 =====
    api.get_weather({
      method: "POST",
      data: { city: cityCode },
      header: {
        "content-type": "application/json",
        Authorization: wx.getStorageSync("access_token"),
      },

      success(res) {
        console.log("[weather_get] raw response:", res);

        // --- 提取实时天气 ---
        const weather = res.data && res.data.weather;
        if (!weather || !weather.now || !weather.cityInfo) {
          console.error("天气数据格式异常", res.data);
          return;
        }
        const now = weather.now;
        const info = weather.cityInfo;

        // --- 天气图标映射 ---
        const map = {
          "00": "00",
          "01": "01",
          "02": "02",
          18: "18",
          53: "53",
          20: "20",
          29: "20",
          30: "20",
          31: "20",
          301: "03",
          "03": "03",
          "04": "03",
          "05": "03",
          "06": "03",
          "07": "03",
          19: "03",
          "08": "12",
          "09": "12",
          10: "12",
          11: "12",
          12: "12",
          24: "12",
          25: "12",
          302: "13",
          13: "13",
          14: "13",
          15: "15",
          16: "15",
          17: "15",
          26: "15",
          27: "15",
          28: "15",
        };
        const mergedIcon = map[String(now.weather_code)] || "01"; // 默认“多云”
        const weatherIconName = `a-${mergedIcon}`;

        // --- 露点 ---
        const temperature = parseFloat(now.temperature); // ℃
        const humidity = parseFloat(now.sd.replace("%", "")); // %

        const dewPoint = calculateDewPoint(temperature, humidity);

        // --- 生成展示用地点文本 ---
        const locationText = MUNICIPALITY_CODES.includes(provinceCode)
          ? `${info.c3}市` // “北京市”
          : `${info.c7}省 ${info.c3}市`; // “江苏省 无锡市”

        // ===== 3. 更新页面数据 =====
        that.setData({
          weatherIconName,
          dewPoint,
          locationText,
          weatherDetail: {
            cityInfo: info,
            temperature: now.temperature,
            weather: now.weather,
            sd: now.sd,
            pm2_5: now.aqiDetail.pm2_5,
          },
        });
      },

      fail(err) {
        console.error("[weather_get] 请求失败:", err);
        that.setData({ weatherIconName: false });
        // 如需提示用户，可自行调用 wx.showToast
      },
    });
  },

  // === 弹层控制 ===
  openWeatherBox() {
    this.setData({ showWeatherBox: true });
  },
  closeWeatherBox() {
    this.setData({ showWeatherBox: false });
  },
  // 阻止冒泡，避免点内容区关闭
  noop() {},

  healthCheck() {
    var that = this;
    api.control_healthy_check({
      method: "POST",
      data: {
        project_id: wx.getStorageSync("selected_home"),
      },
      header: {
        "content-type": "application/json",
        Authorization: wx.getStorageSync("access_token"),
      },
      success: function (res) {
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
        that.setData({ offline: true });
        console.error("控制屏健康检查失败", error);
      },
    });
  },

  async getDataFromScreen() {
    if (this._screenRequestPending) {
      return;
    }
    const projectId = wx.getStorageSync("selected_home");
    if (!projectId) {
      return;
    }
    this._screenRequestPending = true;
    try {
      const body = await legacyControlMessageBody({
        messageType: 100,
        projectId,
      });
      if (projectId !== wx.getStorageSync("selected_home")) {
        return;
      }
      if (!body || typeof body !== "object") {
        return;
      }
      const modeIndex = body.currentMode;
      wx.setStorageSync("mode_list", body.mode || []);

      const projectInfo = wx.getStorageSync("selected_project_info");
      const state = {
        isXinLiangLianGong:
          projectInfo && projectInfo.app_name === "新两联供",
        filter: body.strainer === undefined ? "" : body.strainer,
        mode: body.mode || [],
        mode_icon: modeIndex + 1,
        deviceData: body.sensor || [],
        home_mode: body.isAtHome,
      };

      if (body.timing === undefined) {
        state.hasclock = false;
      } else {
        state.hasclock = true;
        state.clock_info = body.timing;
        state.clock_on = body.timing.isTiming;
      }

      state.show_mode =
        modeIndex === -1
          ? body.currentModeName
          : [
              body.currentModeName,
              body.airConditionerModeName,
              body.airProcessorModeName,
            ]
              .filter(Boolean)
              .join("|");

      this.setData(state);
      wx.setStorageSync("current_mode", modeIndex);
      wx.setStorageSync(
        "airConditionerModeName",
        body.airConditionerModeName || "",
      );
    } catch (error) {
      console.error("首页控制屏数据获取失败", error);
    } finally {
      this._screenRequestPending = false;
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
    this.setData({ selectedProjectId: project.id });
    current_region = project.customer_region || "";

    if (refresh) {
      this.healthCheck();
      this.getDataFromScreen();
      this.weather_get();
    }
  },

  async loadProjects(index = 0) {
    if (this._projectRequestPending) {
      return;
    }
    this._projectRequestPending = true;
    try {
      const projects = await fetchHomeProjects();
      const selectedProject = applyHomeProjects(this, projects, index);
      if (selectedProject) {
        this.selectCurrentProject(selectedProject);
      }
      if (wx.getStorageSync("isAdmin")) {
        wx.setStorageSync("change_distributor", false);
      }
    } catch (error) {
      console.error("首页项目列表获取失败", error);
      wx.showToast({
        title: (error && error.message) || "项目列表获取失败",
        icon: "none",
      });
    } finally {
      this._projectRequestPending = false;
    }
  },

  restoreFromHome2() {
    const selectedProject = restoreHomeProjects(
      this,
      "home2showlist",
      "home2index",
    );
    wx.setStorageSync("backfromhome2", false);
    if (selectedProject) {
      this.selectCurrentProject(selectedProject);
      return true;
    }
    return false;
  },

  onLoad() {
    this.setData({ isvisitor: app.globalData.isvisitor });
    if (
      !wx.getStorageSync("backfromhome2") ||
      !this.restoreFromHome2()
    ) {
      this.loadProjects();
    }
  },

  clock() {
    let that = this;
    let clockInfo = that.data.clock_info;

    // 先存到本地，后面在对应页面的 onLoad 或者别处获取
    wx.setStorageSync("clock_info", clockInfo);

    if (clockInfo.version === 2) {
      // 如果后端返回了 version=2
      wx.navigateTo({
        url: "/pages/clockNew/clockNew",
      });
    } else {
      // 如果不存在 version 字段，或者 version != 2，则跳转老页面
      wx.navigateTo({
        url: "/pages/clock/clock",
      });
    }
  },

  async changeHomeMode(atHome) {
    if (this._homeModePending) {
      return;
    }
    if (this.data.isXinLiangLianGong && wx.getStorageSync("current_mode") === 8) {
      wx.showToast({
        title: "供热除湿模式下不可更改",
        icon: "none",
      });
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

    this._homeModePending = true;
    try {
      await apiRequest(api.ctrl_home, {
        method: "POST",
        header: {
          "content-type": "application/json",
          Authorization: wx.getStorageSync("access_token"),
        },
        data: {
          project_id: wx.getStorageSync("selected_home"),
          at_home: atHome,
        },
      });
      if (!isCurrentPage(this)) {
        return;
      }
      this.setData({ home_mode: atHome ? 1 : 0 });
      wx.showToast({
        title: atHome ? "已开启在家模式" : "已开启离家模式",
        icon: "success",
      });
      this.getDataFromScreen();
    } catch (error) {
      if (isCurrentPage(this)) {
        wx.showToast({ title: getErrorMessage(error), icon: "none" });
      }
    } finally {
      this._homeModePending = false;
      if (this._pageVisible) {
        this.scheduleStatusRefresh();
      }
    }
  },

  backhome() {
    return this.changeHomeMode(true);
  },

  leavehome() {
    return this.changeHomeMode(false);
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

    if (wx.getStorageSync("backfromhome2")) {
      this.restoreFromHome2();
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
