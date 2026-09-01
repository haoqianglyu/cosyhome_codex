const app  = getApp();


Component({
  data: {
    selected: 0,
    color: "#8a9994",
    selectedColor: "#55c2bb",
    list: []
  },
  attached() {
    var that = this;
    this.setData({
      list: app.ensureTabBarList()
    })
    this._tabbarCallback = res => {
      that.setData({
        list:res
      })
    }
    app.changeTabbarCallback = this._tabbarCallback
  },
  detached() {
    if (app.changeTabbarCallback === this._tabbarCallback) {
      app.changeTabbarCallback = null;
    }
  },
  methods: {
    switchTab(e) {
      const data = e.currentTarget.dataset
      const url = data.path
      if (!url) {
        return;
      }
      wx.switchTab({ url })
      this.setData({
        selected: data.index
      })
    }
  }
})
