import React, { useRef, useState } from "react";
import { Engine, Scene } from "react-babylonjs";
import { Vector3, Color3, SceneLoader, ActionManager, ExecuteCodeAction, StandardMaterial } from "@babylonjs/core";
import "@babylonjs/loaders";

const GLBScene = () => {
  const sceneRef = useRef(null);
  const meshesRef = useRef([]);
  const originalMaterialsRef = useRef(new Map());
  const selectedMeshRef = useRef(null);
  const [, setSelectedName] = useState(null);

  const onSceneMount = ({ scene }) => {
    sceneRef.current = scene;

    SceneLoader.ImportMesh(
      null,
      "/models/", 
      "python.glb", 
      sceneRef.current,
      (meshes) => {
        console.log("GLB loaded", meshes);
        meshesRef.current = meshes;

        if (meshes.length > 0) {
          try {
            const center = meshes[0].getBoundingInfo().boundingBox.centerWorld;
            if (sceneRef.current.activeCamera && sceneRef.current.activeCamera.setTarget) {
              sceneRef.current.activeCamera.setTarget(center);
              if (sceneRef.current.activeCamera.radius !== undefined) {
                sceneRef.current.activeCamera.radius = Math.max(3, sceneRef.current.activeCamera.radius);
              }
            }
          } catch (e) {
            console.warn("Could not frame camera:", e);
          }
        }

        meshes.forEach((mesh) => {
          if (!originalMaterialsRef.current.has(mesh)) {
            const mat = mesh.material;
            let color = null;
            let alpha = 1;
            if (mat) {
              if (mat.albedoColor && mat.albedoColor.clone) color = mat.albedoColor.clone();
              else if (mat.baseColor && mat.baseColor.clone) color = mat.baseColor.clone();
              else if (mat.diffuseColor && mat.diffuseColor.clone) color = mat.diffuseColor.clone();
              if (typeof mat.alpha !== 'undefined') alpha = mat.alpha;
            }
            const scaling = mesh.scaling && mesh.scaling.clone ? mesh.scaling.clone() : new Vector3(1, 1, 1);
            const renderingGroupId = typeof mesh.renderingGroupId !== 'undefined' ? mesh.renderingGroupId : 0;
            const alphaIndex = typeof mesh.alphaIndex !== 'undefined' ? mesh.alphaIndex : Number.MAX_VALUE;
            originalMaterialsRef.current.set(mesh, { material: mat, color, alpha, scaling, renderingGroupId, alphaIndex });
          }

          mesh.actionManager = new ActionManager(sceneRef.current);
          mesh.actionManager.registerAction(
            new ExecuteCodeAction(ActionManager.OnPickTrigger, () => {
              mesh.metadata = mesh.metadata || {};
              const wasHighlighted = !!mesh.metadata._highlighted;

              if (wasHighlighted) {
                // restore all meshes to original state
                meshesRef.current.forEach((m) => {
                  const original = originalMaterialsRef.current.get(m);
                  if (original) {
                    // restore material and alpha
                    m.material = original.material;
                    if (m.material && typeof original.alpha !== 'undefined') m.material.alpha = original.alpha;
                    if (original.color && m.material) {
                      if ('albedoColor' in m.material && m.material.albedoColor) m.material.albedoColor = original.color.clone();
                      else if ('baseColor' in m.material && m.material.baseColor) m.material.baseColor = original.color.clone();
                      else if ('diffuseColor' in m.material && m.material.diffuseColor) m.material.diffuseColor = original.color.clone();
                    }
                    // restore rendering order
                    if (typeof original.renderingGroupId !== 'undefined') m.renderingGroupId = original.renderingGroupId;
                    if (typeof original.alphaIndex !== 'undefined') m.alphaIndex = original.alphaIndex;
                    m.scaling = original.scaling && original.scaling.clone ? original.scaling.clone() : new Vector3(1, 1, 1);
                  }
                  m.isVisible = true;
                  // dispose any temporary faded material
                  if (m._fadedMaterial && m._fadedMaterial.dispose) {
                    try { m._fadedMaterial.dispose(); } catch { /* ignore */ }
                    m._fadedMaterial = null;
                  }
                  if (m.disableEdgesRendering) m.disableEdgesRendering();
                });
                mesh.metadata._highlighted = false;
                // clear selection
                selectedMeshRef.current = null;
                setSelectedName(null);
                return;
              }

              // make other meshes semi-transparent (50%) by cloning their material
              meshesRef.current.forEach((m) => {
                const original = originalMaterialsRef.current.get(m);
                if (m !== mesh) {
                  // dispose previous faded material if any
                  if (m._fadedMaterial && m._fadedMaterial.dispose) {
                    try { m._fadedMaterial.dispose(); } catch { /* ignore */ }
                    m._fadedMaterial = null;
                  }

                  // prefer cloning the current material so we preserve appearance, then reduce alpha
                  if (m.material && typeof m.material.clone === 'function') {
                    try {
                      const faded = m.material.clone(`faded_${m.name}_${Date.now()}`);
                      faded.alpha = 0.2;
                      if (original && original.color && faded) {
                        if ('albedoColor' in faded && faded.albedoColor) faded.albedoColor = original.color.clone();
                        else if ('baseColor' in faded && faded.baseColor) faded.baseColor = original.color.clone();
                        else if ('diffuseColor' in faded && faded.diffuseColor) faded.diffuseColor = original.color.clone();
                      }
                      faded.backFaceCulling = true;
                      m._fadedMaterial = faded;
                      m.material = faded;
                      m.renderingGroupId = 0;
                      m.alphaIndex = 0;
                    } catch {
                      // fallback: try setting alpha on existing material
                      if (typeof m.material.alpha !== 'undefined') m.material.alpha = 0.2;
                      m.renderingGroupId = 0;
                      m.alphaIndex = 0;
                    }
                  } else if (original && original.material && typeof original.material.clone === 'function') {
                    try {
                      const faded = original.material.clone(`faded_${m.name}_${Date.now()}`);
                      faded.alpha = 0.2;
                      if (original.color && faded) {
                        if ('albedoColor' in faded && faded.albedoColor) faded.albedoColor = original.color.clone();
                        else if ('baseColor' in faded && faded.baseColor) faded.baseColor = original.color.clone();
                        else if ('diffuseColor' in faded && faded.diffuseColor) faded.diffuseColor = original.color.clone();
                      }
                      faded.backFaceCulling = true;
                      m._fadedMaterial = faded;
                      m.material = faded;
                      m.renderingGroupId = 0;
                      m.alphaIndex = 0;
                    } catch {
                      if (original && typeof original.alpha !== 'undefined') {
                        if (m.material) m.material.alpha = 0.2;
                      }
                    }
                  } else if (m.material) {
                    if (typeof m.material.alpha !== 'undefined') m.material.alpha = 0.2;
                    m.renderingGroupId = 0;
                    m.alphaIndex = 0;
                  }
                } else {
                  m.isVisible = true;
                }
              });

              // enlarge clicked mesh to 120% of its original size (avoid shrinking)
              const orig = originalMaterialsRef.current.get(mesh);
              if (orig && orig.scaling && orig.scaling.clone) {
                const enlarged = orig.scaling.clone();
                enlarged.scaleInPlace(1.2);
                mesh.scaling = enlarged;
              } else {
                mesh.scaling = new Vector3(1.2, 1.2, 1.2);
              }

              if (mesh.material) {
                if ('albedoColor' in mesh.material) mesh.material.albedoColor = Color3.Red();
                else if ('baseColor' in mesh.material) mesh.material.baseColor = Color3.Red();
                else if ('diffuseColor' in mesh.material) mesh.material.diffuseColor = Color3.Red();
                if (typeof mesh.material.alpha !== 'undefined') mesh.material.alpha = 1.0;
              } else {
                const mat = new StandardMaterial(`mat_highlight_${mesh.name}`, sceneRef.current);
                mat.diffuseColor = Color3.Red();
                mat.alpha = 1.0;
                mesh.material = mat;
              }

              // ensure highlighted mesh renders on top of faded ones
              mesh.renderingGroupId = 1;
              mesh.alphaIndex = 1;

              // Edge highlight
              if (mesh.enableEdgesRendering) {
                mesh.enableEdgesRendering();
                mesh.edgesWidth = 4.0;
                mesh.edgesColor = Color3.Red();
              }

              mesh.metadata._highlighted = true;
              // set selection
              selectedMeshRef.current = mesh;
              setSelectedName(mesh.name || mesh.id || "selected");
            })
          );
        });
      },
      () => {
      },
      (scene, message, exception) => {
        console.error("Failed to load GLB:", message, exception);
      }
    );

    console.log("Scene mounted and loader started");
  };


  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <div style={{ position: 'absolute', top: 10, left: 10, zIndex: 999 }}>
        <button className="ui-btn ui-btn--danger" onClick={() => {
          const mesh = selectedMeshRef.current;
          if (!mesh) return;
          try { mesh.dispose(true, true); } catch { /* ignore */ }
          meshesRef.current = meshesRef.current.filter(m => m !== mesh);
          originalMaterialsRef.current.delete(mesh);
          selectedMeshRef.current = null;
          setSelectedName(null);
        }} >Delete Geometry</button>
        <button className="ui-btn ui-btn--accent" onClick={() => {
          const mesh = selectedMeshRef.current;
          if (!mesh) return;
          const factor = 1.2;
          if (mesh.scaling && typeof mesh.scaling.scaleInPlace === 'function') {
            mesh.scaling.scaleInPlace(factor);
          } else {
            mesh.scaling = new Vector3(factor, factor, factor);
          }
        }}>Scale Geometry</button>
      </div>

      <Engine antialias adaptToDeviceRatio canvasId="babylonJS">
        <Scene onSceneMount={onSceneMount}>
          <arcRotateCamera
            name="camera1"
            target={Vector3.Zero()}
            alpha={Math.PI / 2}
            beta={Math.PI / 4}
            radius={10}
          />
          <hemisphericLight
            name="light1"
            intensity={0.7}
            direction={Vector3.Up()}
          />
        </Scene>
      </Engine>
    </div>
  );
};

export default GLBScene;
