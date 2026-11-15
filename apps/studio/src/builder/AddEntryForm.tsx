import {
  applyOperation,
  humanize,
  isUpload,
  type SpecIR,
  type SpecPlugin,
  validateAuth,
} from "@smithable/core";
import { useId, useState } from "react";
import type { Project } from "../api";
import { Button, Input, Select } from "../ui";
import { conditionOf, type WhenRow, WhenRows } from "./action-rows";
import type { Run } from "./ChangeForms";
import { usePendingEdit } from "./pending-edit";

type Area = "outgoing" | "payments" | "incoming" | "queries";
const labels: Record<Area, string> = {
  outgoing: "outgoing mail",
  payments: "payment",
  incoming: "incoming call",
  queries: "query",
};
const operations: Record<Area, string> = {
  outgoing: "addOutgoing",
  payments: "addPayment",
  incoming: "addIncoming",
  queries: "addQuery",
};

/** A named entry starts with all the values its operation needs, never an empty mapping. */
export function AddEntryForm({
  area,
  project,
  ir,
  plugins = [],
  run,
}: {
  area: Area;
  project: Project;
  ir: SpecIR;
  plugins?: SpecPlugin[];
  run: Run;
}) {
  const id = useId();
  const [name, setName] = useState("");
  const [modelName, setModelName] = useState("");
  const [trigger, setTrigger] = useState("");
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [when, setWhen] = useState("created");
  const [condition, setCondition] = useState<WhenRow[]>([]);
  const [incoming, setIncoming] = useState("");
  const [values, setValues] = useState<Record<string, string>>({});
  const [column, setColumn] = useState("");
  const [intent, setIntent] = useState("");
  const [busy, setBusy] = useState(false);
  usePendingEdit(
    Boolean(
      name ||
        modelName ||
        trigger ||
        recipient ||
        amount ||
        incoming ||
        column ||
        intent ||
        condition.length ||
        Object.keys(values).length ||
        when !== "created",
    ) || busy,
  );
  const model = ir.models.find((m) => m.name === modelName);
  const timer = ir.timers.find((t) => t.name === trigger);
  const action = ir.actions.find((a) => a.name === trigger);
  const listMail = Boolean(timer && !timer.on);
  const eventModel = ir.models.find(
    (m) => m.name === (timer?.on ?? (action && !action.custom ? action.on : trigger.split(" ")[0])),
  );
  const roles = project.files.auth
    ? (validateAuth({ path: "smithable.auth.yml", text: project.files.auth }, ir).auth?.roles.map(
        (role) => role.name,
      ) ?? ["admin"])
    : ["admin"];
  const receivers = [
    "owner",
    ...(eventModel?.fields ?? [])
      .filter((f) =>
        f.type.kind === "scalar"
          ? f.type.name === "email"
          : f.type.kind === "relation" && !f.type.many && f.type.model === "User",
      )
      .map((f) => f.name),
  ];
  const fields = (model?.fields ?? []).filter(
    (f) => !f.formula && !(f.type.kind === "relation" && f.type.many),
  );
  const incomingFields = fields.filter(
    (field) => field.type.kind !== "relation" && !isUpload(field),
  );
  const needsLink = Boolean(
    model?.fields.some((field) => field.required && field.type.kind === "relation"),
  );
  const startingValues = incomingFields.every(
    (field) =>
      !field.required ||
      field.default !== undefined ||
      field.defaultFormula ||
      field.sequence ||
      values[field.name]?.trim(),
  );
  const money =
    model?.fields.filter((f) => f.type.kind === "scalar" && f.type.name === "money") ?? [];
  const triggers: [string, string][] = [
    ...ir.models.flatMap((m) =>
      ["created", "changed", "deleted"].map(
        (event) => [`${m.name} ${event}`, `${humanize(m.name)} ${event}`] as [string, string],
      ),
    ),
    ...ir.actions.map((a) => [a.name, `After ${humanize(a.name)}`] as [string, string]),
    ...ir.timers.map((t) => [t.name, `When ${humanize(t.name)} runs`] as [string, string]),
  ];
  const args =
    area === "queries"
      ? { query: name, returns: modelName, ...(intent.trim() ? { intent: intent.trim() } : {}) }
      : area === "payments"
        ? {
            name,
            on: modelName,
            amount,
            when: when === "created" ? "created" : conditionOf(condition),
          }
        : area === "incoming"
          ? {
              name,
              ...(incoming === "custom"
                ? { custom: true }
                : {
                    create: modelName,
                    set: Object.entries(values)
                      .filter(([, value]) => value.trim())
                      .map(([field, value]) => `${field}=${value}`),
                  }),
            }
          : {
              outgoing: name,
              when: trigger,
              to: "mail",
              recipient,
              ...(listMail ? { list: modelName, columns: [column] } : {}),
            };
  const complete =
    /^[a-z][A-Za-z0-9]*$/.test(name) &&
    (area === "queries"
      ? model
      : area === "payments"
        ? model && amount
        : area === "incoming"
          ? incoming === "custom" ||
            (incoming === "record" && model && !needsLink && startingValues)
          : trigger && recipient && (!listMail || (model && column)));
  // This is a pure preview on copied files; effects are executed only by the real operation.
  const preview = complete
    ? applyOperation(
        { ...project.files, spec: project.files.spec ?? "", plugins, themes: project.ownThemes },
        operations[area],
        args,
      )
    : undefined;
  const save = async () => {
    if (!preview?.ok || busy) return;
    setBusy(true);
    try {
      if (await run(operations[area], args)) {
        setName("");
        setModelName("");
        setTrigger("");
        setRecipient("");
        setAmount("");
        setWhen("created");
        setCondition([]);
        setIncoming("");
        setValues({});
        setColumn("");
        setIntent("");
      }
    } finally {
      setBusy(false);
    }
  };
  const chooseModel = (value: string) => {
    setModelName(value);
    setAmount("");
    setValues({});
    setColumn("");
    setCondition([]);
  };
  return (
    <form
      aria-label={`Add ${labels[area]}`}
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      <fieldset disabled={busy} className="space-y-3 rounded-md border border-line p-3">
        <label htmlFor={`${id}-name`} className="block space-y-1 text-sm">
          Name
          <Input
            id={`${id}-name`}
            aria-label={`${humanize(labels[area])} name`}
            value={name}
            required
            pattern="[a-z][A-Za-z0-9]*"
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        {area === "incoming" && (
          <label htmlFor={`${id}-incoming`} className="block space-y-1 text-sm">
            Incoming call does
            <Select
              id={`${id}-incoming`}
              value={incoming}
              onChange={(event) => setIncoming(event.target.value)}
              options={[
                ["", "Choose what happens"],
                ["record", "Creates a record"],
                ["custom", "Is handled by custom code"],
              ]}
            />
          </label>
        )}
        {area === "outgoing" && (
          <>
            <label htmlFor={`${id}-trigger`} className="block space-y-1 text-sm">
              When
              <Select
                id={`${id}-trigger`}
                aria-label="Mail is sent when"
                value={trigger}
                onChange={(event) => {
                  setTrigger(event.target.value);
                  setRecipient("");
                  chooseModel("");
                }}
                options={[["", "Choose an event"], ...triggers]}
              />
            </label>
            <label htmlFor={`${id}-recipient`} className="block space-y-1 text-sm">
              Mail recipient
              <Select
                id={`${id}-recipient`}
                value={recipient}
                onChange={(event) => setRecipient(event.target.value)}
                options={[
                  ["", "Choose a recipient"],
                  ...(listMail || action?.custom ? roles : receivers).map(
                    (value) => [value, humanize(value)] as [string, string],
                  ),
                ]}
              />
            </label>
          </>
        )}
        {(area === "queries" ||
          area === "payments" ||
          (area === "incoming" && incoming === "record") ||
          listMail) && (
          <label htmlFor={`${id}-model`} className="block space-y-1 text-sm">
            Kind of record
            <Select
              id={`${id}-model`}
              value={modelName}
              onChange={(event) => chooseModel(event.target.value)}
              options={[
                ["", "Choose records"],
                ...ir.models.map((m) => [m.name, humanize(m.name)] as [string, string]),
              ]}
            />
          </label>
        )}
        {listMail && model && (
          <label htmlFor={`${id}-column`} className="block space-y-1 text-sm">
            First column in the mail
            <Select
              id={`${id}-column`}
              value={column}
              onChange={(event) => setColumn(event.target.value)}
              options={[
                ["", "Choose a field"],
                ...fields.map((f) => [f.name, humanize(f.name)] as [string, string]),
              ]}
            />
          </label>
        )}
        {area === "payments" && (
          <>
            <label htmlFor={`${id}-amount`} className="block space-y-1 text-sm">
              Amount
              <Select
                id={`${id}-amount`}
                aria-label="Payment amount"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                options={[
                  ["", "Choose a money field"],
                  ...money.map((f) => [f.name, humanize(f.name)] as [string, string]),
                ]}
              />
            </label>
            <label htmlFor={`${id}-when`} className="block space-y-1 text-sm">
              Payment is offered
              <Select
                id={`${id}-when`}
                value={when}
                onChange={(event) => setWhen(event.target.value)}
                options={[
                  ["created", "When creating a record"],
                  ["condition", "For records that match"],
                ]}
              />
            </label>
            {when === "condition" && (
              <WhenRows model={model} rows={condition} onChange={setCondition} />
            )}
          </>
        )}
        {area === "incoming" && incoming === "record" && model && (
          <fieldset className="space-y-2">
            <legend className="text-sm">Starting values from the call</legend>
            {needsLink && (
              <p role="status" className="text-sm">
                These records need a link to an existing record. Use custom code to choose it.
              </p>
            )}
            {incomingFields.map((field) => (
              <label
                key={field.name}
                htmlFor={`${id}-value-${field.name}`}
                className="block space-y-1 text-sm"
              >
                {humanize(field.name)}
                {field.required ? " (required)" : ""}
                <Input
                  id={`${id}-value-${field.name}`}
                  value={values[field.name] ?? ""}
                  placeholder={`{${field.name}}`}
                  onChange={(event) => setValues({ ...values, [field.name]: event.target.value })}
                />
              </label>
            ))}
          </fieldset>
        )}
        {area === "queries" && (
          <label htmlFor={`${id}-intent`} className="block space-y-1 text-sm">
            What it finds
            <Input
              id={`${id}-intent`}
              value={intent}
              onChange={(event) => setIntent(event.target.value)}
            />
          </label>
        )}
        <div
          id={`${id}-problem`}
          role="status"
          className={preview && !preview.ok ? "space-y-1 text-sm" : "sr-only"}
        >
          {preview && !preview.ok && (
            <>
              <p>This entry is not ready yet. Check its records and starting values.</p>
              <details className="text-xs text-muted">
                <summary>Code details</summary>
                <p>{preview.message}</p>
              </details>
            </>
          )}
        </div>
        <Button
          type="submit"
          disabled={!preview?.ok || busy}
          aria-describedby={preview && !preview.ok ? `${id}-problem` : undefined}
        >
          Add {labels[area]}
        </Button>
      </fieldset>
    </form>
  );
}
