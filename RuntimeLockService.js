/**
 * Serialization for the explicitly protected runtime workflows.
 * Waves R1.3.0.2–R1.3.0.3 — Runtime Safety (Reduced Scope)
 */

const FO_RUNTIME_LOCK_TIMEOUT_MS_ = 5000;
const FO_RUNTIME_PROTECTED_OPERATIONS_ = Object.freeze([
  'Run Autonomous CIO Orchestrator',
  'Run Production Certification',
  'Archive report',
  'Run Production Certification Wave311',
  'Run Executive Report archive workflow',
  'Run Weekly CIO Report A240 archive workflow'
]);
let FO_RUNTIME_LOCK_DEPTH_ = 0;

function foAssertRuntimeProtectedOperation_(operation) {
  if (FO_RUNTIME_PROTECTED_OPERATIONS_.indexOf(operation) === -1) {
    throw new Error(
      'Runtime safety blocked unregistered protected operation: ' + operation
    );
  }
}

function foAssertRuntimeLockHeld_(operationName) {
  const operation = String(operationName || '').trim();

  foAssertRuntimeProtectedOperation_(operation);
  foAssertRuntimeWriteSafety_(operation);

  if (FO_RUNTIME_LOCK_DEPTH_ < 1) {
    throw new Error(
      'Runtime safety blocked unlocked operation: ' + operation
    );
  }
}

function foWithRuntimeLock_(operationName, callback) {
  const operation = String(operationName || '').trim();

  foAssertRuntimeProtectedOperation_(operation);
  foAssertRuntimeWriteSafety_(operation);

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

    foAssertRuntimeWorkbookBindings_();
    FO_RUNTIME_LOCK_DEPTH_ = 1;
    return callback();
  } finally {
    FO_RUNTIME_LOCK_DEPTH_ = 0;
    if (acquired) lock.releaseLock();
  }
}
