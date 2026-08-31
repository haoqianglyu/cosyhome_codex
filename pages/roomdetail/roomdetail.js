// pages/roomdetail/roomdetail.js
import * as echarts from "../../ec-canvas/echarts";
import api from "../../api/api.js";
import { controlMessageBody } from "../../utils/controlMessage.js";
var app = getApp();
let barChart1 = null;
let input_value = "";
let TimeID = -1;
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
    hiddenmodalput: true,
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
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad: function (options) {
    console.log(options);

    var that = this;
    var roomID = options.roomID;
    var roomName = options.roomName;
    console.log(roomName)
    console.log(app.globalData.isvisitor);
    that.setData({
      isvisitor: app.globalData.isvisitor,
      roomId: roomID,
      roomName:roomName,
      windowHeight: wx.getStorageSync("windowHeight"),
      windowWidth: wx.getStorageSync("windowWidth"),
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

    console.log(that.data.roomId);

    this.loadHistory();
  },

  async loadHistory() {
    wx.showLoading({ title: "正在加载数据" });
    try {
      const body = await controlMessageBody({
        messageType: 4,
        body: this.data.roomId,
      });
      const records = Array.isArray(body) ? body : [];
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
      const body = await controlMessageBody({
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
        windLevelNumber: body.windLevelNumber,
        isAutoWindLevel: body.isAutoWindLevel,
        currentButton,
        windLevels: Array.from(
          { length: Number(body.windLevelNumber) || 0 },
          (_, index) => index,
        ),
      });
    } catch (error) {
      console.error("房间状态获取失败", error);
    } finally {
      this._statusRequestPending = false;
    }
  },

  toggleSelection: function (e) {
    var that = this;
    that.clearTimeInterval();
    if (app.globalData.isvisitor) {
      wx.showToast({
        title: "访客模式不可操作",
        icon: "none",
      });
    } else {
      let index = e.currentTarget.dataset.index;
      let item = that.data.workModes[index];
      if (!item.isChange) {
        // console.log(`${item.optionName} 无法修改`);
        wx.showToast({
          title: "不可修改",
          icon: "error",
        });
        return;
      }

      let selectedCount = that.getSelectedCount();
      if (item.isSelect && selectedCount === 1) {
        wx.showToast({
          title: "至少选择一项",
          icon: "error",
        });
        return;
      }

      that.setData(
        {
          workModes: that.data.workModes.map((item, i) => {
            if (i === index) {
              console.log(
                `${item.optionName} ${!item.isSelect ? "选中" : "未选中"}`
              );
              return { ...item, isSelect: !item.isSelect };
            } else {
              return item;
            }
          }),
        },
        function () {
          // 请求API
          api.trans_ctrl_message({
            method: "POST",
            header: {
              "content-type": "application/json",
              Authorization: wx.getStorageSync("access_token"),
            },
            data: {
              project_id: wx.getStorageSync("selected_home"),
              body: JSON.stringify({
                id: that.data.roomId,
                workModes: that.data.workModes,
              }),
              message_type: 14,
            },
            success: function (res) {},
          });
        }
      );
    }
    that.onShow();
  
  },

  getSelectedCount: function () {
    var that = this;
    return that.data.workModes.filter((item) => item.isSelect).length;
  },

  init_echarts1: function (chartData) {
    this.chart1Componnet = this.selectComponent("#mychart1"); //去获取echarts    这里的id就是echarts的id
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
      setTimeout(() => {
        barChart1.setOption(this.getBarOption1(chartData));
        barChart1.hideLoading();
        console.log(barChart1.getOption())
        wx.hideNavigationBarLoading();
      }, 1200);
      

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
        inactiveColor: "#74CEAE", // 图例关闭时的颜色。
        textStyle: {
          //图例文字的样式
          color: "black",
          fontSize: this.data.windowWidth / 35,
          backgroundColor: "transparent", // 文字块背景色。
          borderColor: "#74CEAE", // 文字块边框颜色。
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
    // setTimeout(() => {
    //   this.getChartData();
    // }, 1000);
  },

  /**
   * 生命周期函数--监听页面显示
   */
  onShow: function () {
    this.loadRoomStatus();
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
    var that = this;
    that.clearTimeInterval();
  },

  /**
   * 生命周期函数--监听页面卸载
   */
  onUnload: function () {
    this.clearTimeInterval();
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

  //点击按钮弹出指定的hiddenmodalput弹出框
  modalinput: function () {
    var that = this
    that.clearTimeInterval();
    if (app.globalData.isvisitor) {
      wx.showToast({
        title: "访客模式不可操作",
        icon: "none",
      });
    } else {
      that.setData({
        hiddenmodalput: !that.data.hiddenmodalput,
      });
    }
    
  },
  //取消按钮
  cancel: function () {
    var that = this
    that.setData({
      hiddenmodalput: true,
    });
  },
  //确认
  confirm: function () {
    var that = this
    api.ctrl_modify_room_name({
      method: "POST",
      header: {
        "content-type": "application/json",
        Authorization: wx.getStorageSync("access_token"),
      },
      data: {
        project_id: wx.getStorageSync("selected_home"),
        room_id: that.data.roomId,
        room_name: input_value,
      },
      success: function (res) {},
    });
    that.setData({
      hiddenmodalput: true,
      roomName: input_value,
    });

    that.onShow();

  },

  modifyRoomName: function (e) {
    console.log(e.detail.value);
    input_value = e.detail.value;
  },

  switchButton: function(e) {
    var that = this;
    var index = Number(e.currentTarget.dataset.index); 
    console.log(index)
    var actualWindLevel;
    if (index === 100) {
      actualWindLevel = 100; // 特殊值表示自动风速
    } else {
        actualWindLevel = index + 1; // 将下标转换回实际风速值
    }
    that.setData({
        currentButton: index
    });

    that.clearTimeInterval();
    if (app.globalData.isvisitor) {
      wx.showToast({
        title: "访客模式不可操作",
        icon: "none",
      });
    } else {
      clearTimeout(this.TimeID);
        that.TimeID = setTimeout(() => {
          console.log(actualWindLevel)
          api.trans_ctrl_message({
            method: "POST",
            header: {
              "content-type": "application/json",
              Authorization: wx.getStorageSync("access_token"),
            },
            data: {
              project_id: wx.getStorageSync("selected_home"),
              body: JSON.stringify({
                id: that.data.roomId,
                level: actualWindLevel, 
            }),
              message_type: 18,
            },
            success: function (res) {
              
            },
            fail: function (res) {
              
              console.log(res);
            },
          });
        }, 500);
  
    }
    that.onShow();
  },

  /* 点击减号 */
  bindMinus: function () {
    var that = this;
    var num = that.data.showtemp;
    var minTemperatureSet = that.data.minTemperatureSet;
    var maxTemperatureSet = that.data.maxTemperatureSet;
    var energyMode = that.data.energyMode;
    that.clearTimeInterval();
    if (app.globalData.isvisitor) {
      wx.showToast({
        title: "访客模式不可操作",
        icon: "none",
      });
    } else {
      if (energyMode === 1) {
        wx.showToast({
          title: "节能模式不可调节",
          icon: "none",
        });
      } else {
        if (num > minTemperatureSet) {
          num = num - 0.5;
        }
        var minusStatus = num <= minTemperatureSet ? "disabled" : "normal";
        var plusStatus = num >= maxTemperatureSet ? "disabled" : "normal";
        // 将数值与状态写回
        that.setData({
          showtemp: num,
          minusStatus: minusStatus,
          plusStatus: plusStatus,
        });
        clearTimeout(this.TimeID);
        that.TimeID = setTimeout(() => {
          api.ctrl_room_temp({
            method: "POST",
            header: {
              "content-type": "application/json",
              Authorization: wx.getStorageSync("access_token"),
            },
            data: {
              project_id: wx.getStorageSync("selected_home"),
              room_id: that.data.roomId,
              room_temp_mode: that.data.roomMode,
              target_temp: num,
            },
            success: function (res) {},
          });
        }, 500);
      }
    }
    that.onShow();
  },

  /* 点击加号 */
  bindPlus: function () {
    var that = this;
    var num = that.data.showtemp;
    var minTemperatureSet = that.data.minTemperatureSet;
    var maxTemperatureSet = that.data.maxTemperatureSet;
    var energyMode = that.data.energyMode;
    that.clearTimeInterval();
    if (app.globalData.isvisitor) {
      wx.showToast({
        title: "访客模式不可操作",
        icon: "none",
      });
    } else {
      if (energyMode === 1) {
        wx.showToast({
          title: "节能模式不可调节",
          icon: "none",
        });
      } else {
        if (num < maxTemperatureSet) {
          num = num + 0.5;
        }

        var minusStatus = num < minTemperatureSet ? "disabled" : "normal";
        var plusStatus = num > maxTemperatureSet ? "disabled" : "normal";
        // 将数值与状态写回
        that.setData({
          showtemp: num,
          minusStatus: minusStatus,
          plusStatus: plusStatus,
        });

        clearTimeout(this.TimeID);
        that.TimeID = setTimeout(() => {
          api.ctrl_room_temp({
            method: "POST",
            header: {
              "content-type": "application/json",
              Authorization: wx.getStorageSync("access_token"),
            },
            data: {
              project_id: wx.getStorageSync("selected_home"),
              room_id: that.data.roomId,
              room_temp_mode: that.data.roomMode,
              target_temp: num,
            },
            success: function (res) {},
          });
        }, 500);
      }
    }
    that.onShow();
  },

  onChangePower(e) {
    var that = this;
    console.log(e.detail.value);
    that.clearTimeInterval();
    if (app.globalData.isvisitor) {
      wx.showToast({
        title: "访客模式不可操作",
        icon: "none",
      });
    } else {
      that.setData({
        switch_power: e.detail.value,
      });
      api.trans_ctrl_message({
        method: "POST",
        header: {
          "content-type": "application/json",
          Authorization: wx.getStorageSync("access_token"),
        },
        data: {
          project_id: wx.getStorageSync("selected_home"),
          body: JSON.stringify({
            id: String(that.data.roomId),
            isOn: e.detail.value,
          }),
          message_type: 16,
        },
        success: function (res) {},
        fail: function (res) {
          console.log(res);
        },
      });
    }
    that.onShow();
  },

  onChangeLock(e) {
    var that = this;
    console.log(e.detail.value);
    that.clearTimeInterval();
    if (app.globalData.isvisitor) {
      wx.showToast({
        title: "访客模式不可操作",
        icon: "none",
      });
    } else {
      that.setData({
        switch_lock: e.detail.value,
      });
      api.trans_ctrl_message({
        method: "POST",
        header: {
          "content-type": "application/json",
          Authorization: wx.getStorageSync("access_token"),
        },
        data: {
          project_id: wx.getStorageSync("selected_home"),
          body: JSON.stringify({
            id: String(that.data.roomId),
            isOn: e.detail.value,
          }),
          message_type: 15,
        },
        success: function (res) {},
        fail: function (res) {
          console.log(res);
        },
      });
    }
    that.onShow();
  },

  onChange(e) {
    var that = this;
    console.log(e.detail.value);
    that.clearTimeInterval();
    if (app.globalData.isvisitor) {
      wx.showToast({
        title: "访客模式不可操作",
        icon: "none",
      });
    } else {
      that.setData({
        switch1: e.detail.value,
      });
      api.trans_ctrl_message({
        method: "POST",
        header: {
          "content-type": "application/json",
          Authorization: wx.getStorageSync("access_token"),
        },
        data: {
          project_id: wx.getStorageSync("selected_home"),
          body: JSON.stringify({
            id: String(that.data.roomId),
            isOff: !e.detail.value,
          }),
          message_type: 300,
        },
        success: function (res) {},
        fail: function (res) {
          console.log(res);
        },
      });
    }
    that.onShow();
    
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
