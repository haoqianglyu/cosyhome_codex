const app  = getApp();


Component({
  data: {
    selected: 0,
    color: "#aaaaaa",
    selectedColor: "#1F1F1F",
    list: app.globalData.list
  },
  attached() {
    var that = this;
    console.log(app.globalData.list)
    this.setData({
      // selected: app.globalData.selectedTabIndex,
      list:app.globalData.list
    })
    app.changeTabbarCallback = res => {
      console.log(res)
      that.setData({
        list:res
      })
    }
  },
  methods: {
    switchTab(e) {
      console.log(e)
      const data = e.currentTarget.dataset
      console.log(data);
      const url = data.path
      wx.switchTab({ url })
      this.setData({
        selected: data.index
      })
    }
  }
})