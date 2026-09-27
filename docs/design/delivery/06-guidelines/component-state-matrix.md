# Component state contract

The sheets demonstrate shared state treatments. A component inherits these treatments instead of requiring a different bespoke design for every permutation. “N/A” means the state has no useful semantic meaning; do not invent loading badges or errors on static headings.

| Family | Default / hover / active | Keyboard focus | Disabled / read-only | Error / loading | Empty |
|---|---|---|---|---|---|
| Buttons: primary, secondary, outline, ghost, destructive, icon | Token fill; hover keeps text contrast; active adds inset outline | 2 px ring + 2 px gap | Muted surface + readable text; disable invocation; icon gets accessible label | Action error in adjacent Alert; pending replaces label with Saving… and blocks duplicate submission | N/A |
| Text, long text, integer, decimal, amount, email, phone, URL | Card/input border; hover can strengthen border; active follows focus | Ring around complete control | Read-only tinted, selectable value; disabled muted and explained if useful | Invalid border + inline explanation; pending validation labelled | Empty value keeps visible label and example placeholder |
| Date / datetime | Same input; calendar has explicit trigger | Input plus keyboard-accessible popup | Same; don't hide existing value | Parsing/range errors with valid example; loading only for async availability | Placeholder states required format and zone |
| Select / linked record / user | Trigger; selected option gets check + accent; active option follows keyboard | Ring; aria-activedescendant or supported library semantics | Tinted value, no popup | Failed lookup includes retry; loading text/spinner | No choices vs no search match; clear search where appropriate |
| Checkbox / yes-no switch | Visible check/thumb position plus label; selected is persistent active state | Ring encloses 44 px target | Preserve checked state, mute using readable pair | Field-level error, saving announcement if persisted immediately | N/A; unknown data should not be silently coerced to No |
| Computed value | Tinted value + explanation | Focus only if selectable/actionable | Always read-only | Updating…; keep last valid value or explicit Unavailable + error | “Not calculated” before required inputs exist |
| Navigation / mobile drawer | Label + icon; selected primary pair, hover accent | Ring, current-page semantics | Unavailable items explained or omitted based on access policy | Page loading in content; navigation failure alert | No destinations is a setup state |
| Table row / mobile record card | Visible record link, hover accent, selection check if bulk actions exist | Link/button focus; optional row outline | Read-only row still permits allowed detail navigation | Skeleton rows then error+retry | Separate no records / no matches |
| Search / filters / pagination | Labelled input and buttons; active filter has removable text chip | Shared control ring | Previous disabled on first page; preserve readable page count | Busy result region; errors don't erase search | Clear search; reset filters |
| Card / badge / heading | Static surface/status text; hover only if actually interactive | Only interactive descendants | N/A for purely decorative surfaces | Content owns feedback; status badge still has text | Card content uses purpose-specific empty state |
| Dialog | Surface + explicit title and consequence | Initial focus on Cancel; trap + restore | Pending action prevents repeat; don't trap user indefinitely | Inline action failure; busy confirmation | N/A |
| Toast / alert | Icon + title + supporting text | Dismiss action focus; status announced politely | N/A | Error is persistent; success can time out if unimportant | N/A |
| Sign-in | Configured provider actions + labelled credentials | Standard focus order | Pending provider disables duplicate click | Auth failure is user-facing, not raw server configuration | No enabled providers: useful contact/help message |
| Chart | Axes, values, labelled series and distinct marks | Accessible data view, tooltip info available without pointer | N/A | Skeleton, retry | “No activity in this period” |
| FAQ | Question button, collapsed/expanded icon | Shared ring on question target | N/A | N/A for local static content | Omit entire block if no questions |

## Exact interaction details

Hover must never reveal the only route to an action. The hover state can use the same fill as default for solid buttons; the cursor and optional contrast-preserving border change are supplementary. Active uses a visible inset stroke in the sheets. Focus takes precedence over hover. Disabled must not use a global low opacity that makes meaningful text unreadable.

Input active/editing follows the focus appearance. Error plus focus combines error border and outer focus ring. Read-only is not disabled: its text remains copyable and it may participate in tab order where appropriate. Screen-reader descriptions explain computed values and blocked actions.

Icon marks are 20–24 px inside minimum 44 px touch targets. The drawn glyph's bounds are not the target bounds. A standalone icon action receives a visually hidden name, such as “Close menu”.

For all interactive components, verify combinations that static sheets cannot certify: hover+focus, error+focus, selected+disabled, loading+reduced-motion, 200% zoom and keyboard focus not obscured by sticky regions.
