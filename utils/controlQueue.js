/** 合并连续设定，串行发送，并保留请求进行期间用户选择的最终值。 */
export function createControlQueue({ delay = 500, send, isActive, onSuccess, onError, onIdle }) {
  let timer = null;
  let latest = null;
  let running = false;
  let runningGeneration = -1;
  let generation = 0;

  async function drain() {
    if (running || timer || !latest) return;
    const job = latest;
    const currentGeneration = generation;
    latest = null;
    if (!isActive(job)) return;
    running = true;
    runningGeneration = currentGeneration;
    try {
      await send(job);
      if (currentGeneration === generation && isActive(job)) onSuccess(job);
    } catch (error) {
      if (currentGeneration === generation && isActive(job) && !latest) onError(error, job);
    } finally {
      running = false;
      if (latest) {
        drain();
      } else if (currentGeneration === generation && isActive(job)) {
        onIdle();
      }
    }
  }

  return {
    enqueue(job) {
      latest = job;
      clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        drain();
      }, delay);
    },
    isBusy() {
      return (running && runningGeneration === generation) || latest !== null || timer !== null;
    },
    cancel() {
      generation += 1;
      clearTimeout(timer);
      timer = null;
      latest = null;
    },
  };
}
