// 后端不区分管理员，沿用旧项目的前端手机号白名单。
const ADMIN_PHONES = new Set(["15006181214", "18888888888"]);

export function isAdminPhone(phone) {
  return ADMIN_PHONES.has(String(phone || "").trim());
}

export function parseLoginPayload(value) {
  if (typeof value !== "string") {
    return value;
  }

  try {
    return JSON.parse(value);
  } catch (error) {
    return null;
  }
}

export function isTrueFlag(value) {
  return (
    value === true ||
    value === 1 ||
    value === "1" ||
    String(value).toLowerCase() === "true"
  );
}

export function getMiniLoginState(value) {
  const payload = parseLoginPayload(value);
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return "invalid";
  }

  if (isTrueFlag(payload.unbinded) || isTrueFlag(payload.unbound)) {
    return "unbound";
  }

  return payload.access_token ? "authenticated" : "invalid";
}
