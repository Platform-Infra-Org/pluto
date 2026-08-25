/**
 * Who counts as an admin when the caller is a service acting for a human.
 *
 * Kept apart from the catalog lookup so the rule is a pure function with a
 * test, rather than something only reachable through a live catalog.
 *
 * Exact ref comparison, matching the permission policy — the two must not
 * drift into disagreeing about who is an admin.
 */
export function isAdminRef(
  groups: string[] | undefined,
  adminGroups: string[],
): boolean {
  // `undefined` means the user could not be resolved. Failing open here would
  // let anyone past the gate by naming a user that does not exist.
  if (!groups) return false;
  return groups.some(g => adminGroups.includes(g));
}
