const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.resolve(__dirname, '..');
const flush = () => new Promise(resolve => setImmediate(resolve));
const clone = value => JSON.parse(JSON.stringify(value));

function deferred() {
  let resolve, reject;
  const promise = new Promise((a, b) => { resolve = a; reject = b; });
  return { promise, resolve, reject };
}

function harness(overrides = {}) {
  const storage = new Map([['access_token', 'Bearer owner'], ['selected_home', 'A'], ['haveProject', true]]);
  const timers = new Map(), cache = new Map(), calls = [];
  let now = 0, nextId = 0, pageDefinition, app, currentPage;
  const setTimer = (fn, delay = 0, interval = false) => {
    const id = ++nextId;
    timers.set(id, { fn, at: now + delay, delay, interval });
    return id;
  };
  const wx = {
    getStorageSync: key => storage.has(key) ? storage.get(key) : '',
    setStorageSync: (key, value) => storage.set(key, value),
    removeStorageSync: key => storage.delete(key),
    getWindowInfo: () => ({ windowWidth: 375, windowHeight: 800, pixelRatio: 2 }),
    getDeviceInfo: () => ({ model: 'test-device' }),
    nextTick: fn => fn(),
    login: options => options.success({ code: 'test-wx-code' }),
    showToast: options => calls.push({ type: 'toast', ...options }),
    redirectTo: options => calls.push({ type: 'redirect', ...options }),
    reLaunch: options => calls.push({ type: 'reLaunch', ...options }),
    navigateTo: options => calls.push({ type: 'navigate', ...options }),
    navigateBack: options => calls.push({ type: 'back', ...options }),
    showLoading() {}, hideLoading() {}, setNavigationBarTitle() {},
    showNavigationBarLoading() {}, hideNavigationBarLoading() {},
  };
  function load(file) {
    file = path.posix.normalize(file);
    if (Object.prototype.hasOwnProperty.call(overrides, file)) return overrides[file];
    if (cache.has(file)) return cache.get(file).exports;
    if (file.startsWith('ec-canvas/') || file.startsWith('@vant/') || file === 'lottie-miniprogram') return {};
    const module = { exports: {} };
    cache.set(file, module);
    let source = fs.readFileSync(path.join(root, file), 'utf8');
    source = source.replace(/import\s+([\s\S]*?)\s+from\s+["']([^"']+)["'];/g, (_, binding, request) => {
      let target = request.startsWith('.') ? path.posix.join(path.posix.dirname(file), request) : request;
      if (request.startsWith('.') && !target.endsWith('.js')) target += '.js';
      const assignment = binding.startsWith('* as ') ? binding.slice(5) : binding;
      return `const ${assignment} = __load(${JSON.stringify(target)});`;
    });
    const names = [];
    source = source.replace(/export\s+(async\s+)?function\s+(\w+)/g, (_, asyncKeyword, name) => {
      names.push(name); return `${asyncKeyword || ''}function ${name}`;
    });
    source = source.replace(/export\s*\{([^}]+)\};/g, (_, list) => { names.push(...list.split(',').map(x => x.trim()).filter(Boolean)); return ''; });
    if (names.length) source += `\nmodule.exports = { ${names.join(', ')} };`;
    vm.runInNewContext(source, {
      module, __load: load, wx,
      getApp: () => app,
      getCurrentPages: () => currentPage ? [currentPage] : [],
      App: value => { app = value; },
      Page: value => { pageDefinition = value; },
      console: { log() {}, error() {}, warn() {} },
      Date: class extends Date { static now() { return 1700000000000 + now; } },
      setTimeout: (fn, delay) => setTimer(fn, delay),
      clearTimeout: id => timers.delete(id),
      setInterval: (fn, delay) => setTimer(fn, delay, true),
      clearInterval: id => timers.delete(id),
    }, { filename: file });
    return module.exports;
  }
  load('app.js');
  function page(file) {
    cache.delete(file);
    load(file);
    const result = { ...pageDefinition, data: clone(pageDefinition.data) };
    result.setData = function(values, callback) {
      for (const [key, value] of Object.entries(values)) {
        const parts = key.replace(/\[(\d+)\]/g, '.$1').split('.');
        let target = this.data;
        for (const part of parts.slice(0, -1)) target = target[part] || (target[part] = {});
        target[parts[parts.length - 1]] = value;
      }
      if (callback) callback();
    };
    result.selectComponent = () => null;
    result.getOpenerEventChannel = () => ({ on() {} });
    currentPage = result;
    return result;
  }
  async function tick(milliseconds) {
    const end = now + milliseconds;
    for (;;) {
      const task = [...timers].filter(([, t]) => t.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
      if (!task) break;
      const [id, timer] = task;
      now = timer.at;
      if (timer.interval) timer.at += timer.delay;
      else timers.delete(id);
      timer.fn();
      await flush();
    }
    now = end;
    await flush();
  }
  return { storage, timers, calls, wx, load, page, tick, get app() { return app; } };
}

const tests = [];
function test(name, run) { tests.push({ name, run }); }
function roomHarness(api) {
  const h = harness({ 'api/api.js': api });
  const p = h.page('pages/roomdetail/roomdetail.js');
  p._roomContext = h.load('utils/projects.js').captureProjectContext();
  p._pageVisible = true;
  Object.assign(p.data, { roomId: 'room-A', showtemp: 25, minTemperatureSet: 16, maxTemperatureSet: 30, roomMode: 0, energyMode: 0, currentButton: 0, hasWindControl: true, windLevelNumber: 3 });
  p.loadRoomStatus = () => { p.statusReads = (p.statusReads || 0) + 1; };
  p.startRoomPolling();
  return { h, p };
}

test('F01 连续温度请求串行发送最终值，失败回退到已提交值并恢复轮询', async () => {
  const requests = [];
  const { h, p } = roomHarness({ ctrl_room_temp: options => requests.push(options) });
  p.bindPlus();
  await h.tick(500);
  p.bindPlus();
  p.bindPlus();
  await h.tick(500);
  assert.equal(requests.length, 1);
  assert.equal(p.data.showtemp, 26.5);
  requests[0].success({ statusCode: 200 });
  await flush();
  assert.equal(requests.length, 2);
  assert.equal(requests[1].data.target_temp, 26.5);
  assert.equal(p.data.refreshInterval, null);
  requests[1].fail(new Error('offline'));
  await flush();
  assert.equal(p.data.showtemp, 25.5);
  assert(p.data.refreshInterval);
});

test('F01 风速保留最后档位，页面隐藏取消未发送操作', async () => {
  const requests = [];
  const { h, p } = roomHarness({ trans_ctrl_message: options => requests.push(options) });
  p.switchButton({ currentTarget: { dataset: { index: 1 } } });
  await h.tick(500);
  p.switchButton({ currentTarget: { dataset: { index: 2 } } });
  await h.tick(500);
  requests[0].success({ statusCode: 200 });
  await flush();
  assert.equal(requests.length, 2);
  assert.equal(JSON.parse(requests[1].data.body).level, 3);
  requests[1].success({ statusCode: 200 });
  await flush();
  assert(p.data.refreshInterval);
  p.switchButton({ currentTarget: { dataset: { index: 0 } } });
  p.onHide();
  await h.tick(500);
  assert.equal(requests.length, 2);
  assert.equal(p.data.refreshInterval, null);
  p.onShow();
  assert(p.data.refreshInterval);
});

test('F02 工作模式校验、开关失败不会使轮询永久停止', async () => {
  const { p } = roomHarness({ trans_ctrl_message: options => options.fail(new Error('offline')) });
  p.data.workModes = [{ isChange: false }];
  await p.toggleSelection({ currentTarget: { dataset: { index: 0 } } });
  assert(p.data.refreshInterval);
  p.data.workModes = [{ isChange: true, isSelect: true }];
  await p.toggleSelection({ currentTarget: { dataset: { index: 0 } } });
  assert(p.data.refreshInterval);
  p.onChange({ detail: { value: true } });
  await flush();
  assert(p.data.refreshInterval);
  assert.equal(p.data.switch1, null);
});

test('F02 温度未到防抖时间时另一开关完成，不抢先刷新旧状态', async () => {
  const temperature = [], switches = [];
  const { h, p } = roomHarness({ ctrl_room_temp: options => temperature.push(options), trans_ctrl_message: options => switches.push(options) });
  p.bindPlus();
  p.onChangeLock({ detail: { value: true } });
  switches[0].success({ statusCode: 200 });
  await flush();
  assert.equal(p.data.refreshInterval, null);
  await h.tick(500);
  temperature[0].success({ statusCode: 200 });
  await flush();
  assert(p.data.refreshInterval);
});

test('F03 普通及关联透传保持发送时的项目、凭证和请求体约定', async () => {
  for (const correlated of [false, true]) {
    const requests = [];
    const h = harness({ 'api/api.js': {
      trans_ctrl_message: options => { requests.push(options); options.success({ statusCode: 200 }); },
      trans_ctrl_message_callback: options => { requests.push(options); options.success({ statusCode: 200, data: { body: { requestId: 'r1', data: [] } } }); },
    } });
    const control = h.load('utils/controlMessage.js');
    const promise = correlated
      ? control.legacyCorrelatedControlMessageBody({ messageType: 10, body: { requestId: 'r1', year: '2026', month: '9' } }, { initialDelay: 1000 })
      : control.legacyControlMessageBody({ messageType: 3, body: 'room-A' });
    await flush();
    h.storage.set('selected_home', 'B');
    h.storage.set('access_token', 'Bearer other');
    await h.tick(1000);
    await promise;
    assert.deepEqual(requests.map(r => r.data.project_id), ['A', 'A']);
    assert.deepEqual(requests.map(r => r.header.Authorization), ['Bearer owner', 'Bearer owner']);
    assert.equal(requests[1].data.body, undefined);
    if (!correlated) assert.equal(requests[0].data.body, 'room-A');
  }
});

test('F04 切项目清理模式和定时，空列表移除项目ID，A→B→A作废旧上下文', () => {
  const h = harness({ 'api/api.js': {} });
  const projects = h.load('utils/projects.js'), homes = h.load('utils/homeProjects.js');
  const p = h.page('pages/home/home.js');
  Object.assign(p.data, { selectedProjectId: 'A', projectReady: true, hasclock: true, clock_info: { version: 2 }, deviceData: [{ temperature: 22 }] });
  h.storage.set('mode_list', [{ mode: 9 }]);
  const old = projects.captureProjectContext();
  homes.applyHomeProjects(p, [{ id: 'B', name: 'B', app_name: '单机版' }]);
  assert.equal(p.data.projectReady, false);
  assert.equal(p.data.hasclock, false);
  assert.equal(h.storage.get('mode_list'), undefined);
  assert.equal(p.ensureProjectReady(), false);
  projects.saveSelectedProject({ id: 'A', name: 'A' });
  assert.equal(projects.isProjectContextCurrent(old), false);
  homes.applyHomeProjects(p, []);
  assert.equal(h.storage.get('selected_home'), undefined);
  assert.equal(h.storage.get('selected_project_info'), undefined);
  assert.equal(h.storage.get('haveProject'), false);
});

test('F04 两种首页旧项目响应不能覆盖新项目，加载完才开放控制', async () => {
  for (const name of ['home', 'home2']) {
    const pending = [];
    const h = harness({ 'api/api.js': {}, 'utils/controlMessage.js': { legacyControlMessageBody: () => { const d = deferred(); pending.push(d); return d.promise; } } });
    const p = h.page(`pages/${name}/${name}.js`);
    p._pageVisible = true;
    const homeUtils = h.load('utils/homeProjects.js');
    homeUtils.applyHomeProjects(p, [{ id: 'A', name: 'A' }]);
    const a = p.getDataFromScreen();
    homeUtils.applyHomeProjects(p, [{ id: 'B', name: 'B' }]);
    const b = p.getDataFromScreen();
    pending[0].resolve({ currentMode: 1, currentModeName: 'A', sensor: [], mode: [] });
    await a;
    assert.equal(p.data.projectReady, false);
    pending[1].resolve({ currentMode: 2, currentModeName: 'B', sensor: [], mode: [] });
    await b;
    assert.equal(p.data.projectReady, true);
    assert(p.data.show_mode.includes('B'));
  }
});

test('F05 环境Tab切项目重新查询历史，忽略旧响应，空项目不发请求', async () => {
  const pending = [];
  const h = harness({ 'utils/controlMessage.js': { legacyControlMessageBody: options => { const d = deferred(); pending.push({ ...d, ...options }); return d.promise; } } });
  const p = h.page('pages/envir/envir.js');
  let renders = 0;
  p.getChartData = () => renders++;
  p.onLoad(); p.onShow();
  assert.equal(pending.filter(r => r.messageType === 19).length, 1);
  p.onHide();
  h.load('utils/projects.js').saveSelectedProject({ id: 'B' });
  p.onShow();
  assert.equal(pending.filter(r => r.messageType === 19).length, 2);
  pending.find(r => r.messageType === 19 && r.projectId === 'A').resolve([{ temperature: 10 }]);
  await flush();
  assert.equal(p.data.temperature_array.length, 0);
  pending.find(r => r.messageType === 19 && r.projectId === 'B').resolve([{ temperature: 22, humidity: 50, dewPoint: 11, dateFormat: '08' }]);
  await flush();
  assert.deepEqual(clone(p.data.temperature_array), [22]);
  assert.equal(renders, 1);
  p.onHide(); h.load('utils/projects.js').clearSelectedProject(); p.onShow();
  assert.equal(p.data.temperature_array.length, 0);
  assert.equal(p.data.sliderable, false);
  assert.equal(pending.length, 6);
});

test('F06 环境设定转换字符串、夹紧上下限，非法步长不发送', async () => {
  const sent = [];
  const h = harness({ 'utils/controlMessage.js': { sendControlCommand: options => { sent.push(options); return Promise.resolve(); } } });
  const p = h.page('pages/envir/envir.js');
  p._pageVisible = true; p._projectContext = h.load('utils/projects.js').captureProjectContext();
  Object.assign(p.data, { sliderable: true, shownum: '59.8', minset: '20', maxset: '60', dvalue: '0.5', setType: 2 });
  p.bindPlus(); await h.tick(1000);
  assert.equal(p.data.shownum, 60);
  assert.equal(sent[0].body.value, 60);
  p.setData({ shownum: 20.2 }); p.bindMinus(); await h.tick(1000);
  assert.equal(sent[1].body.value, 20);
  p.setData({ dvalue: 0 }); p.bindPlus(); await h.tick(1000);
  assert.equal(sent.length, 2);
});

test('F07 访客成功登录替换原管理员/成员身份并清理项目缓存', async () => {
  const h = harness({ 'api/api.js': {
    visitor_login: o => o.success({ data: { access_token: 'guest' } }),
    visitor_projects: o => o.success({ data: { project_entities: [{ id: 'B', app_name: '单机版' }] } }),
  } });
  h.storage.set('isAdmin', true); h.storage.set('isdistributor', true); h.storage.set('is_member_login', true); h.storage.set('clock_info', { old: true });
  const p = h.page('pages/bind/bind.js'); p._pageVisible = true;
  await p.loginAsGuest();
  assert.equal(h.storage.get('isAdmin'), false);
  assert.equal(h.storage.get('is_member_login'), false);
  assert.equal(h.storage.get('isdistributor'), false);
  assert.equal(h.storage.get('clock_info'), undefined);
  assert.equal(h.storage.get('selected_home'), 'B');
  assert.equal(h.storage.get('access_token'), 'Bearer guest');
  assert.equal(h.app.globalData.isdistributor_visitor, true);
});

test('F09 兼容旧接口未绑定及无项目空对象，所有登录角色均有出口', async () => {
  const cases = [
    { login: { unbinded: true }, user: {}, distributor: {} },
    { login: { access_token: 'owner', is_distributor: false }, user: {} },
    { login: { access_token: 'dealer', is_distributor: true }, user: {}, distributor: {} },
    { login: { access_token: 'dealer', is_distributor: true }, user: { project_entities: [{ id: 'A' }] }, distributor: {}, role: 'distributor' },
  ];
  for (const c of cases) {
    const h = harness({ 'api/api.js': {
      mini_login: o => o.success({ data: c.login }),
      user_projects: o => o.success({ data: c.user }),
      distributor_projects: o => o.success({ data: c.distributor }),
    } });
    if (c.role) h.storage.set('login', c.role);
    const p = h.page('pages/index/index.js');
    await p.login();
    assert(h.calls.some(c => c.type === 'redirect' && c.url.endsWith('bind/bind')));
    assert.equal(p._loginPending, false);
  }
});

test('F09 网络失败可重试，管理员仍使用旧手机号白名单', async () => {
  let attempts = 0;
  const h = harness({ 'api/api.js': { mini_login: o => {
    attempts++;
    if (attempts === 1) o.fail(new Error('network'));
    else o.success({ data: { access_token: 'admin', is_distributor: true, customer_phone: '15006181214' } });
  } } });
  const p = h.page('pages/index/index.js');
  await p.login();
  assert.equal(p.data.loginStatus, 'error');
  await p.login();
  assert.equal(h.storage.get('isAdmin'), true);
  assert(h.calls.some(c => c.type === 'redirect' && c.url.endsWith('admin/admin')));
});

test('F09 普通用户成功仍延迟进入正确项目主页；重复点击不重复登录', async () => {
  let attempts = 0;
  const h = harness({ 'api/api.js': {
    mini_login: o => { attempts++; o.success({ data: { access_token: 'owner' } }); },
    user_projects: o => o.success({ data: { project_entities: [{ id: 'A', app_name: '通用版' }] } }),
  } });
  const p = h.page('pages/index/index.js'); const promise = p.login(); await flush();
  await p.login(); assert.equal(attempts, 1);
  await h.tick(1200); await promise;
  assert(h.calls.some(c => c.type === 'reLaunch' && c.url === '/pages/home/home'));
});

test('F10 报告后台返回成功或失败都结束加载，卸载不再更新', async () => {
  for (const outcome of ['success', 'failure', 'unload']) {
    let request;
    const h = harness({ 'api/api.js': { project_report: o => { request = o; } } });
    const p = h.page('pages/reportlist/reportlist.js'); p._pageVisible = true;
    const promise = p.fetchReports(); p.onHide();
    if (outcome === 'unload') p.onUnload();
    if (outcome === 'failure') request.fail(new Error('network'));
    else request.success({ data: { project_report_entities: [] } });
    await promise;
    if (outcome === 'unload') assert.equal(p.data.loading, true);
    else { p.onShow(); assert.equal(p.data.loading, false); }
  }
});

test('F09 退出登录页后迟到的项目响应不能覆盖新访客角色', async () => {
  for (const distributor of [false, true]) {
    let request;
    const h = harness({ 'api/api.js': {
      mini_login: o => o.success({ data: { access_token: 'owner', is_distributor: distributor } }),
      user_projects: o => { request = o; },
    } });
    const p = h.page('pages/index/index.js'); const promise = p.login(); await flush();
    p.onUnload();
    h.app.replaceSession({ accessToken: 'Bearer guest', visitor: true, distributorVisitor: true });
    request.success({ data: { project_entities: [{ id: 'A' }] } }); await promise;
    assert.equal(h.storage.get('access_token'), 'Bearer guest');
    assert.equal(h.app.globalData.isvisitor, true);
    assert.equal(h.storage.get('isdistributor'), false);
    assert.equal(h.calls.filter(c => ['redirect', 'reLaunch'].includes(c.type)).length, 0);
  }
});

test('F10 详情在后台收到报告延迟渲染，失败结束加载，退出后作废', async () => {
  for (const outcome of ['success', 'failure', 'unload']) {
    let request;
    const report = { id: 42, bodyParsed: {} };
    const h = harness({
      'api/api.js': { project_report: o => { request = o; } },
      'utils/report.js': { prepareReport: value => value },
    });
    const p = h.page('pages/reportdetail/reportdetail.js'); p.onLoad();
    const promise = p.loadReportById('42'); p.onHide();
    if (outcome === 'unload') p.onUnload();
    if (outcome === 'failure') request.fail(new Error('network'));
    else request.success({ data: { project_report_entities: [report] } });
    await promise;
    assert.equal(p._reportLoading, false);
    assert.equal(p.data.report, null);
    if (outcome === 'unload') {
      assert.equal(p._deferredReport, null);
    } else {
      assert.equal(p.data.reportLoading, false);
      p.onShow();
      if (outcome === 'success') {
        assert.equal(p.data.report.id, 42);
        assert.equal(p._reportLoaded, true);
        assert.equal(p.data.loadError, '');
      } else assert(p.data.loadError);
    }
  }
});

test('F11 记录创建后锁定实际提交的信息，附件失败可续传；创建失败可编辑', async () => {
  let request, creates = 0, uploads = 0;
  const h = harness({ 'api/api.js': { create_repair_report: o => { request = o; creates++; } } });
  const p = h.page('subpackages/repaircreate/repaircreate.js');
  Object.assign(p.data, { contactName: ' 测试 ', contactPhone: '13800000000', address: ' 原地址 ', description: '描述', fileList: [{ url: 'test.jpg' }] });
  p.uploadAllFiles = () => { uploads++; p.setData({ submitting: false }); };
  p.submitFeedback();
  p.onAddressChange({ detail: '请求中修改' });
  assert.equal(p.data.address, '原地址');
  request.success({ data: { id: 42 } });
  p.onAddressChange({ detail: '附件失败后修改' });
  p.onDescriptionChange({ detail: '另一描述' });
  assert.equal(p.data.address, request.data.address);
  assert.equal(p.data.description, request.data.description);
  p.submitFeedback();
  assert.equal(creates, 1); assert.equal(uploads, 2);
  p.setData({ currentReportId: null, submitting: false });
  p.submitFeedback(); request.fail(new Error('network'));
  p.onAddressChange({ detail: '允许修改' });
  assert.equal(p.data.address, '允许修改');
});

test('F07 旧登录凭证的迟到401不会清空新会话', () => {
  const h = harness();
  let request;
  h.wx.request = o => { request = o; };
  const api = h.load('api/api.js');
  api.user_projects({ header: { Authorization: 'Bearer owner' }, fail() {} });
  h.app.replaceSession({ accessToken: 'Bearer guest', visitor: true });
  request.success({ statusCode: 401 });
  assert.equal(h.storage.get('access_token'), 'Bearer guest');
  assert.equal(h.calls.filter(c => c.type === 'toast').length, 0);
});

test('验证码发送成功才显示已发送，60秒冷却阻止重复发送并恢复重发', async () => {
  const requests = [];
  const h = harness({ 'api/api.js': { sendverify: o => requests.push(o) } });
  h.storage.set('userPhoneNumber', '13800000000');
  const p = h.page('pages/verification/verification.js'); p.onLoad();
  assert.equal(p.data.sendStatus, 'sending');
  await p.handleSendVerify(); assert.equal(requests.length, 1);
  requests[0].success({ statusCode: 200 }); await flush();
  assert.equal(p.data.sendStatus, 'sent'); assert.equal(p.data.cooldown, 60);
  await h.tick(59000); await p.handleSendVerify();
  assert.equal(requests.length, 1); assert.equal(p.data.cooldown, 1);
  await h.tick(1000); p.handleSendVerify();
  assert.equal(requests.length, 2); assert.equal(p.data.sendStatus, 'sending');
  requests[1].fail({ data: { message: '发送过于频繁' } }); await flush();
  assert.equal(p.data.sendStatus, 'error'); assert.equal(p.data.sendError, '发送过于频繁');
  assert.equal(p.data.cooldown, 0);
  p.handleSendVerify(); assert.equal(requests.length, 3);
  requests[2].success({ statusCode: 200 }); await flush();
  assert.equal(p.data.cooldown, 60);
});

test('验证码冷却跨后台和页面返回保留，到期重新进入可发送', async () => {
  let sends = 0;
  const h = harness({ 'api/api.js': { sendverify: o => { sends++; o.success({ statusCode: 200 }); } } });
  h.storage.set('userPhoneNumber', '13800000000');
  let p = h.page('pages/verification/verification.js'); p.onLoad(); await flush();
  p.onHide(); assert.equal(h.timers.size, 0);
  await h.tick(15000); p.onShow(); assert.equal(p.data.cooldown, 45);
  p.onUnload();
  p = h.page('pages/verification/verification.js'); p.onLoad();
  assert.equal(p.data.cooldown, 45); assert.equal(sends, 1);
  p.onHide(); await h.tick(50000); p.onShow();
  assert.equal(p.data.cooldown, 0); p.onUnload();
  p = h.page('pages/verification/verification.js'); p.onLoad(); await flush();
  assert.equal(sends, 2); assert.equal(p.data.cooldown, 60);
});

test('发送接口HTTP错误及网络失败显示可重试状态，不误跳转登录', async () => {
  for (const network of [false, true]) {
    const h = harness(); let request;
    h.wx.request = o => { request = o; };
    h.storage.set('userPhoneNumber', '13800000000');
    const p = h.page('pages/verification/verification.js'); p.onLoad();
    if (network) request.fail({ errMsg: 'request:fail timeout' });
    else request.success({ statusCode: 401, data: { message: '发送失败，请稍后重试' } });
    await flush();
    assert.equal(p.data.sendStatus, 'error'); assert.equal(p.data.cooldown, 0);
    assert(p.data.sendError.includes(network ? '网络' : '发送失败'));
    assert.equal(h.storage.get('access_token'), 'Bearer owner');
    assert.equal(h.timers.size, 0);
  }
});

test('原生输入清洗粘贴内容且保留前导0，满4位只提交一次，失败可编辑重试', async () => {
  const requests = [];
  const h = harness({ 'api/api.js': {
    sendverify: o => o.success({ statusCode: 200 }),
    bindproject: o => requests.push(o),
  } });
  h.storage.set('userPhoneNumber', '13800000000');
  const p = h.page('pages/verification/verification.js'); p.onLoad(); await flush();
  p.onCodeInput({ detail: { value: '01' } }); await flush(); assert.equal(requests.length, 0);
  assert.equal(p.onCodeInput({ detail: { value: ' 0123 ' } }), '0123');
  await flush();
  p.onCodeInput({ detail: { value: '4567' } }); p.verifyCode();
  assert.equal(requests.length, 1);
  assert.equal(requests[0].data.customer_phone_code, '0123');
  assert.equal(requests[0].data.customer_phone, '13800000000');
  requests[0].fail({ data: { message: '验证码错误' } }); await flush();
  assert.equal(p.data.errorCode, '验证码错误'); assert.equal(p.data.verifying, false);
  assert.equal(p.data.currentInput, ''); assert.equal(p.data.inputFocused, true);
  p.onCodeInput({ detail: { value: '01' } });
  assert.equal(p.data.errorCode, ''); assert.equal(p.data.currentInput, '01');
  p.onCodeInput({ detail: { value: '0124' } }); await flush();
  requests[1].fail(new Error('network')); await flush();
  assert.equal(p.data.currentInput, '0124');
  p.verifyCode(); await flush(); assert.equal(requests.length, 3);
  requests[2].success({ statusCode: 200 }); await flush();
  assert.equal(p.data.bound, true); assert.equal(p.data.verifying, false);
  p.verifyCode(); assert.equal(requests.length, 3);
  await h.tick(1000);
  assert(h.calls.some(c => c.type === 'reLaunch' && c.url === '/pages/index/index'));
});

test('验证码页卸载后迟到响应不更新页面或跳转，后台成功在恢复时进入首页', async () => {
  for (const unload of [false, true]) {
    let request;
    const h = harness({ 'api/api.js': {
      sendverify: o => o.success({ statusCode: 200 }),
      bindproject: o => { request = o; },
    } });
    h.storage.set('userPhoneNumber', '13800000000');
    const p = h.page('pages/verification/verification.js'); p.onLoad(); await flush();
    p.onCodeInput({ detail: { value: '1234' } }); await flush();
    if (unload) { p.onUnload(); p.setData = () => assert.fail('卸载后更新页面'); }
    else p.onHide();
    request.success({ statusCode: 200 }); await flush(); await h.tick(1000);
    assert(!h.calls.some(c => c.type === 'reLaunch'));
    if (!unload) {
      assert.equal(p.data.bound, true); p.onShow(); await h.tick(1000);
      assert(h.calls.some(c => c.type === 'reLaunch'));
    }
  }
  let request;
  const h = harness({ 'api/api.js': { sendverify: o => { request = o; } } });
  h.storage.set('userPhoneNumber', '13800000000');
  const p = h.page('pages/verification/verification.js'); p.onLoad(); p.onUnload();
  p.setData = () => assert.fail('卸载后更新页面');
  request.success({ statusCode: 200 }); await flush();
  assert.equal(h.timers.size, 0);
});

test('验证码错误或过期清空并聚焦，网络、服务及未知错误保留以便重试', async () => {
  const cases = [
    { error: { statusCode: 400, data: { message: '验证码不正确' } }, clear: true },
    { error: { statusCode: 400, data: { message: '短信验证码已过期，请重新获取' } }, clear: true, response: true },
    { error: { data: { message: '验证码已失效' } }, clear: true },
    { error: { type: 'network', message: 'request:fail timeout' }, clear: false },
    { error: { statusCode: 503, data: { message: '验证码错误' } }, clear: false },
    { error: { statusCode: 400, data: { message: '验证服务暂时不可用' } }, clear: false },
    { error: { statusCode: 400, data: { message: '验证失败' } }, clear: false },
    { error: { errMsg: 'login:fail' }, clear: false, loginFailure: true },
  ];
  for (const c of cases) {
    let binds = 0;
    const h = harness({ 'api/api.js': {
      sendverify: o => o.success({ statusCode: 200 }),
      bindproject: o => { binds++; c.response ? o.success(c.error) : o.fail(c.error); },
    } });
    h.storage.set('userPhoneNumber', '13800000000');
    const p = h.page('pages/verification/verification.js'); p.onLoad(); await flush();
    if (c.loginFailure) h.wx.login = o => o.fail(c.error);
    p.onCodeInput({ detail: { value: '0123' } }); await flush();
    assert.equal(p.data.currentInput, c.clear ? '' : '0123');
    assert.equal(p.data.inputFocused, c.clear);
    assert.equal(p.data.verifying, false);
    assert(p.data.errorCode);
    assert.equal(binds, c.loginFailure ? 0 : 1);
  }
});

test('后台收到验证码错误先清空，回到前台再聚焦且不重复验证', async () => {
  let request, binds = 0;
  const h = harness({ 'api/api.js': {
    sendverify: o => o.success({ statusCode: 200 }),
    bindproject: o => { request = o; binds++; },
  } });
  h.storage.set('userPhoneNumber', '13800000000');
  const p = h.page('pages/verification/verification.js'); p.onLoad(); await flush();
  p.onCodeInput({ detail: { value: '0123' } }); await flush(); p.onHide();
  request.fail({ statusCode: 400, data: { message: '验证码错误' } }); await flush();
  assert.equal(p.data.currentInput, ''); assert.equal(p.data.inputFocused, false);
  p.onShow();
  assert.equal(p.data.inputFocused, true); assert.equal(p.data.errorCode, '验证码错误');
  assert.equal(binds, 1);
});

(async () => {
  for (const { name, run } of tests) {
    try { await run(); }
    catch (error) { error.message = `${name}: ${error.message}`; throw error; }
  }
  console.log(`页面与接口约定回归通过（${tests.length} 组场景，无真实网络或设备操作）`);
})().catch(error => { console.error(error); process.exitCode = 1; });
