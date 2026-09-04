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
    loading: true,
    loadError: "",
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
    this._loadedProjectId = null;
    this._hasLoadedFloors = false;
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
      this._loadedProjectId = null;
      this._hasLoadedFloors = false;
      this._floorData = [];
      this.setData({
        floors: [],
        floors_id: [],
        content: [],
        loading: false,
        loadError: "",
      });
      return;
    }

    const projectId = String(wx.getStorageSync("selected_home") || "");
    const projectChanged =
      this._loadedProjectId !== null && this._loadedProjectId !== projectId;
    if (projectChanged) {
      this._hasLoadedFloors = false;
      this._floorData = [];
      this.setData({
        show: false,
        floors: [],
        floors_id: [],
        index: 0,
        content: [],
        loading: true,
        loadError: "",
      });
    }

    this.loadFloors(!this._hasLoadedFloors);
    this.startRefresh();
  },

  async loadFloors(showInitialLoading = false) {
    if (this._floorsRequestPending) {
      return;
    }
    this._floorsRequestPending = true;
    const requestProjectId = String(wx.getStorageSync("selected_home") || "");
    if (showInitialLoading) {
      this.setData({ loading: true, loadError: "" });
      wx.showNavigationBarLoading();
    }

    try {
      const body = await legacyControlMessageBody({ messageType: 2 });
      if (String(wx.getStorageSync("selected_home") || "") !== requestProjectId) {
        return;
      }
      const floorData = Array.isArray(body && body.data)
        ? body.data.map((floor) => ({
            ...floor,
            rooms: Array.isArray(floor.rooms)
              ? floor.rooms.map((room) => ({
                  ...room,
                  roomRouteName: encodeURIComponent(String(room.roomName || "房间")),
                }))
              : [],
          }))
        : [];
      this._floorData = floorData;
      const selectedFloorId = this.data.floors_id[this.data.index];
      const matchedFloorIndex = floorData.findIndex(
        (floor) => String(floor.floorId) === String(selectedFloorId),
      );
      const index =
        matchedFloorIndex >= 0
          ? matchedFloorIndex
          : Math.min(this.data.index, Math.max(floorData.length - 1, 0));
      const selectedFloor = floorData[index] || {};

      this._loadedProjectId = requestProjectId;
      this._hasLoadedFloors = true;
      this.setData({
        index,
        floors: floorData.map((floor) => floor.floorName),
        floors_id: floorData.map((floor) => floor.floorId),
        content: Array.isArray(selectedFloor.rooms) ? selectedFloor.rooms : [],
        loading: false,
        loadError: "",
      });
    } catch (error) {
      console.error("房间列表获取失败", error);
      if (showInitialLoading) {
        this.setData({ loading: false, loadError: "房间数据加载失败" });
      }
    } finally {
      this._floorsRequestPending = false;
      if (showInitialLoading) {
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

  onPullDownRefresh() {
    this.loadFloors(!this._hasLoadedFloors).finally(() =>
      wx.stopPullDownRefresh(),
    );
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
