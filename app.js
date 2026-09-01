import { configureConsole } from "./utils/logger.js";

const TAB_CONFIG = {
  1: {
    home: "/pages/home/home",
    middle: {
      pagePath: "/pages/rooms/rooms",
      text: "房间",
      iconPath: "/icons/room-unselected.png",
      selectedIconPath: "/icons/room-selected.png",
    },
  },
  2: {
    home: "/pages/home2/home2",
    middle: {
      pagePath: "/pages/envir/envir",
      text: "环境数据",
      iconPath: "/icons/huanjingjiance.png",
      selectedIconPath: "/icons/huanjingjiance-2.png",
    },
  },
};

const HOME_TAB_ICONS = {
  iconPath: "/icons/home-unselected.png",
  selectedIconPath: "/icons/home-selected.png",
};

const VISITOR_MODE_KEY = "visitor_mode";
const DISTRIBUTOR_VISITOR_MODE_KEY = "distributor_visitor_mode";
const TAB_ROLE_KEY = "tab_role";
const SESSION_KEYS = [
  "userInfo",
  "mode_list",
  "isAdmin",
  "access_token",
  "isdistributor",
  "haveProject",
  "selected_home",
  "selected_region",
  "selected_homename",
  "selected_project_info",
  "current_mode",
  "current_distributor",
  "current_distributorid",
  "selected_year",
  "selected_month",
  "change_distributor",
  "clock_info",
  "backData",
  "mode_icon",
  "show_mode",
  "airConditionerModeName",
  "is_member_login",
  "isSingle",
  "backfromhome1",
  "backfromhome2",
  "home1index",
  "home1showlist",
  "home2index",
  "home2showlist",
  VISITOR_MODE_KEY,
  DISTRIBUTOR_VISITOR_MODE_KEY,
  TAB_ROLE_KEY,
  "userPhoneNumber",
];

function readBooleanStorage(key) {
  const value = wx.getStorageSync(key);
  return value === true || value === "true";
}

function buildTabList(role) {
  const config = TAB_CONFIG[Number(role)];
  if (!config) {
    return [];
  }
  return [
    { pagePath: config.home, text: "我的家", ...HOME_TAB_ICONS },
    config.middle,
    {
      pagePath: "/pages/user/user",
      text: "个人中心",
      iconPath: "/icons/user-unselected.png",
      selectedIconPath: "/icons/user-selected.png",
    },
  ];
}

App({
  onLaunch() {
    configureConsole();
    this.restoreSessionState();
    this.autoUpdate();
    
    wx.getSystemInfo({
      success: e => {
        this.globalData.StatusBar = e.statusBarHeight;
        let capsule = wx.getMenuButtonBoundingClientRect();
		if (capsule) {
		 	this.globalData.Custom = capsule;
			this.globalData.CustomBar = capsule.bottom + capsule.top - e.statusBarHeight;
		} else {
			this.globalData.CustomBar = e.statusBarHeight + 50;
		}
      }
    })

    // if (this.globalData.userInfo) {
    //   console.log("aaaaaa")
    //   wx.switchTab({
    //     url: 'pages/bind/bind',
    //   })
    // } else {
    //   console.log("bbbbbb")
    //     wx.reLaunch({
    //         url: 'pages/index/index'
    //     })
    // }


  },


  globalData: {
    ColorList: [{
        title: '嫣红',
        name: 'red',
        color: '#e54d42'
      },
      {
        title: '桔橙',
        name: 'orange',
        color: '#f37b1d'
      },
      {
        title: '明黄',
        name: 'yellow',
        color: '#fbbd08'
      },
      {
        title: '橄榄',
        name: 'olive',
        color: '#8dc63f'
      },
      {
        title: '森绿',
        name: 'green',
        color: '#39b54a'
      },
      {
        title: '天青',
        name: 'cyan',
        color: '#1cbbb4'
      },
      {
        title: '海蓝',
        name: 'blue',
        color: '#0081ff'
      },
      {
        title: '姹紫',
        name: 'purple',
        color: '#6739b6'
      },
      {
        title: '木槿',
        name: 'mauve',
        color: '#9c26b0'
      },
      {
        title: '桃粉',
        name: 'pink',
        color: '#e03997'
      },
      {
        title: '棕褐',
        name: 'brown',
        color: '#a5673f'
      },
      {
        title: '玄灰',
        name: 'grey',
        color: '#8799a3'
      },
      {
        title: '草灰',
        name: 'gray',
        color: '#aaaaaa'
      },
      {
        title: '墨黑',
        name: 'black',
        color: '#333333'
      },
      {
        title: '雅白',
        name: 'white',
        color: '#ffffff'
      },
    ],
    isvisitor: false,
    isdistributor_visitor: false,
    list: [],
    userInfo: null,
    // selectedTabIndex: 0
  },

  restoreSessionState() {
    const hasToken = Boolean(wx.getStorageSync("access_token"));
    this.globalData.isvisitor =
      hasToken && readBooleanStorage(VISITOR_MODE_KEY);
    this.globalData.isdistributor_visitor =
      hasToken && readBooleanStorage(DISTRIBUTOR_VISITOR_MODE_KEY);
    if (!hasToken) {
      wx.removeStorageSync(VISITOR_MODE_KEY);
      wx.removeStorageSync(DISTRIBUTOR_VISITOR_MODE_KEY);
    }
    this.ensureTabBarList();
  },

  setVisitorMode(isVisitor, isDistributorVisitor = false) {
    const visitor = Boolean(isVisitor);
    const distributorVisitor = Boolean(isDistributorVisitor);
    this.globalData.isvisitor = visitor;
    this.globalData.isdistributor_visitor = distributorVisitor;
    wx.setStorageSync(VISITOR_MODE_KEY, visitor);
    wx.setStorageSync(DISTRIBUTOR_VISITOR_MODE_KEY, distributorVisitor);
  },

  clearSession() {
    SESSION_KEYS.forEach((key) => wx.removeStorageSync(key));
    this.globalData.isvisitor = false;
    this.globalData.isdistributor_visitor = false;
    this.globalData.list = [];
    this.globalData.userInfo = null;
  },

  ensureTabBarList() {
    if (Array.isArray(this.globalData.list) && this.globalData.list.length) {
      return this.globalData.list;
    }
    const storedRole = Number(wx.getStorageSync(TAB_ROLE_KEY));
    const fallbackRole = readBooleanStorage("isSingle") ? 2 : 1;
    this.globalData.list = buildTabList(storedRole || fallbackRole);
    return this.globalData.list;
  },

  switchTabWithRole(role) {
    const config = TAB_CONFIG[Number(role)];
    if (!config) {
      return;
    }
    wx.setStorageSync(TAB_ROLE_KEY, Number(role));
    this.globalData.list = buildTabList(role);
    if (this.changeTabbarCallback) {
      this.changeTabbarCallback(this.globalData.list);
    }
    wx.reLaunch({ url: config.home });
  },

  autoUpdate: function() {
    var self = this
    // 获取小程序更新机制兼容
    if (wx.canIUse('getUpdateManager')) {
      const updateManager = wx.getUpdateManager()
      updateManager.onCheckForUpdate(function(res) {
        if (res.hasUpdate) {
          wx.showModal({
            title: '更新提示',
            content: '检测到新版本，是否下载新版本并重启小程序？',
            success: function(res) {
              if (res.confirm) {
                self.downLoadAndUpdate(updateManager)
              } else if (res.cancel) {
                wx.showModal({
                  title: '温馨提示',
                  content: '本次版本更新涉及到新的功能添加，旧版本无法正常访问的',
                  showCancel:false,
                  confirmText:"确定更新",
                  success: function(res) {
                    if (res.confirm) {
                      //下载新版本，并重新应用
                      self.downLoadAndUpdate(updateManager)
                    }
                  }
                })
              }
            }
          })
        }
      })
    } else {
      wx.showModal({
        title: '提示',
        content: '当前微信版本过低，无法使用该功能，请升级到最新微信版本后重试。',
      })
    }
  },
  
  downLoadAndUpdate: function (updateManager){
    wx.showLoading();
     updateManager.onUpdateReady(function () {
      wx.hideLoading()
      updateManager.applyUpdate()
    })
    updateManager.onUpdateFailed(function () {
      wx.hideLoading()
      // 新的版本下载失败
      wx.showModal({
        title: '已经有新版本了哟~',
        content: '新版本已经上线，请您删除当前小程序，重新搜索打开',
      })
    })
  }
})
