import { controlMessageBody } from "../../utils/controlMessage.js";

Page({
  data: {
    show: false,
    floors: [],
    floors_id: [],
    index: 0,
    content: [],
    interval: null,
  },

  selectTap() {
    this.setData({ show: !this.data.show });
  },

  optionTap(event) {
    const index = Number(event.currentTarget.dataset.index) || 0;
    this.setData({ index, show: false });
    this.loadFloors();
  },

  onShow() {
    if (typeof this.getTabBar === "function" && this.getTabBar()) {
      this.getTabBar().setData({ selected: 1 });
    }

    if (wx.getStorageSync("haveProject") === false) {
      this.clearTimeInterval();
      this.setData({ floors: [], floors_id: [], content: [] });
      return;
    }

    wx.setNavigationBarTitle({
      title: wx.getStorageSync("selected_homename"),
    });
    this.loadFloors(true);
    this.startRefresh();
  },

  async loadFloors(showLoading = false) {
    if (this._floorsRequestPending) {
      return;
    }
    this._floorsRequestPending = true;
    if (showLoading) {
      wx.showNavigationBarLoading();
    }

    try {
      const body = await controlMessageBody({ messageType: 2 });
      const floorData = Array.isArray(body && body.data) ? body.data : [];
      const index = Math.min(this.data.index, Math.max(floorData.length - 1, 0));
      const selectedFloor = floorData[index] || {};

      this.setData({
        index,
        floors: floorData.map((floor) => floor.floorName),
        floors_id: floorData.map((floor) => floor.floorId),
        content: Array.isArray(selectedFloor.rooms) ? selectedFloor.rooms : [],
      });
    } catch (error) {
      console.error("房间列表获取失败", error);
    } finally {
      this._floorsRequestPending = false;
      if (showLoading) {
        wx.hideNavigationBarLoading();
      }
    }
  },

  startRefresh() {
    this.clearTimeInterval();
    const interval = setInterval(() => this.loadFloors(), 10000);
    this.setData({ interval });
  },

  clearTimeInterval() {
    if (this.data.interval) {
      clearInterval(this.data.interval);
      this.setData({ interval: null });
    }
  },

  onHide() {
    this.clearTimeInterval();
  },

  onUnload() {
    this.clearTimeInterval();
  },

  onShareAppMessage() {
    return {
      title: "HC健康舒适家",
      path: "/pages/index/index",
    };
  },

  groupBy(array) {
    const floorIds = Array.from(new Set(array.map((item) => item.floorId)));
    return floorIds.map((floorId) => ({
      floor_id: floorId,
      list: array.filter((item) => item.floorId === floorId),
    }));
  },
});
