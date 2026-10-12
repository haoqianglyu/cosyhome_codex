import api from "../../api/api.js";
import { prepareReport } from "../../utils/report.js";
import { apiRequest, getErrorMessage, isCurrentPage } from "../../utils/request.js";
import { captureProjectContext, isProjectContextCurrent } from "../../utils/projects.js";

Page({
  data: {
    reports: [],
    loading: true,
    loadError: "",
  },

  onLoad() {
    this._pageVisible = true;
    wx.setNavigationBarTitle({ title: "查看报告" });
    this.fetchReports();
  },

  onShow() {
    this._pageVisible = true;
  },

  onHide() {
    this._pageVisible = false;
  },

  onUnload() {
    this._destroyed = true;
    this._pageVisible = false;
    this._reportRequestVersion = (this._reportRequestVersion || 0) + 1;
  },

  async fetchReports() {
    if (this._reportLoading) return;
    const requestVersion = (this._reportRequestVersion || 0) + 1;
    this._reportRequestVersion = requestVersion;
    this._reportLoading = true;
    const context = captureProjectContext();
    this.setData({ loading: true, loadError: "" });
    try {
      const response = await apiRequest(api.project_report, {
        method: "POST",
        header: {
          "content-type": "application/json",
          Authorization: wx.getStorageSync("access_token"),
        },
        data: { project_id: context.projectId },
      });
      if (this._destroyed || requestVersion !== this._reportRequestVersion || !isProjectContextCurrent(context)) return;
      const entities = response.data.project_report_entities || [];
      const reports = [];
      let invalidCount = 0;
      entities.forEach((entity) => {
        try {
          reports.push(prepareReport(entity));
        } catch (error) {
          invalidCount++;
          console.error("报告数据解析失败", entity && entity.id, error);
        }
      });
      this.setData({ reports, loading: false });
      if (invalidCount && isCurrentPage(this)) {
        wx.showToast({ title: `${invalidCount}份报告数据异常，已跳过`, icon: "none" });
      }
    } catch (error) {
      if (!this._destroyed && requestVersion === this._reportRequestVersion && isProjectContextCurrent(context)) {
        this.setData({ loading: false, loadError: getErrorMessage(error, "报告加载失败，请重试") });
      }
    } finally {
      this._reportLoading = false;
    }
  },

  retryLoad() {
    this.fetchReports();
  },

  onReportTap(e) {
    const item = this.data.reports[e.currentTarget.dataset.index];
    if (!item) return;
    wx.navigateTo({
      url: `/pages/reportdetail/reportdetail?id=${encodeURIComponent(item.id)}`,
      success: (res) => res.eventChannel.emit("acceptData", item),
    });
  },

  onShareAppMessage() {
    return { title: "HC健康舒适家", path: "/pages/index/index" };
  },
});
