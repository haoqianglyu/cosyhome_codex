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

function checkReleaseConfiguration() {
  const appConfig = JSON.parse(
    fs.readFileSync(path.join(root, "app.json"), "utf8"),
  );
  const projectConfig = JSON.parse(
    fs.readFileSync(path.join(root, "project.config.json"), "utf8"),
  );
  const sitemap = JSON.parse(
    fs.readFileSync(path.join(root, "sitemap.json"), "utf8"),
  );
  const packageConfig = JSON.parse(
    fs.readFileSync(path.join(root, "package.json"), "utf8"),
  );

  if ((appConfig.pages || []).some((route) => route.includes("fantest"))) {
    errors.push("app.json: 发布路由中不能包含 fantest 测试页面");
  }
  if (!projectConfig.setting || projectConfig.setting.urlCheck !== true) {
    errors.push("project.config.json: 发布前必须启用合法域名校验");
  }
  if (
    !projectConfig.setting ||
    projectConfig.setting.scopeDataCheck !== true ||
    projectConfig.setting.autoAudits !== true
  ) {
    errors.push("project.config.json: 发布前必须启用权限与自动审计检查");
  }
  if (projectConfig.setting.uploadWithSourceMap !== false) {
    errors.push("project.config.json: 正式发布应关闭 Source Map 上传");
  }
  const disallowsAll = (sitemap.rules || []).some(
    (rule) => rule.action === "disallow" && rule.page === "*",
  );
  if (!disallowsAll) {
    errors.push("sitemap.json: 业务后台页面应禁止微信索引");
  }
  if (packageConfig.name !== "cosyhome_codex") {
    errors.push("package.json: 项目名称必须为 cosyhome_codex");
  }
  if (
    packageConfig.devDependencies &&
    packageConfig.devDependencies["mini-program-iconfont-cli"]
  ) {
    errors.push("package.json: 不应保留已弃用且存在漏洞的图标生成依赖");
  }

  const ignoredFolders = new Set(
    ((projectConfig.packOptions && projectConfig.packOptions.ignore) || [])
      .filter((item) => item.type === "folder")
      .map((item) => item.value),
  );
  for (const filename of files) {
    const sourcePath = relative(filename).split(path.sep).join("/");
    if (!/^(?:app\.js|pages\/|subpackages\/|components\/|custom-tab-bar\/)/.test(sourcePath)) {
      continue;
    }
    if (!/\.(?:js|json)$/.test(filename)) continue;
    const source = fs.readFileSync(filename, "utf8");
    for (const match of source.matchAll(/@vant\/weapp\/([\w-]+)/g)) {
      const componentFolder = `miniprogram_npm/@vant/weapp/${match[1]}`;
      if (ignoredFolders.has(componentFolder)) {
        addError(filename, `正在使用的 Vant 组件被发布配置排除：${match[1]}`);
      }
    }
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
    const sourcePath = relative(filename).split(path.sep).join("/");
    if (
      /^(?:app\.|my_icon\.wxss|pages\/|subpackages\/|components\/|custom-tab-bar\/|styles\/|icon\.wxss)/.test(sourcePath) &&
      /(?:http:\/\/|url\(["']?\/\/)/.test(source)
    ) {
      addError(filename, "运行时代码和资源必须使用 HTTPS 或本地文件");
    }
    if (filename.endsWith(".wxml")) {
      if (/wx:key=["'](?:index|this|i|idx|ri|ci|h|c)["']/.test(source)) {
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
      /\bthat\./.test(source) &&
      !/\b(?:var|let|const)\s+that\s*=/.test(source)
    ) {
      addError(filename, "使用 that 前必须在当前文件中显式声明");
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

function checkDuplicateAssets() {
  const contentHashes = new Map();
  for (const filename of files) {
    if (!/\.(?:wxss|png|jpg|jpeg|webp|gif|svg|woff|woff2|ttf)$/.test(filename)) {
      continue;
    }
    const content = fs.readFileSync(filename);
    if (content.length < 8192) {
      continue;
    }
    const key = `${content.length}:${content.toString("base64")}`;
    const previous = contentHashes.get(key);
    if (previous) {
      addError(filename, `与 ${relative(previous)} 内容完全重复，请避免重复打包`);
    } else {
      contentHashes.set(key, filename);
    }
  }
}

visit(root);
checkPageFiles();
checkLocalComponents();
checkSourceRules();
checkReleaseConfiguration();
checkDuplicateAssets();

if (errors.length) {
  console.error(errors.join("\n\n"));
  process.exit(1);
}

console.log("项目语法、配置、页面结构和维护规则检查通过");
