export function isControlResponseForRequest(body, requestId) {
  if (!requestId || Array.isArray(body) || !body || typeof body !== "object") {
    return true;
  }

  const responseRequestId = body.requestId;
  if (
    responseRequestId === undefined ||
    responseRequestId === null ||
    responseRequestId === ""
  ) {
    return true;
  }

  return String(responseRequestId) === String(requestId);
}
