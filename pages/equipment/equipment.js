import { controlMessageBody } from "../../utils/controlMessage.js";

let currentMenuType = null;
let currentEquipmentId = null;

Page({
  data: {
    scrollTop: 0,
    menu_number: 1,
    open: false,
    open_gif: true,
    mark: 0,
    newmark: 0,
    istoright: true,
    flag: false,
    color: "",
    first_equipmentid: null,
    first_type: null,
    first_title: null,
    menuList: { menuList: [] },
    menuList_name: [],
    menuList_type: [],
    menuList_id: [],
    menu_type: [],
    current_item: 0,
    content: [],
    interval: null,
    show: false,
    index2: 0,
    rooms: [],
    titles: [],
    ids: [],
  },

  onLoad() {
    wx.setNavigationBarTitle({ title: "设备数据" });
    this.loadMenuList();
  },

  onShow() {
    this.startRefresh();
  },

  async loadMenuList() {
    wx.showLoading({ title: "正在加载数据" });
    try {
      const body = await controlMessageBody({ messageType: 5 });
      const menuItems = Array.isArray(body && body.menuList)
        ? body.menuList
        : [];
      const menuNames = [];
      const menuTypes = [];
      const menuIds = [];
      const equipmentTypes = [];

      menuItems.forEach((menu) => {
        const firstEquipment =
          Array.isArray(menu.equipments) && menu.equipments.length
            ? menu.equipments[0]
            : null;
        menuNames.push(firstEquipment ? firstEquipment.name : menu.name);
        menuTypes.push(menu.type);
        menuIds.push(firstEquipment ? firstEquipment.id : menu.id);
        equipmentTypes.push(firstEquipment ? firstEquipment.equipmentType : null);
      });

      this.setData({
        menuList: body || { menuList: [] },
        menuList_name: menuNames,
        menuList_type: equipmentTypes,
        menuList_id: menuIds,
        menu_type: menuTypes,
        rooms: [],
      });

      if (menuItems.length) {
        this.selectMenu(0);
      } else {
        this.setData({ content: [], titles: [], ids: [] });
      }
    } catch (error) {
      wx.showToast({ title: "设备列表获取失败", icon: "none" });
    } finally {
      wx.hideLoading();
      this.setData({ color: "#74ceae", open_gif: false });
    }
  },

  selectTap() {
    this.setData({ show: !this.data.show });
  },

  optionTap(event) {
    const index = Number(event.currentTarget.dataset.index) || 0;
    currentEquipmentId = this.data.ids[index];
    this.setData({ index2: index, show: false });
    this.loadEquipmentData(true);
  },

  clicked(event) {
    const index = Number(event.currentTarget.dataset.key) || 0;
    this.selectMenu(index, true);
  },

  selectMenu(index, showLoading = false) {
    const menuItems = this.data.menuList.menuList || [];
    const menu = menuItems[index];
    if (!menu) {
      return;
    }

    const equipments = Array.isArray(menu.equipments) ? menu.equipments : [];
    const titles = equipments.length
      ? equipments.map((item) => item.name)
      : [menu.name];
    const ids = equipments.length
      ? equipments.map((item) => item.id)
      : [menu.id];

    currentMenuType = menu.type;
    currentEquipmentId = ids[0];
    this.setData({
      current_item: index,
      index2: 0,
      menu_number: titles.length,
      titles,
      ids,
      first_type: currentMenuType,
      first_equipmentid: currentEquipmentId,
    });
    this.loadEquipmentData(showLoading);
  },

  async loadEquipmentData(showLoading = false) {
    if (currentMenuType == null || currentEquipmentId == null) {
      return;
    }
    if (this._equipmentRequestPending) {
      return;
    }
    this._equipmentRequestPending = true;
    if (showLoading) {
      wx.showLoading({ title: "正在加载数据" });
    }

    const requestId = Date.now();
    try {
      const body = await controlMessageBody({
        messageType: 6,
        body: {
          menuType: currentMenuType,
          equipmentId: currentEquipmentId,
          requestId,
        },
      });
      if (
        body &&
        body.requestId !== undefined &&
        String(body.requestId) !== String(requestId)
      ) {
        console.warn("设备数据 requestId 不匹配", requestId, body.requestId);
      }
      this.setData({ content: this.remove_empty((body && body.data) || []) });
    } catch (error) {
      console.error("设备数据获取失败", error);
      if (showLoading) {
        wx.showToast({ title: "加载失败", icon: "none" });
      }
    } finally {
      this._equipmentRequestPending = false;
      if (showLoading) {
        wx.hideLoading();
      }
    }
  },

  startRefresh() {
    this.clearTimeInterval();
    const interval = setInterval(() => this.loadEquipmentData(), 5000);
    this.setData({ interval });
  },

  tap_ch() {
    this.setData({
      open: !this.data.open,
      open_gif: !this.data.open_gif,
    });
  },

  tap_start(event) {
    const pageX = event.touches[0].pageX;
    this.data.mark = pageX;
    this.data.newmark = pageX;
  },

  tap_drag(event) {
    const pageX = event.touches[0].pageX;
    this.data.newmark = pageX;
    if (this.data.mark !== pageX) {
      const open = this.data.mark < pageX;
      this.setData({ open, open_gif: open });
    }
    this.data.mark = pageX;
  },

  remove_empty(items) {
    return Array.isArray(items)
      ? items.filter((item) => item && item.title !== "")
      : [];
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
});
