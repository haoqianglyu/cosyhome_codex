// pages/roomdetail/roomdetail.js
import * as echarts from "../../ec-canvas/echarts";
import api from "../../api/api.js";
import { legacyControlMessageBody } from "../../utils/controlMessage.js";
import {
  apiRequest,
  getErrorMessage,
  isCurrentPage,
} from "../../utils/request.js";
var app = getApp();
let barChart1 = null;
Page({
  /**
   * 页面的初始数据
   */
  data: {
    switch_power: null,
    switch_lock: null,
    switch1: null,
    num: 25,
    // 使用data数据对象设置样式名
    minusStatus: "true",
    plusStatus: "true",
    windowHeight: null,
    windowWidth: null,
    isvisitor: false,
    ec1: {
      disableTouch: false,
      lazyLoad: true,
    },
    windLevels: [], // 风速级别数组
    currentButton: 0, // 当前选中的风速
    windLevelNumber: null, // 风速级别数
    isAutoWindLevel: false, // 是否有自动风速

    roomId: "",
    roomdata: "",
    panelState: 1,
    roomName: "",
    realtemp: "",
    settemp: "",
    realhumidity: "",
    realdewtemp: "",
    roomConfigCategoryName: "",
    energyMode: "",
    refreshInterval: null, // 用于保存刷新定时器的ID
    maxTemperatureSet: null,
    minTemperatureSet: null,

    temperature_array: [],
    humidity_array: [],
    CO2_array: [],
    PM2_5_array: [],
    dewPoint_array: [],
    time_array: [],

    temperature_arraytemp: [],
    humidity_arraytemp: [],
    CO2_arraytemp: [],
    PM2_5_arraytemp: [],
    dewPoint_arraytemp: [],
    canOff: false,
    roomMode: null,
    sliderable: true,
    //可以通过hidden是否掩藏弹出框的属性，来指定那个弹出框
    // modifyName :""
    interval: "", //定时器
    ecoTemperature: "",
    showtemp: "",
    workModes: [],
    isHeatingDehumidify: false,
    airConditionerModeName: "",
    isXLLG: false,
    statusBarHeight: 0,
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad: function (options) {
    var that = this;
    const windowInfo =
      typeof wx.getWindowInfo === "function"
        ? wx.getWindowInfo()
        : wx.getSystemInfoSync();
    const roomID = String((options && options.roomID) || "").trim();
    let roomName = String((options && options.roomName) || "房间");
    try {
      roomName = decodeURIComponent(roomName);
    } catch (error) {
      roomName = "房间";
    }
    if (!roomID) {
      wx.showToast({ title: "缺少房间编号", icon: "none" });
      wx.nextTick(() => wx.navigateBack({ delta: 1 }));
      return;
    }
    that.setData({
      isvisitor: app.globalData.isvisitor,
      roomId: roomID,
      roomName,
      windowHeight: wx.getStorageSync("windowHeight"),
      windowWidth: wx.getStorageSync("windowWidth"),
      statusBarHeight: windowInfo.statusBarHeight || 0,
    });

    // 判断是否为"新两联供"项目的供热除湿模式
    var projectInfo = wx.getStorageSync("selected_project_info");
    var isXLLG = projectInfo && projectInfo.app_name === "新两联供";
    var currentMode = wx.getStorageSync("current_mode");
    that.setData({
      isXLLG: isXLLG,
      isHeatingDehumidify: isXLLG && currentMode === 8,
      airConditionerModeName: wx.getStorageSync("airConditionerModeName") || "",
    });

    this.loadHistory();
  },

  async loadHistory() {
    if (!this.data.roomId) return;
    wx.showLoading({ title: "正在加载数据" });
    try {
      const body = await legacyControlMessageBody({
        messageType: 4,
        body: this.data.roomId,
      });
      const records = Array.isArray(body) ? body.slice(-200) : [];
      const temperatures = records.map((item) => item.temperature);
      const humidities = records.map((item) => item.humidity);
      const co2Values = records.map((item) => item.co2);
      const pm25Values = records.map((item) => item.pm2_5);
      const dewPoints = records.map((item) => item.dewPoint);

      this.setData({
        temperature_arraytemp: temperatures,
        humidity_arraytemp: humidities,
        CO2_arraytemp: co2Values,
        PM2_5_arraytemp: pm25Values,
        dewPoint_arraytemp: dewPoints,
        time_array: records.map((item) =>
          String(item.dateFormat || "").slice(-2),
        ),
        temperature_array: this.ArrayNoHundred(temperatures),
        humidity_array: this.ArrayNoHundred(humidities),
        CO2_array: this.ArrayNoHundred(co2Values),
        PM2_5_array: this.ArrayNoHundred(pm25Values),
        dewPoint_array: this.ArrayNoHundred(dewPoints),
      });
      this.getChartData();
    } catch (error) {
      console.error("房间历史数据获取失败", error);
    } finally {
      wx.hideLoading();
    }
  },

  async loadRoomStatus() {
    if (this._statusRequestPending || !this.data.roomId) {
      return;
    }
    this._statusRequestPending = true;
    try {
      const body = await legacyControlMessageBody({
        messageType: 3,
        body: this.data.roomId,
      });
      if (!body || typeof body !== "object") {
        return;
      }
      const currentButton =
        body.windLevel === 100 ? 100 : Math.max(Number(body.windLevel) - 1, 0);
      const setTemperature =
        body.roomMode === 0
          ? body.tempOfRefrigeration
          : body.tempOfHeating;
      const showTemperature =
        body.ecoTemperature === undefined || body.energyMode !== 1
          ? setTemperature
          : body.ecoTemperature;
      const windLevelNumber = Math.min(
        Math.max(Math.floor(Number(body.windLevelNumber) || 0), 0),
        10,
      );
      this.setData({
        canOff: body.canOff,
        maxTemperatureSet: body.maxTemperatureSet,
        minTemperatureSet: body.minTemperatureSet,
        roomName: body.roomName || this.data.roomName,
        realtemp: body.roomTemp,
        realhumidity: body.roomHumidity,
        realdewtemp: body.roomDewTemp,
        roomConfigCategoryName: body.roomConfigCategoryName,
        energyMode: body.energyMode,
        roomMode: body.roomMode,
        sliderable: body.roomMode !== 2,
        settemp: setTemperature,
        showtemp: showTemperature,
        panelState: body.panelState,
        switch1: body.panelState,
        switch_lock: body.panelIsLock,
        switch_power: body.energyMode,
        ecoTemperature: body.ecoTemperature,
        workModes: Array.isArray(body.workModes) ? body.workModes : [],
        windLevelNumber,
        isAutoWindLevel: body.isAutoWindLevel,
        currentButton,
        minusStatus:
          Number(showTemperature) <= Number(body.minTemperatureSet)
            ? "disabled"
            : "normal",
        plusStatus:
          Number(showTemperature) >= Number(body.maxTemperatureSet)
            ? "disabled"
            : "normal",
        windLevels: Array.from(
          { length: windLevelNumber },
          (_, index) => index,
        ),
      });
    } catch (error) {
      console.error("房间状态获取失败", error);
    } finally {
      this._statusRequestPending = false;
    }
  },

  toggleSelection: async function (e) {
    this.clearTimeInterval();
    if (app.globalData.isvisitor) {
      wx.showToast({
        title: "访客模式不可操作",
        icon: "none",
      });
      this.startRoomPolling();
      return;
    }
    if (this._workModePending) return;
    const index = Number(e.currentTarget.dataset.index);
    const item = this.data.workModes[index];
    if (!item) return;
    if (!item.isChange) {
      wx.showToast({ title: "不可修改", icon: "none" });
      return;
    }
    if (item.isSelect && this.getSelectedCount() === 1) {
      wx.showToast({ title: "至少选择一项", icon: "none" });
      return;
    }
    const previousModes = this.data.workModes;
    const workModes = previousModes.map((mode, modeIndex) =>
      modeIndex === index ? { ...mode, isSelect: !mode.isSelect } : mode,
    );
    this._workModePending = true;
    this.setData({ workModes });
    try {
      await apiRequest(api.trans_ctrl_message, {
        method: "POST",
        header: {
          "content-type": "application/json",
          Authorization: wx.getStorageSync("access_token"),
        },
        data: {
          project_id: wx.getStorageSync("selected_home"),
          body: JSON.stringify({ id: this.data.roomId, workModes }),
          message_type: 14,
        },
      });
      if (isCurrentPage(this)) this.refreshRoomStatus();
    } catch (error) {
      if (isCurrentPage(this)) {
        this.setData({ workModes: previousModes });
        wx.showToast({ title: getErrorMessage(error), icon: "none" });
      }
    } finally {
      this._workModePending = false;
    }
  },

  getSelectedCount: function () {
    var that = this;
    return that.data.workModes.filter((item) => item.isSelect).length;
  },

  init_echarts1: function (chartData) {
    this.chart1Componnet = this.selectComponent("#mychart1"); //去获取echarts    这里的id就是echarts的id
    if (!this.chart1Componnet) return;
    // console.log(this.chart1Componnet)
    this.chart1Componnet.init((canvas, width, height, dpr) => {
      // 初始化图表
      barChart1 = echarts.init(canvas, null, {
        //echarts会继承父元素的宽高
        width: width,
        height: height,
        devicePixelRatio: dpr, // 像素
      });

      wx.showNavigationBarLoading();
      barChart1.showLoading({ text: "正在加载数据" });
      barChart1.setOption(this.getBarOption1(chartData));
      barChart1.hideLoading();
      wx.hideNavigationBarLoading();
      

      return barChart1; //一定要return出去
    });
  },

  getBarOption1: function (chartData) {
    var option = {
      color: ["#3398DB", "#EB5E5E"],
      title: {
        padding: [10, 20, 100, 100],
        left: "center",
        text: chartData.title,
      },
      grid: {
        top: "30%",
        left: "3%",
        right: "4%",
        bottom: "2%",
        containLabel: true,
      },
      //坐标轴触发，。   'item'  , 'axis' ,'none'
      tooltip: {
        trigger: "axis",
        formatter: "{b}时:\n{a}: {c}",
      },
      legend: {
        // type: 'scroll',
        data: chartData.legendData,
        top: "13%",
        selectedMode: "single",
        icon: "none",
        itemWidth: 5, // 图例标记的图形宽度。
        itemGap: 6, // 图例每项之间的间隔。
        inactiveColor: "#55c2bb", // 图例关闭时的颜色。
        textStyle: {
          //图例文字的样式
          color: "black",
          fontSize: this.data.windowWidth / 35,
          backgroundColor: "transparent", // 文字块背景色。
          borderColor: "#55c2bb", // 文字块边框颜色。
          borderWidth: 1, // 文字块边框宽度。
          borderRadius: 8, // 文字块的圆角。
          padding: 6, // 文字块的内边距
        },
      },

      xAxis: [
        {
          type: "category",
          boundaryGap: false,
          data: chartData.xData,
          axisLine: {
            show: true,
            symbol: ["none", "arrow"],
          },
        },
      ],
      yAxis: {
        type: "value",
        scale: true,
        axisLine: {
          show: true,
          symbol: ["none", "arrow"],
        },
      },
      series: chartData.seriesData,
    };
    return option;
  },

  //图表数据
  getChartData() {
    var dataArr1 = [];

    if (this.data.temperature_array.length > 0) {
      dataArr1.push({
        name: "温度",
        type: "line",
        smooth: true,
        data: this.data.temperature_array,
        symbol: "circle",
        symbolSize: 5,
      });
    }
    if (this.data.dewPoint_array.length > 0 && !this.data.isXLLG) {
      dataArr1.push({
        name: "露点温度",
        type: "line",
        smooth: true,
        data: this.data.dewPoint_array,
        symbol: "circle",
        symbolSize: 5,
      });
    }
    if (this.data.humidity_array.length > 0 && !this.data.isXLLG) {
      dataArr1.push({
        name: "湿度",
        type: "line",
        smooth: true,
        data: this.data.humidity_array,
        symbol: "circle",
        symbolSize: 5,
      });
    }
    if (this.data.PM2_5_array.length > 0) {
      dataArr1.push({
        name: "PM2.5",
        type: "line",
        smooth: true,
        data: this.data.PM2_5_array,
        symbol: "circle",
        symbolSize: 5,
      });
    }
    if (this.data.CO2_array.length > 0) {
      dataArr1.push({
        name: "CO₂",
        type: "line",
        smooth: true,
        data: this.data.CO2_array,
        symbol: "circle",
        symbolSize: 5,
      });
    }

    var legendItems = ["温度"];
    if (!this.data.isXLLG) {
      legendItems.push("露点温度", "湿度");
    }
    legendItems.push("PM2.5", "CO₂");

    var chartData1 = {
      title: "24小时房间数据统计",
      legendData: legendItems,
      xData: this.data.time_array,
      seriesData: dataArr1,
    };

    this.init_echarts1(chartData1);
    
  },

  /**
   * 生命周期函数--监听页面初次渲染完成
   */
  onReady: function () {
    // 图表由 ec-canvas 在组件准备完成后初始化。
  },

  /**
   * 生命周期函数--监听页面显示
   */
  onShow: function () {
    this._pageVisible = true;
    this.refreshRoomStatus();
  },

  refreshRoomStatus: function () {
    if (!this._pageVisible) {
      return;
    }
    this.loadRoomStatus();
    this.startRoomPolling();
  },

  startRoomPolling: function () {
    if (!this.data.refreshInterval) {
      this.data.refreshInterval = setInterval(
        () => this.loadRoomStatus(),
        10000,
      );
    }
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
    this.clearDelayedControls();
  },

  /**
   * 生命周期函数--监听页面卸载
   */
  onUnload: function () {
    this._pageVisible = false;
    this.clearTimeInterval();
    this.clearDelayedControls();
    if (barChart1) {
      barChart1.dispose();
      barChart1 = null;
    }
  },

  clearDelayedControls: function () {
    clearTimeout(this._windControlTimer);
    clearTimeout(this._temperatureControlTimer);
    this._windControlTimer = null;
    this._temperatureControlTimer = null;
    this._windOriginalValue = undefined;
    this._temperatureOriginalValue = undefined;
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

    /**
   * 自定义导航栏返回按钮处理
   */
  BackPage: function() {
    var that = this
    // 停止页面刷新
    that.clearTimeInterval();
    // 返回上一页
    wx.navigateBack({
      delta: 1
    });
  },

  // 修改房间名称
  modalinput: function () {
    if (app.globalData.isvisitor) {
      wx.showToast({
        title: "访客模式不可操作",
        icon: "none",
      });
      return;
    }
    this.clearTimeInterval();
    wx.showModal({
      title: "修改房间名称",
      editable: true,
      content: this.data.roomName,
      placeholderText: "请输入房间名称",
      confirmText: "保存",
      success: (result) => {
        if (!result.confirm) {
          this.startRoomPolling();
          return;
        }
        this.renameRoom(String(result.content || "").trim());
      },
      fail: () => {
        this.startRoomPolling();
      },
    });
  },

  renameRoom: async function (roomName) {
    if (!roomName) {
      wx.showToast({ title: "请输入房间名称", icon: "none" });
      this.startRoomPolling();
      return;
    }
    if (roomName.length > 20) {
      wx.showToast({ title: "房间名称最多20个字符", icon: "none" });
      this.startRoomPolling();
      return;
    }
    if (this._renamePending) {
      return;
    }
    this._renamePending = true;
    try {
      await apiRequest(api.ctrl_modify_room_name, {
        method: "POST",
        header: {
          "content-type": "application/json",
          Authorization: wx.getStorageSync("access_token"),
        },
        data: {
          project_id: wx.getStorageSync("selected_home"),
          room_id: this.data.roomId,
          room_name: roomName,
        },
      });
      if (!isCurrentPage(this)) {
        return;
      }
      this.setData({ roomName });
      this.refreshRoomStatus();
    } catch (error) {
      if (isCurrentPage(this)) {
        wx.showToast({ title: getErrorMessage(error), icon: "none" });
        this.startRoomPolling();
      }
    } finally {
      this._renamePending = false;
    }
  },

  switchButton: function(e) {
    var index = Number(e.currentTarget.dataset.index); 
    if (
      index !== 100 &&
      (!Number.isInteger(index) || index < 0 || index >= Number(this.data.windLevelNumber))
    ) {
      wx.showToast({ title: "风速档位无效", icon: "none" });
      return;
    }
    const actualWindLevel = index === 100 ? 100 : index + 1;
    this.clearTimeInterval();
    if (app.globalData.isvisitor) {
      wx.showToast({
        title: "访客模式不可操作",
        icon: "none",
      });
      this.startRoomPolling();
      return;
    }
    if (this._windOriginalValue === undefined) {
      this._windOriginalValue = this.data.currentButton;
    }
    this.setData({ currentButton: index });
    clearTimeout(this._windControlTimer);
    this._windControlTimer = setTimeout(async () => {
      this._windControlTimer = null;
      if (!this._pageVisible || this._windControlPending) {
        return;
      }
      this._windControlPending = true;
      try {
        await apiRequest(api.trans_ctrl_message, {
          method: "POST",
          header: {
            "content-type": "application/json",
            Authorization: wx.getStorageSync("access_token"),
          },
          data: {
            project_id: wx.getStorageSync("selected_home"),
            body: JSON.stringify({
              id: this.data.roomId,
              level: actualWindLevel,
            }),
            message_type: 18,
          },
        });
        this._windOriginalValue = undefined;
        if (isCurrentPage(this)) {
          this.refreshRoomStatus();
        }
      } catch (error) {
        if (isCurrentPage(this)) {
          this.setData({ currentButton: this._windOriginalValue });
          wx.showToast({ title: getErrorMessage(error), icon: "none" });
        }
        this._windOriginalValue = undefined;
      } finally {
        this._windControlPending = false;
      }
    }, 500);
  },

  changeTemperature: function (step) {
    let num = Number(this.data.showtemp);
    const minTemperatureSet = Number(this.data.minTemperatureSet);
    const maxTemperatureSet = Number(this.data.maxTemperatureSet);
    if (![num, minTemperatureSet, maxTemperatureSet].every(Number.isFinite)) {
      wx.showToast({ title: "温度范围暂不可用", icon: "none" });
      return;
    }
    this.clearTimeInterval();
    if (app.globalData.isvisitor) {
      wx.showToast({
        title: "访客模式不可操作",
        icon: "none",
      });
      this.startRoomPolling();
      return;
    }
    if (this.data.energyMode === 1) {
      wx.showToast({ title: "节能模式不可调节", icon: "none" });
      this.startRoomPolling();
      return;
    }
    const nextValue = Math.min(
      maxTemperatureSet,
      Math.max(minTemperatureSet, num + step),
    );
    if (nextValue === num) {
      this.startRoomPolling();
      return;
    }
    if (this._temperatureOriginalValue === undefined) {
      this._temperatureOriginalValue = num;
    }
    num = nextValue;
    this.setData({
      showtemp: num,
      minusStatus: num <= minTemperatureSet ? "disabled" : "normal",
      plusStatus: num >= maxTemperatureSet ? "disabled" : "normal",
    });
    clearTimeout(this._temperatureControlTimer);
    this._temperatureControlTimer = setTimeout(async () => {
      this._temperatureControlTimer = null;
      if (!this._pageVisible || this._temperatureControlPending) {
        return;
      }
      this._temperatureControlPending = true;
      try {
        await apiRequest(api.ctrl_room_temp, {
            method: "POST",
            header: {
              "content-type": "application/json",
              Authorization: wx.getStorageSync("access_token"),
            },
            data: {
              project_id: wx.getStorageSync("selected_home"),
              room_id: this.data.roomId,
              room_temp_mode: this.data.roomMode,
              target_temp: num,
            },
        });
        this._temperatureOriginalValue = undefined;
        if (isCurrentPage(this)) {
          this.refreshRoomStatus();
        }
      } catch (error) {
        const original = this._temperatureOriginalValue;
        this._temperatureOriginalValue = undefined;
        if (isCurrentPage(this)) {
          this.setData({
            showtemp: original,
            minusStatus:
              original <= minTemperatureSet ? "disabled" : "normal",
            plusStatus:
              original >= maxTemperatureSet ? "disabled" : "normal",
          });
          wx.showToast({ title: getErrorMessage(error), icon: "none" });
        }
      } finally {
        this._temperatureControlPending = false;
      }
    }, 500);
  },

  /* 点击减号 */
  bindMinus: function () {
    this.changeTemperature(-0.5);
  },

  /* 点击加号 */
  bindPlus: function () {
    this.changeTemperature(0.5);
  },

  runSwitchControl: async function (key, stateKey, value, messageType, body) {
    const previousValue = this.data[stateKey];
    if (this._switchControlPending && this._switchControlPending[key]) {
      this.setData({ [stateKey]: previousValue });
      return;
    }
    this._switchControlPending = this._switchControlPending || {};
    this._switchControlPending[key] = true;
    this.setData({ [stateKey]: value });
    try {
      await apiRequest(api.trans_ctrl_message, {
        method: "POST",
        header: {
          "content-type": "application/json",
          Authorization: wx.getStorageSync("access_token"),
        },
        data: {
          project_id: wx.getStorageSync("selected_home"),
          body: JSON.stringify(body),
          message_type: messageType,
        },
      });
      if (isCurrentPage(this)) {
        this.refreshRoomStatus();
      }
    } catch (error) {
      if (isCurrentPage(this)) {
        this.setData({ [stateKey]: previousValue });
        wx.showToast({ title: getErrorMessage(error), icon: "none" });
      }
    } finally {
      this._switchControlPending[key] = false;
    }
  },

  onChangePower(e) {
    var that = this;
    that.clearTimeInterval();
    if (app.globalData.isvisitor) {
      wx.showToast({
        title: "访客模式不可操作",
        icon: "none",
      });
      that.startRoomPolling();
    } else {
      that.runSwitchControl(
        "power",
        "switch_power",
        e.detail.value,
        16,
        {
            id: String(that.data.roomId),
            isOn: e.detail.value,
        },
      );
    }
  },

  onChangeLock(e) {
    var that = this;
    that.clearTimeInterval();
    if (app.globalData.isvisitor) {
      wx.showToast({
        title: "访客模式不可操作",
        icon: "none",
      });
      that.startRoomPolling();
    } else {
      that.runSwitchControl(
        "lock",
        "switch_lock",
        e.detail.value,
        15,
        {
            id: String(that.data.roomId),
            isOn: e.detail.value,
        },
      );
    }
  },

  onChange(e) {
    var that = this;
    that.clearTimeInterval();
    if (app.globalData.isvisitor) {
      wx.showToast({
        title: "访客模式不可操作",
        icon: "none",
      });
      that.startRoomPolling();
    } else {
      that.runSwitchControl(
        "main",
        "switch1",
        e.detail.value,
        300,
        {
            id: String(that.data.roomId),
            isOff: !e.detail.value,
        },
      );
    }
  },


  ArrayNoHundred: function (array) {
    var result_array = [];
    var temp = 0;
    for (var i = 0; i < array.length; i++) {
      if (array[i] != -100) {
        result_array.push(array[i]);
      } else {
        temp++;
        result_array.push("");
      }
    }
    if (temp === array.length) {
      return [];
    } else {
      return result_array;
    }
  },
});
