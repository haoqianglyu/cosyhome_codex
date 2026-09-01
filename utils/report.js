function encodeUtf8(text) {
  const bytes = [];
  for (let i = 0; i < text.length; i++) {
    let codePoint = text.charCodeAt(i);
    if (codePoint >= 0xd800 && codePoint <= 0xdbff && i + 1 < text.length) {
      const next = text.charCodeAt(i + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        codePoint = 0x10000 + ((codePoint - 0xd800) << 10) + (next - 0xdc00);
        i++;
      }
    }
    if (codePoint < 0x80) {
      bytes.push(codePoint);
    } else if (codePoint < 0x800) {
      bytes.push((codePoint >> 6) | 0xc0, (codePoint & 0x3f) | 0x80);
    } else if (codePoint < 0x10000) {
      bytes.push((codePoint >> 12) | 0xe0, ((codePoint >> 6) & 0x3f) | 0x80, (codePoint & 0x3f) | 0x80);
    } else {
      bytes.push((codePoint >> 18) | 0xf0, ((codePoint >> 12) & 0x3f) | 0x80, ((codePoint >> 6) & 0x3f) | 0x80, (codePoint & 0x3f) | 0x80);
    }
  }
  return new Uint8Array(bytes);
}

function decodeUtf8(bytes) {
  let output = "";
  let i = 0;
  while (i < bytes.length) {
    const first = bytes[i++];
    let codePoint;
    if ((first & 0x80) === 0) {
      codePoint = first;
    } else if ((first & 0xe0) === 0xc0 && i < bytes.length) {
      codePoint = ((first & 0x1f) << 6) | (bytes[i++] & 0x3f);
    } else if ((first & 0xf0) === 0xe0 && i + 1 < bytes.length) {
      codePoint = ((first & 0x0f) << 12) | ((bytes[i++] & 0x3f) << 6) | (bytes[i++] & 0x3f);
    } else if ((first & 0xf8) === 0xf0 && i + 2 < bytes.length) {
      codePoint = ((first & 0x07) << 18) | ((bytes[i++] & 0x3f) << 12) | ((bytes[i++] & 0x3f) << 6) | (bytes[i++] & 0x3f);
    } else {
      codePoint = 0xfffd;
    }
    if (codePoint <= 0xffff) {
      output += String.fromCharCode(codePoint);
    } else {
      codePoint -= 0x10000;
      output += String.fromCharCode(0xd800 + (codePoint >> 10), 0xdc00 + (codePoint & 0x3ff));
    }
  }
  return output;
}

function base64ToBytes(base64) {
  if (typeof base64 !== "string" || !base64.trim()) {
    throw new Error("报告内容为空");
  }
  if (typeof wx !== "undefined" && wx.base64ToArrayBuffer) {
    return new Uint8Array(wx.base64ToArrayBuffer(base64));
  }
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  const clean = base64.replace(/\s+/g, "").replace(/=+$/, "");
  const bytes = [];
  let buffer = 0;
  let bits = 0;
  for (let i = 0; i < clean.length; i++) {
    const value = chars.indexOf(clean[i]);
    if (value < 0) throw new Error("报告内容不是有效的 Base64 数据");
    buffer = (buffer << 6) | value;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((buffer >> bits) & 0xff);
    }
  }
  return new Uint8Array(bytes);
}

function rc4Decrypt(ciphertext, key) {
  const keyBytes = encodeUtf8(String(key || ""));
  if (!keyBytes.length) throw new Error("报告解密密钥缺失");
  const state = Array.from({ length: 256 }, (_, index) => index);
  let j = 0;
  for (let i = 0; i < 256; i++) {
    j = (j + state[i] + keyBytes[i % keyBytes.length]) % 256;
    [state[i], state[j]] = [state[j], state[i]];
  }
  const output = new Uint8Array(ciphertext.length);
  let i = 0;
  j = 0;
  for (let n = 0; n < ciphertext.length; n++) {
    i = (i + 1) % 256;
    j = (j + state[i]) % 256;
    [state[i], state[j]] = [state[j], state[i]];
    output[n] = ciphertext[n] ^ state[(state[i] + state[j]) % 256];
  }
  return output;
}

export function decryptReport(entity) {
  if (!entity || entity.id === undefined || entity.id === null) {
    throw new Error("报告 ID 缺失");
  }
  const bodyDecrypted = decodeUtf8(rc4Decrypt(base64ToBytes(entity.body), String(entity.id)));
  return { ...entity, bodyDecrypted, bodyParsed: JSON.parse(bodyDecrypted) };
}

export function formatReportDate(timestamp) {
  const date = new Date(Number(timestamp));
  if (Number.isNaN(date.getTime())) return "";
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function prepareReport(entity) {
  return {
    ...decryptReport(entity),
    period: `${formatReportDate(entity.start_time)}~${formatReportDate(entity.end_time)}`,
  };
}
