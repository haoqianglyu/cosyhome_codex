// pages/test/test.js
import api from "../../api/api.js";

Page({
  data: {
    reports: [], // 报告列表
  },

  /** 生命周期函数—加载 */
  onLoad() {
    wx.setNavigationBarTitle({
      title: "查看报告",
    });
    this.fetchReports();
  },




  /* -------- 主流程 -------- */
  fetchReports() {
    api.project_report({
      method: "POST",
      header: {
        "content-type": "application/json",
        Authorization: wx.getStorageSync("access_token"),
      },
      data: { project_id: wx.getStorageSync("selected_home") },
      success: (res) => {
        const list = (res.data.project_report_entities || []).map(ent => {
          const bytes = this.base64ToBytes(ent.body);
          const plainBuf = this.rc4Decrypt(bytes, ent.id);
          const bodyStr = this.decode(plainBuf);
          const jsonbody = JSON.parse(bodyStr)
          // ✅ 打印每份报告解密之后的body内容
          console.log(`🔓 解密报告 [${ent.name}] 的 body 内容：\n`, jsonbody);

          return {
            ...ent,
            bodyDecrypted: bodyStr,
            period: `${this.formatDate(ent.start_time)}~${this.formatDate(ent.end_time)}`
          };
        });

        this.setData({ reports: list });
      }
    });
  },


  /* -------- 点击跳转 -------- */
  onReportTap(e) {
    const i = e.currentTarget.dataset.index;
    const item = this.data.reports[i];
    wx.navigateTo({
      url: "/pages/reportdetail/reportdetail",
      success: (res) => {
        res.eventChannel.emit("acceptData", item); // 传递整条记录
      },
    });
  },

  /* -------- 工具函数 -------- */
  formatDate(ts) {
    const d = new Date(Number(ts));
    const pad = (n) => (n < 10 ? "0" + n : n);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  },
  base64ToBytes(base64) {
    const binaryString = this.myAtob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  },

  decode(buffer) {
    let resultString = '';
    let bytes = new Uint8Array(buffer); // 获取字节视图
    let i = 0;
    // 根据 encoding 决定解码逻辑
    while (i < bytes.length) {
      let byte1 = bytes[i++];
      let unicodeCodepoint;

      // 根据 UTF-8 编码规则判断字节的类型和后续字节的数量
      if ((byte1 & 0x80) === 0x00) { // 0xxxxxxx (1-byte character)
        unicodeCodepoint = byte1;
      } else if ((byte1 & 0xE0) === 0xC0) { // 110xxxxx (2-byte character)
        let byte2 = bytes[i++];
        if ((byte2 & 0xC0) !== 0x80) { /* 错误处理: 格式错误 */ }
        unicodeCodepoint = ((byte1 & 0x1F) << 6) | (byte2 & 0x3F);
      } else if ((byte1 & 0xF0) === 0xE0) { // 1110xxxx (3-byte character)
        let byte2 = bytes[i++];
        let byte3 = bytes[i++];
        if ((byte2 & 0xC0) !== 0x80 || (byte3 & 0xC0) !== 0x80) { /* 错误处理 */ }
        unicodeCodepoint = ((byte1 & 0x0F) << 12) | ((byte2 & 0x3F) << 6) | (byte3 & 0x3F);
      } else if ((byte1 & 0xF8) === 0xF0) { // 11110xxx (4-byte character)
        let byte2 = bytes[i++];
        let byte3 = bytes[i++];
        let byte4 = bytes[i++];
        if ((byte2 & 0xC0) !== 0x80 || (byte3 & 0xC0) !== 0x80 || (byte4 & 0xC0) !== 0x80) { /* 错误处理 */ }
        unicodeCodepoint = ((byte1 & 0x07) << 18) | ((byte2 & 0x3F) << 12) | ((byte3 & 0x3F) << 6) | (byte4 & 0x3F);
      } else {
        // 错误处理: 非法的起始字节
        // 比如 TextDecoder 默认的行为是替换为 U+FFFD (Replacement Character)
        unicodeCodepoint = 0xFFFD;
      }
      // 将 Unicode 码点转换为 JavaScript 字符串字符
      // JavaScript 内部字符串是 UTF-16，对于大于 U+FFFF 的码点，需要使用代理对
      if (unicodeCodepoint < 0x10000) {
        resultString += String.fromCharCode(unicodeCodepoint);
      } else {
        // 处理代理对 (surrogate pairs)
        unicodeCodepoint -= 0x10000;
        resultString += String.fromCharCode(0xD800 + (unicodeCodepoint >> 10)); // High surrogate
        resultString += String.fromCharCode(0xDC00 + (unicodeCodepoint & 0x3FF)); // Low surrogate
      }
    }
    return resultString;
  },

  encode(textString) {
    const bytes = [];
    let p = 0;

    for (let i = 0; i < textString.length; i++) {
        let codePoint = textString.charCodeAt(i);

        // 处理代理对（surrogate pairs）以支持 U+FFFF 以上的 Unicode 字符
        // JavaScript 字符串内部是 UTF-16
        if (codePoint >= 0xD800 && codePoint <= 0xDBFF && i + 1 < textString.length) {
            const nextCodePoint = textString.charCodeAt(i + 1);
            if (nextCodePoint >= 0xDC00 && nextCodePoint <= 0xDFFF) {
                // 这是一个有效的代理对
                codePoint = 0x10000 + ((codePoint - 0xD800) << 10) + (nextCodePoint - 0xDC00);
                i++; // 跳过下一个字符，因为它已经被处理
            }
        }

        // 根据 Unicode 码点将其编码为 UTF-8 字节序列
        if (codePoint < 0x80) { // 1字节字符：0xxxxxxx
            bytes[p++] = codePoint;
        } else if (codePoint < 0x800) { // 2字节字符：110xxxxx 10xxxxxx
            bytes[p++] = (codePoint >> 6) | 0xC0;
            bytes[p++] = (codePoint & 0x3F) | 0x80;
        } else if (codePoint < 0x10000) { // 3字节字符：1110xxxx 10xxxxxx 10xxxxxx
            bytes[p++] = (codePoint >> 12) | 0xE0;
            bytes[p++] = ((codePoint >> 6) & 0x3F) | 0x80;
            bytes[p++] = (codePoint & 0x3F) | 0x80;
        } else if (codePoint < 0x110000) { // 4字节字符：11110xxx 10xxxxxx 10xxxxxx 10xxxxxx
            bytes[p++] = (codePoint >> 18) | 0xF0;
            bytes[p++] = ((codePoint >> 12) & 0x3F) | 0x80;
            bytes[p++] = ((codePoint >> 6) & 0x3F) | 0x80;
            bytes[p++] = (codePoint & 0x3F) | 0x80;
        } else {
            // 错误处理：无效的 Unicode 码点，通常用替换字符 (U+FFFD) 的 UTF-8 编码
            bytes[p++] = 0xEF;
            bytes[p++] = 0xBF;
            bytes[p++] = 0xBD;
        }
    }

    // 将字节数组转换为 Uint8Array
    return new Uint8Array(bytes);
},

  myAtob(base64String) {
    // Base64 字符集
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
    // 反向查找表：字符 -> 整数值
    const lookup = {};
    for (let i = 0; i < chars.length; i++) {
      lookup[chars[i]] = i;
    }

    let output = '';
    let i = 0; // 输入字符串的当前索引

    // 移除空白字符，如果存在的话
    base64String = base64String.replace(/\s+/g, '');

    // 循环直到处理完所有字符
    while (i < base64String.length) {
      // 读取 4 个 Base64 字符，并查找它们的整数值
      // 遇到 '=' 填充字符时，对应的值为 64
      const c1 = lookup[base64String[i++]];
      const c2 = lookup[base64String[i++]];
      const c3 = lookup[base64String[i++]];
      const c4 = lookup[base64String[i++]];

      // 组合 24 位数据
      // 左移 2 位是因为 c1 占 6 位，c2 占 6 位，c1 + (c2右移4位) = 第一个字节的 8 位
      // 然后 c2 剩下的 4 位 + c3 的 4 位 = 第二个字节
      // c3 剩下的 2 位 + c4 的 6 位 = 第三个字节
      const bits = (c1 << 18) | (c2 << 12) | (c3 << 6) | c4;

      // 提取 3 个 8 位字节
      const b1 = (bits >> 16) & 0xFF; // 第一个字节
      const b2 = (bits >> 8) & 0xFF;  // 第二个字节
      const b3 = bits & 0xFF;          // 第三个字节

      // 将字节转换为字符并添加到输出字符串
      // 如果遇到填充字符 '='，说明原始数据不足 3 字节，对应字节无需处理
      if (c3 === 64) { // 如果第三个字符是 '='，说明原始数据只有 1 个字节
        output += String.fromCharCode(b1);
      } else if (c4 === 64) { // 如果第四个字符是 '='，说明原始数据只有 2 个字节
        output += String.fromCharCode(b1, b2);
      } else { // 原始数据有 3 个字节
        output += String.fromCharCode(b1, b2, b3);
      }
    }

    return output;
  },


  rc4Decrypt(ciphertextBytes, keyStr) {
    // 将密钥字符串转换为字节数组
    const keyBytes = this.encode(keyStr);

    // 初始化 S 盒
    const S = Array.from({ length: 256 }, (_, i) => i);
    let j = 0;

    // 密钥调度算法 (KSA)
    for (let i = 0; i < 256; i++) {
      j = (j + S[i] + keyBytes[i % keyBytes.length]) % 256;
      [S[i], S[j]] = [S[j], S[i]]; // 交换元素
    }

    // 伪随机生成算法 (PRGA)
    let i = 0;
    j = 0;
    const plaintextBytes = new Uint8Array(ciphertextBytes.length);

    // 生成密钥流并与密文异或
    for (let n = 0; n < ciphertextBytes.length; n++) {
      i = (i + 1) % 256;
      j = (j + S[i]) % 256;
      [S[i], S[j]] = [S[j], S[i]];
      const k = S[(S[i] + S[j]) % 256];
      plaintextBytes[n] = ciphertextBytes[n] ^ k;
    }

    return plaintextBytes;
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
