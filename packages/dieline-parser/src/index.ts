// SPDX-License-Identifier: AGPL-3.0-or-later

export type DielineFormat = "CF2" | "DDES" | "ARD";

export type DielinePath = {
  id: string;
  type: "cut" | "crease" | "perf" | "bleed";
  d: string;
};

export type Dieline = {
  format: DielineFormat;
  widthMm: number;
  heightMm: number;
  paths: DielinePath[];
};

// ── helpers ───────────────────────────────────────────────────────────────────

function parseNums(s: string): number[] {
  return s
    .trim()
    .split(/[\s,]+/)
    .filter(Boolean)
    .map(Number)
    .filter((n) => !Number.isNaN(n));
}

function arcToSvg(cx: number, cy: number, r: number, startDeg: number, endDeg: number): string {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const x1 = cx + r * Math.cos(toRad(startDeg));
  const y1 = cy + r * Math.sin(toRad(startDeg));
  const x2 = cx + r * Math.cos(toRad(endDeg));
  const y2 = cy + r * Math.sin(toRad(endDeg));
  const large = Math.abs(endDeg - startDeg) > 180 ? 1 : 0;
  const sweep = endDeg > startDeg ? 1 : 0;
  return `M${x1},${y1} A${r},${r} 0 ${large},${sweep} ${x2},${y2}`;
}

function boundingBox(segs: string[]): { w: number; h: number } {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const seg of segs) {
    const ns = (seg.match(/-?[\d.]+/g) ?? []).map(Number);
    for (let i = 0; i + 1 < ns.length; i += 2) {
      const x = ns[i] ?? 0;
      const y = ns[i + 1] ?? 0;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  return {
    w: maxX === Number.NEGATIVE_INFINITY ? 0 : maxX - minX,
    h: maxY === Number.NEGATIVE_INFINITY ? 0 : maxY - minY,
  };
}

type PathType = "cut" | "crease" | "perf" | "bleed";

function typeFromCode(code: number): PathType {
  if (code === 1) return "crease";
  if (code === 2) return "perf";
  if (code === 3) return "bleed";
  return "cut";
}

function buildPaths(
  segments: Map<PathType, string[]>,
  format: DielineFormat,
): { paths: DielinePath[]; widthMm: number; heightMm: number } {
  const paths: DielinePath[] = [];
  const all: string[] = [];
  let idx = 0;
  for (const [type, segs] of segments) {
    if (segs.length === 0) continue;
    paths.push({ id: `${format.toLowerCase()}-${idx++}`, type, d: segs.join(" ") });
    all.push(...segs);
  }
  const bb = boundingBox(all);
  return { paths, widthMm: bb.w, heightMm: bb.h };
}

function emptySegments(): Map<PathType, string[]> {
  return new Map<PathType, string[]>([
    ["cut", []],
    ["crease", []],
    ["perf", []],
    ["bleed", []],
  ]);
}

// ── CF2 parser ────────────────────────────────────────────────────────────────
// ISO 12182:2012 Common File Format 2 — ASCII variant
export function parseCF2(content: string): Dieline {
  const lines = content.split(/\r?\n/);
  const segments = emptySegments();
  let currentType: PathType = "cut";

  for (const raw of lines) {
    const line = raw.trim();
    if (line === "" || line.startsWith("#") || line.startsWith("//")) continue;

    const layerMatch = line.match(/^LAYER(?:BEGIN)?\s+\d+\s*(?:TYPE\s+(\d+))?/i);
    if (layerMatch) {
      currentType = typeFromCode(Number(layerMatch[1] ?? "0"));
      continue;
    }

    const typeMatch = line.match(/^TYPE\s+(\d+)/i);
    if (typeMatch) {
      currentType = typeFromCode(Number(typeMatch[1] ?? "0"));
      continue;
    }

    const lineMatch = line.match(/^LINE\s+([\d.\s,-]+)/i);
    if (lineMatch) {
      const n = parseNums(lineMatch[1] ?? "");
      if (n.length >= 4) {
        const x1 = n[0] ?? 0;
        const y1 = n[1] ?? 0;
        const x2 = n[2] ?? 0;
        const y2 = n[3] ?? 0;
        segments.get(currentType)?.push(`M${x1},${y1} L${x2},${y2}`);
      }
      continue;
    }

    const arcMatch = line.match(/^ARC\s+([\d.\s,-]+)/i);
    if (arcMatch) {
      const n = parseNums(arcMatch[1] ?? "");
      if (n.length >= 5) {
        segments
          .get(currentType)
          ?.push(arcToSvg(n[0] ?? 0, n[1] ?? 0, n[2] ?? 0, n[3] ?? 0, n[4] ?? 0));
      }
      continue;
    }

    // bare: <typeCode> x1 y1 x2 y2
    const bare = line.match(/^(\d+)\s+([\d.\s,-]+)$/);
    if (bare) {
      const t = typeFromCode(Number(bare[1] ?? "0"));
      const n = parseNums(bare[2] ?? "");
      if (n.length >= 4) {
        segments.get(t)?.push(`M${n[0] ?? 0},${n[1] ?? 0} L${n[2] ?? 0},${n[3] ?? 0}`);
      }
    }
  }

  const { paths, widthMm, heightMm } = buildPaths(segments, "CF2");
  return { format: "CF2", widthMm, heightMm, paths };
}

// ── DDES2 parser ──────────────────────────────────────────────────────────────
// Barco Die Design Electronic Standard 2
export function parseDDES(content: string): Dieline {
  const lines = content.split(/\r?\n/);
  const segments = emptySegments();

  for (const raw of lines) {
    const line = raw.trim();
    if (line === "" || /^DDES|^UNIT|^\/\//i.test(line)) continue;

    const lineMatch = line.match(/^LINE\s+(\d+)\s+([\d.\s,-]+)/i);
    if (lineMatch) {
      const t = typeFromCode(Number(lineMatch[1] ?? "0"));
      const n = parseNums(lineMatch[2] ?? "");
      if (n.length >= 4) {
        segments.get(t)?.push(`M${n[0] ?? 0},${n[1] ?? 0} L${n[2] ?? 0},${n[3] ?? 0}`);
      }
      continue;
    }

    const arcMatch = line.match(/^ARC\s+(\d+)\s+([\d.\s,-]+)/i);
    if (arcMatch) {
      const t = typeFromCode(Number(arcMatch[1] ?? "0"));
      const n = parseNums(arcMatch[2] ?? "");
      if (n.length >= 5) {
        segments.get(t)?.push(arcToSvg(n[0] ?? 0, n[1] ?? 0, n[2] ?? 0, n[3] ?? 0, n[4] ?? 0));
      }
      continue;
    }

    // bare: <code> x1 y1 x2 y2
    const bare = line.match(/^(\d+)\s+([\d.\s,-]+)$/);
    if (bare) {
      const t = typeFromCode(Number(bare[1] ?? "0"));
      const n = parseNums(bare[2] ?? "");
      if (n.length >= 4) {
        segments.get(t)?.push(`M${n[0] ?? 0},${n[1] ?? 0} L${n[2] ?? 0},${n[3] ?? 0}`);
      }
    }
  }

  const { paths, widthMm, heightMm } = buildPaths(segments, "DDES");
  return { format: "DDES", widthMm, heightMm, paths };
}

// ── ARD parser ────────────────────────────────────────────────────────────────
// ArtiosCAD ASCII export — line sections and arc sections
export function parseARD(content: string): Dieline {
  const lines = content.split(/\r?\n/);
  const segments = emptySegments();
  let inLines = false;
  let inArcs = false;

  for (const raw of lines) {
    const line = raw.trim();
    if (line === "") continue;

    const upper = line.toUpperCase();

    if (upper === "LINES" || upper === "LINES:") {
      inLines = true;
      inArcs = false;
      continue;
    }
    if (upper === "ARCS" || upper === "ARCS:") {
      inArcs = true;
      inLines = false;
      continue;
    }
    if (/^(END|BOX|UNITS)/.test(upper)) {
      inLines = false;
      inArcs = false;
      continue;
    }

    if (inLines) {
      const n = parseNums(line);
      if (n.length >= 5) {
        const t = typeFromCode(n[0] ?? 0);
        segments.get(t)?.push(`M${n[1] ?? 0},${n[2] ?? 0} L${n[3] ?? 0},${n[4] ?? 0}`);
      }
    } else if (inArcs) {
      const n = parseNums(line);
      if (n.length >= 6) {
        const t = typeFromCode(n[0] ?? 0);
        segments.get(t)?.push(arcToSvg(n[1] ?? 0, n[2] ?? 0, n[3] ?? 0, n[4] ?? 0, n[5] ?? 0));
      }
    } else {
      // outside sections: bare <code> x1 y1 x2 y2
      const n = parseNums(line);
      if (n.length >= 5) {
        const t = typeFromCode(n[0] ?? 0);
        segments.get(t)?.push(`M${n[1] ?? 0},${n[2] ?? 0} L${n[3] ?? 0},${n[4] ?? 0}`);
      }
    }
  }

  const { paths, widthMm, heightMm } = buildPaths(segments, "ARD");
  return { format: "ARD", widthMm, heightMm, paths };
}
