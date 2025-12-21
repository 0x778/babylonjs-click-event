import React, { useRef } from "react";
import { Engine, Scene } from "react-babylonjs";
import { Vector3, Color3, SceneLoader, ActionManager, ExecuteCodeAction, StandardMaterial } from "@babylonjs/core";
import "@babylonjs/loaders";

const GLBScene = () => {
  const sceneRef = useRef(null);
  const meshesRef = useRef([]);
  const originalMaterialsRef = useRef(new Map());

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
            if (mat) {
              if (mat.albedoColor && mat.albedoColor.clone) color = mat.albedoColor.clone();
              else if (mat.baseColor && mat.baseColor.clone) color = mat.baseColor.clone();
              else if (mat.diffuseColor && mat.diffuseColor.clone) color = mat.diffuseColor.clone();
            }
            originalMaterialsRef.current.set(mesh, { material: mat, color });
          }

          mesh.actionManager = new ActionManager(sceneRef.current);
          mesh.actionManager.registerAction(
            new ExecuteCodeAction(ActionManager.OnPickTrigger, () => {
              // Hide other meshes and restore their colors
              meshesRef.current.forEach((m) => {
                m.isVisible = m === mesh;

                const original = originalMaterialsRef.current.get(m);
                if (m !== mesh && original && original.color && m.material) {
                  if ('albedoColor' in m.material && m.material.albedoColor) m.material.albedoColor = original.color.clone();
                  else if ('baseColor' in m.material && m.material.baseColor) m.material.baseColor = original.color.clone();
                  else if ('diffuseColor' in m.material && m.material.diffuseColor) m.material.diffuseColor = original.color.clone();
                }
              });

              // enlarge clicked mesh
              mesh.scaling = new Vector3(0.3, 0.3, 0.3);

              if (mesh.material) {
                if ('albedoColor' in mesh.material) mesh.material.albedoColor = Color3.Red();
                else if ('baseColor' in mesh.material) mesh.material.baseColor = Color3.Red();
                else if ('diffuseColor' in mesh.material) mesh.material.diffuseColor = Color3.Red();
              } else {
                const mat = new StandardMaterial(`mat_highlight_${mesh.name}`, sceneRef.current);
                mat.diffuseColor = Color3.Red();
                mesh.material = mat;
              }

              // Edge highlight
              if (mesh.enableEdgesRendering) {
                mesh.enableEdgesRendering();
                mesh.edgesWidth = 4.0;
                mesh.edgesColor = Color3.Red();
              }
            })
          );
        });
      },
      (evt) => {
      },
      (scene, message, exception) => {
        console.error("Failed to load GLB:", message, exception);
      }
    );

    console.log("Scene mounted and loader started");
  };


  return (
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
  );
};

export default GLBScene;
