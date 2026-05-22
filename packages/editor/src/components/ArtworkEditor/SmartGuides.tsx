// Smart Guides - Visual snap guides and dieline snapping
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useMemo } from "react";
import type { ArtworkObject, Layer } from "@artworkpdf/document-model";

interface SmartGuidesProps {
  selectedObjectIds: string[];
  objects: ArtworkObject[];
  layers: Layer[];
  zoom: number;
  snapThreshold?: number;
}

interface GuideLine {
  position: number;
  type: "horizontal" | "vertical";
  target: string;
}

export function SmartGuides({
  selectedObjectIds,
  objects,
  layers,
  zoom,
  snapThreshold = 5,
}: SmartGuidesProps) {
  const guides = useMemo(() => {
    if (selectedObjectIds.length !== 1) return [];

    const selected = objects.find((o) => o.id === selectedObjectIds[0]);
    if (!selected) return [];

    const selectedBounds = {
      left: selected.x,
      right: selected.x + selected.width,
      top: selected.y,
      bottom: selected.y + selected.height,
      centerX: selected.x + selected.width / 2,
      centerY: selected.y + selected.height / 2,
    };

    const guideLines: GuideLine[] = [];
    const threshold = snapThreshold / zoom;

    // Check against other objects
    for (const obj of objects) {
      if (obj.id === selected.id) continue;
      if (obj.parentId) continue; // Skip children

      const objBounds = {
        left: obj.x,
        right: obj.x + obj.width,
        top: obj.y,
        bottom: obj.y + obj.height,
        centerX: obj.x + obj.width / 2,
        centerY: obj.y + obj.height / 2,
      };

      // Horizontal alignments
      if (Math.abs(selectedBounds.top - objBounds.top) < threshold) {
        guideLines.push({ position: objBounds.top, type: "horizontal", target: "top" });
      }
      if (Math.abs(selectedBounds.bottom - objBounds.bottom) < threshold) {
        guideLines.push({ position: objBounds.bottom, type: "horizontal", target: "bottom" });
      }
      if (Math.abs(selectedBounds.centerY - objBounds.centerY) < threshold) {
        guideLines.push({ position: objBounds.centerY, type: "horizontal", target: "center" });
      }
      if (Math.abs(selectedBounds.top - objBounds.bottom) < threshold) {
        guideLines.push({ position: objBounds.bottom, type: "horizontal", target: "edge" });
      }
      if (Math.abs(selectedBounds.bottom - objBounds.top) < threshold) {
        guideLines.push({ position: objBounds.top, type: "horizontal", target: "edge" });
      }

      // Vertical alignments
      if (Math.abs(selectedBounds.left - objBounds.left) < threshold) {
        guideLines.push({ position: objBounds.left, type: "vertical", target: "left" });
      }
      if (Math.abs(selectedBounds.right - objBounds.right) < threshold) {
        guideLines.push({ position: objBounds.right, type: "vertical", target: "right" });
      }
      if (Math.abs(selectedBounds.centerX - objBounds.centerX) < threshold) {
        guideLines.push({ position: objBounds.centerX, type: "vertical", target: "center" });
      }
      if (Math.abs(selectedBounds.left - objBounds.right) < threshold) {
        guideLines.push({ position: objBounds.right, type: "vertical", target: "edge" });
      }
      if (Math.abs(selectedBounds.right - objBounds.left) < threshold) {
        guideLines.push({ position: objBounds.left, type: "vertical", target: "edge" });
      }
    }

    // Check against dieline layer bounds
    const dielineLayer = layers.find((l) => l.type === "dieline");
    if (dielineLayer?.dielineBounds) {
      const bounds = dielineLayer.dielineBounds;

      // Snap to dieline edges
      if (Math.abs(selectedBounds.left - bounds.x) < threshold) {
        guideLines.push({ position: bounds.x, type: "vertical", target: "dieline" });
      }
      if (Math.abs(selectedBounds.right - (bounds.x + bounds.width)) < threshold) {
        guideLines.push({ position: bounds.x + bounds.width, type: "vertical", target: "dieline" });
      }
      if (Math.abs(selectedBounds.top - bounds.y) < threshold) {
        guideLines.push({ position: bounds.y, type: "horizontal", target: "dieline" });
      }
      if (Math.abs(selectedBounds.bottom - (bounds.y + bounds.height)) < threshold) {
        guideLines.push({ position: bounds.y + bounds.height, type: "horizontal", target: "dieline" });
      }

      // Snap to center
      const centerX = bounds.x + bounds.width / 2;
      const centerY = bounds.y + bounds.height / 2;
      if (Math.abs(selectedBounds.centerX - centerX) < threshold) {
        guideLines.push({ position: centerX, type: "vertical", target: "center" });
      }
      if (Math.abs(selectedBounds.centerY - centerY) < threshold) {
        guideLines.push({ position: centerY, type: "horizontal", target: "center" });
      }
    }

    return guideLines;
  }, [selectedObjectIds, objects, layers, zoom, snapThreshold]);

  if (guides.length === 0) return null;

  return (
    <>
      {guides.map((guide, index) =>
        guide.type === "horizontal" ? (
          <line
            key={`h-${index}`}
            x1={-10000}
            y1={guide.position}
            x2={10000}
            y2={guide.position}
            stroke="#00D4FF"
            strokeWidth={1 / zoom}
            strokeDasharray={`${4 / zoom} ${4 / zoom}`}
          />
        ) : (
          <line
            key={`v-${index}`}
            x1={guide.position}
            y1={-10000}
            x2={guide.position}
            y2={10000}
            stroke="#00D4FF"
            strokeWidth={1 / zoom}
            strokeDasharray={`${4 / zoom} ${4 / zoom}`}
          />
        )
      )}
    </>
  );
}

// Snap utility function
export function snapToGuides(
  x: number,
  y: number,
  width: number,
  height: number,
  objects: ArtworkObject[],
  layers: Layer[],
  snapThreshold: number = 5
): { x: number; y: number; snapped: boolean } {
  const bounds = {
    left: x,
    right: x + width,
    top: y,
    bottom: y + height,
    centerX: x + width / 2,
    centerY: y + height / 2,
  };

  let newX = x;
  let newY = y;
  let snapped = false;

  // Check against dieline
  const dielineLayer = layers.find((l) => l.type === "dieline");
  if (dielineLayer?.dielineBounds) {
    const dieline = dielineLayer.dielineBounds;

    // Snap X
    if (Math.abs(bounds.left - dieline.x) < snapThreshold) {
      newX = dieline.x;
      snapped = true;
    } else if (Math.abs(bounds.right - (dieline.x + dieline.width)) < snapThreshold) {
      newX = dieline.x + dieline.width - width;
      snapped = true;
    }

    // Snap Y
    if (Math.abs(bounds.top - dieline.y) < snapThreshold) {
      newY = dieline.y;
      snapped = true;
    } else if (Math.abs(bounds.bottom - (dieline.y + dieline.height)) < snapThreshold) {
      newY = dieline.y + dieline.height - height;
      snapped = true;
    }
  }

  return { x: newX, y: newY, snapped };
}
