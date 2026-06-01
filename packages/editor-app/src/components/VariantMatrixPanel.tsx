// SPDX-License-Identifier: AGPL-3.0-or-later
"use client";

import { useMemo } from "react";

/**
 * Wave 2 V2 — variant matrix UI for variable-data overrides.
 *
 * One row per {@link Variant}; one editable column per token in
 * `tokenKeys`. The token columns mirror the document-level
 * `variableData` token keys; each `Variant.overrides` maps a subset
 * of those keys to variant-specific values. Absent keys inherit the
 * document's defaults at merge time (Wave 3 V1).
 *
 * Structurally mirrors `@artworkpdf/document-model`'s `VariantMatrix`
 * — inlined here so the editor stays consumable without
 * document-model (same pattern as `EditorSeparation`,
 * `FoldGeometryPanelMetadata`).
 *
 * Controlled component: pass `value` + `onChange`, panel reflects
 * mutations back to the host on every keystroke. Hosts that need
 * batched commits should debounce externally.
 *
 * @public
 */

/**
 * One row of a {@link VariantMatrixPanelValue}.
 *
 * @public
 */
export type VariantMatrixPanelVariant = {
  id: string;
  name: string;
  overrides: Record<string, string>;
};

/**
 * Controlled value for the panel — the cross-product of variants
 * (rows) × token keys (columns).
 *
 * @public
 */
export type VariantMatrixPanelValue = {
  tokenKeys: string[];
  variants: VariantMatrixPanelVariant[];
};

/**
 * @public
 */
export type VariantMatrixPanelProps = {
  /** Current matrix. `undefined` means "no variants configured" —
   *  the panel offers an empty matrix with the document's token
   *  keys as columns. */
  value: VariantMatrixPanelValue | undefined;
  /** Fires on every change to a variant row, a token cell, or a
   *  token key. Hosts thread this into `document.variants`. */
  onChange: (next: VariantMatrixPanelValue) => void;
  /** Optional initial token keys to surface when `value` is
   *  `undefined` — typically the document-level `variableData`
   *  keys, so the matrix immediately reflects the merge surface. */
  initialTokenKeys?: readonly string[];
};

/**
 * @public
 */
export function VariantMatrixPanel({ value, onChange, initialTokenKeys }: VariantMatrixPanelProps) {
  const effective = useMemo<VariantMatrixPanelValue>(() => {
    if (value) return value;
    return {
      tokenKeys: initialTokenKeys ? [...initialTokenKeys] : [],
      variants: [],
    };
  }, [value, initialTokenKeys]);

  const addVariant = () => {
    const id = `v-${effective.variants.length + 1}`;
    onChange({
      ...effective,
      variants: [
        ...effective.variants,
        { id, name: `Variant ${effective.variants.length + 1}`, overrides: {} },
      ],
    });
  };

  const removeVariant = (id: string) => {
    onChange({
      ...effective,
      variants: effective.variants.filter((v) => v.id !== id),
    });
  };

  const renameVariant = (id: string, name: string) => {
    onChange({
      ...effective,
      variants: effective.variants.map((v) => (v.id === id ? { ...v, name } : v)),
    });
  };

  const setOverride = (id: string, key: string, val: string) => {
    onChange({
      ...effective,
      variants: effective.variants.map((v) =>
        v.id === id ? { ...v, overrides: { ...v.overrides, [key]: val } } : v,
      ),
    });
  };

  const addTokenKey = (key: string) => {
    const trimmed = key.trim();
    if (!trimmed || effective.tokenKeys.includes(trimmed)) return;
    onChange({ ...effective, tokenKeys: [...effective.tokenKeys, trimmed] });
  };

  const removeTokenKey = (key: string) => {
    onChange({
      ...effective,
      tokenKeys: effective.tokenKeys.filter((k) => k !== key),
      variants: effective.variants.map((v) => {
        if (!(key in v.overrides)) return v;
        const { [key]: _removed, ...rest } = v.overrides;
        return { ...v, overrides: rest };
      }),
    });
  };

  return (
    <div data-testid="variant-matrix-panel" style={{ padding: "0.5rem" }}>
      <header style={{ display: "flex", gap: "0.5rem", alignItems: "baseline" }}>
        <h3 style={{ margin: 0 }}>Variants</h3>
        <button type="button" onClick={addVariant} aria-label="Add variant">
          + variant
        </button>
        <TokenKeyAdder onAdd={addTokenKey} />
      </header>

      {effective.variants.length === 0 ? (
        <p style={{ opacity: 0.6 }}>
          No variants yet. Click <strong>+ variant</strong> to add the first row.
        </p>
      ) : (
        <table style={{ borderCollapse: "collapse", marginTop: "0.5rem" }}>
          <thead>
            <tr>
              <th>Name</th>
              {effective.tokenKeys.map((k) => (
                <th key={k}>
                  {k}{" "}
                  <button
                    type="button"
                    onClick={() => removeTokenKey(k)}
                    aria-label={`Remove token ${k}`}
                    title={`Remove token ${k}`}
                  >
                    ×
                  </button>
                </th>
              ))}
              <th>{/* row actions */}</th>
            </tr>
          </thead>
          <tbody>
            {effective.variants.map((v) => (
              <tr key={v.id}>
                <td>
                  <input
                    value={v.name}
                    onChange={(e) => renameVariant(v.id, e.target.value)}
                    aria-label={`Variant name for ${v.id}`}
                  />
                </td>
                {effective.tokenKeys.map((k) => (
                  <td key={k}>
                    <input
                      value={v.overrides[k] ?? ""}
                      onChange={(e) => setOverride(v.id, k, e.target.value)}
                      aria-label={`${v.name} override for ${k}`}
                      placeholder="—"
                    />
                  </td>
                ))}
                <td>
                  <button
                    type="button"
                    onClick={() => removeVariant(v.id)}
                    aria-label={`Remove variant ${v.name}`}
                  >
                    ×
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function TokenKeyAdder({ onAdd }: { onAdd: (key: string) => void }) {
  return (
    <form
      style={{ display: "inline-flex", gap: "0.25rem" }}
      onSubmit={(e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const input = form.elements.namedItem("token") as HTMLInputElement | null;
        if (input?.value) {
          onAdd(input.value);
          input.value = "";
        }
      }}
    >
      <input name="token" placeholder="+ token key" aria-label="New token key" />
      <button type="submit">add</button>
    </form>
  );
}
