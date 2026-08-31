// pages/rooms/rooms.js
import {
  controlDataArray,
  controlMessageBody,
} from "../../utils/controlMessage.js";

Page({
  data: {
    show: false,           // 控制下拉框的显示/隐藏
    floors: [],            // 楼层名称数组
    floors_id: [],         // 楼层 id 数组
    index: 0,              // 当前选中楼层下标
    content: [],           // 当前楼层房间信息
    
    allFloorsData: [],     // 一次性存储所有楼层数据

    requestId: null,       // 当前请求的唯一标识
  },

  onLoad() {
    // 如果没有项目 => 清空并返回
    if (wx.getStorageSync("haveProject") === false) {
      this.setData({ floors: [], floors_id: [], content: [] });
      return;
    }

    // 设置页面标题
    wx.setNavigationBarTitle({
      title: wx.getStorageSync("selected_month") + "月房间环境量统计",
    });

    const nowStr = String(Date.now());
    this.setData({
      requestId: nowStr
    });
    wx.showLoading({
      title: "正在加载",
      mask: true
    });
    this.fetchFloorsData();
  },

  /** 获取并渲染房间环境量统计。 */
  async fetchFloorsData() {
    try {
      const body = await controlMessageBody({
        messageType: 10,
        body: {
          requestId: this.data.requestId,
          month: wx.getStorageSync("selected_month"),
          year: wx.getStorageSync("selected_year"),
        },
      });
      const data = controlDataArray(body);
      if (data.length) {
        this.handleFloorsDataAndRender(data, "sync");
      } else {
        this.showNoData();
      }
    } catch (error) {
      console.error("房间环境量统计获取失败", error);
      this.showNoData();
    } finally {
      wx.hideLoading();
    }
  },

  /**
   * 处理拿到的楼层数组 dataArr 并默认显示第 0 楼层
   */
  handleFloorsDataAndRender(dataArr, versionType = "old") {
    console.log(`handleFloorsDataAndRender => ${versionType}`, dataArr);
    if (!Array.isArray(dataArr) || dataArr.length === 0) {
      this.showNoData();
      return;
    }

    this.setData({
      allFloorsData: dataArr
    });

    const newFloors = dataArr.map(item => item.name);
    const newFloorIds = dataArr.map(item => item.floorId);

    const idx = 0; // 默认选中第 0 楼层
    const theContent = dataArr[idx].data || [];

    this.setData({
      floors: newFloors,
      floors_id: newFloorIds,
      index: idx,
      content: theContent
    });

    // 隐藏 loading，因为数据已经加载完毕
    wx.hideLoading();
  },

  /**
   * 无数据时，清空数据
   */
  showNoData() {
    // 隐藏 loading
    wx.hideLoading();
    
    this.setData({
      floors: [],
      floors_id: [],
      index: 0,
      content: [],
      allFloorsData: []
    });
  },

  /**
   * 点击下拉框，显示/隐藏
   */
  selectTap() {
    this.setData({
      show: !this.data.show
    });
  },

  /**
   * 点击某个楼层，切换显示
   */
  optionTap(e) {
    const idx = e.currentTarget.dataset.index;
    console.log("optionTap => index =", idx);
    this.setData({
      index: idx,
      show: false
    });

    const dataArr = this.data.allFloorsData;
    if (!dataArr || dataArr.length === 0) {
      this.showNoData();
      return;
    }
    if (idx < 0 || idx >= dataArr.length) {
      this.showNoData();
      return;
    }
    this.setData({
      content: dataArr[idx].data || []
    });
  },

  // 其他生命周期函数
  onReady() {},
  onHide() {},
  onUnload() {},
  onPullDownRefresh() {},
  onReachBottom() {},
  onShareAppMessage: function () {
    return {
      // 这里的 title 会显示在分享卡片上
      title: "HC健康舒适家",

      // 关键：把路径固定为你的 index 登录页
      path: "/pages/index/index",
    };
  },
});
