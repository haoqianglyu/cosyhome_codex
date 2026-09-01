import * as echarts from "../../ec-canvas/echarts";
import api from "../../api/api.js";
import { prepareReport } from "../../utils/report.js";
import { apiRequest, getErrorMessage, isCurrentPage } from "../../utils/request.js";

const COLOR_MAP = {
  "过热+过湿": "#A50026",
  过热: "#FF5733",
  "过热+过干": "#FFA500",
  过湿: "#5E4FA2",
  适合: "#00BA96",
  "过冷+过湿": "#2B65EC",
  过冷: "#4682B4",
  "过冷+过干": "#B0E0E6",
  过干: "#D2691E",
};

const LABELS = Object.keys(COLOR_MAP);
const VAL_MAP = LABELS.reduce((o, k, i) => ((o[k] = i), o), {});
const PIECES = LABELS.map((k, i) => ({
  value: i,
  color: COLOR_MAP[k],
  label: k,
}));

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function finiteNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function fixedNumber(value, digits = 1) {
  return finiteNumber(value).toFixed(digits);
}

function normalizeInfoRows(rows) {
  return rows.map((cells, index) => ({
    key: `info-${index}-${(cells[0] && cells[0].label) || "row"}`,
    left: cells[0],
    right: cells[1],
  }));
}

function normalizeTables(tables) {
  return tables.map((table, tableIndex) => ({
    ...table,
    key: `table-${tableIndex}-${table.title}`,
    headers: table.headers.map((value, index) => ({
      key: `header-${index}-${value}`,
      value,
    })),
    rows: table.rows.map((cells, rowIndex) => ({
      key: `row-${rowIndex}`,
      cells: cells.map((value, cellIndex) => ({
        key: `cell-${cellIndex}`,
        value,
      })),
    })),
  }));
}

const WEEK_CN = ["日", "一", "二", "三", "四", "五", "六"];
const MONTH_CN = [
  "一月",
  "二月",
  "三月",
  "四月",
  "五月",
  "六月",
  "七月",
  "八月",
  "九月",
  "十月",
  "十一月",
  "十二月",
];

// datum[] → heat / scatter
function transformDatum(datumArr) {
  const heat = [],
    scat = [];
  let minTS = Number.MAX_SAFE_INTEGER,
    maxTS = 0;

  asArray(datumArr).forEach((rec) => {
    const ts = finiteNumber(rec && rec.date_day, NaN);
    if (!Number.isFinite(ts) || !Object.prototype.hasOwnProperty.call(VAL_MAP, rec.valuation_des)) {
      return;
    }
    if (ts < minTS) minTS = ts;
    if (ts > maxTS) maxTS = ts;

    const des = rec.valuation_des;
    const tDev = rec.temp_deviation ?? null;
    const hDev = rec.dew_hum_deviation ?? null;
    const ds = echarts.time.format(ts, "{yyyy}-{MM}-{dd}", false);

    heat.push([ds, VAL_MAP[des]]);
    scat.push([ds, 1, tDev, hDev, des]);
  });
  if (!heat.length) {
    return null;
  }
  // console.log(heat)
  const start = echarts.time.format(minTS, "{yyyy}-{MM}-{dd}", false);
  const end = echarts.time.format(maxTS, "{yyyy}-{MM}-{dd}", false);
  const monthCnt =
    (new Date(maxTS).getFullYear() - new Date(minTS).getFullYear()) * 12 +
    new Date(maxTS).getMonth() -
    new Date(minTS).getMonth() +
    1;

  return { heat, scat, start, end, monthCnt };
}

// buildOption
function buildOption({ heat, scat, start, end, cell, margin }) {
  const headerH = 34;
  return {
    tooltip: {
      trigger: "item",
      formatter: (p) => `${p.value[0]}：${LABELS[p.value[1]]}`,
      // trigger: "item",

      // formatter: (p) => {
      //   // console.log(p)
      //   if (Array.isArray(p.value)) {
      //     return `${p.value[0]}：${p.value[4]}`;
      //   }
      //   return "";
      // },
    },
    visualMap: {
      type: "piecewise",
      show: false,
      dimension: 1,
      seriesIndex: 0,
      pieces: PIECES,
    },

    calendar: [
      {
        top: headerH,
        left: margin + 30,
        right: margin,
        orient: "vertical",
        cellSize: [cell, cell],
        range: [start, end],
        yearLabel: { show: false },
        monthLabel: {
          nameMap: MONTH_CN,
          position: "start",
          margin: 10,
          fontSize: 14,
          color: "#000",
        },
        dayLabel: {
          firstDay: 0,
          nameMap: WEEK_CN,
          margin: 10,
          fontSize: 14,
          color: "#000",
        },
      },
    ],
    series: [
      {
        type: "heatmap",
        coordinateSystem: "calendar",
        data: heat,
        // tooltip: { show: false },
      },
      {
        type: "scatter",
        coordinateSystem: "calendar",
        symbolSize: 0,
        data: scat,
        silent: true,
        label: {
          show: true,
          rich: {
            d: { fontSize: 12, color: "#000", align: "center", lineHeight: 18 },
            t: { fontSize: 9, color: "#000", align: "center", lineHeight: 12 },
            h: { fontSize: 9, color: "#000", align: "center", lineHeight: 12 },
          },
          formatter: (p) => {
            const day = echarts.time.parse(p.value[0]).getDate();
            const tDev = p.value[2];
            const hDev = p.value[3];
            const lines = [`{d|${day}}`];
            if (tDev != null) lines.push(`{t|温度:${(+tDev).toFixed(1)}}`);
            if (hDev != null) lines.push(`{h|露点:${(+hDev).toFixed(1)}}`);
            return lines.join("\n");
          },
        },
      },
    ],
  };
}

// 初始化图表
function initChart(canvas, width, height, dpr, opt) {
  const chart = echarts.init(canvas, null, {
    width,
    height,
    devicePixelRatio: dpr,
  });
  canvas.setChart(chart);
  chart.setOption(opt);
  return chart;
}

Page({
  data: {
    report: null,
    rows: [],
    metrics: {},
    modeRatio: [],
    tables: [],
    ecPie: { disableTouch: false, lazyLoad: true },
    roomCalendars: [],
    city_name: null,
    legendData: [],
    colorPieces: PIECES,
    reportLoading: true,
    loadError: "",
  },

  /* ---------------- 页面加载 ---------------- */
  onLoad(options = {}) {
    this._pageVisible = true;
    const ec = this.getOpenerEventChannel();
    if (ec && typeof ec.on === "function") {
      ec.on("acceptData", (report) => {
        try {
          this.applyReport(report);
        } catch (error) {
          console.error("报告详情渲染失败", error);
          this._reportLoaded = false;
          this.setData({ reportLoading: false, loadError: "报告内容异常，无法展示" });
        }
      });
    }
    if (options.id) {
      this._reportFallbackTimer = setTimeout(() => {
        if (!this._reportLoaded) {
          this.loadReportById(decodeURIComponent(options.id));
        }
      }, 200);
    }
  },

  async loadReportById(reportId) {
    if (this._reportLoading) return;
    this._reportLoading = true;
    this.setData({ reportLoading: true, loadError: "" });
    wx.showLoading({ title: "报告加载中", mask: true });
    try {
      const response = await apiRequest(api.project_report, {
        method: "POST",
        header: {
          "content-type": "application/json",
          Authorization: wx.getStorageSync("access_token"),
        },
        data: { project_id: wx.getStorageSync("selected_home") },
      });
      if (!isCurrentPage(this) || this._reportLoaded) return;
      const entities = asArray(response && response.data && response.data.project_report_entities);
      const entity = entities.find((item) => String(item.id) === String(reportId));
      if (!entity) throw new Error("未找到这份报告");
      this.applyReport(prepareReport(entity));
    } catch (error) {
      if (isCurrentPage(this)) {
        this.setData({ reportLoading: false, loadError: getErrorMessage(error, "报告加载失败") });
        wx.showToast({ title: getErrorMessage(error, "报告加载失败"), icon: "none" });
      }
    } finally {
      this._reportLoading = false;
      wx.hideLoading();
    }
  },

  applyReport(report) {
      if (!report || this._reportLoaded) return;
      const that = this;
      this._reportLoaded = true;
      clearTimeout(this._reportFallbackTimer);
      this.disposeCharts();
      // 获取 report 详细信息并传递到页面
      const endarea = {
        evaluate: report.evaluate, // 运行结论与建议
        reporter: report.reporter, // 报告人姓名
        report_time: report.report_time, // 完成日期
      };
      that.setData({
        endarea,
      });
      let body = report.bodyParsed || {};
      if (!report.bodyParsed) {
        try {
          body = JSON.parse(report.bodyDecrypted);
        } catch (error) {
          this._reportLoaded = false;
          this.setData({ reportLoading: false, loadError: "报告内容损坏，无法打开" });
          wx.showToast({ title: "报告内容损坏，无法打开", icon: "none" });
          return;
        }
      }
      if (!body || typeof body !== "object" || Array.isArray(body)) {
        this._reportLoaded = false;
        this.setData({ reportLoading: false, loadError: "报告内容格式异常" });
        wx.showToast({ title: "报告内容格式异常", icon: "none" });
        return;
      }

      // metrics 和 rows 的处理
      const proj = wx.getStorageSync("selected_project_info") || {};
      const project = {
        ...proj,
        delivery_time_fmt: this.fmt(proj.delivery_time),
      };

      // 获取三级行政区域代码
      const customerRegion = String(project.customer_region || "").split("/");
      const cityCode = customerRegion[2]; // 获取第三级的代码

      const buildEnergyData = asArray(body?.build_energy);
      // 设置 buildEnergyData
      that.setData({
        buildEnergyData,
      });

      const co2_per = Array.from({ length: 5 }, (_, index) =>
        finiteNumber(asArray(body?.sensor?.co2_per)[index]),
      );
      const pm25_per = Array.from({ length: 5 }, (_, index) =>
        finiteNumber(asArray(body?.sensor?.pm25_per)[index]),
      );
      const co2_score = finiteNumber(body?.sensor?.co2_score);
      const pm25_score = finiteNumber(body?.sensor?.pm25_score);

      // 五个评价对应的颜色
      const colors = ["#5470c6", "#91cc75", "#fac858", "#ee6666", "#73c0de"];

      // CO2 数据处理
      const co2Data = co2_per.map((value, index) => ({
        value: value * 100,
        name: ["优", "良", "正常", "稍高", "极高"][index],
        itemStyle: { color: colors[index] },
      }));

      // PM2.5 数据处理
      const pm25Data = pm25_per.map((value, index) => ({
        value: value * 100,
        name: ["优", "良", "正常", "稍高", "极高"][index],
        itemStyle: { color: colors[index] },
      }));

      // 设置数据
      this.setData({
        co2Data,
        pm25Data,
        co2Score: co2_score,
        pm25Score: pm25_score,
      });

      // 处理每个房间的数据
      const rooms2 = asArray(body.sensor && body.sensor.details);

      const co2CurveData = [];
      const pm25CurveData = [];

      // 处理每个房间的 CO2 和 PM2.5 数据
      rooms2.forEach((room2) => {
        const roomCo2 = [];
        const roomPm25 = [];

        asArray(room2 && room2.datum).forEach((datum) => {
          // console.log(datum)
          const timestamp = that.fmt(datum.date_day);
          const avgCo2 = finiteNumber(datum.avg_co2);
          const avgPm25 = finiteNumber(datum.avg_pm25);

          roomCo2.push({ timestamp, avgCo2 });
          roomPm25.push({ timestamp, avgPm25 });
        });

        if (roomCo2.length) {
          co2CurveData.push({ roomName: room2.name || "未命名房间", data: roomCo2 });
          pm25CurveData.push({ roomName: room2.name || "未命名房间", data: roomPm25 });
        }
      });

      // 设置曲线图的数据
      this.setData({
        co2CurveData,
        pm25CurveData,
      });

      const metrics = {
        period: report.period,
        totalRooms: body.total_rooms ?? 0,
        ratedRooms: body.rated_rooms ?? 0,
        roomScore: fixedNumber(body?.room?.total_score),
        co2Score: fixedNumber(body?.sensor?.co2_score),
        pm25Score: fixedNumber(body?.sensor?.pm25_score),
        totalScore: fixedNumber(body.total_score),
        trouble:
          body.trouble_per !== undefined
            ? fixedNumber(body.trouble_per, 2)
            : "0",
        runtime: body.runtime ?? 0,
      };

      const energyLines = buildEnergyData.map((e) => ({
        label: `标准能耗-${e.energy_name}`,
        value: fixedNumber(e.total_usage),
      }));

      const infoItems = [
        { label: "项目名称", value: project.name, single: true },
        { label: "项目ID", value: project.code },
        { label: "项目等级", value: project.level },
        { label: "建筑类型", value: project.building_type },
        { label: "建筑面积", value: project.building_area },
        { label: "节能水平", value: project.energy_level },
        { label: "所在省市", value: "", single: true },
        { label: "交付时间", value: project.delivery_time_fmt },
        { label: "总房间数", value: metrics.totalRooms },
        { label: "评分房间数", value: metrics.ratedRooms },
        { label: "热湿舒适得分", value: metrics.roomScore },
        { label: "CO₂得分", value: metrics.co2Score },
        { label: "PM2.5得分", value: metrics.pm25Score },
        { label: "项目总分", value: metrics.totalScore },
        { label: "故障指数", value: metrics.trouble },
        ...energyLines,
        { label: "运行时长", value: `${metrics.runtime} h` },
      ];

      // 调用接口获取城市中文名称
      if (cityCode) api.get_city({
        method: "POST",
        header: {
          "content-type": "application/json",
          Authorization: wx.getStorageSync("access_token"),
        },
        data: {
          city_code: cityCode, // 使用动态获取的三级行政代码
        },
        success: function (res) {
          if (!that._pageVisible) return;
          // 更新数据中城市名称字段，并重新设置 infoItems
          that.setData(
            {
              city_name: (res.data && res.data.city_name) || "-",
            },
            () => {
              // 在 city_name 更新后，重新构建 infoItems
              infoItems[6] = {
                label: "所在省市",
                value: that.data.city_name,
                single: true,
              };
              const rows = [];
              let buf = null;
              const push = (a, b) => rows.push([a, b]);
              infoItems.forEach((it) => {
                if (it.single) {
                  if (buf) {
                    push(buf, null);
                    buf = null;
                  }
                  push(it, null);
                } else {
                  if (buf) {
                    push(buf, it);
                    buf = null;
                  } else buf = it;
                }
              });
              if (buf) push(buf, null);

              // 更新 rows 到页面
              that.setData({
                rows: normalizeInfoRows(rows),
              });
            }
          );
        },
        fail: function () {
          console.error("获取城市名称失败");
        },
      });
      const rows = [];
      let buf = null;
      const push = (a, b) => rows.push([a, b]);
      infoItems.forEach((it) => {
        if (it.single) {
          if (buf) {
            push(buf, null);
            buf = null;
          }
          push(it, null);
        } else {
          if (buf) {
            push(buf, it);
            buf = null;
          } else buf = it;
        }
      });
      if (buf) push(buf, null);

      // 运行情况表格
      const tables = [];
      const toHour = (ms) =>
        ms === -1 ? "-" : ms == null ? "0h" : Math.round(ms / 3600000) + "h";
      const pct = (v) =>
        v === -1 ? "-" : v == null ? "0%" : Math.round(v * 100) + "%";
      const freq = (v) =>
        v === -1 ? "-" : v == null ? "0Hz" : Math.round(v) + "Hz";

      if (body.air_con_runtime?.length) {
        tables.push({
          title: "冷热源运行情况",
          headers: ["名称", "运行时间(h)", "开机比例(%)"],
          rows: body.air_con_runtime.map((x) => [
            x.name ?? "-",
            toHour(x.runtime),
            pct(x.power_ratio),
          ]),
        });
      }
      if (body.air_proc_runtime?.length) {
        tables.push({
          title: "空气处理机运行情况",
          headers: [
            "名称",
            "运行时间(h)",
            "开机比例(%)",
            "压缩机(%)",
            "压缩机平均频率",
            "水阀(%)",
            "滤网更换时间",
          ],
          rows: body.air_proc_runtime.map((x) => [
            x.name ?? "-",
            toHour(x.runtime),
            pct(x.power_ratio),
            pct(x.compressor_ratio),
            freq(x.compressor_freq),
            pct(x.water_valve_ratio),
            x.strainer_time ?? "-",
          ]),
        });
      }
      if (body.room_runtime?.length) {
        tables.push({
          title: "房间运行情况",
          headers: ["名称", "运行时间(h)", "开机比例(%)"],
          rows: body.room_runtime.map((x) => [
            x.name ?? "-",
            toHour(x.runtime),
            pct(x.power_ratio),
          ]),
        });
      }
      if (body.mix_water_runtime?.length) {
        tables.push({
          title: "混水运行情况",
          headers: ["名称", "运行时间(h)", "开机比例(%)"],
          rows: body.mix_water_runtime.map((x) => [
            x.name ?? "-",
            toHour(x.runtime),
            pct(x.power_ratio),
          ]),
        });
      }

      this.setData(
        {
          report,
          rows: normalizeInfoRows(rows),
          metrics,
          modeRatio: asArray(body.mode_ratio),
          tables: normalizeTables(tables),
          roomTotalScore: body.room?.total_score ?? 0,
          reportLoading: false,
          loadError: "",
        },
        () => {
          that.initPieChart();
          that.initPieChart2();
          that.renderCo2Chart();
          that.renderPm25Chart();
          that.renderEnergyChart();
        }
      );

      const rooms = asArray(body.room && body.room.details);
      const { windowWidth: W } =
        typeof wx.getWindowInfo === "function"
          ? wx.getWindowInfo()
          : wx.getSystemInfoSync();
      const H_MARGIN = 20,
        headerH = 34;

      const roomCalendars = rooms.reduce((result, room, idx) => {
        const transformed = transformDatum(room && room.datum);
        if (!transformed) return result;
        const { heat, scat, start, end, monthCnt } = transformed;
        const cell = (W - (H_MARGIN + 30) - H_MARGIN) / 7;
        const chartHpx = monthCnt * (headerH + cell * 6) + 40;

        result.push({
          id: room.id || `room-${idx}`,
          name: room.name,
          score: room.score,
          time_period: room.time_period,
          ec: { disableTouch: false, lazyLoad: true },
          canvasH: (chartHpx * 550) / W,
          _inner: { heat, scat, start, end, cell },
        });
        return result;
      }, []);

      this.setData({ roomCalendars }, () => {
        this.data.roomCalendars.forEach((room, idx) => {
          const comp = this.selectComponent(`#cal_${idx}`);
          if (!comp) return;
          comp.init((canvas, w, h, dpr) => {
            const opt = buildOption({
              heat: room._inner.heat,
              scat: room._inner.scat,
              start: room._inner.start,
              end: room._inner.end,
              cell: room._inner.cell,
              margin: H_MARGIN,
            });
            const chart = initChart(canvas, w, h, dpr, opt);
            this.trackChart(chart);
            return chart;
          });
        });
      });
  },

  trackChart(chart) {
    this._chartInstances = this._chartInstances || [];
    this._chartInstances.push(chart);
  },

  disposeCharts() {
    (this._chartInstances || []).forEach((chart) => {
      if (
        chart &&
        typeof chart.dispose === "function" &&
        (typeof chart.isDisposed !== "function" || !chart.isDisposed())
      ) {
        chart.dispose();
      }
    });
    this._chartInstances = [];
  },

  // 系统能耗曲线图渲染函数
  renderEnergyChart() {
    if (!this.data.buildEnergyData.length) return;

    const comp = this.selectComponent("#energyChart");
    if (!comp) return;
    comp.init((canvas, width, height, dpr) => {
      const chart = echarts.init(canvas, null, {
        width,
        height,
        devicePixelRatio: dpr,
      });

      // 获取所有日期，确保日期一致
      let allDates = [];
      this.data.buildEnergyData.forEach((energy) => {
        asArray(energy.day_list).forEach((d) => {
          const formattedDate = this.fmt(d.date);
          if (!allDates.includes(formattedDate)) {
            allDates.push(formattedDate);
          }
        });
      });
      allDates = allDates.sort(); // 排序所有日期

      // 准备系统能耗数据
      const series = this.data.buildEnergyData.map((energy) => {
        const avgUsage = fixedNumber(energy.avg_usage);
        const totalUsage = fixedNumber(energy.total_usage);

        // 确保每条曲线都有完整的日期列表
        const data = allDates.map((date) => {
          const dayData = asArray(energy.day_list).find(
            (d) => this.fmt(d.date) === date
          );
          // 如果某天的数据不存在，则返回 "-"
          return dayData ? [date, dayData.value] : [date, "-"];
        });

        return {
          name: `${energy.energy_name} (avg: ${avgUsage}, total: ${totalUsage})`,
          type: "line",
          data: data, // 使用填充后的数据
          smooth: true,
        };
      });

      chart.setOption({
        title: {
          text: "系统能耗(kWh/100㎡)",
          left: "center",
        },
        tooltip: {
          confine: true,
          trigger: "axis",
          formatter: (params) => {
            const timestamp = params[0].value[0];
            const date = echarts.time.format(
              timestamp,
              "{yyyy}-{MM}-{dd}",
              false
            );
            let tooltipContent = `${date}\n`;
            params.forEach((param) => {
              const energyName = param.seriesName.split(" ")[0];
              const avg = param.seriesName
                .split(" (avg: ")[1]
                .split(",")[0]
                .slice(0, -1);
              const total = param.seriesName.split("total: ")[1].slice(0, -1);
              tooltipContent += `${energyName} (avg: ${avg}, total: ${total})   ${
                param.value[1] === "-" ? "-" : param.value[1]
              }\n`; // 如果值为 "-" 显示 "-"
            });
            return tooltipContent;
          },
        },
        legend: {
          data: series.map((item) => item.name),
          orient: "horizontal",
          top: 30,
          left: "center",
          textStyle: { fontSize: 10 },
        },
        grid: {
          left: "3%",
          right: "4%",
          top: "40%",
          bottom: "3%",
          containLabel: true,
        },
        xAxis: {
          type: "category",
          data: allDates, // 使用统一的日期列表
          boundaryGap: false,
        },
        yAxis: { type: "value" },
        series,
      });

      this.trackChart(chart);
      return chart;
    });
  },

  // 初始化 CO2 曲线图
  renderCo2Chart() {
    if (!this.data.co2CurveData.length) return;

    const comp = this.selectComponent("#co2Chart");
    if (!comp) return;
    comp.init((canvas, width, height, dpr) => {
      const chart = echarts.init(canvas, null, {
        width,
        height,
        devicePixelRatio: dpr,
      });

      // 获取所有日期，确保日期一致
      let allDates = [];
      this.data.co2CurveData.forEach((room) => {
        room.data.forEach((d) => {
          const formattedDate = d.timestamp;
          if (!allDates.includes(formattedDate)) {
            allDates.push(formattedDate);
          }
        });
      });
      allDates = allDates.sort(); // 排序所有日期

      // 准备 CO2 曲线数据
      const series = this.data.co2CurveData.map((room) => {
        const avgCo2 = (
          room.data.reduce((sum, d) => sum + d.avgCo2, 0) / room.data.length
        ).toFixed(1);

        // 确保每条曲线都有完整的日期列表
        const data = allDates.map((date) => {
          const dayData = room.data.find((d) => d.timestamp === date);
          return dayData ? [date, dayData.avgCo2] : [date, "-"];
        });

        return {
          name: `${room.roomName} (avg: ${avgCo2})`,
          type: "line",
          data: data,
          smooth: true,
        };
      });

      chart.setOption({
        title: { text: "CO₂", left: "center" },
        tooltip: {
          confine: true,
          trigger: "axis",
          formatter: (params) => {
            const timestamp = params[0].value[0];
            const date = echarts.time.format(
              timestamp,
              "{yyyy}-{MM}-{dd}",
              false
            );
            let tooltipContent = `${date}\n`;
            params.forEach((param) => {
              const roomName = param.seriesName.split(" ")[0];
              const avg = param.seriesName.split(" (avg: ")[1].slice(0, -1);
              tooltipContent += `${roomName} (avg: ${avg})   ${
                param.value[1] === "-" ? "-" : param.value[1]
              }\n`;
            });
            return tooltipContent;
          },
        },
        grid: {
          left: "3%",
          right: "4%",
          top: "40%",
          bottom: "3%",
          containLabel: true,
        },
        legend: {
          data: series.map((item) => item.name),
          orient: "horizontal",
          top: 30,
          left: "center",
          textStyle: { fontSize: 10 },
        },
        xAxis: { type: "category", data: allDates, boundaryGap: false },
        yAxis: { type: "value" },
        series,
      });

      this.trackChart(chart);
      return chart;
    });
  },

  // PM2.5 曲线图渲染函数
  renderPm25Chart() {
    if (!this.data.pm25CurveData.length) return;

    const comp = this.selectComponent("#pm25Chart");
    if (!comp) return;
    comp.init((canvas, width, height, dpr) => {
      const chart = echarts.init(canvas, null, {
        width,
        height,
        devicePixelRatio: dpr,
      });

      // 获取所有日期，确保日期一致
      let allDates = [];
      this.data.pm25CurveData.forEach((room) => {
        room.data.forEach((d) => {
          const formattedDate = d.timestamp;
          if (!allDates.includes(formattedDate)) {
            allDates.push(formattedDate);
          }
        });
      });
      allDates = allDates.sort(); // 排序所有日期

      // 准备 PM2.5 曲线数据
      const series = this.data.pm25CurveData.map((room) => {
        const avgPm25 = (
          room.data.reduce((sum, d) => sum + d.avgPm25, 0) / room.data.length
        ).toFixed(1);

        // 确保每条曲线都有完整的日期列表
        const data = allDates.map((date) => {
          const dayData = room.data.find((d) => d.timestamp === date);
          return dayData ? [date, dayData.avgPm25] : [date, "-"];
        });

        return {
          name: `${room.roomName} (avg: ${avgPm25})`,
          type: "line",
          data: data,
          smooth: true,
        };
      });

      chart.setOption({
        title: { text: "PM2.5", left: "center" },
        tooltip: {
          confine: true,
          trigger: "axis",
          formatter: (params) => {
            const timestamp = params[0].value[0];
            const date = echarts.time.format(
              timestamp,
              "{yyyy}-{MM}-{dd}",
              false
            );
            let tooltipContent = `${date}\n`;
            params.forEach((param) => {
              const roomName = param.seriesName.split(" ")[0];
              const avg = param.seriesName.split(" (avg: ")[1].slice(0, -1);
              tooltipContent += `${roomName} (avg: ${avg})   ${
                param.value[1] === "-" ? "-" : param.value[1]
              }\n`;
            });
            return tooltipContent;
          },
        },
        grid: {
          left: "3%",
          right: "4%",
          top: "40%",
          bottom: "3%",
          containLabel: true,
        },
        legend: {
          data: series.map((item) => item.name),
          orient: "horizontal",
          top: 30,
          left: "center",
          textStyle: { fontSize: 10 },
        },
        xAxis: { type: "category", data: allDates, boundaryGap: false },
        yAxis: { type: "value" },
        series,
      });

      this.trackChart(chart);
      return chart;
    });
  },

  initPieChart2() {
    if (!this.data.co2Data.length || !this.data.pm25Data.length) return;

    const comp = this.selectComponent("#airQualityPieChart");
    if (!comp) return;
    comp.init((canvas, w, h, dpr) => {
      const chart = echarts.init(canvas, null, {
        width: w,
        height: h,
        devicePixelRatio: dpr,
      });

      // 颜色数组
      const colors = ["#5470c6", "#91cc75", "#fac858", "#ee6666", "#73c0de"];

      // 数据准备：获取 CO₂ 和 PM2.5 数据
      const co2Data = this.data.co2Data.map((item, index) => ({
        value: item.value,
        name: ["优", "良", "正常", "稍高", "极高"][index],
        itemStyle: { color: colors[index] }, // 设置颜色
      }));

      const pm25Data = this.data.pm25Data.map((item, index) => ({
        value: item.value,
        name: ["优", "良", "正常", "稍高", "极高"][index],
        itemStyle: { color: colors[index] }, // 设置颜色
      }));

      // 设置 ECharts 配置
      chart.setOption({
        title: [
          {
            text: "空气质量评价",
            left: "center",
          },
          {
            text: `CO₂`,
            subtext: `${Number(this.data.co2Score).toFixed(1)} 分`,
            left: "15%",
            top: 20,
          },
          {
            text: `PM2.5`,
            subtext: `${Number(this.data.pm25Score).toFixed(1)} 分`,
            left: "75%",
            top: 20,
          },
        ],
        tooltip: {
          trigger: "item",
          formatter: function (params) {
            const value = params.value; // 获取值
            return `${params.name}: ${value.toFixed(2)}%`; // 保留两位小数
          },
        },

        legend: {
          orient: "vertical",
          left: "center",
          top: "center",
        },
        series: [
          {
            name: "CO₂",
            type: "pie",
            radius: "55%",
            center: ["20%", "60%"],
            label: {
              show: false,
            },
            data: co2Data,
            emphasis: {
              itemStyle: {
                shadowBlur: 10,
                shadowOffsetX: 0,
                shadowColor: "rgba(0, 0, 0, 0.5)",
              },
            },
          },
          {
            name: "PM2.5",
            type: "pie",
            radius: "55%",
            center: ["80%", "60%"],
            label: {
              show: false,
            },
            data: pm25Data,
            emphasis: {
              itemStyle: {
                shadowBlur: 10,
                shadowOffsetX: 0,
                shadowColor: "rgba(0, 0, 0, 0.5)",
              },
            },
          },
        ],
      });

      this.trackChart(chart);
      return chart;
    });
  },

  /* ---------------- 饼图 ---------------- */
  initPieChart() {
    if (!this.data.modeRatio.length) return;
    const comp = this.selectComponent("#pieChart");
    if (!comp) return;
    comp.init((canvas, w, h, dpr) => {
      const chart = echarts.init(canvas, null, {
        width: w,
        height: h,
        devicePixelRatio: dpr,
      });
      chart.setOption({
        color: [
          "#5470c6",
          "#91cc75",
          "#fac858",
          "#ee6666",
          "#73c0de",
          "#3ba272",
          "#fc8452",
          "#9a60b4",
          "#ea7ccc",
          "#2f4554",
          "#ffb980",
          "#8d7fec",
          "#b6a2de",
          "#5ab1ef",
          "#c23531",
        ],
        title: { text: "系统运行模式比例", left: "center", top: 10 },
        legend: { orient: "horizontal", top: 50 },
        tooltip: { trigger: "item", formatter: "{b}: {d}%" },
        series: [
          {
            type: "pie",
            radius: "50%",
            // minAngle: 15,//最小角度
            // startAngle:300, //起始角度
            center: ["50%", "70%"],
            label: { formatter: "{b}({d}%)" },
            data: this.data.modeRatio.map((m) => ({
              value: m.value,
              name: m.name,
            })),
          },
        ],
      });
      this.trackChart(chart);
      return chart;
    });
  },

  /* ---------------- 时间戳 → YYYY-MM-DD ---------------- */
  fmt(ts) {
    if (!ts) return "";
    let n = Number(ts);
    if (!isNaN(n)) {
      if (ts.toString().length === 10) n *= 1000;
      const d = new Date(n),
        p = (x) => (x < 10 ? "0" + x : x);
      return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
    }
    return String(ts).slice(0, 10);
  },

  onHide() {
    this._pageVisible = false;
  },

  onShow() {
    this._pageVisible = true;
  },

  onUnload() {
    this._pageVisible = false;
    clearTimeout(this._reportFallbackTimer);
    this.disposeCharts();
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
