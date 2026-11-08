// Pure vouch-decision rules — no DB, no $env — so they unit-test in isolation.

/**
 * Raise-only rule. An upgrade writes a new vouch iff there is no active vouch
 * (`activeLevel === null`) or the active one is below the target. At or above
 * the target it is a no-op: re-acting on an inbox suggestion or a one-click
 * profile vouch must never downgrade a stronger vouch already made. Demotions
 * happen only through an explicit `createVouch` (the picker) or `revokeVouch`.
 */
export function wouldUpgrade(activeLevel: number | null, target: number): boolean {
	return activeLevel === null || activeLevel < target;
}
