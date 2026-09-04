import api from "../api/api.js";
import { isControlResponseForRequest } from "./controlResponse.js";

const JSON_CONTENT_TYPE = { "content-type": "application/json" };

function parseJson(value) {
  if (typeof value !== "string") {
    return value;
  }

  const text = value.trim();
  if (!text) {
    return text;
  }

  try {
    return JSON.parse(text);
  } catch (error) {
    return value;
  }
}

export function parseControlResponse(response) {
  const payload = parseJson(response && response.data);

  if (payload && Number(payload.code) === 4) {
    throw new Error(payload.message || "控制屏响应超时，请稍后重试");
  }

  if (
    response &&
    typeof response.statusCode === "number" &&
    (response.statusCode < 200 || response.statusCode >= 300)
  ) {
    throw new Error(`请求失败，HTTP ${response.statusCode}`);
  }

  if (
    payload &&
    typeof payload === "object" &&
    !Array.isArray(payload) &&
    Object.prototype.hasOwnProperty.call(payload, "body")
  ) {
    return parseJson(payload.body);
  }

  return payload;
}

export function controlDataArray(body) {
  if (Array.isArray(body)) {
    return body;
  }
  return body && Array.isArray(body.data) ? body.data : [];
}

function legacyRequest(method, { messageType, body, projectId }) {
  return new Promise((resolve, reject) => {
    const data = {
      project_id: projectId || wx.getStorageSync("selected_home"),
      message_type: messageType,
    };

    if (body !== undefined) {
      data.body = typeof body === "string" ? body : JSON.stringify(body);
    }

    method({
      method: "POST",
      header: {
        ...JSON_CONTENT_TYPE,
        Authorization: wx.getStorageSync("access_token"),
      },
      data,
      success: (response) => {
        if (
          typeof response.statusCode === "number" &&
          (response.statusCode < 200 || response.statusCode >= 300)
        ) {
          reject(new Error(`请求失败，HTTP ${response.statusCode}`));
          return;
        }
        resolve(response);
      },
      fail: reject,
    });
  });
}

export function sendControlCommand(options) {
  return legacyRequest(api.trans_ctrl_message, options);
}

export async function legacyControlMessageBody(options, delay = 1000) {
  await sendControlCommand(options);
  await new Promise((resolve) => setTimeout(resolve, delay));
  const response = await legacyRequest(api.trans_ctrl_message_callback, {
    ...options,
    body: undefined,
  });
  return parseControlResponse(response);
}

/**
 * 发送带 requestId 的控制屏查询，并轮询到本次请求对应的回调结果。
 * 无 requestId 的旧版响应仍在首次读取后直接返回。
 */
export async function legacyCorrelatedControlMessageBody(
  options,
  { initialDelay = 2000, retryDelay = 1500, maxAttempts = 6 } = {},
) {
  const requestId = options && options.body && options.body.requestId;
  await sendControlCommand(options);

  let lastBody;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const delay = attempt === 0 ? initialDelay : retryDelay;
    await new Promise((resolve) => setTimeout(resolve, delay));
    const response = await legacyRequest(api.trans_ctrl_message_callback, {
      ...options,
      body: undefined,
    });
    lastBody = parseControlResponse(response);
    if (isControlResponseForRequest(lastBody, requestId)) {
      return lastBody;
    }
  }

  const error = new Error("数据仍在生成，请稍后重试");
  error.lastBody = lastBody;
  throw error;
}
