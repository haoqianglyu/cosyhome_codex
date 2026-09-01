const FAN_STATES = {
  off: {
    animationClass: "off",
    levelTitle: "已停止",
    rpmLabel: "0 RPM",
  },
  1: {
    animationClass: "level-1",
    levelTitle: "1档",
    rpmLabel: "480 RPM",
  },
  2: {
    animationClass: "level-2",
    levelTitle: "2档",
    rpmLabel: "820 RPM",
  },
  3: {
    animationClass: "level-3",
    levelTitle: "3档",
    rpmLabel: "1260 RPM",
  },
  auto: {
    animationClass: "auto",
    levelTitle: "自动",
    rpmLabel: "AUTO",
  },
};

Page({
  data: {
    roomName: "主卧",
    levels: [
      { key: "off", label: "停止" },
      { key: "1", label: "1档" },
      { key: "2", label: "2档" },
      { key: "3", label: "3档" },
      { key: "auto", label: "自动" },
    ],
    currentLevel: "3",
    animationClass: FAN_STATES[3].animationClass,
    levelTitle: FAN_STATES[3].levelTitle,
    rpmLabel: FAN_STATES[3].rpmLabel,
    minTemperature: 16,
    maxTemperature: 30,
    realTemperature: 23.8,
    setTemperature: 27,
    setTemperatureText: "27.0",
    temperatureStatus: "正在升温",
    temperatureStatusClass: "heating",
    panelEnabled: true,
    energyEnabled: true,
    lockEnabled: false,
    presenceMode: "home",
    presencePending: "",
    presenceTimerEnabled: true,
    terminalOptions: [
      { key: "floor", label: "地暖", selected: true },
      { key: "fan", label: "风机盘管", selected: true },
      { key: "fresh", label: "新风", selected: false },
    ],
  },

  onReady() {
    this.initTemperatureGauge();
  },

  onUnload() {
    if (this._presenceSwitchTimer) {
      clearTimeout(this._presenceSwitchTimer);
      this._presenceSwitchTimer = null;
    }
    this._gaugeDragging = false;
    this._gaugeCanvas = null;
    this._gaugeContext = null;
    this._gaugeGeometry = null;
  },

  selectLevel(e) {
    const key = String(e.currentTarget.dataset.level || "off");
    const state = FAN_STATES[key] || FAN_STATES.off;
    this.setData({
      currentLevel: key,
      animationClass: state.animationClass,
      levelTitle: state.levelTitle,
      rpmLabel: state.rpmLabel,
    });
  },

  selectPresenceMode(event) {
    const mode = String(event.currentTarget.dataset.mode || "");
    if (
      !["home", "away"].includes(mode) ||
      this.data.presencePending ||
      mode === this.data.presenceMode
    ) {
      return;
    }

    this.setData({ presencePending: mode });
    this._presenceSwitchTimer = setTimeout(() => {
      this._presenceSwitchTimer = null;
      this.setData({
        presenceMode: mode,
        presencePending: "",
      });
      wx.showToast({
        title: mode === "home" ? "已切换为在家" : "已切换为离家",
        icon: "none",
      });
    }, 850);
  },

  togglePresenceTimer() {
    this.setData({
      presenceTimerEnabled: !this.data.presenceTimerEnabled,
    });
  },

  editRoomName() {
    wx.showModal({
      title: "修改房间名称",
      editable: true,
      content: this.data.roomName,
      placeholderText: this.data.roomName,
      success: (result) => {
        if (!result.confirm) {
          return;
        }
        const roomName = String(result.content || "").trim();
        if (!roomName) {
          wx.showToast({ title: "请输入房间名称", icon: "none" });
          return;
        }
        this.setData({ roomName: roomName.slice(0, 20) });
      },
    });
  },

  toggleMockControl(event) {
    const key = event.currentTarget.dataset.key;
    const supportedKeys = ["panelEnabled", "energyEnabled", "lockEnabled"];
    if (!supportedKeys.includes(key)) {
      return;
    }
    this.setData({ [key]: !this.data[key] });
  },

  toggleTerminal(event) {
    const key = event.currentTarget.dataset.key;
    const terminalOptions = this.data.terminalOptions.map((item) =>
      item.key === key ? { ...item, selected: !item.selected } : item,
    );
    this.setData({ terminalOptions });
  },

  initTemperatureGauge() {
    wx.createSelectorQuery()
      .in(this)
      .select("#temperatureGauge")
      .fields({ node: true, size: true, rect: true })
      .exec((result) => {
        const canvasInfo = result && result[0];
        if (!canvasInfo || !canvasInfo.node) {
          return;
        }
        const windowInfo =
          typeof wx.getWindowInfo === "function"
            ? wx.getWindowInfo()
            : wx.getSystemInfoSync();
        const dpr = windowInfo.pixelRatio || 1;
        const canvas = canvasInfo.node;
        const context = canvas.getContext("2d");

        canvas.width = canvasInfo.width * dpr;
        canvas.height = canvasInfo.height * dpr;
        context.scale(dpr, dpr);

        this._gaugeCanvas = canvas;
        this._gaugeContext = context;
        this._gaugeSize = {
          width: canvasInfo.width,
          height: canvasInfo.height,
          left: canvasInfo.left || 0,
          top: canvasInfo.top || 0,
        };
        this.drawTemperatureGauge(this.data.setTemperature);
      });
  },

  drawTemperatureGauge(temperature) {
    const context = this._gaugeContext;
    const size = this._gaugeSize;
    if (!context || !size) {
      return;
    }

    const min = Number(this.data.minTemperature);
    const max = Number(this.data.maxTemperature);
    const range = Math.max(max - min, 0.5);
    const progress = Math.min(1, Math.max(0, (temperature - min) / range));
    const centerX = size.width / 2;
    const centerY = size.height * 0.49;
    const radius = Math.min(size.width * 0.36, size.height * 0.35);
    const startAngle = (3 * Math.PI) / 4;
    const endAngle = (9 * Math.PI) / 4;
    const currentAngle = startAngle + (endAngle - startAngle) * progress;

    this._gaugeGeometry = {
      centerX,
      centerY,
      radius,
      startAngle,
      endAngle,
    };

    context.clearRect(0, 0, size.width, size.height);
    context.save();
    context.lineCap = "round";

    context.beginPath();
    context.arc(centerX, centerY, radius, startAngle, endAngle);
    context.lineWidth = 18;
    context.strokeStyle = "rgba(45, 79, 71, 0.12)";
    context.stroke();

    if (progress > 0) {
      const gradient = context.createLinearGradient(
        centerX - radius,
        centerY,
        centerX + radius,
        centerY,
      );
      gradient.addColorStop(0, "#55c2bb");
      gradient.addColorStop(0.62, "#55c2bb");
      gradient.addColorStop(1, "#f5b43d");
      context.beginPath();
      context.arc(centerX, centerY, radius, startAngle, currentAngle);
      context.lineWidth = 18;
      context.strokeStyle = gradient;
      context.stroke();
    }

    const steps = Math.round(range * 2);
    for (let index = 0; index <= steps; index += 1) {
      const ratio = index / steps;
      const angle = startAngle + (endAngle - startAngle) * ratio;
      const isMajor = index % 4 === 0;
      const innerRadius = radius + 20;
      const outerRadius = radius + (isMajor ? 38 : 30);
      context.beginPath();
      context.moveTo(
        centerX + Math.cos(angle) * innerRadius,
        centerY + Math.sin(angle) * innerRadius,
      );
      context.lineTo(
        centerX + Math.cos(angle) * outerRadius,
        centerY + Math.sin(angle) * outerRadius,
      );
      context.lineWidth = isMajor ? 3 : 2;
      context.strokeStyle =
        ratio <= progress ? "rgba(224, 151, 37, 0.9)" : "rgba(57, 83, 77, 0.18)";
      context.stroke();
    }

    const knobX = centerX + Math.cos(currentAngle) * radius;
    const knobY = centerY + Math.sin(currentAngle) * radius;
    context.shadowColor = "rgba(229, 153, 39, 0.35)";
    context.shadowBlur = 12;
    context.beginPath();
    context.arc(knobX, knobY, 12, 0, Math.PI * 2);
    context.fillStyle = "#fff";
    context.fill();
    context.shadowBlur = 0;
    context.beginPath();
    context.arc(knobX, knobY, 6, 0, Math.PI * 2);
    context.fillStyle = "#f5ad35";
    context.fill();

    context.restore();
  },

  getGaugeTouchPoint(event) {
    const touch =
      (event.touches && event.touches[0]) ||
      (event.changedTouches && event.changedTouches[0]);
    if (!touch || !this._gaugeSize) {
      return null;
    }
    const hasLocalPoint =
      Number.isFinite(touch.x) && Number.isFinite(touch.y);
    return {
      x: hasLocalPoint ? touch.x : touch.clientX - this._gaugeSize.left,
      y: hasLocalPoint ? touch.y : touch.clientY - this._gaugeSize.top,
    };
  },

  updateTemperatureFromTouch(event, requireRingHit) {
    const point = this.getGaugeTouchPoint(event);
    const geometry = this._gaugeGeometry;
    if (!point || !geometry) {
      return false;
    }

    const deltaX = point.x - geometry.centerX;
    const deltaY = point.y - geometry.centerY;
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    if (
      requireRingHit &&
      (distance < geometry.radius * 0.58 || distance > geometry.radius * 1.45)
    ) {
      return false;
    }

    let angle = Math.atan2(deltaY, deltaX);
    if (angle < 0) {
      angle += Math.PI * 2;
    }

    const endInFirstCircle = geometry.endAngle - Math.PI * 2;
    if (angle < geometry.startAngle) {
      if (angle <= endInFirstCircle) {
        angle += Math.PI * 2;
      } else {
        angle = point.x < geometry.centerX
          ? geometry.startAngle
          : geometry.endAngle;
      }
    }

    angle = Math.min(geometry.endAngle, Math.max(geometry.startAngle, angle));
    const ratio =
      (angle - geometry.startAngle) /
      (geometry.endAngle - geometry.startAngle);
    const rawTemperature =
      this.data.minTemperature +
      ratio * (this.data.maxTemperature - this.data.minTemperature);
    const temperature = Math.round(rawTemperature * 2) / 2;
    this.setGaugeTemperature(temperature);
    return true;
  },

  temperatureTouchStart(event) {
    this._gaugeDragging = this.updateTemperatureFromTouch(event, true);
  },

  temperatureTouchMove(event) {
    if (this._gaugeDragging) {
      this.updateTemperatureFromTouch(event, false);
    }
  },

  temperatureTouchEnd() {
    this._gaugeDragging = false;
  },

  setGaugeTemperature(value) {
    const min = Number(this.data.minTemperature);
    const max = Number(this.data.maxTemperature);
    const temperature = Math.min(max, Math.max(min, Number(value)));
    if (temperature === this.data.setTemperature) {
      return;
    }

    const difference = temperature - Number(this.data.realTemperature);
    let temperatureStatus = "温度稳定";
    let temperatureStatusClass = "stable";
    if (difference > 0.25) {
      temperatureStatus = "正在升温";
      temperatureStatusClass = "heating";
    } else if (difference < -0.25) {
      temperatureStatus = "正在降温";
      temperatureStatusClass = "cooling";
    }

    this.setData({
      setTemperature: temperature,
      setTemperatureText: temperature.toFixed(1),
      temperatureStatus,
      temperatureStatusClass,
    });
    this.drawTemperatureGauge(temperature);
  },

  decreaseTemperature() {
    this.setGaugeTemperature(this.data.setTemperature - 0.5);
  },

  increaseTemperature() {
    this.setGaugeTemperature(this.data.setTemperature + 0.5);
  },
});
