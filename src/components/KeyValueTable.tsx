import { nanoid } from "nanoid";
import { Trash2 } from "lucide-react";
import { useId, useState } from "react";
import type { KeyValueRow } from "../types/api";

type Props = {
  rows: KeyValueRow[];
  onChange: (rows: KeyValueRow[]) => void;
  keyPlaceholder?: string;
  valuePlaceholder?: string;
  keySuggestions?: string[];
  title?: string;
};

function toBulk(rows: KeyValueRow[]) {
  return rows.map((row) => `${row.enabled ? "" : "// "}${row.key}: ${row.value}`).join("\n");
}

function fromBulk(text: string, previous: KeyValueRow[]): KeyValueRow[] {
  return text
    .split("\n")
    .filter((line) => line.trim())
    .map((line, index) => {
      const disabled = line.trimStart().startsWith("//");
      const content = disabled ? line.trimStart().slice(2).trimStart() : line;
      const colon = content.indexOf(":");
      const key = (colon >= 0 ? content.slice(0, colon) : content).trim();
      const value = colon >= 0 ? content.slice(colon + 1).trim() : "";
      return { id: previous[index]?.id ?? nanoid(), key, value, enabled: !disabled };
    });
}

export function KeyValueTable({ rows, onChange, keyPlaceholder = "Key", valuePlaceholder = "Value", keySuggestions, title }: Props) {
  // The trailing empty row becomes a real row the moment you type in it. Reusing its id keeps focus in place.
  const [ghostId, setGhostId] = useState(() => nanoid());
  const [bulk, setBulk] = useState<string | null>(null);
  const listId = useId();

  const update = (id: string, patch: Partial<KeyValueRow>) => {
    if (id === ghostId) {
      onChange([...rows, { id, key: "", value: "", enabled: true, ...patch }]);
      setGhostId(nanoid());
    } else {
      onChange(rows.map((row) => (row.id === id ? { ...row, ...patch } : row)));
    }
  };

  const remove = (id: string) => onChange(rows.filter((row) => row.id !== id));
  const allEnabled = rows.length > 0 && rows.every((row) => row.enabled);
  const display = [...rows, { id: ghostId, key: "", value: "", enabled: true }];

  return (
    <div>
      <div className="mb-2 flex h-6 items-center justify-between">
        <span className="text-xs font-medium text-muted">{title}</span>
        <button
          className="btn-ghost h-6 text-xs"
          onClick={() => {
            if (bulk === null) setBulk(toBulk(rows));
            else {
              onChange(fromBulk(bulk, rows));
              setBulk(null);
            }
          }}
        >
          {bulk === null ? "Bulk edit" : "Key–value edit"}
        </button>
      </div>

      {bulk !== null ? (
        <textarea
          className="input h-48 resize-y py-2 font-mono text-xs leading-5"
          spellCheck={false}
          autoFocus
          value={bulk}
          placeholder={"Key: Value\n// Disabled-Key: Value"}
          onChange={(event) => setBulk(event.target.value)}
        />
      ) : (
        <div className="overflow-hidden rounded border border-line">
          <div className="grid grid-cols-[34px_minmax(0,1fr)_minmax(0,1.4fr)_32px] border-b border-line bg-sidebar text-xs font-medium text-muted">
            <label className="grid place-items-center" title={allEnabled ? "Disable all" : "Enable all"}>
              <input
                type="checkbox"
                className="accent-[var(--accent)]"
                checked={allEnabled}
                disabled={rows.length === 0}
                onChange={(event) => onChange(rows.map((row) => ({ ...row, enabled: event.target.checked })))}
              />
            </label>
            <div className="border-l border-line px-2.5 py-1.5">Key</div>
            <div className="border-l border-line px-2.5 py-1.5">Value</div>
            <div />
          </div>
          {display.map((row) => {
            const ghost = row.id === ghostId;
            return (
              <div key={row.id} className="group grid grid-cols-[34px_minmax(0,1fr)_minmax(0,1.4fr)_32px] border-b border-line last:border-b-0 focus-within:bg-hover">
                <label className="grid place-items-center">
                  {!ghost && (
                    <input type="checkbox" className="accent-[var(--accent)]" checked={row.enabled} onChange={(event) => update(row.id, { enabled: event.target.checked })} />
                  )}
                </label>
                <input
                  className={`h-8 min-w-0 border-l border-line bg-transparent px-2.5 text-sm outline-none ${row.enabled ? "" : "text-faint line-through"}`}
                  placeholder={ghost ? keyPlaceholder : ""}
                  value={row.key}
                  list={keySuggestions ? listId : undefined}
                  spellCheck={false}
                  onChange={(event) => update(row.id, { key: event.target.value })}
                />
                <input
                  className={`h-8 min-w-0 border-l border-line bg-transparent px-2.5 font-mono text-xs outline-none ${row.enabled ? "" : "text-faint line-through"}`}
                  placeholder={ghost ? valuePlaceholder : ""}
                  value={row.value}
                  spellCheck={false}
                  onChange={(event) => update(row.id, { value: event.target.value })}
                />
                <div className="grid place-items-center">
                  {!ghost && (
                    <button className="icon-btn h-6 w-6 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100" title="Delete row" onClick={() => remove(row.id)}>
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
      {keySuggestions && (
        <datalist id={listId}>
          {keySuggestions.map((item) => (
            <option key={item} value={item} />
          ))}
        </datalist>
      )}
    </div>
  );
}
