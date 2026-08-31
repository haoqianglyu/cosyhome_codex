import {
  controlMessageBody,
  sendControlCommand,
} from "../../utils/controlMessage.js";

Page({
  data: {
    version_info: "",
  },
  onLoad() {
    wx.setNavigationBarTitle({ title: "强制远程更新" });

    this.loadVersionInfo();
  },

  async loadVersionInfo() {
    try {
      const body = await controlMessageBody({
        messageType: 12,
        body: String(Date.now()),
      });
      this.setData({ version_info: body || {} });
    } catch (error) {
      wx.showToast({ title: "版本信息获取失败", icon: "none" });
    }
  },

  update() {
    wx.showModal({
      title: "提示",
      cancelText: "取消",
      confirmText: "确认",
      content: "确认需要远程强制更新吗",
      success: (res) => {
        if (res.confirm) {
          sendControlCommand({
            messageType: 13,
            body: String(Date.now()),
          })
            .then(() => {
              wx.showToast({ title: "升级指令已发送", icon: "success" });
            })
            .catch(() => {
              wx.showToast({ title: "升级指令发送失败", icon: "none" });
            });
        }
      },
    });
  },

  onShareAppMessage() {
    return {
      title: "HC健康舒适家",
      path: "/pages/index/index",
    };
  },
});
