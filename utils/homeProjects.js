import api from "../api/api.js";
import {
  apiRequest,
  normalizeProjects,
  saveSelectedProject,
} from "./projects.js";

const EMPTY_HOME_STATE = {
  show_mode: "",
  mode_icon: 1000,
  deviceData: "",
  home_mode: 1,
  homes: [],
  homes_id: [],
  showList: [],
  searchedList: [],
  showname: "",
};

export function filterProjects(value, projects) {
  const keyword = String(value || "").trim();
  if (!keyword) {
    return [];
  }
  return (Array.isArray(projects) ? projects : []).filter((project) =>
    String(project.name || "").includes(keyword),
  );
}

function projectRequest() {
  const app = getApp();
  const isVisitor = Boolean(app.globalData.isvisitor);
  const isDistributorVisitor = Boolean(
    app.globalData.isdistributor_visitor,
  );

  if (isVisitor && !isDistributorVisitor) {
    return { method: api.distributor_projects, data: {}, shouldSort: true };
  }
  if (isVisitor && isDistributorVisitor) {
    return { method: api.visitor_projects, data: {}, shouldSort: true };
  }
  if (wx.getStorageSync("isAdmin")) {
    return {
      method: api.distributor_id_projects,
      data: {
        page_options: { page: 1, limit: 10000 },
        distributor_id: wx.getStorageSync("current_distributorid"),
      },
      shouldSort: true,
    };
  }
  return { method: api.user_projects, data: {}, shouldSort: false };
}

export async function fetchHomeProjects() {
  const request = projectRequest();
  const data = await apiRequest(request.method, request.data);
  return normalizeProjects(data, request.shouldSort);
}

export function clearHomeProjects(page, showToast = true) {
  wx.setStorageSync("haveProject", false);
  page.setData({ ...EMPTY_HOME_STATE });
  if (showToast) {
    wx.showToast({ title: "无项目可查看", icon: "none" });
  }
}

export function applyHomeProjects(page, projects, requestedIndex = 0) {
  if (!Array.isArray(projects) || projects.length === 0) {
    clearHomeProjects(page);
    return null;
  }

  const index = Math.min(
    Math.max(Number(requestedIndex) || 0, 0),
    projects.length - 1,
  );
  const selectedProject = projects[index];

  wx.setStorageSync("haveProject", true);
  saveSelectedProject(selectedProject);
  page.setData({
    homes: projects,
    showList: projects,
    searchedList: projects,
    index,
    showname: selectedProject.name,
    show: false,
  });
  return selectedProject;
}

export function restoreHomeProjects(page, listKey, indexKey) {
  const projects = wx.getStorageSync(listKey);
  if (!Array.isArray(projects) || projects.length === 0) {
    return null;
  }
  return applyHomeProjects(page, projects, wx.getStorageSync(indexKey));
}
