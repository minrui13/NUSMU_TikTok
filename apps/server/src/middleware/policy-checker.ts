import type { Ability } from "./permissions.ts";

export function checkAbility(ability: Ability, grantedAbilities: Ability[]) {
  const allowed = grantedAbilities.includes(ability);

  return {
    allowed,
    reason: allowed ? `${ability} is permitted` : `${ability} is not permitted`,
  };
}
