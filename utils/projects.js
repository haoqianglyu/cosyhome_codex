const PROJECT_FIELDS = [
  "name",
  "id",
  "app_name",
  "code",
  "level",
  "building_type",
  "building_area",
  "energy_level",
  "customer_region",
  "delivery_time",
  "online",
];

let projectRevision = 0;
const PROJECT_STATE_KEYS = [
  "selected_home", "selected_project_info", "selected_homename",
  "selected_region", "mode_list", "current_mode", "clock_info",
  "backData", "mode_icon", "show_mode", "airConditionerModeName",
];

export function clearSelectedProject() {
  projectRevision += 1;
  PROJECT_STATE_KEYS.forEach((key) => wx.removeStorageSync(key));
  wx.setStorageSync("haveProject", false);
}

export function captureProjectContext(projectId = wx.getStorageSync("selected_home")) {
  return { projectId, accessToken: wx.getStorageSync("access_token"), revision: projectRevision };
}

export function isProjectContextCurrent(context) {
  return Boolean(context && context.projectId) &&
    context.revision === projectRevision &&
    String(context.projectId) === String(wx.getStorageSync("selected_home")) &&
    context.accessToken === wx.getStorageSync("access_token");
}

export function authHeader() {
  return {
    "content-type": "application/json",
    Authorization: wx.getStorageSync("access_token"),
  };
}

export function apiRequest(method, data = {}) {
  return new Promise((resolve, reject) => {
    method({
      method: "POST",
      data,
      header: authHeader(),
      success: (response) => resolve(response.data),
      fail: reject,
    });
  });
}

export function getProjectEntities(data) {
  return data && Array.isArray(data.project_entities)
    ? data.project_entities
    : [];
}

export function normalizeProject(project) {
  return PROJECT_FIELDS.reduce((result, field) => {
    if (Object.prototype.hasOwnProperty.call(project, field)) {
      result[field] = project[field];
    }
    return result;
  }, {});
}

export function sortProjects(projects) {
  return projects.slice().sort((left, right) => {
    if (Boolean(left.online) !== Boolean(right.online)) {
      return left.online ? -1 : 1;
    }
    if (left.app_name === "通用版" && right.app_name !== "通用版") {
      return -1;
    }
    if (right.app_name === "通用版" && left.app_name !== "通用版") {
      return 1;
    }
    return 0;
  });
}

export function normalizeProjects(data, shouldSort = false) {
  const projects = getProjectEntities(data).map(normalizeProject);
  return shouldSort ? sortProjects(projects) : projects;
}

export function saveSelectedProject(project) {
  if (!project) {
    return;
  }

  if (String(project.id) !== String(wx.getStorageSync("selected_home"))) {
    clearSelectedProject();
  }

  wx.setStorageSync("haveProject", true);
  wx.setStorageSync("selected_project_info", normalizeProject(project));
  wx.setStorageSync("selected_home", project.id);
  wx.setStorageSync("selected_homename", project.name);
  wx.setStorageSync("selected_region", project.customer_region || "");
}

export function enterProjectRole(projects) {
  if (!projects.length) {
    return false;
  }

  const isSingle = projects[0].app_name === "单机版";
  const role = isSingle ? 2 : 1;
  const app = getApp();
  saveSelectedProject(projects[0]);
  app.globalData.userInfo = { userName: `role${role}`, role };
  wx.setStorageSync("isSingle", isSingle);

  app.switchTabWithRole(role);
  return true;
}
