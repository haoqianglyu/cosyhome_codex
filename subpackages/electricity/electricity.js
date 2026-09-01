// pages/meter/meter.js
import * as echarts from '../../ec-canvas/echarts';
import {
  controlDataArray,
  legacyControlMessageBody,
} from "../../utils/controlMessage.js";
var app = getApp();
let externalDataArray = [];
let barChart1 = null;

Page({
  data: {
    // 请求相关
    requestId: null,      // 当前请求的唯一标识（字符串）

    listData: [],
    xAxis: [],
    ec1: {
      disableTouch: false,
      lazyLoad: true
    },
    dataArray: [],
    colorList: [
      "#48D1CC","#6A5ACD","#FFA500","#D3D3D3","#DA70D6",
      "#4169E1","#4682B4","#228B22","#8B4513","#0000FF",
      "#48D1CC","#6A5ACD","#FFA500","#D3D3D3","#DA70D6",
      "#4169E1","#4682B4","#228B22","#8B4513","#0000FF",
    ]
  },

  onLoad: function (options) {
    var that = this;
    wx.setNavigationBarTitle({
      title: wx.getStorageSync("selected_month") + '月计量数据'
    });

    const nowStr = String(Date.now());
    this.setData({ requestId: nowStr });
    that.requestData();
  },

  /** 获取并渲染计量数据。 */
  async requestData() {
    wx.showLoading({ title: "数据加载中...", mask: true });
    try {
      const body = await legacyControlMessageBody({
        messageType: 9,
        body: {
          requestId: this.data.requestId,
          month: wx.getStorageSync("selected_month"),
          year: wx.getStorageSync("selected_year"),
        },
      });
      const data = controlDataArray(body);
      if (data.length) {
        this.handleDataAndRender(data, "sync");
      } else {
        this.showNoData();
      }
    } catch (error) {
      console.error("计量数据获取失败", error);
      this.showNoData();
    } finally {
      wx.hideLoading();
    }
  },

  /**
   * 统一处理数据并渲染: 包括填充 listData / dataArray / xAxis
   */
  handleDataAndRender: function(dataArr, versionType="old") {
    console.log(`解析到 ${versionType} 版本数据 =>`, dataArr);

    if (!Array.isArray(dataArr) || dataArr.length === 0) {
      this.showNoData();
      return;
    }

    const formatUsage = (value) => {
      const number = Number(value);
      return Number.isFinite(number) ? number.toFixed(1) : "0.0";
    };
    const listData = dataArr.map((item) => ({
      column1: item.parameterName,
      column2: item.deviceName,
      column3: item.unit,
      column4: formatUsage(item.totalUsage),
      column5: formatUsage(item.avgUsage),
    }));
    const dataArray = dataArr.map((item, index) => ({
      color: this.data.colorList[index],
      name: item.parameterName,
      deviceName: item.deviceName,
      type: 'line',
      smooth: true,
      data: this.ArrayNoHundred(item.dayList),
      symbol: 'circle',
      symbolSize: 5,
    }));
    const firstDayList = Array.isArray(dataArr[0].dayList)
      ? dataArr[0].dayList
      : [];
    const xAxis = Array.from(
      { length: firstDayList.length },
      (_, index) => index + 1,
    );

    this.setData({
      listData,
      dataArray,
      xAxis,
    });

    externalDataArray = dataArray;
    this.getChartData();
  },

  /**
   * 用 ECharts 显示“暂无数据”
   */
  showNoData: function() {
    this.chart1Componnet = this.selectComponent('#mychart1');
    this.chart1Componnet.init((canvas, width, height, dpr) => {
      barChart1 = echarts.init(canvas, null, {
        width: width,
        height: height,
        devicePixelRatio: dpr
      });
      var option = {
        title: {
          text: '暂无数据',
          left: 'center',
          top: 'middle',
          textStyle: {
            color: '#ccc',
            fontSize: 20
          }
        },
        xAxis: { show: false },
        yAxis: { show: false },
        series: []
      };
      barChart1.setOption(option);
      wx.hideLoading(); // 隐藏加载提示
      return barChart1;
    });
    
  },

  /**
   * 渲染 ECharts 图表
   */
  getChartData() {
    var that = this;
    // 如果 dataArray 没数据 => 显示暂无数据
    if (that.data.dataArray.length === 0) {
      that.showNoData();
      return;
    }
    var chartData1 = {
      title: '计量数据',
      legendData: that.data.dataArray.map(s => s.name),  // 给 legend 用
      xData: that.data.xAxis,
      seriesData: that.data.dataArray
    };
    this.init_echarts1(chartData1);
  },

  /**
   * 初始化图表
   */
  init_echarts1: function (chartData) {
    // console.log(chartData)
    this.chart1Componnet = this.selectComponent('#mychart1');
    this.chart1Componnet.init((canvas, width, height, dpr) => {
      barChart1 = echarts.init(canvas, null, {
        width: width,
        height: height,
        devicePixelRatio: dpr
      });
      
      wx.showNavigationBarLoading();
      barChart1.showLoading({ text: '正在加载数据' });

      barChart1.setOption(this.getBarOption1(chartData));
      barChart1.hideLoading();
      wx.hideNavigationBarLoading();

      return barChart1; 
    });
  },

  // 配置 ECharts
  getBarOption1: function (chartData) {
    var option = {
      // 移除 backgroundColor，默认为透明，会显示父容器的白色
      color: this.data.colorList, // 系列颜色可以保持不变
      title: { 
        text: chartData.title, 
        left: 'center', 
        top: 5, 
        textStyle: { 
          color: '#333333' // 标题颜色改为深灰色
        } 
      },
      grid: { top: '25%', left: '3%', right: '4%', bottom: '2%', containLabel: true },
      
      tooltip: {
        trigger: 'axis',
        confine: true,

        // Tooltip 样式适配白色主题
        backgroundColor: 'rgba(255, 255, 255, 0.9)',
        borderColor: '#cccccc',
        borderWidth: 1,
        textStyle: {
          color: '#333333' // Tooltip 文字颜色改为深灰色
        },
      
        position: function (pos, params, dom, rect, size) {
          const viewWidth  = size.viewSize[0];
          const boxWidth   = dom.offsetWidth;
          const boxHeight  = dom.offsetHeight;
          let x = pos[0], y = pos[1];
          if (x + boxWidth > viewWidth) x = viewWidth - boxWidth - 10;
          if (y < boxHeight) y = y + 20;
          return [x, y];
        },
      
        extraCssText: `max-width:260px; white-space:normal; overflow-wrap:break-word; max-height:140px; overflow-y:auto; padding: 10px; border-radius: 4px; box-shadow: 0 2px 8px rgba(0,0,0,0.15);`,
          
        formatter: function (params) {
          if (!params || params.length === 0) return '';
          let itemsPerRow = params.length > 8 ? 2 : 1;
          let res = `第 ${params[0].axisValue} 日\n`;
          
          params.forEach((p, i) => {
            const dev = externalDataArray[p.seriesIndex].deviceName || p.seriesName;
            const val = (p.value !== null && p.value !== '') ? Number(p.value).toFixed(1) : '无数据';
            res += `${p.marker}${dev}: ${val}`;
            if ((i + 1) % itemsPerRow === 0 && i < params.length - 1) {
              res += '\n';
            } else if (i < params.length - 1) {
              res += ' ;  ';
            }
          });
          return res;
        }
      },

      legend: {
        data: chartData.legendData,
        top:"12%",
        selectedMode: 'single',
        icon:"none",
        itemWidth: 5,
        itemGap: 6,
        inactiveColor: "#55c2bb", // 未选中项的颜色可以调深一些
        textStyle: { 
          color:"#333333", // 图例文字颜色改为深灰色
          fontSize: 12,
          // backgroundColor: "#f7f7f7", // 给个淡淡的背景
          borderColor: "#55c2bb",
          borderWidth: 1,
          borderRadius: 8,
          padding: 6,
        },
      },
      xAxis: [{
        type:'category',
        boundaryGap: false,
        data: chartData.xData,
        axisLine:{ show: true, symbol:['none','arrow'], lineStyle: { color: '#666666' } }, // 轴线颜色
        axisLabel: { color: '#333333' } // 轴标签文字颜色
      }],
      yAxis: {
        type: 'value',
        scale: true,
        axisLine:{ show: true, symbol:['none','arrow'], lineStyle: { color: '#666666' } }, // 轴线颜色
        axisLabel: { color: '#333333' }, // 轴标签文字颜色
        splitLine: { lineStyle: { color: '#eeeeee' } } // 分割线颜色
      },
      series: chartData.seriesData
    };
    return option;
  },


  // 把 dayList 里的 -100 替换为空字符串，做“断点”
  ArrayNoHundred: function(array){
    if(!array || array.length===0){
      return [];
    }
    var result_array=[];
    var temp=0;
    for(var i = 0; i < array.length; i++){
      if(array[i] !== -100){
        result_array.push(array[i]);
      } else {
        temp++;
        result_array.push("");
      }
    }
    // 如果全部都是 -100，就返回空数组
    if(temp === array.length){
      return [];
    } else {
      return result_array;
    }
  },

  // 以下生命周期函数可按需保留
  onReady: function () {},
  onShow: function () {},
  onHide: function () {},
  onUnload: function () {
    if (barChart1) {
      barChart1.dispose();
      barChart1 = null;
    }
  },
  onPullDownRefresh: function () {},
  onReachBottom: function () {},
  onShareAppMessage: function () {
    return {
      // 这里的 title 会显示在分享卡片上
      title: "HC健康舒适家",

      // 关键：把路径固定为你的 index 登录页
      path: "/pages/index/index",
    };
  },
});
