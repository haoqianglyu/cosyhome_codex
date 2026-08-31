let first_homeid = "";
let first_homename = "";
let first_region = "";
let current_home = "";
let current_id = null;
let current_region = null;
var app = getApp();
// 直辖市省级行政区代码
const MUNICIPALITY_CODES = ["110000", "120000", "310000", "500000"];
import api from "../../api/api.js";
import { controlMessageBody } from "../../utils/controlMessage.js";
import { calculateDewPoint } from "../../utils/environment.js";
import { getProjectEntities } from "../../utils/projects.js";
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
    let originalIndex = that.data.showList.findIndex(
      (item) => item.name === selectedItem.name,
    );

    if (that.data.searchedList[searchedIndex].app_name === "单机版") {
      console.log("11111");
      wx.setStorageSync("isSingle", true);
      wx.setStorageSync("backfromhome1", true);
      wx.setStorageSync("home1index", originalIndex);
      wx.setStorageSync("home1showlist", that.data.showList);
      app.globalData.userInfo = { userName: "role2", role: 2 };
      app.switchTabWithRole(2);
    } else {
      console.log("22222");
      wx.setStorageSync("isSingle", false);
      console.log(that.data.showList);
      current_home = that.data.showList[originalIndex].name;
      current_id = that.data.showList[originalIndex].id;
      current_region = that.data.showList[originalIndex].customer_region;
      console.log(current_home);
      console.log(current_region);

      that.setData({
        index: searchedIndex,
        show: !that.data.show,
        showname: current_home,
      });

      wx.setStorageSync("selected_project_info", {
        name: that.data.showList[originalIndex].name, // 项目名称
        code: that.data.showList[originalIndex].code, // 项目 ID（代码）
        level: that.data.showList[originalIndex].level, // 项目等级
        building_type: that.data.showList[originalIndex].building_type, // 建筑类型
        building_area: that.data.showList[originalIndex].building_area, // 建筑面积
        energy_level: that.data.showList[originalIndex].energy_level, // 节能水平
        customer_region: that.data.showList[originalIndex].customer_region, // 省市区
        delivery_time: that.data.showList[originalIndex].delivery_time, // 交付时间
        app_name: that.data.showList[originalIndex].app_name, // 应用名称
      });
      wx.setStorageSync("selected_home", current_id);
      wx.setStorageSync("selected_homename", current_home);
      wx.setStorageSync("selected_region", current_region);

      that.healthCheck();
      that.getDataFromScreen();
      that.weather_get();

      var obj = wx.createSelectorQuery();
      obj.selectAll(".select_text").boundingClientRect(function (rect) {
        console.log(rect[0].height);
        console.log(rect[0].width);
      });
      obj.exec();
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
        console.log(error);
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
      const body = await controlMessageBody({
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

  //当前界面拿到页面输入的值
  getProject: function (project) {
    var that = this;
    // console.log(project)
    if (project.detail.value === "") {
      that.setData({
        searchedList: that.data.homes,
      });
    } else {
      that.setData({
        searchedList: that.searchStr(project.detail.value, that.data.homes),
      });
    }

    // console.log(that.data.showList)
  },

  // 数组中匹配单个字符串的方法，传入数组支持格式[{},{}],
  searchStr: function (value, list) {
    var str = value.trim();
    // value:要查询的字符串
    // list:这里匹配，lis必须是个数组
    if (str) {
      let arr = [];
      list.forEach((el) => {
        if (el.name.indexOf(str) >= 0) {
          arr.push(el);
        }
      });
      return arr;
    } else {
      return [];
    }
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad: function (options) {
    var that = this;

    // console.log("ttttttt")
    // that.weather_get();

    console.log(app.globalData.isvisitor);
    console.log(app.globalData.isdistributor_visitor);

    console.log("kkk");
    // console.log(wx.getStorageSync("access_token"))
    console.log(app.globalData.isvisitor);
    that.setData({
      isvisitor: app.globalData.isvisitor,
    });

    if (wx.getStorageSync("backfromhome2")) {
      console.log("aaa");
      console.log(that.data.show);
      that.setData({
        show: false,
      });
      var Index = wx.getStorageSync("home2index");
      var new_showlist = wx.getStorageSync("home2showlist");
      current_home = new_showlist[Index].name;
      current_id = new_showlist[Index].id;
      current_region = new_showlist[Index].customer_region;
      console.log(current_home);

      that.setData({
        index: Index,
        showname: current_home,
        homes: wx.getStorageSync("home2showlist"),
        showList: wx.getStorageSync("home2showlist"),
        searchedList: wx.getStorageSync("home2showlist"),
      });

      wx.setStorageSync("selected_project_info", {
        name: new_showlist[Index].name, // 项目名称
        code: new_showlist[Index].code, // 项目 ID（代码）
        level: new_showlist[Index].level, // 项目等级
        building_type: new_showlist[Index].building_type, // 建筑类型
        building_area: new_showlist[Index].building_area, // 建筑面积
        energy_level: new_showlist[Index].energy_level, // 节能水平
        customer_region: new_showlist[Index].customer_region, // 省市区
        delivery_time: new_showlist[Index].delivery_time, // 交付时间
        app_name: new_showlist[Index].app_name, // 应用名称
      });
      wx.setStorageSync("selected_home", current_id);
      wx.setStorageSync("selected_homename", current_home);
      wx.setStorageSync("selected_region", current_region);

      that.healthCheck();
      that.getDataFromScreen();
      that.weather_get();

      var obj = wx.createSelectorQuery();
      obj.selectAll(".select_text").boundingClientRect(function (rect) {
        console.log(rect[0].height);
        console.log(rect[0].width);
      });
      obj.exec();
    } else {
      if (app.globalData.isvisitor && !app.globalData.isdistributor_visitor) {
        // console.log(llllllllllll)
        api.distributor_projects({
          method: "POST",
          data: {},
          header: {
            "content-type": "application/json",
            Authorization: wx.getStorageSync("access_token"),
          },
          success: function (res) {
            if (getProjectEntities(res.data).length === 0) {
              wx.showToast({
                title: "无项目可查看",
                icon: "none",
              });
              that.setData({
                show_mode: "",
                mode_icon: 1000,
                deviceData: "",
                home_mode: 1,
                homes: [],
                homes_id: [],
                showList: [],
                searchedList: [],
              });

              wx.setStorageSync("haveProject", false);
            } else {
              wx.setStorageSync("haveProject", true);
              console.log("2222222");
              that.setData({
                homes: [],
                showList: [],
                searchedList: [],
                showname: "",
              });
              console.log(res);
              // 先对 project_entities 进行排序
              // 分离在线和离线项目
              var onlineProjects = [];
              var offlineProjects = [];

              for (var i = 0; i < res.data.project_entities.length; i++) {
                var project = res.data.project_entities[i];
                if (project.online) {
                  onlineProjects.push(project);
                } else {
                  offlineProjects.push(project);
                }
              }

              // 对在线项目排序，将“通用版”放在最前面
              onlineProjects.sort(function (a, b) {
                if (a.app_name === "通用版") {
                  return -1;
                } else if (b.app_name === "通用版") {
                  return 1;
                } else {
                  return 0;
                }
              });

              // 合并排序后的在线和离线项目
              var sortedProjects = onlineProjects.concat(offlineProjects);

              // 处理排序后的项目列表
              for (var i = 0; i < sortedProjects.length; i++) {
                const p = sortedProjects[i];
                var obj = {
                  name: p.name, // 项目名称
                  id: p.id,
                  app_name: p.app_name,
                  code: p.code, // 项目 ID（代码）
                  level: p.level, // 项目等级
                  building_type: p.building_type, // 建筑类型
                  building_area: p.building_area, // 建筑面积
                  energy_level: p.energy_level, // 节能水平
                  customer_region: p.customer_region, // 省市区
                  delivery_time: p.delivery_time, // 交付时间
                  online: p.online || false, // 确保包含 online 属性
                };
                that.data.homes.push(obj);
              }
              var index = wx.getStorageSync("backfromhome2")
                ? wx.getStorageSync("home2index")
                : 0;
              that.setData({
                homes: that.data.homes,
                index: index,
                showList: wx.getStorageSync("backfromhome2")
                  ? wx.getStorageSync("home2showlist")
                  : that.data.homes,
                searchedList: wx.getStorageSync("backfromhome2")
                  ? wx.getStorageSync("home2showlist")
                  : that.data.homes,
              });

              console.log(that.data.showList);
              first_homeid = that.data.showList[0].id;
              first_homename = that.data.showList[0].name;
              first_region = that.data.showList[0].customer_region;

              current_home = first_homename;
              current_id = first_homeid;
              current_region = first_region;

              that.setData({
                showname: current_home,
              });

              wx.setStorageSync("selected_project_info", {
                name: that.data.showList[0].name, // 项目名称
                code: that.data.showList[0].code, // 项目 ID（代码）
                level: that.data.showList[0].level, // 项目等级
                building_type: that.data.showList[0].building_type, // 建筑类型
                building_area: that.data.showList[0].building_area, // 建筑面积
                energy_level: that.data.showList[0].energy_level, // 节能水平
                customer_region: that.data.showList[0].customer_region, // 省市区
                delivery_time: that.data.showList[0].delivery_time, // 交付时间
                app_name: that.data.showList[0].app_name, // 应用名称
              });
              wx.setStorageSync("selected_home", current_id);
              wx.setStorageSync("selected_homename", current_home);
              wx.setStorageSync("selected_region", current_region);
              that.healthCheck();
              that.getDataFromScreen();
              that.weather_get();
            }
          },
        });
      } else if (
        app.globalData.isvisitor &&
        app.globalData.isdistributor_visitor
      ) {
        console.log("pppppppppppppp");
        api.vistor_projects({
          method: "POST",
          data: {},
          header: {
            "content-type": "application/json",
            Authorization: wx.getStorageSync("access_token"),
          },
          success: function (res) {
            if (getProjectEntities(res.data).length === 0) {
              wx.showToast({
                title: "无项目可查看",
                icon: "none",
              });
              that.setData({
                show_mode: "",
                mode_icon: 1000,
                deviceData: "",
                home_mode: 1,
                homes: [],
                homes_id: [],
                showList: [],
                searchedList: [],
              });

              wx.setStorageSync("haveProject", false);
            } else {
              wx.setStorageSync("haveProject", true);

              that.setData({
                homes: [],
                showList: [],
                searchedList: [],
                showname: "",
              });
              console.log(res);
              // 先对 project_entities 进行排序
              // 分离在线和离线项目
              var onlineProjects = [];
              var offlineProjects = [];

              for (var i = 0; i < res.data.project_entities.length; i++) {
                var project = res.data.project_entities[i];
                if (project.online) {
                  onlineProjects.push(project);
                } else {
                  offlineProjects.push(project);
                }
              }

              // 对在线项目排序，将“通用版”放在最前面
              onlineProjects.sort(function (a, b) {
                if (a.app_name === "通用版") {
                  return -1;
                } else if (b.app_name === "通用版") {
                  return 1;
                } else {
                  return 0;
                }
              });

              // 合并排序后的在线和离线项目
              var sortedProjects = onlineProjects.concat(offlineProjects);

              // 处理排序后的项目列表
              for (var i = 0; i < sortedProjects.length; i++) {
                const p = sortedProjects[i];
                var obj = {
                  name: p.name, // 项目名称
                  id: p.id,
                  app_name: p.app_name,
                  code: p.code, // 项目 ID（代码）
                  level: p.level, // 项目等级
                  building_type: p.building_type, // 建筑类型
                  building_area: p.building_area, // 建筑面积
                  energy_level: p.energy_level, // 节能水平
                  customer_region: p.customer_region, // 省市区
                  delivery_time: p.delivery_time, // 交付时间
                  online: p.online || false, // 确保包含 online 属性
                };
                that.data.homes.push(obj);
              }
              var index = wx.getStorageSync("backfromhome2")
                ? wx.getStorageSync("home2index")
                : 0;
              that.setData({
                homes: that.data.homes,
                index: index,
                showList: wx.getStorageSync("backfromhome2")
                  ? wx.getStorageSync("home2showlist")
                  : that.data.homes,
                searchedList: wx.getStorageSync("backfromhome2")
                  ? wx.getStorageSync("home2showlist")
                  : that.data.homes,
              });

              console.log(that.data.showList);
              first_homeid = that.data.showList[0].id;
              first_homename = that.data.showList[0].name;
              first_region = that.data.showList[0].customer_region;

              current_home = first_homename;
              current_id = first_homeid;
              current_region = first_region;

              that.setData({
                showname: current_home,
              });

              wx.setStorageSync("selected_project_info", {
                name: that.data.showList[0].name, // 项目名称
                code: that.data.showList[0].code, // 项目 ID（代码）
                level: that.data.showList[0].level, // 项目等级
                building_type: that.data.showList[0].building_type, // 建筑类型
                building_area: that.data.showList[0].building_area, // 建筑面积
                energy_level: that.data.showList[0].energy_level, // 节能水平
                customer_region: that.data.showList[0].customer_region, // 省市区
                delivery_time: that.data.showList[0].delivery_time, // 交付时间
                app_name: that.data.showList[0].app_name, // 应用名称
              });
              wx.setStorageSync("selected_home", current_id);
              wx.setStorageSync("selected_homename", current_home);
              wx.setStorageSync("selected_region", current_region);
              that.healthCheck();
              that.getDataFromScreen();
              that.weather_get();
            }
          },
        });
      } else {
        if (wx.getStorageSync("isAdmin")) {
          console.log("bbbbbbbb");
          wx.setStorageSync("haveProject", true);
          api.distributor_id_projects({
            method: "POST",
            data: {
              page_options: {
                page: 1,
                limit: 10000,
              },
              distributor_id: wx.getStorageSync("current_distributorid"),
            },
            header: {
              "content-type": "application/json",
              Authorization: wx.getStorageSync("access_token"),
            },
            success: function (res) {
              console.log(res);
              that.setData({
                homes: [],
                showList: [],
                searchedList: [],
                showname: "",
              });
              // 分离在线和离线项目
              var onlineProjects = [];
              var offlineProjects = [];

              for (var i = 0; i < res.data.project_entities.length; i++) {
                var project = res.data.project_entities[i];
                if (project.online) {
                  onlineProjects.push(project);
                } else {
                  offlineProjects.push(project);
                }
              }

              // 对在线项目排序，将“通用版”放在最前面
              onlineProjects.sort(function (a, b) {
                if (a.app_name === "通用版") {
                  return -1;
                } else if (b.app_name === "通用版") {
                  return 1;
                } else {
                  return 0;
                }
              });

              // 准备缓存用的项目信息映射
              const projectInfoMap = {};

              // 合并排序后的在线和离线项目
              var sortedProjects = onlineProjects.concat(offlineProjects);
              console.log(sortedProjects);
              // 处理排序后的项目列表
              for (var i = 0; i < sortedProjects.length; i++) {
                const p = sortedProjects[i];
                var obj = {
                  name: p.name, // 项目名称
                  id: p.id,
                  app_name: p.app_name,
                  code: p.code, // 项目 ID（代码）
                  level: p.level, // 项目等级
                  building_type: p.building_type, // 建筑类型
                  building_area: p.building_area, // 建筑面积
                  energy_level: p.energy_level, // 节能水平
                  customer_region: p.customer_region, // 省市区
                  delivery_time: p.delivery_time, // 交付时间
                  online: p.online || false, // 确保包含 online 属性
                };
                that.data.homes.push(obj);
              }

              var index = wx.getStorageSync("backfromhome2")
                ? wx.getStorageSync("home2index")
                : 0;
              that.setData({
                homes: that.data.homes,
                index: index,
                showList: wx.getStorageSync("backfromhome2")
                  ? wx.getStorageSync("home2showlist")
                  : that.data.homes,
                searchedList: wx.getStorageSync("backfromhome2")
                  ? wx.getStorageSync("home2showlist")
                  : that.data.homes,
              });

              console.log(that.data.showList);
              first_homeid = that.data.showList[0].id;
              first_homename = that.data.showList[0].name;
              first_region = that.data.showList[0].customer_region;

              current_home = first_homename;
              current_id = first_homeid;
              current_region = first_region;

              that.setData({
                showname: current_home,
              });
              wx.setStorageSync("selected_project_info", {
                name: that.data.showList[0].name, // 项目名称
                code: that.data.showList[0].code, // 项目 ID（代码）
                level: that.data.showList[0].level, // 项目等级
                building_type: that.data.showList[0].building_type, // 建筑类型
                building_area: that.data.showList[0].building_area, // 建筑面积
                energy_level: that.data.showList[0].energy_level, // 节能水平
                customer_region: that.data.showList[0].customer_region, // 省市区
                delivery_time: that.data.showList[0].delivery_time, // 交付时间
                app_name: that.data.showList[0].app_name, // 应用名称
              });
              wx.setStorageSync("selected_home", current_id);
              wx.setStorageSync("selected_homename", current_home);
              wx.setStorageSync("selected_region", current_region);
              that.healthCheck();
              that.getDataFromScreen();
              that.weather_get();
              wx.setStorageSync("change_distributor", false);
            },
          });
        } else {
          api.user_projects({
            method: "POST",
            data: {},
            header: {
              "content-type": "application/json",
              Authorization: wx.getStorageSync("access_token"),
            },
            success: function (res) {
              if (getProjectEntities(res.data).length === 0) {
                wx.showToast({
                  title: "无项目可查看",
                  icon: "none",
                });
                that.setData({
                  show_mode: "",
                  mode_icon: 1000,
                  deviceData: "",
                  home_mode: 1,
                  homes: [],
                  homes_id: [],
                  showList: [],
                  searchedList: [],
                });

                wx.setStorageSync("haveProject", false);
              } else {
                wx.setStorageSync("haveProject", true);

                that.setData({
                  homes: [],
                  showList: [],
                  searchedList: [],
                  showname: "",
                });
                for (var i = 0; i < res.data.project_entities.length; i++) {
                  const p = res.data.project_entities[i];
                  var obj = {
                    name: p.name, // 项目名称
                    id: p.id,
                    app_name: p.app_name,
                    code: p.code, // 项目 ID（代码）
                    level: p.level, // 项目等级
                    building_type: p.building_type, // 建筑类型
                    building_area: p.building_area, // 建筑面积
                    energy_level: p.energy_level, // 节能水平
                    customer_region: p.customer_region, // 省市区
                    delivery_time: p.delivery_time, // 交付时间
                    online: p.online || false, // 确保包含 online 属性
                  };

                  that.data.homes.push(obj);
                }
                var index = wx.getStorageSync("backfromhome2")
                  ? wx.getStorageSync("home2index")
                  : 0;
                that.setData({
                  homes: that.data.homes,
                  index: index,
                  showList: wx.getStorageSync("backfromhome2")
                    ? wx.getStorageSync("home2showlist")
                    : that.data.homes,
                  searchedList: wx.getStorageSync("backfromhome2")
                    ? wx.getStorageSync("home2showlist")
                    : that.data.homes,
                });

                console.log(that.data.showList);
                first_homeid = that.data.showList[0].id;
                first_homename = that.data.showList[0].name;
                first_region = that.data.showList[0].customer_region;

                current_home = first_homename;
                current_id = first_homeid;
                current_region = first_region;

                that.setData({
                  showname: current_home,
                });

                wx.setStorageSync("selected_project_info", {
                  name: that.data.showList[0].name, // 项目名称
                  code: that.data.showList[0].code, // 项目 ID（代码）
                  level: that.data.showList[0].level, // 项目等级
                  building_type: that.data.showList[0].building_type, // 建筑类型
                  building_area: that.data.showList[0].building_area, // 建筑面积
                  energy_level: that.data.showList[0].energy_level, // 节能水平
                  customer_region: that.data.showList[0].customer_region, // 省市区
                  delivery_time: that.data.showList[0].delivery_time, // 交付时间
                  app_name: that.data.showList[0].app_name, // 应用名称
                });
                wx.setStorageSync("selected_home", current_id);
                wx.setStorageSync("selected_homename", current_home);
                wx.setStorageSync("selected_region", current_region);
                that.healthCheck();
                that.getDataFromScreen();
                that.weather_get();
              }
            },
          });
        }
      }
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

  backhome() {
    let that = this;
    that.clearTimeInterval();
    if (that.data.isXinLiangLianGong && wx.getStorageSync("current_mode") === 8) {
      wx.showToast({
        title: "供热除湿模式下不可更改",
        icon: "none",
      });
      return;
    }
    if (app.globalData.isvisitor) {
      wx.showToast({
        title: "访客模式不可操作",
        icon: "none",
      });
    } else {
      api.ctrl_home({
        method: "POST",
        header: {
          "content-type": "application/json",
          Authorization: wx.getStorageSync("access_token"),
        },
        data: {
          project_id: wx.getStorageSync("selected_home"),
          at_home: true,
        },
        success: function (res) {
          wx.showToast({
            title: "已开启在家模式",
            icon: "success",
          });
          that.setData({
            home_mode: 1,
          });
        },
      });
    }
    setTimeout(() => {
      that.onShow();
    }, 5000);
  },

  leavehome() {
    let that = this;
    that.clearTimeInterval();
    if (that.data.isXinLiangLianGong && wx.getStorageSync("current_mode") === 8) {
      wx.showToast({
        title: "供热除湿模式下不可更改",
        icon: "none",
      });
      return;
    }
    if (app.globalData.isvisitor) {
      wx.showToast({
        title: "访客模式不可操作",
        icon: "none",
      });
    } else {
      api.ctrl_home({
        method: "POST",
        header: {
          "content-type": "application/json",
          Authorization: wx.getStorageSync("access_token"),
        },
        data: {
          project_id: wx.getStorageSync("selected_home"),
          at_home: false,
        },
        success: function (res) {
          wx.showToast({
            title: "已开启离家模式",
            icon: "success",
            // image: '../../icons/lijiamoshi.png',//自定义图标的本地路径，image 的优先级高于 icon
          });
          that.setData({
            home_mode: 0,
          });
        },
      });
    }
    setTimeout(() => {
      that.onShow();
    }, 5000);
  },
  /**
   * 生命周期函数--监听页面初次渲染完成
   */
  onReady: function () {},

  /**
   * 生命周期函数--监听页面显示
   */
  onShow: function () {
    console.log("11111");
    wx.setNavigationBarTitle({
      title: "我的家",
    });

    var that = this;
    console.log(that.getTabBar);

    if (wx.getStorageSync("backfromhome2")) {
      console.log("aaa");
      console.log(that.data.show);
      that.setData({
        show: false,
      });
      var Index = wx.getStorageSync("home2index");
      var new_showlist = wx.getStorageSync("home2showlist");
      current_home = new_showlist[Index].name;
      current_id = new_showlist[Index].id;
      current_region = new_showlist[Index].customer_region;
      console.log(current_home);

      that.setData({
        index: Index,
        showname: current_home,
      });

      wx.setStorageSync("selected_project_info", {
        name: new_showlist[Index].name, // 项目名称
        code: new_showlist[Index].code, // 项目 ID（代码）
        level: new_showlist[Index].level, // 项目等级
        building_type: new_showlist[Index].building_type, // 建筑类型
        building_area: new_showlist[Index].building_area, // 建筑面积
        energy_level: new_showlist[Index].energy_level, // 节能水平
        customer_region: new_showlist[Index].customer_region, // 省市区
        delivery_time: new_showlist[Index].delivery_time, // 交付时间
        app_name: new_showlist[Index].app_name, // 应用名称
      });
      wx.setStorageSync("selected_home", current_id);
      wx.setStorageSync("selected_homename", current_home);
      wx.setStorageSync("selected_region", current_region);

      that.healthCheck();
      that.getDataFromScreen();

      var obj = wx.createSelectorQuery();
      obj.selectAll(".select_text").boundingClientRect(function (rect) {
        // console.log(rect[0].height);
        // console.log(rect[0].width);
      });
      obj.exec();

      // 最后，将"backfromhome2"标记设置为false
      wx.setStorageSync("backfromhome2", false);
    }

    if (typeof that.getTabBar === "function" && that.getTabBar()) {
      that.getTabBar().setData({
        selected: 0,
      });
    }

    let backData = wx.getStorageSync("backData");
    if (backData) {
      that.setData({
        mode_icon: wx.getStorageSync("mode_icon"),
        show_mode: wx.getStorageSync("show_mode"),
      });

      wx.removeStorageSync("backData");
      // wx.removeStorageSync("changeModeName");
    }

    if (
      wx.getStorageSync("isAdmin") &&
      wx.getStorageSync("change_distributor")
    ) {
      wx.setStorageSync("haveProject", true);
      api.distributor_id_projects({
        method: "POST",
        data: {
          page_options: {
            page: 1,
            limit: 10000,
          },
          distributor_id: wx.getStorageSync("current_distributorid"),
        },
        header: {
          "content-type": "application/json",
          Authorization: wx.getStorageSync("access_token"),
        },
        success: function (res) {
          console.log(res);
          if (getProjectEntities(res.data).length === 0) {
            wx.setStorageSync("haveProject", false);
            that.setData({
              homes: [],
              showList: [],
              searchedList: [],
              showname: "",
            });
            wx.showToast({ title: "无项目可查看", icon: "none" });
            return;
          }
          that.setData({
            homes: [],
            showList: [],
            searchedList: [],
            showname: "",
          });
          // 分离在线和离线项目
          var onlineProjects = [];
          var offlineProjects = [];

          for (var i = 0; i < res.data.project_entities.length; i++) {
            var project = res.data.project_entities[i];
            if (project.online) {
              onlineProjects.push(project);
            } else {
              offlineProjects.push(project);
            }
          }

          // 对在线项目排序，将“通用版”放在最前面
          onlineProjects.sort(function (a, b) {
            if (a.app_name === "通用版") {
              return -1;
            } else if (b.app_name === "通用版") {
              return 1;
            } else {
              return 0;
            }
          });

          // 合并排序后的在线和离线项目
          var sortedProjects = onlineProjects.concat(offlineProjects);

          // 处理排序后的项目列表
          for (var i = 0; i < sortedProjects.length; i++) {
            const p = sortedProjects[i];
            var obj = {
              name: p.name, // 项目名称
              id: p.id,
              app_name: p.app_name,
              code: p.code, // 项目 ID（代码）
              level: p.level, // 项目等级
              building_type: p.building_type, // 建筑类型
              building_area: p.building_area, // 建筑面积
              energy_level: p.energy_level, // 节能水平
              customer_region: p.customer_region, // 省市区
              delivery_time: p.delivery_time, // 交付时间
              online: p.online || false, // 确保包含 online 属性
            };
            that.data.homes.push(obj);
          }
          that.setData({
            homes: that.data.homes,
            index: 0,
          });
          that.setData({
            showList: that.data.homes,
            searchedList: that.data.homes,
          });
          console.log(that.data.showList);
          first_homeid = that.data.homes[0].id;
          first_homename = that.data.homes[0].name;
          first_region = that.data.homes[0].customer_region;

          current_home = first_homename;
          current_id = first_homeid;
          current_region = first_region;

          that.setData({
            showname: current_home,
          });

          wx.setStorageSync("selected_project_info", {
            name: that.data.showList[0].name, // 项目名称
            code: that.data.showList[0].code, // 项目 ID（代码）
            level: that.data.showList[0].level, // 项目等级
            building_type: that.data.showList[0].building_type, // 建筑类型
            building_area: that.data.showList[0].building_area, // 建筑面积
            energy_level: that.data.showList[0].energy_level, // 节能水平
            customer_region: that.data.showList[0].customer_region, // 省市区
            delivery_time: that.data.showList[0].delivery_time, // 交付时间
            app_name: that.data.showList[0].app_name, // 应用名称
          });
          wx.setStorageSync("selected_home", current_id);
          wx.setStorageSync("selected_homename", current_home);
          wx.setStorageSync("selected_region", current_region);

          that.healthCheck();
          that.getDataFromScreen();
        },
      });
    } else if (
      wx.getStorageSync("isAdmin") &&
      !wx.getStorageSync("change_distributor")
    ) {
      console.log("管理员切换房间");
      api.distributor_id_projects({
        method: "POST",
        data: {
          page_options: {
            page: 1,
            limit: 10000,
          },
          distributor_id: wx.getStorageSync("current_distributorid"),
        },
        header: {
          "content-type": "application/json",
          Authorization: wx.getStorageSync("access_token"),
        },
        success: function (res) {
          wx.setStorageSync("haveProject", true);
          that.healthCheck();
          that.getDataFromScreen();
        },
      });
    }

    if (that.data.refreshInterval) {
      // 如果已经有一个刷新定时器在运行，就不再设置新的定时器
      return;
    }

    that.data.refreshInterval = setInterval(function () {
      console.log(app.globalData.isvisitor);
      if (that.data.skipRefresh) {
        return;
      }
      if (app.globalData.isvisitor && !app.globalData.isdistributor_visitor) {
        api.distributor_projects({
          method: "POST",
          data: {},
          header: {
            "content-type": "application/json",
            Authorization: wx.getStorageSync("access_token"),
          },
          success: function (res) {
            console.log(res);
            if (getProjectEntities(res.data).length === 0) {
              wx.showToast({
                title: "无项目可查看",
                icon: "none",
              });

              that.setData({
                show_mode: "",
                mode_icon: 1000,
                deviceData: "",
                home_mode: 1,
                homes: [],
                showList: [],
                searchedList: [],
              });

              wx.setStorageSync("haveProject", false);
            } else {
              wx.setStorageSync("haveProject", true);

              that.healthCheck();
              that.getDataFromScreen();
            }
          },
        });
      } else if (
        app.globalData.isvisitor &&
        app.globalData.isdistributor_visitor
      ) {
        console.log("yyyyyyyyy");
        api.vistor_projects({
          method: "POST",
          data: {},
          header: {
            "content-type": "application/json",
            Authorization: wx.getStorageSync("access_token"),
          },
          success: function (res) {
            if (getProjectEntities(res.data).length === 0) {
              wx.showToast({
                title: "无项目可查看",
                icon: "none",
              });
              that.setData({
                show_mode: "",
                mode_icon: 1000,
                deviceData: "",
                home_mode: 1,
                homes: [],
                homes_id: [],
                showList: [],
                searchedList: [],
              });

              wx.setStorageSync("haveProject", false);
            } else {
              wx.setStorageSync("haveProject", true);

              that.healthCheck();
              that.getDataFromScreen();
            }
          },
        });
      } else {
        if (wx.getStorageSync("isAdmin")) {
          console.log("1111");
          api.distributor_id_projects({
            method: "POST",
            data: {
              page_options: {
                page: 1,
                limit: 10000,
              },
              distributor_id: wx.getStorageSync("current_distributorid"),
            },
            header: {
              "content-type": "application/json",
              Authorization: wx.getStorageSync("access_token"),
            },
            success: function (res) {
              wx.setStorageSync("haveProject", true);

              that.healthCheck();
              that.getDataFromScreen();
            },
          });
        } else {
          api.user_projects({
            method: "POST",
            data: {},
            header: {
              "content-type": "application/json",
              Authorization: wx.getStorageSync("access_token"),
            },
            success: function (res) {
              console.log("xxxxxxxxxxxxxxxxx");
              console.log(res);
              if (getProjectEntities(res.data).length === 0) {
                wx.showToast({
                  title: "无项目可查看",
                  icon: "none",
                });
                that.setData({
                  show_mode: "",
                  mode_icon: 1000,
                  deviceData: "",
                  home_mode: 1,
                  homes: [],
                  showList: [],
                  searchedList: [],
                });
                wx.setStorageSync("haveProject", false);
              } else {
                wx.setStorageSync("haveProject", true);
                that.healthCheck();
                that.getDataFromScreen();
              }
            },
          });
        }
      }
    }, 5000);
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
    var that = this;
    that.clearTimeInterval(that);
  },

  /**
   * 生命周期函数--监听页面卸载
   */
  onUnload: function () {
    var that = this;
    that.clearTimeInterval(that);
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
