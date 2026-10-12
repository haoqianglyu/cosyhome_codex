const HOST = "https://control.cosyhome.com.cn";
let handlingAuthExpired = false;

function requestError(message, type, response) {
  const error = new Error(message);
  error.errMsg = message;
  error.type = type;
  if (response) {
    error.statusCode = response.statusCode;
    error.data = response.data;
    error.response = response;
  }
  return error;
}

function handleAuthExpired() {
  if (handlingAuthExpired) {
    return;
  }
  handlingAuthExpired = true;
  const app = getApp();
  if (app && typeof app.clearSession === "function") {
    app.clearSession();
  } else {
    wx.removeStorageSync("access_token");
  }
  wx.showToast({ title: "登录已过期，请重新登录", icon: "none" });
  setTimeout(() => {
    wx.reLaunch({
      url: "/pages/index/index",
      complete: () => {
        handlingAuthExpired = false;
      },
    });
  }, 500);
}

function parsePayload(data) {
  if (typeof data !== "string") {
    return data;
  }
  try {
    return JSON.parse(data);
  } catch (error) {
    return data;
  }
}

function rejectBusinessCodes(codes, fallbackMessage) {
  const rejectedCodes = new Set(codes.map(Number));
  return (data) => {
    const payload = parsePayload(data);
    if (!payload || !rejectedCodes.has(Number(payload.code))) {
      return null;
    }
    return payload.message || fallbackMessage;
  };
}

function wxRequest(params = {}, url) {
  const {
    method = "GET",
    data = {},
    header = {},
    success,
    fail,
    complete,
    businessValidator,
    skipAuthRedirect = false,
    ...requestOptions
  } = params;

  return wx.request({
    timeout: 15000,
    ...requestOptions,
    url,
    method,
    data,
    header,
    success: (response) => {
      if (
        typeof response.statusCode === "number" &&
        (response.statusCode < 200 || response.statusCode >= 300)
      ) {
        const error = requestError(
          `请求失败，HTTP ${response.statusCode}`,
          "http",
          response,
        );
        if (response.statusCode === 401 && !skipAuthRedirect &&
          (!header.Authorization || header.Authorization === wx.getStorageSync("access_token"))) {
          handleAuthExpired();
        }
        if (fail) {
          fail(error);
        }
        return;
      }

      if (typeof businessValidator === "function") {
        let validationResult;
        try {
          validationResult = businessValidator(response.data, response);
        } catch (error) {
          if (fail) {
            fail(error);
          }
          return;
        }
        if (validationResult) {
          const error =
            validationResult instanceof Error
              ? validationResult
              : requestError(String(validationResult), "business", response);
          if (fail) {
            fail(error);
          }
          return;
        }
      }
      if (success) {
        success(response);
      }
    },
    fail: (error) => {
      if (!fail) {
        return;
      }
      if (error instanceof Error) {
        fail(error);
        return;
      }
      const message =
        (error && error.errMsg) || "网络连接失败，请检查网络后重试";
      const normalizedError = requestError(message, "network");
      normalizedError.originalError = error;
      fail(normalizedError);
    },
    complete: (response) => complete && complete(response),
  });
}

function endpoint(path, defaults = {}) {
  return (params = {}) =>
    wxRequest(
      {
        ...defaults,
        ...params,
        businessValidator:
          params.businessValidator || defaults.businessValidator,
      },
      `${HOST}${path}`,
    );
}

function endpointWithId(path) {
  return (id, params) =>
    wxRequest(params, `${HOST}${path}/${encodeURIComponent(String(id))}`);
}

const api = {
  control_healthy_check: endpoint("/v1/wx/control-healthy-check"),
  download_distributor_bg: endpoint("/v1/wx/get-distributor-bg-url"),
  ctrl_modify_room_name: endpoint("/v1/wx/ctrl-modify-room-name"),
  ctrl_room_temp: endpoint("/v1/wx/ctrl-room-temp"),
  stats_room_data: endpoint("/v1/wx/stats-room-data"),
  ctrl_mode: endpoint("/v1/wx/ctrl-mode"),
  ctrl_home: endpoint("/v1/wx/ctrl-home"),
  trans_ctrl_message_callback: endpoint(
    "/v1/wx/trans-ctrl-message-callback",
    {
      businessValidator: rejectBusinessCodes(
        [4],
        "控制屏响应超时，请稍后重试",
      ),
    },
  ),
  trans_ctrl_message: endpoint("/v1/wx/trans-ctrl-message"),
  trans_ctrl_message_sync: endpoint("/v1/wx/trans-ctrl-message-sync", {
    businessValidator: rejectBusinessCodes(
      [4],
      "控制屏响应超时，请稍后重试",
    ),
  }),
  customer_info: endpoint("/v1/wx/customer-info"),
  get_house_layout: endpoint("/v1/wx/get-house-layout"),
  default_project_config: endpoint("/v1/wx/default-project-config"),
  user_projects: endpoint("/v1/wx/user-projects"),
  distributor_projects: endpoint("/v2/wx/distributor-projects"),
  distributor_visitor_projects: endpoint("/v1/wx/distributor-projects"),
  sendverify: endpoint("/v1/wx/bind-phone"),
  mini_login: endpoint("/v1/wx/mini-login", {
    skipAuthRedirect: true,
    businessValidator: rejectBusinessCodes([3], "微信登录凭证错误"),
  }),
  bindproject: endpoint("/v1/wx/bind-project"),
  distributors: endpoint("/v1/wx/distributors"),
  distributor_id_projects: endpoint("/v1/wx/distributor-id-projects"),
  visitor_login: endpoint("/v1/wx/visitor-login", {
    skipAuthRedirect: true,
    businessValidator: rejectBusinessCodes([5], "访客登录失败"),
  }),
  visitor_projects: endpoint("/v1/wx/visitor-projects"),
  get_weather: endpoint("/v1/wx/weather"),
  project_report: endpoint("/v1/wx/project-reports"),
  get_city: endpoint("/v1/wx/getcity"),
  work_order: endpoint("/v1/wx/work-orders"),
  work_order_contents: endpoint("/v1/wx/work-order-contents"),
  work_order_categories: endpoint("/v1/wx/work-order-categories"),
  customers: endpoint("/v1/wx/customers"),
  create_customer: endpoint("/v1/wx/customer/create"),
  get_attachment: endpoint("/v1/wx/work-order-attachments"),
  create_attachment: endpoint("/v1/wx/work-order-attachment/create"),
  get_devices: endpoint("/v1/wx/login-devices"),
  device_logout: endpoint("/v1/wx/device-logout"),
  delete_customer: endpointWithId("/v1/wx/customer/remove"),
  work_order_logs: endpointWithId("/v1/wx/work-order/logs"),
  delete_attachment: endpointWithId("/v1/wx/work-order-attachment/delete"),
  attachment_download: endpointWithId(
    "/v1/wx/work-order-attachment/download",
  ),
  modify_order: endpointWithId("/v1/wx/work-order/modify"),
  set_status: endpointWithId("/v1/wx/work-order/set-status"),
  work_order_content_detail: endpointWithId("/v1/wx/work-order-content"),
  create_repair_report: endpoint("/v1/wx/repair-report/create"),
  get_repair_reports: endpoint("/v1/wx/repair-reports"),
  create_repair_report_attachment: endpoint(
    "/v1/wx/repair-report-attachment/create",
  ),
  get_repair_report_attachments: endpoint(
    "/v1/wx/repair-report-attachments",
  ),
  get_repair_report_attachment_upload_url: endpointWithId(
    "/v1/wx/repair-report-attachment/upload",
  ),
  get_repair_report_attachment_download_url: endpointWithId(
    "/v1/wx/repair-report-attachment/download",
  ),
  remove_repair_report_attachment: endpointWithId(
    "/v1/wx/repair-report-attachment/delete",
  ),
};

module.exports = api;
