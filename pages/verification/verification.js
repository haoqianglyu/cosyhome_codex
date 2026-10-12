import api from "../../api/api.js";
import { apiRequest } from "../../utils/request.js";

const COOLDOWN_MS = 60000;
const COOLDOWN_KEY = "verificationCooldowns";

function errorMessage(error, fallback) {
  return (error && error.data && error.data.message) || fallback;
}

function requireSuccess(response, fallback) {
  // 沿用旧接口约定：HTTP 200 表示成功。
  if (response.statusCode !== 200) {
    const error = new Error(errorMessage(response, fallback));
    error.data = response.data;
    error.statusCode = response.statusCode;
    throw error;
  }
}

function isInvalidVerificationCode(error) {
  if (!error || error.type === "network" || Number(error.statusCode) >= 500) return false;
  // 旧接口没有可确认的专用错误码，仅在服务端明确说明验证码无效时清空。
  const message = errorMessage(error, "");
  return /验证码[：:\s]*(?:输入)?(?:已(?:经)?)?(?:错误|有误|不正确|不对|不匹配|无效|失效|过期|不存在)/.test(message);
}

Page({
  data: {
    phone: "",
    phoneValid: false,
    currentInput: "",
    inputFocused: false,
    sendStatus: "idle",
    sendError: "",
    cooldown: 0,
    errorCode: "",
    verifying: false,
    bound: false,
  },

  onLoad() {
    this._pageVisible = true;
    const phone = String(wx.getStorageSync("userPhoneNumber") || "").trim();
    const phoneValid = /^1[3-9]\d{9}$/.test(phone);
    this.setData({ phone, phoneValid });
    if (!phoneValid) {
      this.setData({ sendStatus: "error", sendError: "手机号无效，请返回重新填写" });
      return;
    }
    const saved = wx.getStorageSync(COOLDOWN_KEY) || {};
    this._cooldownUntil = Number(saved[phone]) || 0;
    this.updateCooldown();
    if (this.data.cooldown > 0) {
      this.setData({ sendStatus: "sent" });
      this.startCooldownTimer();
    } else {
      this.handleSendVerify();
    }
  },

  updateCooldown() {
    const cooldown = Math.max(0, Math.ceil(((this._cooldownUntil || 0) - Date.now()) / 1000));
    this.setData({ cooldown });
    if (!cooldown) this.clearCooldownTimer();
  },

  startCooldownTimer() {
    this.clearCooldownTimer();
    this.updateCooldown();
    if (!this._pageVisible || !this.data.cooldown) return;
    this._cooldownTimer = setInterval(() => this.updateCooldown(), 1000);
  },

  clearCooldownTimer() {
    clearInterval(this._cooldownTimer);
    this._cooldownTimer = null;
  },

  async handleSendVerify() {
    if (this._destroyed || !this.data.phoneValid || this._sendVerifyPending || this.data.verifying || this.data.bound) return;
    this.updateCooldown();
    if (this.data.cooldown > 0) return;
    this._sendVerifyPending = true;
    this.setData({ sendStatus: "sending", sendError: "", errorCode: "" });
    const phone = this.data.phone;
    try {
      const response = await apiRequest(api.sendverify, {
        method: "POST",
        data: { customer_phone: phone },
        header: { "content-type": "application/json" },
        skipAuthRedirect: true,
      });
      requireSuccess(response, "验证码发送失败，请重试");
      const now = Date.now();
      const saved = wx.getStorageSync(COOLDOWN_KEY) || {};
      const active = {};
      Object.keys(saved).forEach(key => {
        if (Number(saved[key]) > now) active[key] = Number(saved[key]);
      });
      active[phone] = now + COOLDOWN_MS;
      wx.setStorageSync(COOLDOWN_KEY, active);
      if (this._destroyed) return;
      this._cooldownUntil = active[phone];
      this.setData({ sendStatus: "sent", currentInput: "", inputFocused: this._pageVisible });
      this.startCooldownTimer();
    } catch (error) {
      if (this._destroyed) return;
      this.setData({
        sendStatus: "error",
        sendError: errorMessage(error, error.type === "network" ? "网络连接失败，请检查网络后重试" : "验证码发送失败，请重试"),
      });
    } finally {
      this._sendVerifyPending = false;
    }
  },

  onCodeFocus() {
    this.setData({ inputFocused: true });
  },

  onCodeBlur() {
    this.setData({ inputFocused: false });
  },

  onCodeInput(event) {
    if (this.data.verifying || this.data.bound || this._sendVerifyPending) return this.data.currentInput;
    this._refocusCode = false;
    const value = String(event.detail.value || "").replace(/\D/g, "").slice(0, 4);
    this.setData({ currentInput: value, errorCode: "" });
    if (value.length === 4) this.verifyCode();
    return value;
  },

  async verifyCode() {
    if (this._destroyed || !this.data.phoneValid || this.data.verifying || this.data.bound || this._sendVerifyPending) return;
    const value = this.data.currentInput;
    if (!/^\d{4}$/.test(value)) return;
    this.setData({ verifying: true, errorCode: "", inputFocused: false });
    let bindingRequested = false;
    try {
      const code = await new Promise((resolve, reject) => {
        wx.login({
          success: result => result.code ? resolve(result.code) : reject(new Error("微信登录失败，请重试")),
          fail: reject,
        });
      });
      if (this._destroyed) return;
      bindingRequested = true;
      const response = await apiRequest(api.bindproject, {
        method: "POST",
        data: { wx_code: code, customer_phone: this.data.phone, customer_phone_code: value },
        header: { "content-type": "application/json" },
        skipAuthRedirect: true,
      });
      if (this._destroyed) return;
      requireSuccess(response, "验证码验证失败，请重试");
      wx.removeStorageSync("userPhoneNumber");
      this.clearCooldownTimer();
      this.setData({ bound: true });
      this.navigateAfterSuccess();
    } catch (error) {
      if (!this._destroyed) {
        const clearCode = bindingRequested && isInvalidVerificationCode(error);
        this._refocusCode = clearCode;
        this.setData({
          errorCode: errorMessage(error, "验证失败，请检查验证码或网络后重试"),
          ...(clearCode ? { currentInput: "", inputFocused: false } : {}),
        });
      }
    } finally {
      if (!this._destroyed) this.setData({ verifying: false }, () => this.restoreCodeFocus());
    }
  },

  restoreCodeFocus() {
    wx.nextTick(() => {
      if (!this._refocusCode || this._destroyed || !this._pageVisible || this.data.verifying || this._sendVerifyPending || this.data.bound) return;
      this._refocusCode = false;
      this.setData({ inputFocused: true });
    });
  },

  navigateAfterSuccess() {
    if (!this._pageVisible || this._destroyed || !this.data.bound || this._navigationTimer) return;
    wx.showToast({ title: "绑定成功", icon: "none", duration: 1500 });
    this._navigationTimer = setTimeout(() => {
      this._navigationTimer = null;
      if (this._pageVisible && !this._destroyed) wx.reLaunch({ url: "/pages/index/index" });
    }, 1000);
  },

  onShow() {
    this._pageVisible = true;
    if (this.data.bound) this.navigateAfterSuccess();
    else this.startCooldownTimer();
    this.restoreCodeFocus();
  },

  onHide() {
    this._pageVisible = false;
    this.clearCooldownTimer();
    clearTimeout(this._navigationTimer);
    this._navigationTimer = null;
    this.setData({ inputFocused: false });
  },

  onUnload() {
    this._destroyed = true;
    this._pageVisible = false;
    this.clearCooldownTimer();
    clearTimeout(this._navigationTimer);
  },

  onShareAppMessage() {
    return { title: "HC健康舒适家", path: "/pages/index/index" };
  },
});
