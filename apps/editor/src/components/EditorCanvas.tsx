// SPDX-License-Identifier: AGPL-3.0-or-later
"use client";
import { Stage, Layer, Rect, Text } from "react-konva";
import { useState } from "react";

export function EditorCanvas() {
  const [dimensions] = useState({ width: 800, height: 600 });

  return (
    <div style={{ flex: 1, overflow: "hidden", background: "#1a0f08" }}>
      <Stage width={dimensions.width} height={dimensions.height}>
        <Layer>
          {/* Artboard */}
          <Rect
            x={50} y={50}
            width={700} height={500}
            fill="white"
            shadowBlur={20}
            shadowColor="rgba(0,0,0,0.6)"
          />
          <Text
            x={60} y={60}
            text="artworkPDF editor — canvas ready"
            fontSize={14}
            fill="#888"
          />
        </Layer>
      </Stage>
    </div>
  );
}
