/**
 * Serialization for the explicitly protected runtime workflows.
 * Wave R1.3.0.2 — Runtime Safety (Reduced Scope)
 */

const FO_RUNTIME_LOCK_TIMEOUT_MS_ = 5000;
let FO_RUNTIME_LOCK_DEPTH_ = 0;

function foAssertRuntimeLockHeld_(operationName) {
  const operation = String(operationName || '').trim();

  foAssertRuntimeSafety_(operation);

  if (FO_RUNTIME_LOCK_DEPTH_ < 1) {
    throw new Error(
      'Runtime safety blocked unlocked operation: ' + operation
    );
  }
}

function foWithRuntimeLock_(operationName, callback) {
  const operation = String(operationName || '').trim();

  foAssertRuntimeSafety_(operation);

  if (typeof callback !== 'function') {
    throw new Error('Runtime lock callback must be executable');
  }

  if (FO_RUNTIME_LOCK_DEPTH_ > 0) {
    FO_RUNTIME_LOCK_DEPTH_ += 1;
    try {
      return callback();
    } finally {
      FO_RUNTIME_LOCK_DEPTH_ -= 1;
    }
  }

  const lock = LockService.getScriptLock();
  let acquired = false;

  try {
    acquired = lock.tryLock(FO_RUNTIME_LOCK_TIMEOUT_MS_);
    if (!acquired) {
      throw new Error(
        'Runtime safety blocked concurrent operation: ' + operation
      );
    }

    FO_RUNTIME_LOCK_DEPTH_ = 1;
    return callback();
  } finally {
    FO_RUNTIME_LOCK_DEPTH_ = 0;
    if (acquired) lock.releaseLock();
  }
}
