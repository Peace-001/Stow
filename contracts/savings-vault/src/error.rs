use soroban_sdk::contracterror;

/// Contract-wide error codes.
///
/// Keep these stable and append-only — clients and the indexer map to them.
/// Max 50 variants total (XDR `SCSpecUDTErrorEnumV0.cases<50>` limit).
///
/// Error codes are organized by category:
/// - 1-9: Lifecycle and initialization
/// - 10-19: Authentication and authorization
/// - 20-29: Generic validation
/// - 30-39: Locked savings
/// - 40-49: Goal savings
/// - 50-59: Group savings
/// - 60-69: Arithmetic and limits
/// - 70-79: Admin lifecycle
/// - 80-89: Policy limits
/// - 90-99: Time-based operations
/// - 120-129: Rewards
#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    // --- Lifecycle (1-9) ---
    AlreadyInitialized = 1,
    NotInitialized = 2,

    // --- Authentication & Authorization (10-19) ---
    Unauthorized = 10,

    // --- Generic Validation (20-29) ---
    InvalidAmount = 20,
    NotFound = 21,
    InsufficientBalance = 22,
    InvalidParameters = 25,

    // --- Locked Savings (30-39) ---
    StillLocked = 30,
    InvalidUnlockTime = 31,

    // --- Goal Savings (40-49) ---
    GoalNotReached = 40,

    // --- Group Savings (50-59) ---
    GroupClosed = 50,
    InvalidShares = 51,
    NotAMember = 52,
    InsufficientGroupFunds = 55,
    MemberAlreadyExists = 56,
    AlreadyVoted = 57,
    ProposalAlreadyExecuted = 58,

    // --- Arithmetic & Limits (60-69) ---
    Overflow = 60,
    DepositCapExceeded = 61,

    // --- Admin Lifecycle (70-79) ---
    Paused = 70,

    // --- Policy Limits (80-89) ---
    DepositBelowMinimum = 80,

    // --- Time-based Operations (90-99) ---
    OperationExpired = 92,
    TimeWindowNotOpen = 93,

    // --- Rewards (120-129) ---
    /// The reward pool has insufficient funds; partial payment was made.
    RewardPoolShortfall = 120,
    /// Reward config values are invalid (e.g. tiers not sorted, bps > cap).
    InvalidRewardConfig = 121,
    /// No reward has accrued yet (nothing to claim).
    NoRewardAccrued = 122,
}
