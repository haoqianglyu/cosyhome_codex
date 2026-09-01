function apiRequest(method, options = {}) {
  return new Promise((resolve, reject) => {
    method({
      ...options,
      success: resolve,
      fail: reject,
    });
  });
}

function getErrorMessage(error, fallback = "操作失败，请稍后重试") {
  return (
    (error && error.message) ||
    (error && error.errMsg) ||
    fallback
  );
}

function isCurrentPage(page) {
  if (!page || page._pageVisible === false) {
    return false;
  }
  const pages = getCurrentPages();
  return pages.length > 0 && pages[pages.length - 1] === page;
}

export { apiRequest, getErrorMessage, isCurrentPage };
