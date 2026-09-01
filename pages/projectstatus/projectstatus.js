import api from "../../api/api.js";

const RECENT_WARNING_DAYS = 10;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

Page({
  data: {
    loading: false,
    requestStatus: "等待检查",
    checkTime: "-",
    projectName: "-",
    projectId: "-",
    customerName: "",
    customerPhone: "",
    warningItems: [],
    errorMessage: "",
    reportText: "项目状态检查\n\n正在准备检查...",
  },

  onLoad: function () {
    const canView = !!(
      wx.getStorageSync("isAdmin") || wx.getStorageSync("isdistributor")
    );

    if (!canView) {
      this.setData({
        requestStatus: "无查看权限",
        reportText: "项目状态检查\n\n当前账号无权查看项目状态",
      });
      return;
    }

    const projectInfo = wx.getStorageSync("selected_project_info") || {};
    this.setData({
      projectName:
        projectInfo.name || wx.getStorageSync("selected_homename") || "-",
      projectId:
        projectInfo.code || wx.getStorageSync("selected_home") || "-",
    });

    this.requestCustomerInfo();
    this.requestProjectStatus();
  },

  onPullDownRefresh: function () {
    this.requestCustomerInfo();
    this.requestProjectStatus();
  },

  requestCustomerInfo: function () {
    const that = this;
    const projectId = wx.getStorageSync("selected_home");

    if (!projectId) {
      return;
    }

    api.customer_info({
      method: "POST",
      header: {
        "content-type": "application/json",
        Authorization: wx.getStorageSync("access_token"),
      },
      data: {
        project_id: projectId,
      },
      success: function (res) {
        const customerInfo =
          (res.data && res.data.customer_info) || {};
        that.setData({
          customerName: customerInfo.customer_name || "",
          customerPhone: customerInfo.customer_phone || "",
        });

        if (that.projectStatusDevices) {
          that.updateReportText();
        }
      },
    });
  },

  requestProjectStatus: function () {
    const that = this;
    const projectId = wx.getStorageSync("selected_home");
    const checkTime = this.formatDate(new Date());
    const requestSequence = (this._requestSequence || 0) + 1;
    this._requestSequence = requestSequence;

    if (!projectId) {
      that.setData({
        loading: false,
        requestStatus: "未选择项目",
        reportText: "项目状态检查\n\n请先选择项目",
      });
      wx.stopPullDownRefresh();
      return;
    }

    that.projectStatusDevices = null;
    that.setData({
      loading: true,
      checkTime: checkTime,
      requestStatus: "检查中...",
      warningItems: [],
      errorMessage: "",
      reportText: "项目状态检查\n\n正在检查，请稍候...",
    });

    api.trans_ctrl_message_sync({
      method: "POST",
      header: {
        "content-type": "application/json",
        Authorization: wx.getStorageSync("access_token"),
      },
      data: {
        project_id: projectId,
        message_type: 500,
      },
      success: function (res) {
        if (requestSequence !== that._requestSequence) {
          return;
        }
        const responseData = that.parseResponseData(res.data);
        if (responseData && Number(responseData.code) === 4) {
          const message =
            responseData.message || "控制屏响应超时，请稍后重试";
          that.handleControlScreenTimeout(message);
          return;
        }

        if (
          typeof res.statusCode === "number" &&
          (res.statusCode < 200 || res.statusCode >= 300)
        ) {
          that.handleRequestError("请求失败，HTTP " + res.statusCode);
          return;
        }

        try {
          const parsed = that.parseProjectStatusResponse(res.data);
          that.projectStatusDevices = parsed.devices;
          that.setData({
            loading: false,
            requestStatus: "检查完成",
            projectId:
              that.data.projectId === "-"
                ? parsed.projectId || projectId
                : that.data.projectId,
          });
          that.updateReportText();
          wx.stopPullDownRefresh();
        } catch (e) {
          that.handleRequestError("返回数据解析失败");
        }
      },
      fail: function () {
        if (requestSequence !== that._requestSequence) {
          return;
        }
        that.handleRequestError("项目状态请求失败");
      },
    });
  },

  parseProjectStatusResponse: function (data) {
    let envelope = data;

    if (typeof envelope === "string") {
      envelope = JSON.parse(envelope);
    }

    let devices = envelope;
    let projectId = "";
    if (envelope && !Array.isArray(envelope) && typeof envelope === "object") {
      projectId = envelope.project_id || "";
      devices = envelope.body;
    }

    if (typeof devices === "string") {
      devices = JSON.parse(devices);
    }

    if (!Array.isArray(devices)) {
      throw new Error("项目状态数据不是数组");
    }

    return {
      projectId: projectId,
      devices: devices,
    };
  },

  parseResponseData: function (data) {
    if (typeof data !== "string") {
      return data;
    }

    try {
      return JSON.parse(data);
    } catch (e) {
      return data;
    }
  },

  updateReportText: function () {
    const warningItems = this.buildWarningItems(
      this.projectStatusDevices || []
    );
    const reportText = this.buildReportText(warningItems);
    this.setData({
      reportText: reportText,
      warningItems: warningItems,
    });
  },

  buildReportText: function (warningItems) {
    const warningLines = warningItems.map((item) => item.line);

    return [
      "项目状态检查",
      "检查时间：" + this.data.checkTime,
      "项目名称：" + this.data.projectName,
      "项目ID号：" + this.data.projectId,
      "业主名字：" + (this.data.customerName || "无"),
      "业主联系方式：" + (this.data.customerPhone || "无"),
      "",
      "故障预警：",
      warningLines.length ? warningLines.join("\n") : "无",
      "",
      "以上数据与云平台近10天记录一致",
    ].join("\n");
  },

  buildWarningItems: function (devices) {
    const warningItems = [];

    devices.filter(Boolean).forEach((device) => {
      const warnData = Array.isArray(device.warnData) ? device.warnData : [];

      warnData.forEach((item) => {
        const warn = item.warn || {};
        if (
          Object.prototype.hasOwnProperty.call(warn, "endDate") ||
          !this.isWarningWithinDays(warn, RECENT_WARNING_DAYS)
        ) {
          return;
        }

        const statusItem = this.formatStatusItem(device, item);
        if (statusItem) {
          warningItems.push(statusItem);
        }
      });
    });

    return warningItems;
  },

  isWarningWithinDays: function (warn, days, now = Date.now()) {
    const warningTimestamp = this.getWarningTimestamp(warn);
    if (warningTimestamp === null) {
      return false;
    }

    const earliestTimestamp = now - days * ONE_DAY_MS;
    return warningTimestamp >= earliestTimestamp && warningTimestamp <= now;
  },

  getWarningTimestamp: function (warn) {
    const rawTimestamp = Number(warn && warn.date);
    if (Number.isFinite(rawTimestamp) && rawTimestamp > 0) {
      return rawTimestamp < 1000000000000
        ? rawTimestamp * 1000
        : rawTimestamp;
    }

    if (warn && typeof warn.time === "string" && warn.time) {
      const timestamp = new Date(warn.time.replace(/-/g, "/")).getTime();
      return Number.isNaN(timestamp) ? null : timestamp;
    }

    return null;
  },

  formatStatusLine: function (device, item) {
    const statusItem = this.formatStatusItem(device, item);
    return statusItem ? statusItem.line : "";
  },

  formatStatusItem: function (device, item) {
    const warn = item.warn || {};
    const deviceName = device.name || warn.equipmentInfo || "未命名设备";
    const address = device.address || "-";
    const deviceLabel = deviceName + "（" + address + "）";
    const warningTime = this.formatWarningTime(warn);

    if (!warn.content) {
      return "";
    }

    let detail = warn.content;
    const normalPrefix = deviceName + "(" + address + ")";
    const chinesePrefix = deviceName + "（" + address + "）";
    if (detail.indexOf(normalPrefix) === 0) {
      detail = detail.slice(normalPrefix.length);
    } else if (detail.indexOf(chinesePrefix) === 0) {
      detail = detail.slice(chinesePrefix.length);
    }

    const hasAlarmValue =
      Object.prototype.hasOwnProperty.call(item, "data") &&
      item.data !== null &&
      item.data !== undefined &&
      item.data !== "";
    const alarmValue = hasAlarmValue ? this.formatNumber(item.data) : "";

    return this.createStatusItem(
      deviceLabel,
      detail,
      alarmValue,
      warningTime
    );
  },

  createStatusItem: function (
    deviceLabel,
    detail,
    alarmValue,
    warningTime
  ) {
    const alarmText = alarmValue ? "（报警值：" + alarmValue + "）" : "";
    return {
      key: deviceLabel + "-" + warningTime + "-" + detail,
      deviceLabel: deviceLabel,
      detail: detail,
      alarmValue: alarmValue,
      hasAlarmValue: alarmValue !== "",
      warningTime: warningTime,
      line:
        deviceLabel +
        "：" +
        detail +
        alarmText +
        "（故障时间：" +
        warningTime +
        "）",
    };
  },

  formatWarningTime: function (warn) {
    if (warn.time) {
      return warn.time;
    }

    if (warn.date !== undefined && warn.date !== null) {
      const timestamp = this.getWarningTimestamp(warn);
      const date = new Date(timestamp);
      if (timestamp !== null && !Number.isNaN(date.getTime())) {
        const pad = (value) => (value < 10 ? "0" + value : String(value));
        return (
          date.getFullYear() +
          "-" +
          pad(date.getMonth() + 1) +
          "-" +
          pad(date.getDate()) +
          " " +
          pad(date.getHours()) +
          ":" +
          pad(date.getMinutes()) +
          ":" +
          pad(date.getSeconds())
        );
      }
    }

    return "未知";
  },

  formatNumber: function (value) {
    const number = Number(value);
    if (Number.isNaN(number)) {
      return String(value);
    }
    return Number.isInteger(number) ? String(number) : number.toFixed(1);
  },

  formatDate: function (date) {
    const pad = (value) => (value < 10 ? "0" + value : String(value));
    return (
      date.getFullYear() +
      "年" +
      pad(date.getMonth() + 1) +
      "月" +
      pad(date.getDate()) +
      "日 " +
      pad(date.getHours()) +
      ":" +
      pad(date.getMinutes())
    );
  },

  handleRequestError: function (message) {
    this.projectStatusDevices = null;
    this.setData({
      loading: false,
      requestStatus: message,
      warningItems: [],
      errorMessage: message,
      reportText: "项目状态检查\n\n" + message,
    });
    wx.stopPullDownRefresh();
  },

  handleControlScreenTimeout: function (message) {
    this.handleRequestError(message);
    wx.showModal({
      title: "控制屏需要升级",
      content: message + "。请先升级本地控制屏后再重新检查。",
      showCancel: false,
      confirmText: "我知道了",
    });
  },
});
