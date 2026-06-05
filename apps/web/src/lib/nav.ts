/**
 * Centralized active-navigation matching used by every shell (resident, admin,
 * guard) so the highlight logic can never drift between them.
 *
 * The rule is "longest matching prefix wins":
 *  - A nav href matches the current pathname when it is an exact match
 *    (`pathname === href`) or a proper sub-route (`pathname` starts with
 *    `href + '/'`).
 *  - Among all matching hrefs, the most specific (longest) one is the active
 *    item.
 *
 * This automatically gives index/home routes (e.g. `/admin`, `/dashboard`,
 * `/guard`) the correct behaviour: `/admin` only stays active on `/admin`
 * itself, because on `/admin/units` the longer `/admin/units` href wins. The
 * trailing-slash guard also prevents `/admin` from matching unrelated routes
 * like `/admin-something`.
 */
export function resolveActiveHref(pathname: string, hrefs: readonly string[]): string | null {
  let best: string | null = null;
  for (const href of hrefs) {
    const matches = pathname === href || pathname.startsWith(`${href}/`);
    if (matches && (best === null || href.length > best.length)) {
      best = href;
    }
  }
  return best;
}

/**
 * Whether `href` is the active nav item for `pathname`, given the full set of
 * nav hrefs in the same menu. Requires the sibling hrefs so the longest-prefix
 * rule can pick the single most specific match.
 */
export function isActiveHref(pathname: string, href: string, allHrefs: readonly string[]): boolean {
  return resolveActiveHref(pathname, allHrefs) === href;
}
