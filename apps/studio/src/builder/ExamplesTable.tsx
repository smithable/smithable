// A custom action's examples on its Behavior page (docs/design/intents.md §6, A 199): the tests the
// app runs on its code, as a table of what is given and what must hold after; the code is not
// shown. Read-only: an example is added or removed as a change (addExample, removeExample).
import type { ActionExampleIR } from "@smithable/core";
import { exampleRows } from "./examples-table";

const COLUMNS = [
  ["given", "Given"],
  ["input", "Input"],
  ["after", "After"],
  ["output", "Output"],
  ["how", "As, when"],
] as const;

export function ExamplesTable({ examples }: { examples: ActionExampleIR[] }) {
  if (!examples.length) return null;
  const rows = exampleRows(examples);
  // A column no example fills is left out.
  const shown = COLUMNS.filter(([key]) => rows.some((r) => r[key].length));
  return (
    <figure data-part="action-examples" className="space-y-1">
      <figcaption className="text-xs text-muted">
        The examples the app tests its code by: the records given, then what must hold after.
      </figcaption>
      <div className="overflow-x-auto rounded border border-line">
        <table className="w-full text-left text-xs">
          <thead className="bg-panel text-quiet">
            <tr>
              {shown.map(([key, label]) => (
                <th key={key} scope="col" className="px-2 py-1 font-medium">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              // Examples have no names; their order is theirs (removeExample takes the n-th).
              // biome-ignore lint/suspicious/noArrayIndexKey: the n-th example is its identity
              <tr key={i} className="border-t border-line align-top">
                {shown.map(([key]) => (
                  <td key={key} className="px-2 py-1">
                    {row[key].map((line, j) => (
                      <p
                        // Two records alike in an example are two lines alike: by place.
                        // biome-ignore lint/suspicious/noArrayIndexKey: lines may repeat
                        key={j}
                        className={
                          key === "output" && line === "refused"
                            ? "font-medium text-red-700"
                            : undefined
                        }
                      >
                        {line}
                      </p>
                    ))}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  );
}
