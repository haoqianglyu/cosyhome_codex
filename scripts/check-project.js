const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const root = path.resolve(__dirname, "..");
const ignoredDirectories = new Set([
  ".git",
  "dist",
  "miniprogram_npm",
  "node_modules",
]);
const errors = [];
const files = [];

function relative(filename) {
  return path.relative(root, filename);
}

function addError(filename, message) {
  errors.push(`${relative(filename)}: ${message}`);
}

function visit(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.name === ".DS_Store") {
      continue;
    }
    const filename = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (!ignoredDirectories.has(entry.name)) {
        visit(filename);
      }
      continue;
    }

    if (entry.name.endsWith(".json")) {
      try {
        JSON.parse(fs.readFileSync(filename, "utf8"));
      } catch (error) {
        addError(filename, error.message);
      }
    }

    if (entry.name.endsWith(".js")) {
      const result = spawnSync(process.execPath, ["--check", filename], {
        encoding: "utf8",
      });
      if (result.status !== 0) {
        addError(filename, (result.stderr || result.stdout).trim());
      }
    }
    files.push(filename);
  }
}

function checkPageFiles() {
  const appConfig = JSON.parse(
    fs.readFileSync(path.join(root, "app.json"), "utf8"),
  );
  const routes = [...(appConfig.pages || [])];
  for (const subpackage of appConfig.subpackages || []) {
    for (const page of subpackage.pages || []) {
      routes.push(path.posix.join(subpackage.root, page));
    }
  }

  for (const route of new Set(routes)) {
    for (const extension of [".js", ".json", ".wxml", ".wxss"]) {
      const filename = path.join(root, `${route}${extension}`);
      if (!fs.existsSync(filename)) {
        errors.push(`${route}: 缺少页面文件 ${route}${extension}`);
      }
    }
  }
  if (routes.length !== new Set(routes).size) {
    errors.push("app.json: 存在重复页面路由");
  }
}

function checkLocalComponents() {
  for (const filename of files.filter((file) => file.endsWith(".json"))) {
    let config;
    try {
      config = JSON.parse(fs.readFileSync(filename, "utf8"));
    } catch (error) {
      continue;
    }
    for (const componentPath of Object.values(config.usingComponents || {})) {
      if (!componentPath.startsWith("/") && !componentPath.startsWith(".")) {
        continue;
      }
      const base = componentPath.startsWith("/")
        ? path.join(root, componentPath.slice(1))
        : path.resolve(path.dirname(filename), componentPath);
      if (!fs.existsSync(`${base}.json`) && !fs.existsSync(path.join(base, "index.json"))) {
        addError(filename, `本地组件不存在：${componentPath}`);
      }
    }
  }
}

function checkSourceRules() {
  for (const filename of files) {
    const source = fs.readFileSync(filename, "utf8");
    if (filename.endsWith(".wxml")) {
      if (/wx:key=["'](?:index|this)["']/.test(source)) {
        addError(filename, "wx:key 必须使用稳定字段");
      }
      const clickableElements = source.match(
        /<(?:view|text|image)\b(?=[^>]*(?:bindtap|catchtap))[^>]*>/g,
      ) || [];
      if (
        clickableElements.some(
          (element) =>
            !element.includes("aria-role=") &&
            !element.includes("aria-hidden=") &&
            !/catchtap=["']noop["']/.test(element),
        )
      ) {
        addError(filename, "可点击的 view/text/image 缺少无障碍语义");
      }
    }
    if (
      filename.endsWith(".js") &&
      !filename.includes(`${path.sep}scripts${path.sep}`) &&
      /\.onShow\s*\(\s*\)/.test(source)
    ) {
      addError(filename, "不要手动调用页面 onShow 生命周期");
    }
    if (
      filename.endsWith(".js") &&
      !filename.includes(`${path.sep}scripts${path.sep}`) &&
      source.includes("api.trans_ctrl_message_sync(") &&
      relative(filename) !== path.join("pages", "projectstatus", "projectstatus.js")
    ) {
      addError(filename, "同步透传接口目前只能用于项目状态页");
    }
    if (filename.endsWith(".less")) {
      const wxssFilename = filename.replace(/\.less$/, ".wxss");
      if (
        fs.existsSync(wxssFilename) &&
        source !== fs.readFileSync(wxssFilename, "utf8")
      ) {
        addError(filename, "与同名 WXSS 不一致，请运行 npm run styles:sync");
      }
    }
  }
}

visit(root);
checkPageFiles();
checkLocalComponents();
checkSourceRules();

if (errors.length) {
  console.error(errors.join("\n\n"));
  process.exit(1);
}

console.log("项目语法、配置、页面结构和维护规则检查通过");
