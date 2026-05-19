// SPDX-License-Identifier: AGPL-3.0-or-later

export type DistortionParams = {
  factorX: number;
  factorY: number;
  repeatLengthMm?: number;
};

export function applyFlexoDistortion(
  pathData: string,
  params: DistortionParams,
): string {
  // TODO: apply flexo distortion compensation transform to SVG path data
  void params;
  return pathData;
}

export function compensatedDimensions(
  originalWidthMm: number,
  originalHeightMm: number,
  params: DistortionParams,
): { widthMm: number; heightMm: number } {
  return {
    widthMm: originalWidthMm / params.factorX,
    heightMm: originalHeightMm / params.factorY,
  };
}
