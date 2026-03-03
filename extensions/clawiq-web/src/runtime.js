let runtime = null;

export function setClawiqWebRuntime(nextRuntime) {
  runtime = nextRuntime;
}

export function getClawiqWebRuntime() {
  if (!runtime) {
    throw new Error("clawiq-web runtime not initialized");
  }
  return runtime;
}
