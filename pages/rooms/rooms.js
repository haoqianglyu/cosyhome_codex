import { legacyControlMessageBody } from "../../utils/controlMessage.js";

Page({
  data: {
    show: false,
    floors: [],
    floors_id: [],
    index: 0,
    content: [],
    interval: null,
    statusBarHeight: 0,
    projectName: "",
  },

  syncPageHeader() {
    const windowInfo =
      typeof wx.getWindowInfo === "function"
        ? wx.getWindowInfo()
        : wx.getSystemInfoSync();
    this.setData({
      statusBarHeight: windowInfo.statusBarHeight || 0,
      projectName: wx.getStorageSync("selected_homename") || "房间",
    });
  },

  onLoad() {
    this.syncPageHeader();
  },

  selectTap() {
    this.setData({ show: !this.data.show });
  },

  optionTap(event) {
    const index = Number(event.currentTarget.dataset.index) || 0;
    const selectedFloor = Array.isArray(this._floorData)
      ? this._floorData[index] || {}
      : {};
    this.setData({
      index,
      show: false,
      content: Array.isArray(selectedFloor.rooms)
        ? selectedFloor.rooms
        : this.data.content,
    });
    this.loadFloors();
  },

  onShow() {
    this.syncPageHeader();
    if (typeof this.getTabBar === "function" && this.getTabBar()) {
      this.getTabBar().setData({ selected: 1 });
    }

    if (wx.getStorageSync("haveProject") === false) {
      this.clearTimeInterval();
      this.setData({ floors: [], floors_id: [], content: [] });
      return;
    }

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
      const body = await legacyControlMessageBody({ messageType: 2 });
      const floorData = Array.isArray(body && body.data) ? body.data : [];
      this._floorData = floorData;
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
