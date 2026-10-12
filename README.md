# HC 健康舒适家 · 微信小程序

`cosyhome_codex` 是 HC 健康舒适家微信小程序的重构项目，用于查看住宅环境、控制设备、配置定时、查看运行报告，以及处理报修和工单。

项目使用微信原生小程序技术，连接已有业务后端与控制屏。支持通用版、单机版和新两联供项目，并根据用户身份与项目类型展示相应页面。

## 主要功能

| 模块 | 功能 |
| --- | --- |
| 登录与绑定 | 微信登录、手机号短信验证、访客登录、经销商身份选择 |
| 项目首页 | 项目切换、设备在线状态、环境读数、天气、模式和在家状态 |
| 房间控制 | 温度设定、风速、工作模式、节能、锁定与房间名称修改 |
| 单机版环境 | 环境数据、24 小时历史曲线、湿度或露点设定 |
| 定时控制 | 每天、节假日、工作日及单次定时，兼容两套定时页面 |
| 统计与报告 | 运行报告、房间统计、能耗与建筑能效展示 |
| 服务与管理 | 报修及附件、工单、家庭成员、登录设备、经销商与项目管理 |

具体功能是否可用，取决于账号身份、项目配置和控制屏能力。

## 技术栈

- 微信原生小程序：JavaScript、WXML、WXSS。
- Vant Weapp、ColorUI 与本地 `i-switch` 组件。
- ECharts 微信 Canvas 适配与 `lottie-miniprogram`。
- Node.js 脚本负责数据工具测试、页面流程模拟和静态检查。
- 自定义 TabBar，按项目类型切换首页和中间页。

当前 `project.config.json` 配置的基础库版本为 **3.8.12**。Node.js 未在 `package.json` 中锁定版本；本地检查通过的环境为 Node.js 24、npm 11。

## 本地开发

### 1. 获取代码

GitHub 仓库为私有仓库，克隆前需具备访问权限并配置 SSH：

```bash
git clone --origin github git@github.com:haoqianglyu/cosyhome_codex.git
cd cosyhome_codex
npm ci
```

如需同时同步 GitLab，在这个新克隆的目录中添加远程：

```bash
git remote add origin git@test.cosyhome.com.cn:HaoqiangLyu/cosyhome_codex.git
```

已有本地仓库请先执行 `git remote -v`，避免重复添加或覆盖配置。

### 2. 在微信开发者工具中运行

1. 导入项目根目录，使用 `project.config.json` 中配置的 AppID，并确保微信账号拥有小程序开发权限。
2. 安装依赖后，在开发者工具中执行“构建 npm”。仓库已有 `miniprogram_npm/`，依赖更新时需要重新构建。
3. 从 `pages/index/index` 进入，验证登录和项目加载流程。
4. 使用测试账号、测试项目验证设备控制；本地页面操作会请求真实后端。

这是原生小程序项目，没有 `npm run dev` 启动的网页开发服务。

`node_modules/`、`.DS_Store` 和 `project.private.config.json` 已被 Git 忽略。个人开发者工具设置可能覆盖公共配置，发布前需检查实际生效选项。

### 3. 常用命令

```bash
npm test              # 工具函数测试、页面流程模拟、静态检查
npm run check         # 语法、JSON、页面结构、组件引用及维护规则检查
npm run styles:sync   # 将 WXSS 同步到已有的同名 Less 文件
git diff --check      # 检查差异中的空白问题
```

**样式以 `.wxss` 为准。** `styles:sync` 的方向是 WXSS → Less，不是 Less 编译为 WXSS。修改有同名 Less 的样式后运行同步，避免静态检查失败。

## 目录结构

```text
api/                  后端接口封装、HTTP 与部分业务错误处理
pages/                主包页面：登录、首页、房间、环境、定时、报告和管理
subpackages/          分包：能耗、建筑、成员、工单、报修等
utils/                会话相关工具、项目上下文、控制队列、报表与数据处理
custom-tab-bar/       自定义 TabBar
dist/switch/          本地开关组件
ec-canvas/            ECharts 与微信 Canvas 适配
colorui/              基础样式和组件
miniprogram_npm/      微信 npm 构建产物
scripts/              测试、检查、样式同步脚本
styles/               公共样式
icons/、images/        本地图片资源
app.js                全局会话、TabBar 路由与小程序更新处理
app.json              页面、分包与组件配置
project.config.json   微信开发者工具和打包配置
```

## 关键业务与接口约定

### 登录、身份与页面

- 登录入口为 `pages/index/index`；未绑定账号进入 `pages/bind/bind`，短信验证位于 `pages/verification/verification`。
- 通用版使用 `pages/home/home` 和 `pages/rooms/rooms`；单机版使用 `pages/home2/home2` 和 `pages/envir/envir`。路由配置见 `app.js` 的 `TAB_CONFIG`。
- **现有后端不感知管理员身份。** 管理员判断沿用登录接口返回的手机号与前端白名单，维护位置为 `utils/login.js`；登录流程还要求经销商身份。不要擅自依赖后端尚不存在的 `is_admin` 或 `role` 字段。
- 前端白名单控制页面和操作流程，不能替代服务端的接口授权与项目归属检查。
- 账号切换使用 `app.replaceSession()`，退出或重置使用 `app.clearSession()`，避免遗留管理员、成员、访客或项目状态。

### 后端与数据结构

接口集中于 `api/api.js`，当前地址为 `https://control.cosyhome.com.cn`。项目没有独立的环境变量切换机制；联调前先确认请求目标。静态资源与附件还涉及 OSS，微信后台的合法域名配置需与实际请求保持一致。

旧项目 `cosyhome_allmini` 用于核对已有接口约定；当前版本已改进页面逻辑，不应直接用旧逻辑覆盖重构代码。

| 约定 | 当前处理 |
| --- | --- |
| 登录返回 `unbinded` | 作为未绑定账号处理 |
| 项目接口无项目返回 `{}` | 兼容为空列表；有项目时读取 `project_entities` |
| 登录凭证 | 保存为 `Bearer <access_token>`，用于请求头 `Authorization` |
| 短信发送与绑定成功 | 沿用旧代码的 HTTP 200 约定，不自行假设未知业务错误码 |
| 控制屏业务码 `4` | 透传相关接口按控制屏响应超时处理 |
| 登录业务码 `3`、访客登录业务码 `5` | 在对应接口作为失败处理 |

注意两个同名的请求工具返回值不同：`utils/request.js` 的 `apiRequest()` 返回完整响应，`utils/projects.js` 的 `apiRequest()` 返回 `response.data`。

### 项目切换与设备控制

- `utils/projects.js` 管理项目选择与上下文版本。异步请求应固定项目 ID、登录凭证，并在应用结果前核对上下文，避免切换项目后被旧响应覆盖。
- `utils/homeProjects.js` 负责按身份查询项目、应用选择和清空旧状态。首页新项目数据就绪前不开放相应控制入口。
- `utils/controlMessage.js` 封装发送指令和延迟读取回调；新调用优先复用该封装。当前同步透传接口仅用于项目状态页。
- `utils/controlQueue.js` 合并连续设定、串行发送最终目标。它是前端操作队列，不代表所有旧控制屏共享回调通道已实现隔离。
- 不要把“HTTP 请求成功”“指令已发送”和“设备已执行”视作同一状态。无 `requestId` 的旧版响应仍有兼容路径，需要真实固件验证。

### 验证码与报修

- 验证码保留四格外观，由一个原生输入框接收键盘和整段粘贴，满 4 位自动验证。
- 发送成功后开始 60 秒冷却，按手机号保存截止时间；切后台或重新进入后按实际时间恢复。发送失败显示原因并允许重试。
- 服务端明确提示验证码错误或过期时清空并重新聚焦；网络、服务异常或原因不明时保留验证码。当前清空判断依据明确的错误文案，后续可在确认接口契约后改用稳定业务码。
- 报修记录创建后锁定基础信息，附件失败允许续传；现有前端接口封装没有报修基础信息更新接口，不应让用户误以为续传同时修改了已提交信息。

## 测试与发布

当前页面流程模拟包含 **25 组回归场景**，覆盖连续控制、项目切换、会话替换、登录空项目、报告后台恢复、报修续传，以及验证码发送、冷却、粘贴和失败恢复。

测试使用模拟微信 API 与接口响应，不发送真实短信，不操作真实设备。通过 `npm test` 不等于完成真机验收。

发布前至少完成：

1. 运行测试与静态检查，检查 npm 构建产物、样式同步和上传包体积。
2. 验证普通用户、成员、经销商、访客、管理员，以及通用版、单机版、新两联供项目的主要入口。
3. 在测试项目验证慢网、断网、登录失效、设备离线、快速切项目、连续控制和后台恢复。
4. 在 iOS/Android 真机确认四格验证码的输入、长按粘贴、错误后聚焦，以及图表、长列表和附件上传。
5. 核对开发者工具实际域名校验、隐私配置和体验版结果，再执行微信平台的上传与发布流程。

## 当前进展与后续改进

已完成原审查中的 F01–F07、F09–F11 和 F20：连续控制不丢最终值、失败恢复刷新、固定请求上下文、清理项目与身份状态、空项目登录出口、报告后台恢复、报修信息锁定，以及验证码交互。原 F08 根据已确认的后端设计撤回缺陷结论，保留手机号白名单。

仍需推进的事项包括：

- 报修成功后短暂重复提交、离开页面后上传回调、附件失败重试和服务端幂等。
- 新版定时在家/离家提示与跨天判断。
- 天气字段缺失、报表缺测值与真实零值区分、滤网剩余 0 天展示。
- 统一页面及操作权限检查，并验证实际服务端项目归属授权。
- 旧控制屏共享回调通道并发验证、业务错误与设备执行结果识别。
- 报告按需解密、图表懒加载、列表分页、轮询退避和全局重复样式整理。
- 数据最后更新时间、错误观测、隐私说明和发布流程完善。

这些事项不代表已经完成后端或真机验证。后续修改应结合真实接口返回和固件能力确认。

## GitLab 与 GitHub 同步

主分支为 `master`，两个当前项目远程同时保留：

| 远程名 | 用途 | 地址 |
| --- | --- | --- |
| `origin` | GitLab 当前项目 | `git@test.cosyhome.com.cn:HaoqiangLyu/cosyhome_codex.git` |
| `github` | GitHub 私有仓库 | `git@github.com:haoqianglyu/cosyhome_codex.git` |
| `allmini` | 旧项目参考，不默认推送 | `git@test.cosyhome.com.cn:cosyhomedevteam/cosyhome_allmini.git` |

GitHub 页面：[haoqianglyu/cosyhome_codex](https://github.com/haoqianglyu/cosyhome_codex)。两个仓库不会自动互相同步，提交后需分别推送：

```bash
git status
npm test
git diff --check
# 选择本次需要提交的文件，执行 git add 和 git commit 后：
git push origin master
git push github master
```

功能分支应使用实际分支名，不擅自合并或强制覆盖主分支。推送后核对两边结果；一侧失败时不要将其记为全部同步成功。

项目协作约定见 [AGENTS.md](AGENTS.md)：用户提出“提交”时，默认检查、提交当前任务相关改动并同步两个仓库；普通修改请求不自动提交或推送。
