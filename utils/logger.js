const SILENCED_METHODS = ["log", "info", "debug", "warn", "error"];

function getEnvironmentVersion() {
  try {
    const accountInfo = wx.getAccountInfoSync();
    return (
      (accountInfo &&
        accountInfo.miniProgram &&
        accountInfo.miniProgram.envVersion) || "develop"
    );
  } catch (error) {
    return "develop";
  }
}

export function configureConsole() {
  const environmentVersion = getEnvironmentVersion();
  if (environmentVersion === "develop") {
    return;
  }
  SILENCED_METHODS.forEach((method) => {
    try {
      console[method] = function () {};
    } catch (error) {
      // 某些基础库可能不允许改写 console，保持原行为即可。
    }
  });
}
