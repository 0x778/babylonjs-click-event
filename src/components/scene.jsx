import React, { useRef } from "react";
import { Engine, Scene } from "react-babylonjs";
import { Vector3, Color3, SceneLoader, ActionManager, ExecuteCodeAction } from "@babylonjs/core";
import "@babylonjs/loaders";

const GLBScene = () => {
  const sceneRef = useRef(null);
  const meshesRef = useRef([]);

  // Use onSceneMount to get the actual Babylon scene instance
  const onSceneMount = ({ scene }) => {
    sceneRef.current = scene;

    // Load GLB
    SceneLoader.ImportMesh(
      null,
      "/models/", // folder (served from public/)
      "python.glb", // filename
      sceneRef.current,
      (meshes) => {
        console.log("GLB loaded", meshes);
        meshesRef.current = meshes;

        // If meshes exist, focus camera on first mesh center
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

        // Add click events to each mesh
        meshes.forEach((mesh) => {
          mesh.actionManager = new ActionManager(sceneRef.current);
          mesh.actionManager.registerAction(
            new ExecuteCodeAction(ActionManager.OnPickTrigger, () => {
              // Hide other meshes
              meshesRef.current.forEach((m) => {
                m.isVisible = m === mesh;
              });

              mesh.scaling = new Vector3(0.3, 0.3, 0.3);

              // Highlight clicked mesh
              if (mesh.enableEdgesRendering) {
                mesh.enableEdgesRendering();
                mesh.edgesWidth = 4.0;
                mesh.edgesColor = Color3.Red();
              }
            })
          );
        });
      },
      // onProgress
      (evt) => {
        // Optional: show progress
        // console.log('GLB progress', evt);
      },
      // onError
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
