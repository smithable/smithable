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
import { ReferencePicker } from "./ReferencePicker";
import { referenceOptions } from "./reference-options";

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
  const auth = validateAuth(
    { path: "smithable.auth.yml", text: project.files.auth ?? "smithableAuth: 0.1\n" },
    ir,
  ).auth;
  const receivers = referenceOptions(
    {
      kind: "recipient",
      model: listMail || action?.custom ? undefined : eventModel?.name,
      channels: ["mail"],
    },
    ir,
    auth,
  );
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
            <ReferencePicker
              label="Mail is sent when"
              options={referenceOptions({ kind: "event" }, ir)}
              value={trigger || undefined}
              onChange={async (value) => {
                setTrigger(String(value ?? ""));
                setRecipient("");
                chooseModel("");
                return true;
              }}
            />
            <ReferencePicker
              label="Mail recipient"
              options={receivers}
              value={recipient || undefined}
              onChange={async (value) => {
                setRecipient(String(value ?? ""));
                return true;
              }}
            />
          </>
        )}
        {(area === "queries" ||
          area === "payments" ||
          (area === "incoming" && incoming === "record") ||
          listMail) && (
          <ReferencePicker
            label="Kind of record"
            options={referenceOptions({ kind: "model" }, ir)}
            value={modelName || undefined}
            onChange={async (value) => {
              chooseModel(String(value ?? ""));
              return true;
            }}
          />
        )}
        {listMail && model && (
          <ReferencePicker
            label="First column in the mail"
            options={referenceOptions({ kind: "field", model: model.name, use: "sendable" }, ir)}
            value={column || undefined}
            onChange={async (value) => {
              setColumn(String(value ?? ""));
              return true;
            }}
          />
        )}
        {area === "payments" && (
          <>
            <ReferencePicker
              label="Payment amount"
              options={referenceOptions({ kind: "field", model: modelName, use: "money" }, ir)}
              value={amount || undefined}
              onChange={async (value) => {
                setAmount(String(value ?? ""));
                return true;
              }}
            />
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
