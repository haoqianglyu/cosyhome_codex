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
    sliderable: true,
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
    this.get24hData();
  },

  async getDataFromScreen() {
    try {
      const body = await legacyControlMessageBody({ messageType: 100 });
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

  setTemp(setType, setValue) {
    return sendControlCommand({
      messageType: 17,
      body: { setType, value: setValue },
    });
  },

  async setDataFromScreen() {
    try {
      const body = await legacyControlMessageBody({ messageType: 18 });
      let setWordValue;
      let sliderableValue;
      let chushiwayValue;

      switch (body.setType) {
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
        setType: body.setType,
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
      const body = await legacyControlMessageBody({ messageType: 19 });
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
      this.getChartData();
    } catch (error) {
      console.error("24 小时环境数据获取失败", error);
    }
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
    that.getDataFromScreen();
    that.setDataFromScreen();
    that.clearTimeInterval();
    that.startRealtimePolling();
  },

  startRealtimePolling: function () {
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

  /* 点击减号 */
  bindMinus: function () {
    var that = this;
    var strip = that.data.dvalue
    that.clearTimeInterval();
    // 清除之前设置的定时器
    if (that.timeout) {
      clearTimeout(that.timeout);
    }

    var num = that.data.shownum;
    var minTemperatureSet = that.data.minset;
    var maxTemperatureSet = that.data.maxset;

    if (app.globalData.isvisitor) {
      wx.showToast({
        title: "访客模式不可操作",
        icon: "none",
      });
      that.startRealtimePolling();
      return;
    }
    if (num > minTemperatureSet) {
      num = num - strip;
    }
    var minusStatus = num <= minTemperatureSet ? "disabled" : "normal";
    var plusStatus = num >= maxTemperatureSet ? "disabled" : "normal";
    if (this._temperatureOriginalValue === undefined) {
      this._temperatureOriginalValue = this.data.shownum;
    }
    that.setData({
      shownum: num,
      minusStatus: minusStatus,
      plusStatus: plusStatus,
    });

    that.scheduleTemperatureUpdate(num);
  },

  /* 点击加号 */
  bindPlus: function () {
    var that = this;
    var strip = that.data.dvalue
    that.clearTimeInterval();
    // 清除之前设置的定时器
    if (that.timeout) {
      clearTimeout(that.timeout);
    }
    var num = that.data.shownum;
    var minTemperatureSet = that.data.minset;
    var maxTemperatureSet = that.data.maxset;

    if (app.globalData.isvisitor) {
      wx.showToast({
        title: "访客模式不可操作",
        icon: "none",
      });
      that.startRealtimePolling();
      return;
    }
    if (num < maxTemperatureSet) {
      num = num + strip;
    }
    var minusStatus = num < minTemperatureSet ? "disabled" : "normal";
    var plusStatus = num > maxTemperatureSet ? "disabled" : "normal";
    if (this._temperatureOriginalValue === undefined) {
      this._temperatureOriginalValue = this.data.shownum;
    }
    that.setData({
      shownum: num,
      minusStatus: minusStatus,
      plusStatus: plusStatus,
    });

    that.scheduleTemperatureUpdate(num);
  },

  scheduleTemperatureUpdate: function (value) {
    clearTimeout(this.timeout);
    this.timeout = setTimeout(async () => {
      this.timeout = null;
      try {
        await this.setTemp(this.data.setType, value);
        this._temperatureOriginalValue = undefined;
      } catch (error) {
        const original = this._temperatureOriginalValue;
        this._temperatureOriginalValue = undefined;
        if (this._pageVisible && original !== undefined) {
          this.setData({
            shownum: original,
            minusStatus:
              original <= this.data.minset ? "disabled" : "normal",
            plusStatus:
              original >= this.data.maxset ? "disabled" : "normal",
          });
          wx.showToast({ title: "温湿度设置失败", icon: "none" });
        }
      }
      this.scheduleSettingsRefresh();
    }, 1000);
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
