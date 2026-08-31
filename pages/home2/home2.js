let first_homeid = "";
let first_homename = "";
let current_home = "";
let current_id = null;
var app = getApp();
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
    showname: "",
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
    let originalIndex = that.data.showList.findIndex(item => item.name === selectedItem.name);

    if (that.data.searchedList[searchedIndex].app_name != "单机版") {
      console.log("11111");
      that.setData({ show: !that.data.show });
      wx.setStorageSync("isSingle", false);
      wx.setStorageSync("backfromhome2", true);
      wx.setStorageSync("home2index", originalIndex);
      wx.setStorageSync("home2showlist", that.data.showList);
      app.globalData.userInfo = { userName: "role1", role: 1 };
      app.switchTabWithRole(1);
    } else {
      console.log("22222");
      wx.setStorageSync("isSingle", true);
      current_home = that.data.showList[originalIndex].name;
      current_id = that.data.showList[originalIndex].id;
      console.log(current_home);

      that.setData({
        index: searchedIndex,
        show: !that.data.show,
        showname: current_home,
      });

      wx.setStorageSync("selected_project_info", {
                name:           that.data.showList[originalIndex].name,          // 项目名称
                code:           that.data.showList[originalIndex].code,          // 项目 ID（代码）
                level:          that.data.showList[originalIndex].level,         // 项目等级
                building_type:  that.data.showList[originalIndex].building_type, // 建筑类型
                building_area:  that.data.showList[originalIndex].building_area, // 建筑面积
                energy_level:   that.data.showList[originalIndex].energy_level,  // 节能水平
                customer_region:that.data.showList[originalIndex].customer_region,// 省市区
                delivery_time:  that.data.showList[originalIndex].delivery_time  // 交付时间
              });
      wx.setStorageSync("selected_home", current_id);
      wx.setStorageSync("selected_homename", current_home);

      that.healthCheck();
      that.getDataFromScreen();

      var obj = wx.createSelectorQuery();
      obj.selectAll(".select_text").boundingClientRect(function (rect) {
        console.log(rect[0].height);
        console.log(rect[0].width);
      });
      obj.exec();
    }
  },

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
      this._screenRequestPending = false;
    }
  },

    //当前界面拿到页面输入的值
    getProject:function(project){   
      var that = this 
      // console.log(project)
      if(project.detail.value===""){
        that.setData({
          searchedList: that.data.homes
        })
      }else{
        that.setData({
          searchedList: that.searchStr(project.detail.value, that.data.homes)
        })
      
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
    console.log("iiiiiiii")
    that.setData({
      isvisitor: app.globalData.isvisitor,
    });

    if (wx.getStorageSync("backfromhome1")) {
      console.log(that.data.show);
      that.setData({
        show: false,
      });
      var Index = wx.getStorageSync("home1index");
      var new_showlist = wx.getStorageSync("home1showlist");
      current_home = new_showlist[Index].name;
      current_id = new_showlist[Index].id;
      console.log(current_home);

      that.setData({
        index: Index,
        showname: current_home,
        homes:wx.getStorageSync("home1showlist"),
        showList: wx.getStorageSync("home1showlist"),
        searchedList: wx.getStorageSync("home1showlist"),
      });

      wx.setStorageSync("selected_project_info", {
                name:           new_showlist[Index].name,          // 项目名称
                code:           new_showlist[Index].code,          // 项目 ID（代码）
                level:          new_showlist[Index].level,         // 项目等级
                building_type:  new_showlist[Index].building_type, // 建筑类型
                building_area:  new_showlist[Index].building_area, // 建筑面积
                energy_level:   new_showlist[Index].energy_level,  // 节能水平
                customer_region:new_showlist[Index].customer_region,// 省市区
                delivery_time:  new_showlist[Index].delivery_time  // 交付时间
              });
      wx.setStorageSync("selected_home", current_id);
      wx.setStorageSync("selected_homename", current_home);

      that.healthCheck();
      that.getDataFromScreen();
      console.log("55555");

      var obj = wx.createSelectorQuery();
      obj.selectAll(".select_text").boundingClientRect(function (rect) {
        console.log(rect[0].height);
        console.log(rect[0].width);
      });
      obj.exec();
      console.log(that.data.homes)
    } else {
      if (app.globalData.isvisitor&&!app.globalData.isdistributor_visitor) {
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
                searchedList:[],
              });

              wx.setStorageSync("haveProject", false);
            } else {
              wx.setStorageSync("haveProject", true);

              that.setData({
                homes: [],
                showList: [],
                searchedList:[],
                showname: "",
              });
              // 先对 project_entities 进行排序
              res.data.project_entities.sort(function (a, b) {
                if (a.app_name === "通用版") {
                  return -1;
                } else if (b.app_name === "通用版") {
                  return 1;
                } else {
                  return 0;
                }
              });
              for (var i = 0; i < res.data.project_entities.length; i++) {
                const p = res.data.project_entities[i];
                var obj = {
                 name: p.name,                   // 项目名称
                  id: p.id,
                   app_name: p.app_name,
                  code: p.code,                   // 项目 ID（代码）
                  level: p.level,                 // 项目等级
                  building_type: p.building_type, // 建筑类型
                  building_area: p.building_area, // 建筑面积
                  energy_level: p.energy_level,   // 节能水平
                  customer_region: p.customer_region, // 省市区
                  delivery_time: p.delivery_time, // 交付时间
                };
                that.data.homes.push(obj);
              }
              var index = wx.getStorageSync("backfromhome1")
                  ? wx.getStorageSync("home1index")
                  : 0;
                console.log(that.data.homes);
                that.setData({
                  homes: that.data.homes,
                  index: index,
                  showList: wx.getStorageSync("backfromhome1")
                    ? wx.getStorageSync("home1showlist")
                    : that.data.homes,
                    searchedList:wx.getStorageSync("backfromhome1")
                    ? wx.getStorageSync("home1showlist")
                    : that.data.homes,
                });

                console.log(that.data.showList);
                first_homeid = that.data.showList[index].id;
                first_homename = that.data.showList[index].name;

                current_home = first_homename;
                current_id = first_homeid;

                that.setData({
                  showname: current_home,
                });

                wx.setStorageSync("selected_project_info", {
                name:           that.data.showList[index].name,          // 项目名称
                code:           that.data.showList[index].code,          // 项目 ID（代码）
                level:          that.data.showList[index].level,         // 项目等级
                building_type:  that.data.showList[index].building_type, // 建筑类型
                building_area:  that.data.showList[index].building_area, // 建筑面积
                energy_level:   that.data.showList[index].energy_level,  // 节能水平
                customer_region:that.data.showList[index].customer_region,// 省市区
                delivery_time:  that.data.showList[index].delivery_time  // 交付时间
              });
                wx.setStorageSync("selected_home", current_id);
                wx.setStorageSync("selected_homename", current_home);
                console.log(wx.getStorageSync("selected_homename"));
                that.healthCheck();
                that.getDataFromScreen();
            }
          },
        });
      }else if(app.globalData.isvisitor&&app.globalData.isdistributor_visitor){
        api.visitor_projects({
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
                searchedList:[],
              });

              wx.setStorageSync("haveProject", false);
            } else {
              wx.setStorageSync("haveProject", true);

              that.setData({
                homes: [],
                showList: [],
                searchedList:[],
                showname: "",
              });
              // 先对 project_entities 进行排序
              res.data.project_entities.sort(function (a, b) {
                if (a.app_name === "通用版") {
                  return -1;
                } else if (b.app_name === "通用版") {
                  return 1;
                } else {
                  return 0;
                }
              });
              for (var i = 0; i < res.data.project_entities.length; i++) {
                const p = res.data.project_entities[i];
                var obj = {
                 name: p.name,                   // 项目名称
                  id: p.id,
                   app_name: p.app_name,
                  code: p.code,                   // 项目 ID（代码）
                  level: p.level,                 // 项目等级
                  building_type: p.building_type, // 建筑类型
                  building_area: p.building_area, // 建筑面积
                  energy_level: p.energy_level,   // 节能水平
                  customer_region: p.customer_region, // 省市区
                  delivery_time: p.delivery_time, // 交付时间
                };
                that.data.homes.push(obj);
              }
              var index = wx.getStorageSync("backfromhome1")
                  ? wx.getStorageSync("home1index")
                  : 0;
                console.log(that.data.homes);
                that.setData({
                  homes: that.data.homes,
                  index: index,
                  showList: wx.getStorageSync("backfromhome1")
                    ? wx.getStorageSync("home1showlist")
                    : that.data.homes,
                    searchedList:wx.getStorageSync("backfromhome1")
                    ? wx.getStorageSync("home1showlist")
                    : that.data.homes,
                });

                console.log(that.data.showList);
                first_homeid = that.data.showList[index].id;
                first_homename = that.data.showList[index].name;

                current_home = first_homename;
                current_id = first_homeid;

                that.setData({
                  showname: current_home,
                });

                wx.setStorageSync("selected_project_info", {
                name:           that.data.showList[index].name,          // 项目名称
                code:           that.data.showList[index].code,          // 项目 ID（代码）
                level:          that.data.showList[index].level,         // 项目等级
                building_type:  that.data.showList[index].building_type, // 建筑类型
                building_area:  that.data.showList[index].building_area, // 建筑面积
                energy_level:   that.data.showList[index].energy_level,  // 节能水平
                customer_region:that.data.showList[index].customer_region,// 省市区
                delivery_time:  that.data.showList[index].delivery_time  // 交付时间
              });
                wx.setStorageSync("selected_home", current_id);
                wx.setStorageSync("selected_homename", current_home);
                console.log(wx.getStorageSync("selected_homename"));
                that.healthCheck();
                that.getDataFromScreen();
            }
          },
        });
      } else {
        if (wx.getStorageSync("isAdmin")) {
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
                searchedList:[],
                showname: "",
              });
              // 先对 project_entities 进行排序
              res.data.project_entities.sort(function (a, b) {
                if (a.app_name === "通用版") {
                  return -1;
                } else if (b.app_name === "通用版") {
                  return 1;
                } else {
                  return 0;
                }
              });
              for (var i = 0; i < res.data.project_entities.length; i++) {
                const p = res.data.project_entities[i];
                var obj = {
                 name: p.name,                   // 项目名称
                  id: p.id,
                   app_name: p.app_name,
                  code: p.code,                   // 项目 ID（代码）
                  level: p.level,                 // 项目等级
                  building_type: p.building_type, // 建筑类型
                  building_area: p.building_area, // 建筑面积
                  energy_level: p.energy_level,   // 节能水平
                  customer_region: p.customer_region, // 省市区
                  delivery_time: p.delivery_time, // 交付时间
                };
                that.data.homes.push(obj);
              }
              var index = wx.getStorageSync("backfromhome1")
                ? wx.getStorageSync("home1index")
                : 0;
              console.log(that.data.homes);
              that.setData({
                homes: that.data.homes,
                index: index,
                showList: wx.getStorageSync("backfromhome1")
                  ? wx.getStorageSync("home1showlist")
                  : that.data.homes,
                  searchedList:wx.getStorageSync("backfromhome1")
                  ? wx.getStorageSync("home1showlist")
                  : that.data.homes,
              });

              console.log(that.data.showList);
              first_homeid = that.data.showList[index].id;
              first_homename = that.data.showList[index].name;

              current_home = first_homename;
              current_id = first_homeid;

              that.setData({
                showname: current_home,
              });

              wx.setStorageSync("selected_project_info", {
                name:           that.data.showList[index].name,          // 项目名称
                code:           that.data.showList[index].code,          // 项目 ID（代码）
                level:          that.data.showList[index].level,         // 项目等级
                building_type:  that.data.showList[index].building_type, // 建筑类型
                building_area:  that.data.showList[index].building_area, // 建筑面积
                energy_level:   that.data.showList[index].energy_level,  // 节能水平
                customer_region:that.data.showList[index].customer_region,// 省市区
                delivery_time:  that.data.showList[index].delivery_time  // 交付时间
              });
              wx.setStorageSync("selected_home", current_id);
              wx.setStorageSync("selected_homename", current_home);
              console.log(wx.getStorageSync("selected_homename"));
              that.healthCheck();
              that.getDataFromScreen();
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
                  searchedList:[]
                });

                wx.setStorageSync("haveProject", false);
              } else {
                wx.setStorageSync("haveProject", true);

                that.setData({
                  homes: [],
                  showList: [],
                  searchedList:[],
                  showname: "",
                });
                for (var i = 0; i < res.data.project_entities.length; i++) {
                  const p = res.data.project_entities[i];
                var obj = {
                 name: p.name,                   // 项目名称
                  id: p.id,
                   app_name: p.app_name,
                  code: p.code,                   // 项目 ID（代码）
                  level: p.level,                 // 项目等级
                  building_type: p.building_type, // 建筑类型
                  building_area: p.building_area, // 建筑面积
                  energy_level: p.energy_level,   // 节能水平
                  customer_region: p.customer_region, // 省市区
                  delivery_time: p.delivery_time, // 交付时间
                };
                  that.data.homes.push(obj);
                }
                var index = wx.getStorageSync("backfromhome1")
                  ? wx.getStorageSync("home1index")
                  : 0;
                console.log(that.data.homes);
                that.setData({
                  homes: that.data.homes,
                  index: index,
                  showList: wx.getStorageSync("backfromhome1")
                    ? wx.getStorageSync("home1showlist")
                    : that.data.homes,
                    searchedList:wx.getStorageSync("backfromhome1")
                    ? wx.getStorageSync("home1showlist")
                    : that.data.homes,
                });

                console.log(that.data.showList);
                first_homeid = that.data.showList[index].id;
                first_homename = that.data.showList[index].name;

                current_home = first_homename;
                current_id = first_homeid;

                that.setData({
                  showname: current_home,
                });

                wx.setStorageSync("selected_project_info", {
                name:           that.data.showList[index].name,          // 项目名称
                code:           that.data.showList[index].code,          // 项目 ID（代码）
                level:          that.data.showList[index].level,         // 项目等级
                building_type:  that.data.showList[index].building_type, // 建筑类型
                building_area:  that.data.showList[index].building_area, // 建筑面积
                energy_level:   that.data.showList[index].energy_level,  // 节能水平
                customer_region:that.data.showList[index].customer_region,// 省市区
                delivery_time:  that.data.showList[index].delivery_time  // 交付时间
              });
                wx.setStorageSync("selected_home", current_id);
                wx.setStorageSync("selected_homename", current_home);
                console.log(wx.getStorageSync("selected_homename"));
                that.healthCheck();
                that.getDataFromScreen();
              }
            },
          });
        }
      }
    }
  },

  backhome() {
    let that = this;
    that.clearTimeInterval();
    if (app.globalData.isvisitor) {
      wx.showToast({
        title: "访客模式不可操作",
        icon: "none",
      });
    } else {
      api.ctrl_mode({
        method: "POST",
        header: {
          "content-type": "application/json",
          Authorization: wx.getStorageSync("access_token"),
        },
        data: {
          project_id: wx.getStorageSync("selected_home"),
          target_mode: 1000,
          target_mode_desc: "开机",
        },
        success: function () {
          that.setData({ home_mode: 1 });
          that.getDataFromScreen();
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
    if (app.globalData.isvisitor) {
      wx.showToast({
        title: "访客模式不可操作",
        icon: "none",
      });
    } else {
      api.ctrl_mode({
        method: "POST",
        header: {
          "content-type": "application/json",
          Authorization: wx.getStorageSync("access_token"),
        },
        data: {
          project_id: wx.getStorageSync("selected_home"),
          target_mode: -1,
          target_mode_desc: "关机",
        },
        success: function () {
          that.setData({
            home_mode: 0,
          });
          that.getDataFromScreen();
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
    var that = this;
    console.log(that.getTabBar());
    wx.setNavigationBarTitle({
      title: "我的家",
    });

    if (wx.getStorageSync("backfromhome1")) {
      console.log("aaa");
      console.log(that.data.show);
      that.setData({
        show: false,
      });
      var Index = wx.getStorageSync("home1index");
      var new_showlist = wx.getStorageSync("home1showlist");
      current_home = new_showlist[Index].name;
      current_id = new_showlist[Index].id;
      console.log(current_home);

      that.setData({
        index: Index,
        showname: current_home,
        homes:wx.getStorageSync("home1showlist"),
      });

      wx.setStorageSync("selected_project_info", {
                name:           new_showlist[Index].name,          // 项目名称
                code:           new_showlist[Index].code,          // 项目 ID（代码）
                level:          new_showlist[Index].level,         // 项目等级
                building_type:  new_showlist[Index].building_type, // 建筑类型
                building_area:  new_showlist[Index].building_area, // 建筑面积
                energy_level:   new_showlist[Index].energy_level,  // 节能水平
                customer_region:new_showlist[Index].customer_region,// 省市区
                delivery_time:  new_showlist[Index].delivery_time  // 交付时间
              });
      wx.setStorageSync("selected_home", current_id);
      wx.setStorageSync("selected_homename", current_home);

      that.healthCheck();
      that.getDataFromScreen();
      console.log("55555");

      var obj = wx.createSelectorQuery();
      obj.selectAll(".select_text").boundingClientRect(function (rect) {
        console.log(rect[0].height);
        console.log(rect[0].width);
      });
      obj.exec();
      console.log(that.data.homes)
      wx.setStorageSync("backfromhome1", false);
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
            searchedList:[],
            showname: "",
          });
          // 先对 project_entities 进行排序
          res.data.project_entities.sort(function (a, b) {
            if (a.app_name === "通用版") {
              return -1;
            } else if (b.app_name === "通用版") {
              return 1;
            } else {
              return 0;
            }
          });
          for (var i = 0; i < res.data.project_entities.length; i++) {
            const p = res.data.project_entities[i];
                var obj = {
                 name: p.name,                   // 项目名称
                  id: p.id,
                   app_name: p.app_name,
                  code: p.code,                   // 项目 ID（代码）
                  level: p.level,                 // 项目等级
                  building_type: p.building_type, // 建筑类型
                  building_area: p.building_area, // 建筑面积
                  energy_level: p.energy_level,   // 节能水平
                  customer_region: p.customer_region, // 省市区
                  delivery_time: p.delivery_time, // 交付时间
                };
            that.data.homes.push(obj);
          }
          that.setData({
            homes: that.data.homes,
            index: 0,
          });
          that.setData({
            showList: that.data.homes,
            searchedList:that.data.homes,
          });
          console.log(that.data.showList);
          first_homeid = that.data.homes[0].id;
          first_homename = that.data.homes[0].name;

          current_home = first_homename;
          current_id = first_homeid;

          that.setData({
            showname: current_home,
          });

          wx.setStorageSync("selected_project_info", {
                name:           that.data.showList[0].name,          // 项目名称
                code:           that.data.showList[0].code,          // 项目 ID（代码）
                level:          that.data.showList[0].level,         // 项目等级
                building_type:  that.data.showList[0].building_type, // 建筑类型
                building_area:  that.data.showList[0].building_area, // 建筑面积
                energy_level:   that.data.showList[0].energy_level,  // 节能水平
                customer_region:that.data.showList[0].customer_region,// 省市区
                delivery_time:  that.data.showList[0].delivery_time  // 交付时间
              });
          wx.setStorageSync("selected_home", current_id);
          wx.setStorageSync("selected_homename", current_home);

          that.healthCheck();
          that.getDataFromScreen();
        },
      });
    } else if (
      wx.getStorageSync("isAdmin") &&
      !wx.getStorageSync("change_distributor") &&
      !wx.getStorageSync("backfromhome1")
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
      if (app.globalData.isvisitor&&!app.globalData.isdistributor_visitor) {
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
                searchedList:[]
              });

              wx.setStorageSync("haveProject", false);
            } else {
              wx.setStorageSync("haveProject", true);

              that.healthCheck();
              that.getDataFromScreen();
              console.log("88888");
            }
          },
        });
      }else if(app.globalData.isvisitor&&app.globalData.isdistributor_visitor){
        api.visitor_projects({
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
                searchedList:[]
              });

              wx.setStorageSync("haveProject", false);
            } else {
              wx.setStorageSync("haveProject", true);

              that.healthCheck();
              that.getDataFromScreen();
              console.log("88888");
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
                  searchedList:[],
                });
                wx.setStorageSync("haveProject", false);
              } else {
                wx.setStorageSync("haveProject", true);
                that.healthCheck();
                that.getDataFromScreen();
                console.log("00000");
              }
            },
          });
        }
      }
    }, 5000);
    // that.setData({
    //   interval: interval,
    // });
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
    var that = this;
    that.clearTimeInterval();
  },

  /**
   * 生命周期函数--监听页面卸载
   */
  onUnload: function () {
    var that = this;
    that.clearTimeInterval();
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
