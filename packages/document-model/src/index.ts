// SPDX-License-Identifier: AGPL-3.0-or-later

export type ColorSpace = "CMYK" | "Spot" | "DeviceN" | "RGB" | "Gray";

export type Separation = {
  name: string;
  colorSpace: ColorSpace;
  pantone?: string;
  isTechnical?: boolean;
};

export type LayerType =
  | "artwork"
  | "dieline"
  | "white"
  | "varnish"
  | "technical"
  | "variable-data";

export type Layer = {
  id: string;
  type: LayerType;
  name: string;
  visible: boolean;
  separation?: Separation;
  objects: ArtworkObject[];
};

export type ArtworkObject = {
  id: string;
  type: "rect" | "ellipse" | "path" | "text" | "image";
  x: number;
  y: number;
  width: number;
  height: number;
  fill?: string;
  stroke?: string;
};

export type DocumentModel = {
  version: "1";
  width: number;
  height: number;
  unit: "mm" | "in" | "px" | "pt";
  separations: Separation[];
  layers: Layer[];
  flexoDistortion?: { distortionFactorX: number; distortionFactorY: number };
  variableData?: Record<string, string>;
};

export type JobOutputFormat = "pdf-x4" | "thumbnail" | "preview-separations";

export type JobSubmitRequest = {
  document: DocumentModel;
  output: { format: JobOutputFormat; colorProfile?: string };
  preflightReport?: import("./preflight.js").PreflightReport;
  preflightConfig?: {
    labelClass?: string;
    labelType?: string;
    tenantId?: string;
  };
};

export * from "./preflight.js";
