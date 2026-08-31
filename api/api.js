const HOST = "https://control.cosyhome.com.cn";

function wxRequest(params = {}, url) {
  const { method = "GET", data = {}, header = {}, success, fail, complete } =
    params;

  return wx.request({
    url,
    method,
    data,
    header,
    success: (response) => success && success(response),
    fail: (error) => fail && fail(error),
    complete: (response) => complete && complete(response),
  });
}

function endpoint(path) {
  return (params) => wxRequest(params, `${HOST}${path}`);
}

function endpointWithId(path) {
  return (id, params) => wxRequest(params, `${HOST}${path}/${id}`);
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
  ),
  trans_ctrl_message: endpoint("/v1/wx/trans-ctrl-message"),
  trans_ctrl_message_sync: endpoint("/v1/wx/trans-ctrl-message-sync"),
  customer_info: endpoint("/v1/wx/customer-info"),
  get_house_layout: endpoint("/v1/wx/get-house-layout"),
  default_project_config: endpoint("/v1/wx/default-project-config"),
  user_projects: endpoint("/v1/wx/user-projects"),
  distributor_projects: endpoint("/v2/wx/distributor-projects"),
  distributor_visitor_projects: endpoint("/v1/wx/distributor-projects"),
  sendverify: endpoint("/v1/wx/bind-phone"),
  mini_login: endpoint("/v1/wx/mini-login"),
  bindproject: endpoint("/v1/wx/bind-project"),
  distributors: endpoint("/v1/wx/distributors"),
  distributor_id_projects: endpoint("/v1/wx/distributor-id-projects"),
  visitor_login: endpoint("/v1/wx/visitor-login"),
  vistor_projects: endpoint("/v1/wx/visitor-projects"),
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
