// SPDX-License-Identifier: AGPL-3.0-or-later

export type DistortionParams = {
  factorX: number;
  factorY: number;
  repeatLengthMm?: number;
};

// Scale each coordinate in an SVG path by the reciprocal of the distortion factors.
// Flexo plates stretch during mounting: factorX/Y > 1 means the plate will be larger
// than nominal, so we pre-shrink the artwork by dividing by those factors.
export function applyFlexoDistortion(pathData: string, params: DistortionParams): string {
  if (params.factorX === 1 && params.factorY === 1) return pathData;

  const { factorX, factorY } = params;
  // Split into individual commands (letter + following numbers/whitespace)
  const tokens = pathData.match(/[MmLlHhVvCcSsQqTtAaZz][^MmLlHhVvCcSsQqTtAaZz]*/g);
  if (!tokens) return pathData;

  return tokens
    .map((token) => {
      const type = token[0];
      const rest = token.slice(1).trim();
      const nums = rest === "" ? [] : rest.split(/[\s,]+/).filter(Boolean).map(Number);

      const scaleXY = (arr: number[]): number[] =>
        arr.map((n, i) => (i % 2 === 0 ? n / factorX : n / factorY));

      switch (type) {
        case "M":
        case "L":
        case "T":
        case "m":
        case "l":
        case "t":
          return `${type}${scaleXY(nums).join(",")}`;

        case "H":
        case "h":
          return `${type}${nums.map((n) => n / factorX).join(",")}`;

        case "V":
        case "v":
          return `${type}${nums.map((n) => n / factorY).join(",")}`;

        // cubic bezier: x1,y1 x2,y2 x,y (6 params per segment)
        case "C":
        case "c":
          return `${type}${scaleXY(nums).join(",")}`;

        // smooth cubic / quadratic: 4 params per segment, all x,y pairs
        case "S":
        case "s":
        case "Q":
        case "q":
          return `${type}${scaleXY(nums).join(",")}`;

        // arc: rx,ry,x-rot,large-arc,sweep,x,y (7 params per segment)
        case "A":
        case "a": {
          const out: number[] = [];
          for (let i = 0; i + 6 < nums.length; i += 7) {
            const rx = nums[i] ?? 0;
            const ry = nums[i + 1] ?? 0;
            const xRot = nums[i + 2] ?? 0;
            const largeArc = nums[i + 3] ?? 0;
            const sweep = nums[i + 4] ?? 0;
            const ex = nums[i + 5] ?? 0;
            const ey = nums[i + 6] ?? 0;
            out.push(
              rx / factorX,
              ry / factorY,
              xRot,
              largeArc,
              sweep,
              ex / factorX,
              ey / factorY,
            );
          }
          return `${type}${out.join(",")}`;
        }

        case "Z":
        case "z":
          return type;

        default:
          return token;
      }
    })
    .join("");
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
