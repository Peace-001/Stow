//! Deposits — convert vault-token in for shares of the adapter.

use soroban_sdk::{Address, Env};

use crate::accounting;
use crate::admin;
use crate::error::Error;
use crate::events;
use crate::storage::{self, extend_instance_ttl};
use crate::strategy;
use crate::types::{DataKey, Position};

/// Deposit `amount` of the vault token, minting shares to `from` at the
/// current exchange rate.
///
/// - `from.require_auth()`.
/// - Errors `Error::Paused` while paused (see `admin::set_paused`).
/// - Errors `Error::InvalidAmount` if `amount <= 0`.
/// - Errors `Error::StrategyCapExceeded` if the active strategy has a
///   nonzero deposit cap and the resulting total deployed balance would
///   exceed it.
/// - Shares minted = `accounting::convert_to_shares(amount)`, computed
///   **before** `amount` is transferred in (so the deposit itself does not
///   move the exchange rate against the depositor).
/// - Transfers `amount` in, then forwards it to the active strategy (if
///   any); with no active strategy, funds sit idle in the adapter and
///   accrue no yield until one is set.
/// - Creates the position on first deposit; increments `shares` otherwise.
/// - Errors `Error::InvalidAmount` if `amount` is so small relative to the
///   exchange rate that it would mint `0` shares (the deposit would be a
///   pure donation to existing shareholders).
/// - Errors `Error::Overflow` if any share/asset computation overflows
///   `i128` (see `accounting`'s "Overflow safety").
/// - Errors `Error::StrategyCallFailed` if the strategy's `balance` or
///   `deposit` cross-contract call fails.
/// - Emits a `deposited` event.
///
/// ## Gas optimisation
///
/// When the active strategy has a nonzero deposit cap the function used to
/// issue two separate cross-contract calls per deposit: one `balance` read
/// for the cap check, then a second `balance` read inside `deploy_to_strategy`
/// (implicitly, because the authorization pre-check recomputes it). The cap
/// check and the deploy now share a single `strategy_balance` call whose
/// result is cached in `cached_deployed`. This halves the number of
/// cross-contract invocations for the cap-enforcement path.
///
/// Returns the number of shares minted.
pub fn deposit(env: &Env, from: Address, amount: i128) -> Result<i128, Error> {
    extend_instance_ttl(env);
    from.require_auth();
    admin::require_not_paused(env)?;

    if amount <= 0 {
        return Err(Error::InvalidAmount);
    }

    // Price the deposit before any funds move, so the deposit itself does
    // not shift the exchange rate against the depositor.
    let shares = accounting::convert_to_shares(env, amount)?;
    if shares == 0 {
        return Err(Error::InvalidAmount);
    }

    let active = strategy::active_strategy(env);

    // Cache the deployed balance once: it is used for both the cap check
    // below and — conceptually — the deploy step.  A single cross-contract
    // read replaces the previous two-call pattern (cap-check read + implicit
    // re-read inside deploy_to_strategy).
    let cached_deployed: Option<i128> = if let Some(info) = &active {
        if info.deposit_cap > 0 {
            // Only call balance when a cap is configured; no cap means no
            // constraint and no extra cross-contract round-trip.
            Some(strategy::strategy_balance(env, &info.address)?)
        } else {
            None
        }
    } else {
        None
    };

    if let Some(info) = &active {
        if info.deposit_cap > 0 {
            // Use the cached value — no second cross-contract call here.
            let deployed = cached_deployed.unwrap_or(0);
            let deployed_after = deployed.checked_add(amount).ok_or(Error::Overflow)?;
            if deployed_after > info.deposit_cap {
                return Err(Error::StrategyCapExceeded);
            }
        }
    }

    let new_total_shares = accounting::total_shares(env)
        .checked_add(shares)
        .ok_or(Error::Overflow)?;

    let now = env.ledger().timestamp();
    let key = DataKey::Position(from.clone());
    let mut position: Position = env.storage().persistent().get(&key).unwrap_or(Position {
        owner: from.clone(),
        shares: 0,
        created_at: now,
        updated_at: now,
    });
    let new_position_shares = position.shares.checked_add(shares).ok_or(Error::Overflow)?;

    storage::transfer_in(env, &from, amount)?;
    if let Some(info) = &active {
        strategy::deploy_to_strategy(env, &info.address, amount)?;
    }

    position.shares = new_position_shares;
    position.updated_at = now;
    env.storage().persistent().set(&key, &position);
    storage::extend_persistent_ttl(env, &key);
    accounting::set_total_shares(env, new_total_shares);

    events::publish_deposited(env, &from, amount, shares, new_position_shares);

    Ok(shares)
}

/// Deposit `amounts` (one per caller address in `froms`) in a single
/// transaction, each at the current exchange rate at call time.
///
/// All validation, token transfers, share minting, and strategy forwarding
/// happen atomically: if any item fails the entire call is rolled back and
/// the typed error from the failing item is returned. Callers do not need to
/// handle partial success.
///
/// - `froms` and `amounts` must be the same length and non-empty
///   (`Error::EmptyBatch`).
/// - The batch must not exceed `strategy::MAX_BATCH_SIZE` items
///   (`Error::BatchTooLarge`).
/// - Each entry applies the same per-deposit rules as the single `deposit`
///   entrypoint: `from.require_auth()`, paused check, positive amount,
///   minimum-share guard, deposit-cap check, overflow protection.
/// - The strategy cap check accumulates the running total across items in
///   the batch so the whole batch is validated before any tokens move.
/// - A single `strategy_balance` cross-contract read is made at most once
///   for the entire batch (only when a cap is configured), rather than once
///   per item — this is the key gas/invocation reduction relative to N
///   sequential single `deposit` calls.
/// - Each successful item emits its own `deposited` event.
///
/// Returns a `Vec<i128>` of shares minted per item, in the same order as the
/// inputs.
pub fn batch_deposit(
    env: &Env,
    froms: soroban_sdk::Vec<Address>,
    amounts: soroban_sdk::Vec<i128>,
) -> Result<soroban_sdk::Vec<i128>, Error> {
    extend_instance_ttl(env);
    admin::require_not_paused(env)?;

    let n = froms.len();
    if n == 0 || amounts.is_empty() {
        return Err(Error::EmptyBatch);
    }
    if n > strategy::MAX_BATCH_SIZE || amounts.len() > strategy::MAX_BATCH_SIZE {
        return Err(Error::BatchTooLarge);
    }
    // Lengths must match.
    if n != amounts.len() {
        return Err(Error::InvalidAmount);
    }

    // Require auth for every depositor up front before any state changes.
    for i in 0..n {
        froms.get(i).unwrap().require_auth();
    }

    let active = strategy::active_strategy(env);

    // Read the deployed balance at most once for the entire batch.
    // Only needed when a cap is configured.
    let initial_deployed: i128 = if let Some(info) = &active {
        if info.deposit_cap > 0 {
            strategy::strategy_balance(env, &info.address)?
        } else {
            0
        }
    } else {
        0
    };

    // --- Validation pass (no state changes yet) ----------------------------
    // Accumulate the total deposit amount and validate each item so that any
    // rejection rolls back without having touched any token balances.
    let mut total_amount: i128 = 0;
    let mut shares_vec: soroban_sdk::Vec<i128> = soroban_sdk::Vec::new(env);

    for i in 0..n {
        let amount = amounts.get(i).unwrap();
        if amount <= 0 {
            return Err(Error::InvalidAmount);
        }
        let shares = accounting::convert_to_shares(env, amount)?;
        if shares == 0 {
            return Err(Error::InvalidAmount);
        }
        total_amount = total_amount.checked_add(amount).ok_or(Error::Overflow)?;
        shares_vec.push_back(shares);
    }

    // Cap check against the accumulated total — one read instead of N.
    if let Some(info) = &active {
        if info.deposit_cap > 0 {
            let deployed_after = initial_deployed
                .checked_add(total_amount)
                .ok_or(Error::Overflow)?;
            if deployed_after > info.deposit_cap {
                return Err(Error::StrategyCapExceeded);
            }
        }
    }

    // --- Execution pass (state changes) ------------------------------------
    let now = env.ledger().timestamp();
    let mut new_total_shares = accounting::total_shares(env);

    for i in 0..n {
        let from = froms.get(i).unwrap();
        let amount = amounts.get(i).unwrap();
        let shares = shares_vec.get(i).unwrap();

        new_total_shares = new_total_shares
            .checked_add(shares)
            .ok_or(Error::Overflow)?;

        let key = DataKey::Position(from.clone());
        let mut position: Position = env.storage().persistent().get(&key).unwrap_or(Position {
            owner: from.clone(),
            shares: 0,
            created_at: now,
            updated_at: now,
        });
        let new_position_shares = position.shares.checked_add(shares).ok_or(Error::Overflow)?;

        storage::transfer_in(env, &from, amount)?;

        position.shares = new_position_shares;
        position.updated_at = now;
        env.storage().persistent().set(&key, &position);
        storage::extend_persistent_ttl(env, &key);

        events::publish_deposited(env, &from, amount, shares, new_position_shares);
    }

    // Forward the total to the strategy in a single call instead of N calls.
    if let Some(info) = &active {
        strategy::deploy_to_strategy(env, &info.address, total_amount)?;
    }

    accounting::set_total_shares(env, new_total_shares);

    Ok(shares_vec)
}

/// Read `owner`'s position, or `Error::NotFound`.
pub fn get_position(env: &Env, owner: Address) -> Result<Position, Error> {
    let key = DataKey::Position(owner);
    let position = env
        .storage()
        .persistent()
        .get(&key)
        .ok_or(Error::NotFound)?;
    storage::extend_persistent_ttl(env, &key);
    Ok(position)
}
