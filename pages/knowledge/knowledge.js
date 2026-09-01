Page({
  data: {
    loading: true,
    errorMessage: "",
    documentOpened: false,
  },

  onLoad() {
    this._destroyed = false;
    this.loadDocument();
  },

  getDocumentUrl() {
    const role = wx.getStorageSync("isdistributor") ? "distributor" : "user";
    return `https://cosyminiprogram.oss-cn-hangzhou.aliyuncs.com/cloud_pic/mini_${role}.pdf`;
  },

  downloadDocument(url) {
    return new Promise((resolve, reject) => {
      this._downloadTask = wx.downloadFile({
        url,
        success: (response) => {
          if (
            response.statusCode !== 200 ||
            !response.tempFilePath
          ) {
            reject(new Error(`文档下载失败（${response.statusCode || "未知状态"}）`));
            return;
          }
          resolve(response.tempFilePath);
        },
        fail: reject,
      });
    });
  },

  openDocument(filePath) {
    return new Promise((resolve, reject) => {
      wx.openDocument({ filePath, fileType: "pdf", success: resolve, fail: reject });
    });
  },

  async loadDocument() {
    if (this._documentLoading) return;
    const requestVersion = (this._requestVersion || 0) + 1;
    this._requestVersion = requestVersion;
    this._documentLoading = true;
    this.setData({ loading: true, errorMessage: "" });
    wx.showNavigationBarLoading();
    try {
      const filePath = await this.downloadDocument(this.getDocumentUrl());
      if (this._destroyed || requestVersion !== this._requestVersion) return;
      await this.openDocument(filePath);
      if (this._destroyed || requestVersion !== this._requestVersion) return;
      this.setData({ loading: false, documentOpened: true });
    } catch (error) {
      if (!this._destroyed && requestVersion === this._requestVersion) {
        console.error("知识文档打开失败", error);
        this.setData({
          loading: false,
          errorMessage: "文档打开失败，请检查网络后重试",
        });
      }
    } finally {
      if (requestVersion === this._requestVersion) {
        this._documentLoading = false;
        this._downloadTask = null;
        wx.hideNavigationBarLoading();
      }
    }
  },

  retryLoad() {
    this.loadDocument();
  },

  onUnload() {
    this._destroyed = true;
    this._requestVersion = (this._requestVersion || 0) + 1;
    if (this._downloadTask && typeof this._downloadTask.abort === "function") {
      this._downloadTask.abort();
    }
    wx.hideNavigationBarLoading();
  },

  onShareAppMessage() {
    return { title: "HC健康舒适家", path: "/pages/index/index" };
  },
});
