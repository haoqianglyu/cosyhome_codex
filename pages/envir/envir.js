import { createControlQueue } from "../../utils/controlQueue.js";
import { captureProjectContext, isProjectContextCurrent } from "../../utils/projects.js";
var app = getApp();
import {
  legacyControlMessageBody,
  sendControlCommand,
} from "../../utils/controlMessage.js";
import { calculateDewPoint } from "../../utils/environment.js";
import * as echarts from "../../ec-canvas/echarts";
let barChart1 = null;
Page({
  /**
   * 页面的初始数据
   */
  data: {
    realtemp: "",
    realhumidity: "",
    mode: [],
    wind:"",
    show_mode: "",
    deviceData: [],
    refreshInterval: null, // 用于保存刷新定时器的ID
    setwords: "",
    sliderable: false,
    shownum: "",
    minset: "",
    maxset: "",
    minusStatus: "true",
    plusStatus: "true",
    setType: null,
    dvalue:null,
    dewPoint:"",
    chushiway:"",
    ec1: {
      disableTouch: false,
      lazyLoad: true,
    },
    
    temperature_array: [],
    humidity_array: [],
    dewPoint_array: [],
    time_array: [],

    temperature_arraytemp: [],
    humidity_arraytemp: [],
    dewPoint_arraytemp: [],
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad: function () {
    const info = typeof wx.getWindowInfo === "function" ? wx.getWindowInfo() : wx.getSystemInfoSync();
    this.setData({ windowWidth: info.windowWidth });
  },

  syncProject() {
    if (isProjectContextCurrent(this._projectContext)) return;
    this.clearTimeInterval();
    this.clearControlTimers();
    this._projectContext = captureProjectContext();
    this._historyLoaded = false;
    this._historyNeedsRender = false;
    if (barChart1) { barChart1.dispose(); barChart1 = null; }
    this.setData({
      realtemp: "", realhumidity: "", dewPoint: "", mode: [], show_mode: "", deviceData: [],
      setwords: "", sliderable: false, shownum: "", minset: "", maxset: "", setType: null,
      dvalue: null, chushiway: "", wind: "", minusStatus: "disabled", plusStatus: "disabled",
      temperature_array: [], humidity_array: [], dewPoint_array: [], time_array: [],
      temperature_arraytemp: [], humidity_arraytemp: [], dewPoint_arraytemp: [],
    });
  },

  async readProjectScreen(messageType) {
    const context = captureProjectContext();
    if (!context.projectId || wx.getStorageSync("haveProject") === false) return null;
    this._queries = this._queries || {};
    if (isProjectContextCurrent(this._queries[messageType])) return null;
    this._queries[messageType] = context;
    try {
      const body = await legacyControlMessageBody({ messageType, projectId: context.projectId, accessToken: context.accessToken });
      return !this._destroyed && isProjectContextCurrent(context) ? body : null;
    } finally {
      if (this._queries[messageType] === context) delete this._queries[messageType];
    }
  },

  async getDataFromScreen() {
    try {
      const body = await this.readProjectScreen(100);
      if (!body) return;
      const sensors = Array.isArray(body && body.sensor)
        ? body.sensor.map((sensor) => ({
            ...sensor,
            dewPoint: calculateDewPoint(
              sensor.temperature,
              sensor.humidity,
            ),
          }))
        : [];
      const firstSensor = sensors[0] || {};

      this.setData({
        mode: (body && body.mode) || [],
        show_mode: (body && body.currentModeName) || "",
        deviceData: sensors,
        realtemp: this.valueOrEmpty(firstSensor.temperature),
        realhumidity: this.valueOrEmpty(firstSensor.humidity),
        dewPoint: this.valueOrEmpty(firstSensor.dewPoint),
      });
      if (body && body.currentMode !== undefined) {
        wx.setStorageSync("current_mode", body.currentMode);
      }
    } catch (error) {
      console.error("环境数据获取失败", error);
    }
  },

  valueOrEmpty(value) {
    return value === undefined || value === null ? "" : value;
  },

  setTemp(setType, setValue, context = captureProjectContext()) {
    return sendControlCommand({
      projectId: context.projectId,
      accessToken: context.accessToken,
      messageType: 17,
      body: { setType, value: setValue },
    });
  },

  async setDataFromScreen() {
    try {
      const body = await this.readProjectScreen(18);
      if (!body) return;
      if (this._temperatureQueue && this._temperatureQueue.isBusy()) return;
      let setWordValue;
      let sliderableValue;
      let chushiwayValue;

      switch (Number(body.setType)) {
            case 0:
              setWordValue = ""; // you can set a default value here if needed
              sliderableValue = false;
              chushiwayValue = "无";
              break;
            case 1:
              setWordValue = "加湿";
              sliderableValue = true;
              chushiwayValue = "相对湿度";
              break;
            case 2:
              setWordValue = "除湿";
              sliderableValue = true;
              chushiwayValue = "相对湿度"
              break;
            case 3:
              setWordValue = "除湿";
              sliderableValue = true;
              chushiwayValue = "露点温度"
              break;
            default:
              setWordValue = ""; // Optional: set to a default value if needed
              sliderableValue = true; // Optional: set to a default value if needed
              chushiwayValue = "";
      }

      this.setData({
        setwords: setWordValue,
        sliderable: sliderableValue,
        shownum: body.value,
        minset: body.min,
        maxset: body.max,
        setType: Number(body.setType),
        dvalue: body.dValue,
        chushiway: chushiwayValue,
        wind: body.dehumidifyMode || "无",
      });
    } catch (error) {
      console.error("环境设置数据获取失败", error);
    }
  },

  async get24hData() {
    try {
      const body = await this.readProjectScreen(19);
      if (!body) return;
      const records = Array.isArray(body) ? body : [];
      const temperatures = records.map((item) => item.temperature);
      const humidities = records.map((item) => item.humidity);
      const dewPoints = records.map((item) => item.dewPoint);
      const times = records.map((item) =>
        String(item.dateFormat || "").slice(-2),
      );

      this.setData({
        temperature_arraytemp: temperatures,
        humidity_arraytemp: humidities,
        dewPoint_arraytemp: dewPoints,
        time_array: times,
        temperature_array: this.ArrayNoHundred(temperatures),
        humidity_array: this.ArrayNoHundred(humidities),
        dewPoint_array: this.ArrayNoHundred(dewPoints),
      });
      this._historyLoaded = true;
      this._historyNeedsRender = true;
      if (this._pageVisible) this.renderHistory();
    } catch (error) {
      console.error("24 小时环境数据获取失败", error);
    }
  },

  renderHistory() {
    if (!this._historyNeedsRender) return;
    if (barChart1) { barChart1.dispose(); barChart1 = null; }
    this.getChartData();
    this._historyNeedsRender = false;
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
    this._pageVisible = true;
    if (typeof that.getTabBar === "function" && that.getTabBar()) {
      that.getTabBar().setData({
        selected: 1,
      });
    }
    this.syncProject();
    if (!this._historyLoaded) this.get24hData();
    else this.renderHistory();
    that.getDataFromScreen();
    that.setDataFromScreen();
    that.clearTimeInterval();
    that.startRealtimePolling();
  },

  startRealtimePolling: function () {
    if (!this._pageVisible || !isProjectContextCurrent(this._projectContext)) return;
    const that = this;
    if (that.data.refreshInterval) {
      return;
    }
    that.data.refreshInterval = setInterval(function () {
      that.getDataFromScreen();
    }, 10000);
  },

  scheduleSettingsRefresh: function (delay = 10000) {
    clearTimeout(this._settingsRefreshTimer);
    this._settingsRefreshTimer = setTimeout(() => {
      this._settingsRefreshTimer = null;
      if (!this._pageVisible) {
        return;
      }
      this.getDataFromScreen();
      this.setDataFromScreen();
      this.startRealtimePolling();
    }, delay);
  },

  clearControlTimers: function () {
    if (this._temperatureQueue) this._temperatureQueue.cancel();
    clearTimeout(this.timeout);
    clearTimeout(this._settingsRefreshTimer);
    this.timeout = null;
    this._settingsRefreshTimer = null;
    this._temperatureOriginalValue = undefined;
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
    this.clearControlTimers();
  },

  /**
   * 生命周期函数--监听页面卸载
   */
  onUnload: function () {
    this._destroyed = true;
    this._pageVisible = false;
    this.clearTimeInterval();
    this.clearControlTimers();
    if (barChart1) {
      barChart1.dispose();
      barChart1 = null;
    }
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

  bindMinus: function () {
    this.changeSetting(-1);
  },

  bindPlus: function () {
    this.changeSetting(1);
  },

  setSettingView(value) {
    this.setData({
      shownum: value,
      minusStatus: value <= Number(this.data.minset) ? "disabled" : "normal",
      plusStatus: value >= Number(this.data.maxset) ? "disabled" : "normal",
    });
  },

  changeSetting(direction) {
    if (!this._pageVisible || !isProjectContextCurrent(this._projectContext)) return;
    if (app.globalData.isvisitor) {
      wx.showToast({ title: "访客模式不可操作", icon: "none" });
      return;
    }
    const values = [this.data.shownum, this.data.minset, this.data.maxset, this.data.dvalue];
    if (!this.data.sliderable || values.some(value => value == null || value === "") || !values.map(Number).every(Number.isFinite)) {
      wx.showToast({ title: "设定范围暂不可用", icon: "none" });
      return;
    }
    const [current, min, max, step] = values.map(Number);
    if (min > max || step <= 0) {
      wx.showToast({ title: "设定范围暂不可用", icon: "none" });
      return;
    }
    const value = Math.min(max, Math.max(min, Number((current + direction * step).toFixed(6))));
    if (value === current) return;
    const queue = this.getSettingQueue();
    if (!queue.isBusy()) this._settingConfirmedValue = current;
    this.clearTimeInterval();
    clearTimeout(this._settingsRefreshTimer);
    this.setSettingView(value);
    queue.enqueue({ value, setType: this.data.setType, context: captureProjectContext() });
  },

  getSettingQueue() {
    if (!this._temperatureQueue) {
      this._temperatureQueue = createControlQueue({
        delay: 1000,
        isActive: ({ context }) => this._pageVisible && !this._destroyed && isProjectContextCurrent(context),
        send: ({ value, setType, context }) => this.setTemp(setType, value, context),
        onSuccess: ({ value }) => { this._settingConfirmedValue = value; },
        onError: () => {
          this.setSettingView(this._settingConfirmedValue);
          wx.showToast({ title: "温湿度设置失败", icon: "none" });
        },
        onIdle: () => this.scheduleSettingsRefresh(),
      });
    }
    return this._temperatureQueue;
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
    if (this.data.dewPoint_array.length > 0) {
      dataArr1.push({
        name: "露点温度",
        type: "line",
        smooth: true,
        data: this.data.dewPoint_array,
        symbol: "circle",
        symbolSize: 5,
      });
    }
    if (this.data.humidity_array.length > 0) {
      dataArr1.push({
        name: "湿度",
        type: "line",
        smooth: true,
        data: this.data.humidity_array,
        symbol: "circle",
        symbolSize: 5,
      });
    }
    

    var chartData1 = {
      title: "24小时房间数据统计",
      legendData: ["温度", "露点温度", "湿度"],
      xData: this.data.time_array,
      seriesData: dataArr1,
    };

    this.init_echarts1(chartData1);
    
  },

});
