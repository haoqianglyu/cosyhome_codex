import api from "../../api/api.js";
Page({
  data: {
    currentInput: "",
    input1: "",
    input2: "",
    input3: "",
    input4: "",
    input1Class: "",
    input2Class: "",
    input3Class: "",
    input4Class: "",
    particles1Array: [],
    particles2Array: [],
    particles3Array: [],
    particles4Array: [],
    errorCode: "",
    focus1: true,
    focus2: false,
    focus3: false,
    focus4: false,
    phone:"",
    phoneStatus:false,
    loginStatus: false,
  },

  onLoad: function(options) {
    this._pageVisible = true;
    const phone = wx.getStorageSync("userPhoneNumber");
    this.setData({
      phone,
    });
    if (!/^1[3-9]\d{9}$/.test(phone)) {
      wx.showToast({ title: "手机号无效，请重新填写", icon: "none" });
      return;
    }
    this.handleSendVerify();
  },

  handleSendVerify: function () {
    if (this._sendVerifyPending) {
      return;
    }
    if (!/^1[3-9]\d{9}$/.test(this.data.phone)) {
      wx.showToast({ title: "手机号无效，请重新填写", icon: "none" });
      return;
    }
    this._sendVerifyPending = true;
    this.setData({
      phoneStatus: false,
    });
    api.sendverify({
      method: "POST",
      data: {
        customer_phone: this.data.phone,
      },
      header: {
        "content-type": "application/json",
      },
      success: function (res) {
        if (res.statusCode !== 200) {
          wx.showToast({
            title: (res.data && res.data.message) || "验证码发送失败",
            icon: "none",
            duration: 1500,
          });
        }
      },
      fail: function (error) {
        wx.showToast({
          title: (error.data && error.data.message) || "验证码发送失败",
          icon: "none",
        });
      },
      complete: () => {
        this._sendVerifyPending = false;
      },
    });
  },

  moveFocus: function (e) {
    const value = e.detail.value;
    const id = e.target.id;
    if (value) {
      const next = Number(id) + 1;
      if (next <= 4) {
        this.setData({
          [`focus${id}`]: false,
          [`focus${next}`]: true,
        });
      }
    }
  },

  appendNumber: function (e) {
    const number = e.currentTarget.dataset.number;
    const currentInput = this.data.currentInput + number;
    if (currentInput.length <= 4) {
      this.setData({
        currentInput: currentInput,
      });
      this.fillInput(currentInput);
    }
  },

  deleteNumber: function () {
    const currentInput = this.data.currentInput;
    if (currentInput) {
      const newInput = currentInput.slice(0, -1);
      this.setData({
        currentInput: newInput,
      });
      this.fillInput(newInput);
    }
  },

  fillInput: function (value) {
    var that = this
    for (let i = 1; i <= 4; i++) {
      that.setData({
        [`input${i}`]: value[i - 1] || "",
      });
      if (!value[i - 1]) {
        that.setData({
          [`focus${i}`]: true,
          errorCode: "", // 当删除数字时，清除错误消息
        });
        break;
      }
    }

    // 验证码校验
    if (value.length === 4) {
      if (this._verifyPending) {
        return;
      }
      this._verifyPending = true;
      // if (value === "1234") {
      //   wx.navigateTo({ url: "/pages/test/test" });
      // } else {
      //   this.setData({ errorCode: "验证码错误！" });
      //   this.triggerErrorAnimation();
      // }
      wx.login({
        success(res) {
          if (res.code) {
            let phone = that.data.phone;
            let verify = value;
            let code = res.code;

            api.bindproject({
              method: "POST",
              data: {
                wx_code: code,
                customer_phone: phone,
                customer_phone_code: verify,
              },
              header: {
                "content-type": "application/json",
              },
              success: function (res) {
                if (res.statusCode === 200) {
                  wx.removeStorageSync("userPhoneNumber");
                  wx.showToast({
                    title: "绑定成功",
                    icon: "none",
                    duration: 1500,
                  });
                  that._navigationTimer = setTimeout(() => {
                    wx.reLaunch({
                      url: "/pages/index/index",
                    });
                  }, 1000);
                } else {
                  // self.setData({
                  //   loginStatus: true,
                  // });
                  that.setData({
                    errorCode:
                      (res.data && res.data.message) || "验证码验证失败",
                  });
                  that.triggerErrorAnimation();
                  that._verifyPending = false;
                
                }
              },
              fail: function (error) {
                that._verifyPending = false;
                that.setData({
                  loginStatus: true,
                  errorCode:
                    (error.data && error.data.message) || "验证码验证失败",
                });
                that.triggerErrorAnimation();
              },
            });
          } else {
            that._verifyPending = false;
            wx.showToast({
              title: res.errMsg || "微信登录失败",
              icon: "none",
            });
          }
        },
        fail(error) {
          that._verifyPending = false;
          wx.showToast({
            title: (error && error.errMsg) || "微信登录失败",
            icon: "none",
          });
        },
      });
    } else {
      that.setData({ errorCode: "" }); // 确保在不满4位时清除错误消息
    }
  },

  triggerErrorAnimation: function () {
    clearTimeout(this._inputResetTimer);
    clearTimeout(this._particleCleanupTimer);

    const generation = (this._animationGeneration || 0) + 1;
    this._animationGeneration = generation;
    const resetState = {};
    const animationState = {};

    for (let index = 1; index <= 4; index++) {
      resetState[`input${index}Class`] = "";
      resetState[`particles${index}Array`] = [];
      animationState[`input${index}Class`] = "shake-animation";
      animationState[`particles${index}Array`] = this.createParticles(
        index,
        generation,
      );
    }

    this.setData(resetState, () => {
      wx.nextTick(() => {
        if (generation === this._animationGeneration) {
          this.setData(animationState);
        }
      });
    });

    this._inputResetTimer = setTimeout(() => {
      if (generation !== this._animationGeneration) {
        return;
      }
      this.setData({
        currentInput: "",
        input1: "",
        input2: "",
        input3: "",
        input4: "",
        input1Class: "",
        input2Class: "",
        input3Class: "",
        input4Class: "",
        focus1: true,
        focus2: false,
        focus3: false,
        focus4: false,
      });
    }, 500);

    this._particleCleanupTimer = setTimeout(() => {
      if (generation !== this._animationGeneration) {
        return;
      }
      this.setData({
        particles1Array: [],
        particles2Array: [],
        particles3Array: [],
        particles4Array: [],
      });
    }, 1100);
  },

  createParticles: function (inputBoxId, generation) {
    return Array.from({ length: 12 }, (_, index) => ({
      key: `particle-${generation}-${inputBoxId}-${index}`,
      left: `${Math.random() * 60}px`,
      top: `${Math.random() * 60}px`,
      animationClass: "fall",
    }));
  },

  onUnload() {
    this._pageVisible = false;
    this._animationGeneration = (this._animationGeneration || 0) + 1;
    clearTimeout(this._inputResetTimer);
    clearTimeout(this._particleCleanupTimer);
    clearTimeout(this._navigationTimer);
  },

  onShareAppMessage: function () {
    return {
      // 这里的 title 会显示在分享卡片上
      title: "HC健康舒适家",

      // 关键：把路径固定为你的 index 登录页
      path: "/pages/index/index",
    };
  },
});
