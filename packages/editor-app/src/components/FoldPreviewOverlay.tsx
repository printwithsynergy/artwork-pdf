// SPDX-License-Identifier: AGPL-3.0-or-later
"use client";

import { useEffect, useRef } from "react";
import {
  type FoldGeometryConfig,
  type FoldGeometryPanelMetadata,
  type FoldSceneSpec,
  buildFoldScene,
} from "../lib/fold-geometry";

/**
 * S4 — 3D fold preview overlay (Wave 2 PR-3 scaffold).
 *
 * Renders a Three.js scene of the dieline's panels in 3D space.
 * The PR-3 scaffold ships a *flat* preview (every panel at Z=0)
 * with the hinge axes drawn in colored lines so the operator can
 * see where folds will happen. Interactive fold-angle scrubbing
 * lands in PR-4.
 *
 * Bundle note: Three.js is a hard dependency (~150 KB) so hosts
 * paying for the editor get fold preview out of the box. Hosts that
 * never need it can disable via {@link EditorConfig.enable_3d_fold_preview}
 * — when the flag is `false`, this component is never rendered and
 * the Three.js code path stays cold, but the symbols still ship
 * with the bundle. A future refactor may switch to a dynamic
 * `import("three")` for tighter chunking; that's deferred until the
 * editor's bundle profile shows it's worth the complexity.
 *
 * The Three.js scene is owned by this component — it creates the
 * renderer / scene / camera on mount, recomputes geometry on prop
 * change, and disposes on unmount. Hosts get a controlled component:
 * pass `panelMetadata` + `foldConfig`, get a rendered scene.
 *
 * @public
 */
export type FoldPreviewOverlayProps = {
  /** Panel registry derived from the active page's dieline.
   *  Structurally compatible with `document-model`'s `PanelMetadata`.
   *  When `undefined`, the overlay no-ops (renders an empty container). */
  panelMetadata: FoldGeometryPanelMetadata | undefined;
  /** Fold-edge config for the active page. Structurally compatible
   *  with `document-model`'s `FoldConfig`. When `undefined`, panels
   *  are still rendered (flat layout), but no hinge lines appear. */
  foldConfig?: FoldGeometryConfig | undefined;
  /** Container dimensions in CSS pixels. */
  width: number;
  height: number;
  /** Optional background color for the 3D viewport (CSS color
   *  string). Defaults to a transparent canvas so the overlay can
   *  layer over the editor's existing chrome. */
  backgroundColor?: string;
};

/**
 * @public
 */
export function FoldPreviewOverlay({
  panelMetadata,
  foldConfig,
  width,
  height,
  backgroundColor,
}: FoldPreviewOverlayProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<FoldSceneRuntime | null>(null);

  // Hold the latest props in a ref so the mount effect's initial
  // scene picks them up without depending on them — depending on
  // `panelMetadata` / `foldConfig` here would tear down + recreate
  // the renderer on every edit, defeating the per-update apply path
  // in the second effect.
  const propsRef = useRef({ panelMetadata, foldConfig });
  propsRef.current = { panelMetadata, foldConfig };

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let runtime: FoldSceneRuntime | null = null;
    let disposed = false;

    void (async () => {
      const three = await import("three");
      if (disposed) return;
      runtime = await createScene(three, container, width, height, backgroundColor);
      sceneRef.current = runtime;
      const { panelMetadata: pm, foldConfig: fc } = propsRef.current;
      if (pm) {
        applyScene(three, runtime, buildFoldScene(pm, fc));
      }
    })();

    return () => {
      disposed = true;
      sceneRef.current = null;
      if (runtime) disposeScene(runtime);
    };
  }, [width, height, backgroundColor]);

  useEffect(() => {
    const runtime = sceneRef.current;
    if (!runtime || !panelMetadata) return;
    let disposed = false;
    void (async () => {
      const three = await import("three");
      if (disposed) return;
      applyScene(three, runtime, buildFoldScene(panelMetadata, foldConfig));
    })();
    return () => {
      disposed = true;
    };
  }, [panelMetadata, foldConfig]);

  return (
    <div
      ref={containerRef}
      data-testid="fold-preview-overlay"
      style={{
        position: "relative",
        width,
        height,
        pointerEvents: "auto",
      }}
    />
  );
}

/**
 * Loaded Three.js scene state. Held in a ref so React re-renders
 * don't recreate the renderer.
 */
type FoldSceneRuntime = {
  // Use `any` here so the editor package doesn't have to leak the
  // entire `three` type surface through its own public types — the
  // Three.js module is dynamically imported and these handles stay
  // private to this file.
  // biome-ignore lint/suspicious/noExplicitAny: see above.
  renderer: any;
  // biome-ignore lint/suspicious/noExplicitAny: see above.
  scene: any;
  // biome-ignore lint/suspicious/noExplicitAny: see above.
  camera: any;
  // biome-ignore lint/suspicious/noExplicitAny: see above.
  panelGroup: any;
  // biome-ignore lint/suspicious/noExplicitAny: see above.
  hingeGroup: any;
  // biome-ignore lint/suspicious/noExplicitAny: see above.
  resources: any[];
  raf: number | null;
};

async function createScene(
  // biome-ignore lint/suspicious/noExplicitAny: see FoldSceneRuntime.
  three: any,
  container: HTMLDivElement,
  width: number,
  height: number,
  backgroundColor: string | undefined,
): Promise<FoldSceneRuntime> {
  const renderer = new three.WebGLRenderer({ antialias: true, alpha: !backgroundColor });
  renderer.setSize(width, height);
  renderer.setPixelRatio(typeof window !== "undefined" ? window.devicePixelRatio : 1);
  container.replaceChildren(renderer.domElement);

  const scene = new three.Scene();
  if (backgroundColor) {
    scene.background = new three.Color(backgroundColor);
  }

  const camera = new three.PerspectiveCamera(45, width / height, 0.1, 10000);
  camera.position.set(0, 0, 500);

  const light = new three.HemisphereLight(0xffffff, 0x202020, 1);
  scene.add(light);

  const panelGroup = new three.Group();
  const hingeGroup = new three.Group();
  scene.add(panelGroup, hingeGroup);

  const runtime: FoldSceneRuntime = {
    renderer,
    scene,
    camera,
    panelGroup,
    hingeGroup,
    resources: [],
    raf: null,
  };

  const animate = () => {
    runtime.raf = requestAnimationFrame(animate);
    renderer.render(scene, camera);
  };
  animate();

  return runtime;
}

function applyScene(
  // biome-ignore lint/suspicious/noExplicitAny: see FoldSceneRuntime.
  three: any,
  runtime: FoldSceneRuntime,
  spec: FoldSceneSpec,
): void {
  // Tear down previous geometry without disposing the renderer.
  runtime.panelGroup.clear();
  runtime.hingeGroup.clear();
  for (const r of runtime.resources) r.dispose?.();
  runtime.resources = [];

  for (const panel of spec.panels) {
    const geo = new three.BufferGeometry();
    const positions = new Float32Array(panel.corners.flatMap((c) => [c[0], c[1], c[2]]));
    geo.setAttribute("position", new three.BufferAttribute(positions, 3));
    geo.setIndex([0, 1, 2, 0, 2, 3]);
    geo.computeVertexNormals();
    const mat = new three.MeshStandardMaterial({
      color: 0xe6e6e6,
      side: three.DoubleSide,
      roughness: 0.6,
      metalness: 0.0,
    });
    runtime.panelGroup.add(new three.Mesh(geo, mat));
    runtime.resources.push(geo, mat);
  }

  for (const hinge of spec.hinges) {
    const geo = new three.BufferGeometry().setFromPoints([
      new three.Vector3(hinge.from[0], hinge.from[1], hinge.from[2]),
      new three.Vector3(hinge.to[0], hinge.to[1], hinge.to[2]),
    ]);
    const mat = new three.LineBasicMaterial({
      color: hinge.direction === "mountain" ? 0x2563eb : 0xdc2626,
      linewidth: 2,
    });
    runtime.hingeGroup.add(new three.Line(geo, mat));
    runtime.resources.push(geo, mat);
  }

  // Frame the camera around the scene bounds.
  const { min, max } = spec.bounds;
  const cx = (min[0] + max[0]) / 2;
  const cy = (min[1] + max[1]) / 2;
  const span = Math.max(max[0] - min[0], max[1] - min[1], 1);
  runtime.camera.position.set(cx, cy, span * 1.2);
  runtime.camera.lookAt(cx, cy, 0);
}

function disposeScene(runtime: FoldSceneRuntime): void {
  if (runtime.raf !== null) cancelAnimationFrame(runtime.raf);
  for (const r of runtime.resources) r.dispose?.();
  runtime.resources = [];
  runtime.renderer.dispose?.();
  runtime.renderer.domElement?.parentElement?.removeChild(runtime.renderer.domElement);
}
