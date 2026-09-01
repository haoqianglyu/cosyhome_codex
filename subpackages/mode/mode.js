// pages/mode/mode.js
import * as echarts from "../../ec-canvas/echarts";
import {
  controlDataArray,
  legacyControlMessageBody,
} from "../../utils/controlMessage.js";

let pieChart = null;

Page({
  data: {
    ec2: { disableTouch: false, lazyLoad: true },
    key: [],
    value: [],
    cachedKey: [],
    cachedValue: [],
    requestId: null,
  },

  onLoad: function (options) {
    // 显示加载中的提示
    wx.showLoading({ title: "加载中..." });

    // 1) 生成字符串形式的 requestId
    const nowStr = String(Date.now());
    this.setData({ requestId: nowStr });

    // 设置标题
    const selectedMonth = wx.getStorageSync("selected_month");
    wx.setNavigationBarTitle({
      title: `${selectedMonth}月运行模式数据`,
    });

    this.fetchData();
  },

  async fetchData() {
    try {
      const data = await this.loadModeData();
      if (!data.length) {
        wx.showToast({ title: "没有数据", icon: "none", duration: 2000 });
        return;
      }
      this.processData(data);
      this.cacheData();
      this.getChartTestData();
    } catch (error) {
      console.error(`数据获取失败: ${error.message}`);
      wx.showToast({ title: "数据获取失败", icon: "none", duration: 2000 });
    } finally {
      wx.hideLoading();
    }
  },

  async loadModeData() {
    const body = await legacyControlMessageBody({
      messageType: 7,
      body: {
        requestId: this.data.requestId,
        month: wx.getStorageSync("selected_month"),
        year: wx.getStorageSync("selected_year"),
      },
    });
    return controlDataArray(body);
  },

  /**
   * 处理拿到的数据 => 分解出 key/value
   */
  processData(data) {
    const keys = [];
    const values = [];
    data.forEach(item => {
      keys.push(item.name);
      // 这里保留你原本对 value 的处理
      values.push(Number(item.value).toFixed(1));
    });

    this.setData({
      key: keys,
      value: values
    });
  },

  /**
   * 将目前 key/value 缓存起来
   */
  cacheData() {
    this.setData({
      cachedKey: this.data.key,
      cachedValue: this.data.value,
    });
  },

  // 下面是绘制图表的逻辑，基本不变

  init_echarts2: function (chartData) {
    this.chart2Componnet = this.selectComponent("#mychart2");
    this.chart2Componnet.init((canvas, width, height, dpr) => {
      pieChart = echarts.init(canvas, null, {
        width: width,
        height: height,
        devicePixelRatio: dpr,
      });

      wx.showNavigationBarLoading();
      pieChart.showLoading({ text: "正在加载数据" });

      pieChart.setOption(this.getPieOption(chartData));
      pieChart.hideLoading();
      wx.hideNavigationBarLoading();

      return pieChart;
    });
  },

  getPieOption: function (chartData) {
    const option = {
      title: {
        left: "center",
        text: chartData.title,
      },
      tooltip: {
        trigger: "axis",
        formatter: "{b}{a}: {c}%",
        axisPointer: {
          type: "shadow",
        },
      },
      grid: {
        top: "10%",
        left: "3%",
        right: "15%",
        bottom: "10%",
        containLabel: true,
      },
      xAxis: {
        show: true,
        axisLabel: {
          formatter: "{value}",
          show: true,
        },
        splitLine: { show: false },
        axisLine: {
          show: true,
          symbol: ["none", "arrow"],
        },
      },
      yAxis: {
        type: "category",
        axisLabel: {
          color: "#808080",
          formatter: (val) => `${val}`,
        },
        axisLine: {
          show: true,
          symbol: ["none", "arrow"],
        },
        axisTick: {
          show: false,
        },
        data: chartData.legendData,
      },
      series: [
        {
          name: "占比",
          type: "bar",
          label: {
            show: true,
            position: "right",
            formatter: "{c}%",
          },
          barWidth: 10,
          showBackground: true,
          barMaxWidth: 20,
          barMinWidth: 5,
          itemStyle: {
            borderRadius: [0, 10, 10, 0],
            color: new echarts.graphic.LinearGradient(1, 0, 0, 0, [
              { offset: 0, color: "rgba(220,220,220)" },
              { offset: 1, color: "rgba(169,169,169, 1)" },
            ]),
            borderWidth: 1,
            borderColor: "black",
          },
          data: chartData.seriesData,
        },
      ],
    };

    return option;
  },

  getChartTestData() {
    const chartData2 = {
      title: `${wx.getStorageSync("selected_month")}月运行模式时间占比`,
      legendData: this.data.key,
      seriesData: this.data.value,
    };
    this.init_echarts2(chartData2);
  },

  onUnload() {
    if (pieChart) {
      pieChart.dispose();
      pieChart = null;
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
