// pages/membership/membership.js
import Toast from "@vant/weapp/toast/toast";
import api from "../../api/api.js";
Page({
  /**
   * 页面的初始数据
   */
  data: {
    memberList: [],
    loading: true,
    currentOpenSwipeIndex: -1, // 当前打开的滑动单元格索引
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    this.loadMemberData();
  },

  /**
   * 加载成员数据
   */
  /**
   * 加载成员数据
   */
  loadMemberData(callback) {
    api.customers({
      method: "POST",
      header: {
        "content-type": "application/json",
        Authorization: wx.getStorageSync("access_token"),
      },
      data: {},
      success: (res) => {
        console.log("customers API response:", res);
        if (res && res.data && res.data.entities) {
          // 转换API数据格式为页面需要的格式
          const memberList = res.data.entities.map((customer, index) => ({
            id: customer.id,
            name: customer.customer_name,
            phone: customer.customer_phone,
            main_open_id: customer.main_open_id,
          }));

          this.setData({
            memberList: memberList,
            loading: false,
          });
        } else {
          console.error("Invalid API response format:", res);
          this.setData({ loading: false });
        }
        if (callback) callback();
      },
      fail: (err) => {
        console.error("customers API failed:", err);
        this.setData({ loading: false });
        wx.showToast({
          title: "加载成员数据失败",
          icon: "none",
          duration: 2000,
        });
        if (callback) callback();
      },
    });
  },

  /**
   * 生命周期函数--监听页面初次渲染完成
   */
  onReady() {},

  /**
   * 生命周期函数--监听页面显示
   */
  onShow() {
    console.log("111");
    // 页面显示时重新加载成员数据，确保从添加成员页面返回后能看到最新数据
    this.loadMemberData();
  },

  /**
   * 生命周期函数--监听页面隐藏
   */
  onHide() {},

  /**
   * 生命周期函数--监听页面卸载
   */
  onUnload() {},

  /**
   * 页面相关事件处理函数--监听用户下拉动作
   */
  onPullDownRefresh() {
    this.loadMemberData(() => {
      wx.stopPullDownRefresh();
    });
  },

  /**
   * 页面上拉触底事件的处理函数
   */
  onReachBottom() {},

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
   * 滑动单元格打开事件
   */
  onSwipeCellOpen(event) {
    const index = event.currentTarget.dataset.index;

    // 如果有其他打开的滑动单元格，先关闭它
    if (
      this.data.currentOpenSwipeIndex !== -1 &&
      this.data.currentOpenSwipeIndex !== index
    ) {
      this.closeSwipeCell(this.data.currentOpenSwipeIndex);
    }

    // 记录当前打开的滑动单元格索引
    this.setData({
      currentOpenSwipeIndex: index,
    });
  },

  /**
   * 滑动单元格关闭事件
   */
  onSwipeCellClose(event) {
    this.setData({
      currentOpenSwipeIndex: -1,
    });
  },

  /**
   * 点击空白区域关闭滑动单元格
   */
  onCloseSwipeCell() {
    if (this.data.currentOpenSwipeIndex !== -1) {
      this.closeSwipeCell(this.data.currentOpenSwipeIndex);
    }
  },

  /**
   * 点击成员条目（阻止冒泡到空白区域）
   */
  onMemberItemTap() {
    // 阻止事件冒泡，避免触发关闭滑动单元格
  },

  /**
   * 关闭指定索引的滑动单元格
   */
  closeSwipeCell(index) {
    const swipeCellId = `swipe-cell-${index}`;
    const swipeCell = this.selectComponent(`#${swipeCellId}`);
    if (swipeCell) {
      swipeCell.close();
    }
  },

  /**
   * 删除成员
   */
  onDeleteMember(event) {
    const { index, id, name } = event.currentTarget.dataset;

    // 显示确认删除对话框
    wx.showModal({
      title: "确认删除",
      content: `确定要删除成员"${name}"吗？删除后无法恢复。`,
      confirmText: "删除",
      confirmColor: "#ff4757",
      cancelText: "取消",
      success: (res) => {
        if (res.confirm) {
          this.performDeleteMember(id, index, name);
        }
      },
    });
  },

  /**
   * 执行删除成员操作
   */
  performDeleteMember(id, index, name) {
    // 显示加载提示
    wx.showLoading({
      title: "删除中...",
      mask: true,
    });

    api.delete_customer(id, {
      method: "DELETE",
      header: {
        Authorization: wx.getStorageSync("access_token"),
      },
      success: (delRes) => {
        wx.hideLoading();
        console.log("删除成员成功:", delRes);

        if (delRes.statusCode === 200) {
          // 从本地数据中移除该成员
          const memberList = this.data.memberList;
          memberList.splice(index, 1);
          this.setData({ memberList });

          // 显示成功提示
          Toast.success(`成员"${name}"删除成功`);
        } else {
          // 删除失败
          Toast.fail("删除失败，请重试");
        }
      },
      fail: (err) => {
        wx.hideLoading();
        console.error("删除成员接口失败:", err);
        Toast.fail("网络错误，删除失败");
      },
    });
  },

  /**
   * 添加成员
   */
  onAddMember() {
    wx.navigateTo({
      url: "/subpackages/addMember/addMember",
    });
  },
});
