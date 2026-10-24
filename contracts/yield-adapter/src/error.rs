use soroban_sdk::contracterror;

/// Contract-wide error codes.
///
/// Keep these stable and append-only — clients and the indexer map to them.
#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    // --- lifecycle ---
    /// Contract has already been initialized.
    AlreadyInitialized = 1,
    /// Contract must be initialized before this call.
    NotInitialized = 2,

    // --- auth ---
    /// Caller is not authorized for this action.
    Unauthorized = 3,

    // --- generic validation ---
    /// A provided amount was zero or negative.
    InvalidAmount = 4,
    /// The referenced strategy/position/request does not exist.
    NotFound = 5,
    /// The caller has insufficient shares/balance for the requested action.
    InsufficientBalance = 6,
    /// A monetary or share computation would have overflowed or underflowed `i128`.
    Overflow = 7,

    // --- lifecycle (admin) ---
    /// The contract is paused; mutating entrypoints are rejected.
    Paused = 15,

    // --- strategy ---
    /// The referenced strategy is not registered.
    StrategyNotFound = 20,
    /// The strategy is already registered.
    StrategyAlreadyRegistered = 21,
    /// The strategy is currently active and cannot be deregistered directly —
    /// migrate to a different strategy first.
    StrategyActive = 22,
    /// The requested strategy is already the active strategy.
    StrategyAlreadyActive = 23,
    /// The per-strategy deposit cap would be exceeded.
    StrategyCapExceeded = 24,

    // --- withdrawal queue ---
    /// The withdrawal cooldown period has not yet elapsed.
    CooldownNotElapsed = 30,
    /// The withdrawal request has already been claimed or cancelled.
    WithdrawAlreadyResolved = 31,

    // --- fees ---
    /// The provided fee (basis points) exceeds the allowed maximum.
    FeeTooHigh = 40,
    /// There are no accrued fees available to withdraw.
    NoFeesAccrued = 41,

    // --- harvest ---
    /// `harvest` was called before the minimum interval since the last
    /// harvest has elapsed.
    HarvestTooSoon = 50,

    // --- cross-contract calls ---
    /// A cross-contract call to the active strategy failed (the strategy
    /// contract panicked or returned an error). Replaces the previous
    /// behaviour of propagating an untyped host trap.
    StrategyCallFailed = 60,

    // --- batch ---
    /// A batch operation was submitted with zero items.
    EmptyBatch = 61,
    /// A batch operation exceeded the maximum allowed number of items
    /// (`MAX_BATCH_SIZE`).
    BatchTooLarge = 62,
}
