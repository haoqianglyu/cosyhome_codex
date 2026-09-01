const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");

function loadFunctions(filename, names, globals = {}) {
  const source = fs
    .readFileSync(path.join(root, filename), "utf8")
    .replace(/export function /g, "function ");
  const module = { exports: {} };
  vm.runInNewContext(
    `${source}\nmodule.exports = { ${names.join(", ")} };`,
    { module, exports: module.exports, ...globals },
    { filename },
  );
  return module.exports;
}

const storage = new Map();
const wx = {
  getStorageSync(key) {
    return storage.get(key);
  },
  setStorageSync(key, value) {
    storage.set(key, value);
  },
  base64ToArrayBuffer(value) {
    const buffer = Buffer.from(value, "base64");
    return buffer.buffer.slice(
      buffer.byteOffset,
      buffer.byteOffset + buffer.byteLength,
    );
  },
};

const projectUtils = loadFunctions(
  "utils/projects.js",
  [
    "getProjectEntities",
    "normalizeProject",
    "normalizeProjects",
    "sortProjects",
    "saveSelectedProject",
  ],
  { wx },
);

assert.deepStrictEqual(
  Array.from(projectUtils.getProjectEntities(null)),
  [],
  "无效项目响应应返回空数组",
);

const projects = [
  { id: "offline", name: "离线", app_name: "通用版", online: false },
  { id: "single", name: "单机", app_name: "单机版", online: true },
  { id: "general", name: "通用", app_name: "通用版", online: true },
];
const sorted = projectUtils.sortProjects(projects);
assert.deepStrictEqual(
  Array.from(sorted, (project) => project.id),
  ["general", "single", "offline"],
  "在线项目应优先，在线项目中通用版应优先",
);
assert.deepStrictEqual(
  Array.from(projects, (project) => project.id),
  ["offline", "single", "general"],
  "项目排序不应修改接口原数组",
);

const normalized = projectUtils.normalizeProject({
  id: "p1",
  name: "测试项目",
  customer_region: "320000/320200/320211",
  secret: "不应进入页面状态",
});
assert.strictEqual(normalized.id, "p1");
assert.strictEqual(normalized.secret, undefined);

projectUtils.saveSelectedProject(normalized);
assert.strictEqual(storage.get("selected_home"), "p1");
assert.strictEqual(storage.get("selected_homename"), "测试项目");
assert.strictEqual(
  storage.get("selected_region"),
  "320000/320200/320211",
);

const { calculateDewPoint } = loadFunctions(
  "utils/environment.js",
  ["calculateDewPoint"],
);
assert.strictEqual(calculateDewPoint(20, 50), 9.3);
assert.strictEqual(calculateDewPoint("无效", 50), "");
assert.strictEqual(calculateDewPoint(20, 0), "");

const { normalizeClockInfo } = loadFunctions(
  "utils/clock.js",
  ["normalizeClockInfo"],
);
const emptyClock = normalizeClockInfo(null);
assert.strictEqual(emptyClock.isTiming, false);
assert.strictEqual(emptyClock.currentMode, 0);
assert.strictEqual(emptyClock.timeMode, 0);
assert.deepStrictEqual(
  Array.from(emptyClock.timingMode, (period) => Array.from(period)),
  [
    ["00:00", "00:00"],
    ["00:00", "00:00"],
    ["00:00", "00:00"],
    ["00:00", "00:00"],
  ],
  "缺失的定时配置应补齐四组安全默认值",
);
const normalizedClock = normalizeClockInfo({
  isTiming: 1,
  currentMode: 99,
  timeMode: "1",
  timingMode: [["08:30", "bad"], ["23:59", "06:00"]],
});
assert.strictEqual(normalizedClock.isTiming, true);
assert.strictEqual(normalizedClock.currentMode, 3);
assert.strictEqual(normalizedClock.timeMode, 1);
assert.deepStrictEqual(
  Array.from(normalizedClock.timingMode, (period) => Array.from(period)),
  [
    ["08:30", "00:00"],
    ["23:59", "06:00"],
    ["00:00", "00:00"],
    ["00:00", "00:00"],
  ],
  "异常时间与越界模式应被归一化",
);

function rc4(bytes, key) {
  const keyBytes = Buffer.from(key, "utf8");
  const state = Array.from({ length: 256 }, (_, index) => index);
  let j = 0;
  for (let i = 0; i < 256; i++) {
    j = (j + state[i] + keyBytes[i % keyBytes.length]) % 256;
    [state[i], state[j]] = [state[j], state[i]];
  }
  const output = Buffer.alloc(bytes.length);
  let i = 0;
  j = 0;
  for (let n = 0; n < bytes.length; n++) {
    i = (i + 1) % 256;
    j = (j + state[i]) % 256;
    [state[i], state[j]] = [state[j], state[i]];
    output[n] = bytes[n] ^ state[(state[i] + state[j]) % 256];
  }
  return output;
}

const reportUtils = loadFunctions(
  "utils/report.js",
  ["prepareReport", "formatReportDate"],
  { wx, Uint8Array },
);
const reportBody = { total_score: 92.5, title: "舒适家报告" };
const reportId = "report-test-id";
const encryptedBody = rc4(
  Buffer.from(JSON.stringify(reportBody), "utf8"),
  reportId,
).toString("base64");
const report = reportUtils.prepareReport({
  id: reportId,
  body: encryptedBody,
  start_time: 1704067200000,
  end_time: 1704153600000,
});
assert.strictEqual(report.bodyParsed.title, "舒适家报告");
assert.strictEqual(report.bodyParsed.total_score, 92.5);
assert.strictEqual(report.period, "2024-01-01~2024-01-02");
assert.throws(
  () => reportUtils.prepareReport({ id: "broken", body: "not-base64" }),
  "损坏报告应单独抛出解析错误",
);

console.log("项目、环境与报告数据工具测试通过");
