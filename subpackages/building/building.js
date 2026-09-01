// pages/building/building.js
import * as echarts from "../../ec-canvas/echarts";
import {
  controlDataArray,
  legacyControlMessageBody,
} from "../../utils/controlMessage.js";
var app = getApp();
let barChart1 = null;

Page({
  data: {
    requestId: null, // 用来记录本次请求的唯一标识
    selectedSeriesSum: 0,
    windowHeight: null,
    windowWidth: null,
    xAxis: [],
    ec2: {
      disableTouch: false,
      lazyLoad: true,
    },
    dataArray: [],
    colorList: [
      "#48D1CC",
      "#6A5ACD",
      "#FFA500",
      "#D3D3D3",
      "#DA70D6",
      "#4169E1",
      "#4682B4",
      "#228B22",
      "#8B4513",
      "#0000FF",
      "#48D1CC",
      "#6A5ACD",
      "#FFA500",
      "#D3D3D3",
      "#DA70D6",
      "#4169E1",
      "#4682B4",
      "#228B22",
      "#8B4513",
      "#0000FF",
    ],
  },

  onLoad: function (options) {
    const that = this;
    that.setData({
      windowHeight: wx.getStorageSync("windowHeight"),
      windowWidth: wx.getStorageSync("windowWidth"),
    });

    // 设置标题栏
    wx.setNavigationBarTitle({
      title: wx.getStorageSync("selected_month") + "月建筑能效",
    });

    const nowTimestamp = String(Date.now());
    this.setData({ requestId: nowTimestamp });
    wx.showLoading({ title: "加载中..." });
    that.requestData();
  },

  /** 获取并渲染建筑能效数据。 */
  async requestData() {
    try {
      const body = await legacyControlMessageBody({
        messageType: 19,
        body: {
          requestId: this.data.requestId,
          month: wx.getStorageSync("selected_month"),
          year: wx.getStorageSync("selected_year"),
        },
      });
      const data = controlDataArray(body);
      if (data.length) {
        this.handleDataAndRender(data);
      } else {
        this.showNoData();
      }
    } catch (error) {
      console.error("建筑能效数据获取失败", error);
      this.showNoData();
    } finally {
      wx.hideLoading();
    }
  },

  /**
   * 把日数据 dayList 渲染到图表
   * @param {Array} arr 设备数组，每项: { deviceName, dayList, avgUsage, totalUsage... }
   */
  handleDataAndRender: function (arr) {
    if (!Array.isArray(arr) || arr.length === 0) {
      this.showNoData();
      return;
    }

    const dataArray = arr.map((item, index) => ({
      color: this.data.colorList[index],
      name: item.deviceName || `设备${index + 1}`,
      type: "line",
      smooth: true,
      data: this.ArrayNoHundred(item.dayList),
      symbol: "circle",
      symbolSize: 5,
    }));
    const dayCount = Array.isArray(arr[0].dayList) ? arr[0].dayList.length : 0;
    const xAxis = Array.from({ length: dayCount }, (_, index) => index + 1);

    this.setData({
      dataArray,
      xAxis,
    });
    this.getChartData();
  },

  /**
   * 显示“暂无数据”
   */
  showNoData: function () {
    this.chart1Componnet = this.selectComponent("#mychart2");
    if (!this.chart1Componnet) return;
    this.chart1Componnet.init((canvas, width, height, dpr) => {
      barChart1 = echarts.init(canvas, null, {
        width: width,
        height: height,
        devicePixelRatio: dpr,
      });

      var option = {
        title: {
          text: "暂无数据",
          left: "center",
          top: "middle",
          textStyle: {
            color: "#ccc",
            fontSize: 20,
          },
        },
        xAxis: { show: false },
        yAxis: { show: false },
        series: [],
      };
      barChart1.setOption(option);
      return barChart1;
    });
    wx.hideLoading(); // 请求完成后隐藏 loading
  },

  /**
   * 用来将 dayList 里的 -100 变成 ""（让图表中断）
   */
  ArrayNoHundred: function (array) {
    if (!array || array.length === 0) {
      return [];
    }
    let result = [];
    let invalidCount = 0;
    for (let i = 0; i < array.length; i++) {
      if (array[i] !== -100) {
        result.push(array[i]);
      } else {
        invalidCount++;
        result.push("");
      }
    }
    // 如果全是 -100，就返回空数组
    if (invalidCount === array.length) {
      return [];
    }
    return result;
  },

  /**
   * 真正初始化图表
   */
  getChartData() {
    const that = this;
    if (that.data.dataArray.length === 0) {
      that.showNoData();
      wx.hideLoading(); // 请求完成后隐藏 loading
    } else {
      let chartData1 = {
        title: "建筑能效",
        xData: that.data.xAxis,
        seriesData: that.data.dataArray,
      };
      that.init_echarts1(chartData1);
    }
  },

  init_echarts1: function (chartData) {
    const that = this;
    this.chart1Componnet = this.selectComponent("#mychart2");
    if (!this.chart1Componnet) return;
    this.chart1Componnet.init((canvas, width, height, dpr) => {
      barChart1 = echarts.init(canvas, null, {
        width: width,
        height: height,
        devicePixelRatio: dpr,
      });

      wx.showNavigationBarLoading();
      barChart1.showLoading({ text: "正在加载数据" });

      barChart1.setOption(that.getBarOption1(chartData));
      barChart1.hideLoading();
      wx.hideNavigationBarLoading();

      // 图表加载完后，默认显示第一条曲线总和
      let allSeries = barChart1.getOption().series;
      if (allSeries && allSeries.length > 0) {
        let defaultDataArr = allSeries[0].data || [];
        let defaultSum = 0;
        defaultDataArr.forEach((val) => {
          if (typeof val === "number") {
            defaultSum += val;
          }
        });
        defaultSum = parseFloat(defaultSum.toFixed(2));
        that.setData({ selectedSeriesSum: defaultSum });
      }

      // 2) 监听图例点击 => 更新总和
      barChart1.on("legendselectchanged", (e) => {
        const allSeries = barChart1.getOption().series;
        // var selected = e.selected;
        // var symbolSize = selected[e.name] ? 8 : 5;
        // // 设置数据点的 symbolSize
        // barChart1.option.series.forEach(function (series) {
        //   series.symbolSize = symbolSize;
        // });
        const currentSeriesIndex = allSeries.findIndex(
          (s) => s.name === e.name
        );
        if (currentSeriesIndex === -1) return;
        let sumValue = 0;
        let currentDataArr = allSeries[currentSeriesIndex].data;
        currentDataArr.forEach((val) => {
          if (typeof val === "number") {
            sumValue += val;
          }
        });
        sumValue = parseFloat(sumValue.toFixed(2));
        that.setData({
          selectedSeriesSum: sumValue,
        });
      });

      return barChart1;
    });
  },

  getBarOption1: function (chartData) {
    var option = {
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
      tooltip: {
        trigger: "axis",
        formatter: function (params) {
          if (params.length > 0) {
            var param = params[0];
            var day = param.axisValue;
            var value =
              typeof param.value === "number"
                ? param.value.toFixed(1)
                : param.value;
            return "时间: " + day + "日\n能效(kW·h/100m²): " + value;
          }
          return "";
        },
      },
      legend: {
        data: chartData.seriesData.map((item) => item.name),
        top: "13%",
        selectedMode: "single",
        icon: "none",
        itemWidth: 5,
        itemGap: 6,
        inactiveColor: "#55c2bb",
        textStyle: {
          color: "black",
          fontSize: this.data.windowWidth / 35,
          backgroundColor: "transparent",
          borderColor: "#55c2bb",
          borderWidth: 1,
          borderRadius: 8,
          padding: 6,
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

  onUnload: function () {
    if (barChart1) {
      barChart1.dispose();
      barChart1 = null;
    }
  },

  onShareAppMessage: function () {
    return {
      // 这里的 title 会显示在分享卡片上
      title: "HC健康舒适家",

      // 关键：把路径固定为你的 index 登录页
      path: "/pages/index/index",
    };
  },
});
