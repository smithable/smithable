import type { Condition } from "@smithable/core";
import { Select } from "../ui";
import { WhenRows, whenRowsOf } from "./action-rows";
import type { ConditionContext } from "./condition-paths";

/** Uses its parent's Writer: nested settings stay in the same atomic draft. */
export function ConditionRows({
  context,
  value,
  onChange,
}: {
  context: ConditionContext;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  const { model, mode, fixed, computed, references, person } = context;
  if (fixed) return <p className="text-xs text-quiet">{fixed}</p>;
  const conditional = value !== undefined && typeof value === "object" && value !== null;
  const choice =
    mode === "created"
      ? value === "created"
        ? "created"
        : "condition"
      : typeof value === "boolean" && value
        ? "always"
        : conditional
          ? "condition"
          : "never";
  return (
    <div className="space-y-2">
      {mode && (
        <Select
          aria-label={`${mode} mode`}
          value={choice}
          options={
            mode === "created"
              ? [
                  ["created", "Pay to create a record"],
                  ["condition", "Offer payment for matching records"],
                ]
              : [
                  ["never", mode === "required" ? "Optional" : "Not locked"],
                  ["always", mode === "required" ? "Always required" : "Once set"],
                  ["condition", "Only when a condition holds"],
                ]
          }
          onChange={(event) =>
            onChange(
              event.target.value === "created"
                ? "created"
                : event.target.value === "always"
                  ? true
                  : event.target.value === "never"
                    ? undefined
                    : {},
            )
          }
        />
      )}
      {(!mode || choice === "condition") &&
        (model ? (
          <WhenRows
            model={model}
            rows={whenRowsOf(conditional ? (value as Condition) : undefined)}
            computed={computed}
            references={references}
            person={person}
            onChange={(rows) => {
              const next = Object.fromEntries(rows.map((row) => [row.field, row.value]));
              onChange(rows.length || mode ? next : undefined);
            }}
          />
        ) : (
          <p className="text-xs text-quiet">Choose the record this condition is about first.</p>
        ))}
    </div>
  );
}
