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

export function parseCF2(content: string): Dieline {
  // TODO: implement CF2 parser
  void content;
  return { format: "CF2", widthMm: 0, heightMm: 0, paths: [] };
}

export function parseDDES(content: string): Dieline {
  // TODO: implement DDES2 parser
  void content;
  return { format: "DDES", widthMm: 0, heightMm: 0, paths: [] };
}

export function parseARD(content: string): Dieline {
  // TODO: implement ARD (ArtiosCAD) parser
  void content;
  return { format: "ARD", widthMm: 0, heightMm: 0, paths: [] };
}
