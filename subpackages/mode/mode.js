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
    selectedMonth: "",
    dominantMode: "--",
  },

  onLoad: function (options) {
    // 显示加载中的提示
    wx.showLoading({ title: "加载中..." });

    // 1) 生成字符串形式的 requestId
    const nowStr = String(Date.now());
    this.setData({ requestId: nowStr });

    // 设置标题
    const selectedMonth = wx.getStorageSync("selected_month");
    this.setData({ selectedMonth });
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
    const sortedData = data
      .map((item) => ({
        name: item.name,
        value: Number(item.value) || 0,
      }))
      .sort((left, right) => right.value - left.value);
    const keys = sortedData.map((item) => item.name);
    const values = sortedData.map((item) => item.value.toFixed(1));

    this.setData({
      key: keys,
      value: values,
      dominantMode: keys[0] || "--",
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
    if (!this.chart2Componnet) return;
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
      animationDuration: 850,
      animationEasing: "cubicOut",
      tooltip: {
        trigger: "axis",
        confine: true,
        formatter: "{b}<br/>{a}：{c}%",
        backgroundColor: "rgba(35, 61, 56, .94)",
        borderWidth: 0,
        textStyle: { color: "#ffffff", fontSize: 12 },
        axisPointer: {
          type: "none",
        },
      },
      grid: {
        top: 24,
        left: 8,
        right: 50,
        bottom: 12,
        containLabel: true,
      },
      xAxis: {
        type: "value",
        min: 0,
        max: 100,
        splitNumber: 4,
        axisLabel: {
          formatter: "{value}%",
          color: "#9aaca7",
          fontSize: 10,
        },
        splitLine: {
          show: true,
          lineStyle: {
            color: "rgba(85, 194, 187, .12)",
            type: "dashed",
          },
        },
        axisLine: { show: false },
        axisTick: { show: false },
      },
      yAxis: {
        type: "category",
        inverse: true,
        axisLabel: {
          color: "#405a54",
          fontSize: 11,
          margin: 16,
          formatter: (value) => value.length > 8 ? `${value.slice(0, 8)}…` : value,
        },
        axisLine: { show: false },
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
            color: "#3faea7",
            fontSize: 11,
            fontWeight: 600,
          },
          barWidth: 15,
          showBackground: true,
          backgroundStyle: {
            color: "rgba(85, 194, 187, .1)",
            borderRadius: 10,
          },
          itemStyle: {
            borderRadius: 10,
            color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
              { offset: 0, color: "#8ae0da" },
              { offset: .55, color: "#55c2bb" },
              { offset: 1, color: "#35aaa3" },
            ]),
            shadowBlur: 8,
            shadowColor: "rgba(85, 194, 187, .2)",
          },
          emphasis: {
            itemStyle: {
              shadowBlur: 14,
              shadowColor: "rgba(85, 194, 187, .34)",
            },
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
