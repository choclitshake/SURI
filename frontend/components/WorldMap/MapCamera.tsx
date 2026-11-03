"use client";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { CAMERA_ORTHO_SIZE, CAMERA_POSITION, CAMERA_TARGET, LANDMARK_BOUNDS, LANDMARK_LABEL_LIFT, LANDMARK_SCALE, worldFrame } from "@/lib/worldMap/framing";
import { playableProjectionBounds } from "@/lib/worldMap/worldBounds";
import { SITES, sitePosition } from "@/lib/worldMap/landscape";
import { cameraEase, islandCameraPose, ISLAND_ROUTES, RETURN_DURATION, TOPICS_APPROACH_DURATION, ZOOM_DURATION, type CameraCommand } from "@/lib/worldMap/navigation";
import { applyOverviewPose, CAMERA_RESPONSE, responsiveCamera } from "@/lib/worldMap/responsiveCamera";
export { CAMERA_POSITION } from "@/lib/worldMap/framing";

function isFocusedIsland(site?: string) {
  return Object.values(ISLAND_ROUTES).some(destination => destination === site);
}

export function MapCamera({ command, active = true, preserveCameraOnActivate = false, controlsEnabled = true, headerInset = 0 }: { command: CameraCommand | null; active?: boolean; preserveCameraOnActivate?: boolean; controlsEnabled?: boolean; headerInset?: number }) {
  const getThree=useThree(state=>state.get),size=useThree(state=>state.size),invalidate=useThree(state=>state.invalidate);
  const initialized=useRef(false);
  const wasActive=useRef(false);
  const [coarse, setCoarse] = useState(false);
  const reduced = useRef(false);
  const overview = useRef(true);
  const offset = useRef(new THREE.Vector2());
  const targetOffset = useRef(new THREE.Vector2());
  const lastCommand = useRef<number | null>(null);
  const response = useMemo(() => responsiveCamera(size.width, size.height, playableProjectionBounds(), false, headerInset), [size.width, size.height, headerInset]);
  const touchControls=response.mobile||coarse;
  useEffect(() => {
    const pointer = window.matchMedia("(pointer: coarse)");
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => { setCoarse(pointer.matches); reduced.current = motion.matches; invalidate(); };
    update();
    pointer.addEventListener("change", update); motion.addEventListener("change", update);
    return () => { pointer.removeEventListener("change", update); motion.removeEventListener("change", update); };
  }, [invalidate]);
  const animation=useRef<{elapsed:number;duration:number;from:THREE.Vector3;to:THREE.Vector3;fromZoom:number;toZoom:number;fromQuaternion:THREE.Quaternion;toQuaternion:THREE.Quaternion;done:()=>void}|null>(null);
  useLayoutEffect(()=>{
    // Hidden retained canvases must not overwrite the last valid overview.
    if(!active||size.width<2||size.height<2)return;
    const {camera}=getThree();
    if(!initialized.current){
      camera.position.set(...CAMERA_POSITION);camera.lookAt(...CAMERA_TARGET);camera.zoom=1;
      initialized.current=true;
    }
    if(camera instanceof THREE.OrthographicCamera){
      camera.left=-CAMERA_ORTHO_SIZE*size.width/size.height;camera.right=-camera.left;
      camera.top=CAMERA_ORTHO_SIZE;camera.bottom=-CAMERA_ORTHO_SIZE;
    }
    camera.near=0.5;camera.far=650;camera.updateProjectionMatrix();
    offset.current.set(0, 0); targetOffset.current.set(0, 0);
    if (overview.current && !animation.current) {
      camera.position.copy(response.position); camera.quaternion.copy(response.quaternion); camera.zoom=response.zoom;
      camera.updateProjectionMatrix();
    }
    invalidate();
  },[getThree,size.width,size.height,response,invalidate,active]);
  useLayoutEffect(() => {
    const { camera } = getThree();
    if (active && size.width>1 && size.height>1 && !wasActive.current && !preserveCameraOnActivate && !animation.current) {
      // A retained canvas otherwise comes back still zoomed into the island
      // selected just before navigation.
      overview.current = true;
      offset.current.set(0, 0); targetOffset.current.set(0, 0);
      camera.position.copy(response.position);
      camera.quaternion.copy(response.quaternion);
      camera.zoom = response.zoom;
      camera.updateProjectionMatrix();
      invalidate();
    }
    wasActive.current = active;
  }, [active, getThree, invalidate, preserveCameraOnActivate, response,size.width,size.height]);
  useEffect(() => {
    const canvas = getThree().gl.domElement;
    const surface = canvas.closest<HTMLElement>("[data-world-viewport]");
    if (!surface || !active || !controlsEnabled) return;
    let idle: ReturnType<typeof setTimeout> | undefined;
    let drag: { id: number; x: number; y: number; start: THREE.Vector2; moved: boolean } | null = null;
    const pointers = new Set<number>();
    let suppressClick = false;
    const release = () => {
      const id = drag?.id;
      drag = null;
      if (id !== undefined && canvas.hasPointerCapture(id)) canvas.releasePointerCapture(id);
    };
    const down = (event: PointerEvent) => {
      if (!touchControls || !overview.current || animation.current || event.button !== 0) return;
      if (!drag && event.target instanceof Element && event.target.closest("button")) return;
      pointers.add(event.pointerId);
      if (pointers.size > 1) { suppressClick = true; release(); return; }
      suppressClick = false;
      drag = { id: event.pointerId, x: event.clientX, y: event.clientY, start: targetOffset.current.clone(), moved: false };
    };
    const move = (event: PointerEvent) => {
      if (!overview.current || animation.current) return;
      if (touchControls) {
        if (!drag || drag.id !== event.pointerId || pointers.size !== 1) return;
        const dx = event.clientX - drag.x, dy = event.clientY - drag.y;
        if (!drag.moved && Math.hypot(dx, dy) < CAMERA_RESPONSE.dragThreshold) return;
        drag.moved = true; suppressClick = true;
        canvas.setPointerCapture(event.pointerId);
        event.preventDefault();
        targetOffset.current.set(
          THREE.MathUtils.clamp(drag.start.x - dx * response.unitsPerPixel, -response.limits.x, response.limits.x),
          THREE.MathUtils.clamp(drag.start.y + dy * response.unitsPerPixel, -response.limits.y, response.limits.y),
        );
      } else {
        if (event.pointerType !== "mouse" || reduced.current) return;
        const rect = canvas.getBoundingClientRect();
        targetOffset.current.set(
          THREE.MathUtils.clamp(2 * (event.clientX - rect.left) / rect.width - 1, -1, 1) * response.limits.x,
          THREE.MathUtils.clamp(1 - 2 * (event.clientY - rect.top) / rect.height, -1, 1) * response.limits.y,
        );
        clearTimeout(idle);
        idle = setTimeout(() => { targetOffset.current.set(0, 0); invalidate(); }, CAMERA_RESPONSE.idleMilliseconds);
      }
      invalidate();
    };
    const end = (event: PointerEvent) => { pointers.delete(event.pointerId); if (drag?.id === event.pointerId) release(); };
    const leave = () => { if (!touchControls) { targetOffset.current.set(0, 0); invalidate(); } };
    const click = (event: MouseEvent) => { if (suppressClick) { event.preventDefault(); event.stopImmediatePropagation(); suppressClick = false; } };
    const blur = () => { pointers.clear(); release(); leave(); };
    surface.addEventListener("pointerdown", down);
    surface.addEventListener("pointermove", move);
    surface.addEventListener("pointerleave", leave);
    canvas.addEventListener("click", click, true);
    canvas.addEventListener("lostpointercapture", end);
    window.addEventListener("pointerup", end); window.addEventListener("pointercancel", end); window.addEventListener("blur", blur);
    return () => {
      clearTimeout(idle); release();
      surface.removeEventListener("pointerdown", down); surface.removeEventListener("pointermove", move); surface.removeEventListener("pointerleave", leave);
      canvas.removeEventListener("click", click, true);
      canvas.removeEventListener("lostpointercapture", end);
      window.removeEventListener("pointerup", end); window.removeEventListener("pointercancel", end); window.removeEventListener("blur", blur);
    };
  }, [getThree, active, controlsEnabled, response,touchControls, invalidate]);
  useEffect(() => {
    if (!active || !touchControls) return;
    const focusLandmark = (event: Event) => {
      if (!overview.current || animation.current) return;
      const name: unknown = (event as CustomEvent).detail;
      if (typeof name !== "string" || !/^map-(topics|champions|calculator|records)$/.test(name)) return;
      const label = document.querySelector<HTMLElement>(`[data-tutorial="${name}"]`);
      if (!label) return;
      const kind = name.slice(4) as "topics" | "champions" | "calculator" | "records";
      const frame = worldFrame(size.width, size.height, playableProjectionBounds());
      const point = new THREE.Vector3(...sitePosition(kind))
        .add(new THREE.Vector3(0, (LANDMARK_BOUNDS[kind][1] + LANDMARK_LABEL_LIFT) * LANDMARK_SCALE, 0))
        .applyAxisAngle(new THREE.Vector3(0, 1, 0), frame.rotation)
        .multiplyScalar(frame.scale).add(new THREE.Vector3(...frame.position)).project(getThree().camera);
      const labelX = (point.x * .5 + .5) * size.width;
      const labelY = (-point.y * .5 + .5) * size.height - label.offsetHeight / 2 - 9;
      const guide = document.querySelector<HTMLElement>("[data-tutorial-dialog]")?.getBoundingClientRect();
      const sideSheet = guide && guide.left > size.width * .4 && guide.top < size.height * .3;
      const desiredX = sideSheet ? guide.left / 2 : size.width / 2;
      const usableBottom = guide && !sideSheet ? guide.top : size.height;
      const desiredY = Math.max(headerInset + 48, (headerInset + usableBottom) / 2);
      targetOffset.current.set(
        THREE.MathUtils.clamp(offset.current.x + (labelX - desiredX) * response.unitsPerPixel, -response.limits.x, response.limits.x),
        THREE.MathUtils.clamp(offset.current.y + (desiredY - labelY) * response.unitsPerPixel, -response.limits.y, response.limits.y),
      );
      invalidate();
    };
    window.addEventListener("suri:tutorial-map-focus", focusLandmark);
    return () => window.removeEventListener("suri:tutorial-map-focus", focusLandmark);
  }, [active, response,touchControls, size, headerInset, invalidate, getThree]);
  useLayoutEffect(()=>{
    if(!command||!active||size.width<2||size.height<2)return;
    if (lastCommand.current === command.id && !animation.current) return;
    const remaining = lastCommand.current === command.id && animation.current
      ? Math.max(0, animation.current.duration - animation.current.elapsed) : undefined;
    lastCommand.current = command.id;
    const {camera}=getThree();
    overview.current = false;
    offset.current.set(0, 0); targetOffset.current.set(0, 0);
    let to=response.position.clone(),toZoom=response.zoom,toQuaternion=camera.quaternion.clone();
    if (command.kind === "overview") {
      const overviewCamera = new THREE.PerspectiveCamera();
      overviewCamera.position.set(...CAMERA_POSITION);
      overviewCamera.lookAt(...CAMERA_TARGET);
      toQuaternion = overviewCamera.quaternion;
    }
    if(command.kind==="island"&&command.site&&command.site in SITES){
      const frame=worldFrame(size.width,size.height,playableProjectionBounds());
      const point=new THREE.Vector3(...sitePosition(command.site as keyof typeof SITES))
        .applyAxisAngle(new THREE.Vector3(0,1,0),frame.rotation).multiplyScalar(frame.scale).add(new THREE.Vector3(...frame.position));
      // Every focused route must finish at the exact pose its retained
      // close-up canvas uses. Treating one as an ordinary island makes its
      // handoff feel slower and causes a visible jump when that canvas takes
      // over.
      const close = isFocusedIsland(command.site);
      if (close) point.y += 3.2 * frame.scale;
      const pose=islandCameraPose(point, close ? { close: true, worldScale: frame.scale } : undefined);
      to=pose.position;toZoom=pose.zoom;toQuaternion=pose.quaternion;
    }
    const reduced=window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const focusedIsland = isFocusedIsland(command.site);
    animation.current={elapsed:0,duration:reduced||command.instant?0:remaining ?? command.duration ?? (command.kind==="overview"?RETURN_DURATION:focusedIsland ?TOPICS_APPROACH_DURATION:ZOOM_DURATION),
      from:camera.position.clone(),to,fromZoom:camera.zoom,toZoom,fromQuaternion:camera.quaternion.clone(),toQuaternion,done:command.onComplete};
    invalidate();
  },[command,getThree,size.width,size.height,invalidate,response,active]);
  useFrame((_,delta)=>{
    if(!active||size.width<2||size.height<2)return;
    const motion=animation.current;
    if (!motion) {
      if (!active || !overview.current || !controlsEnabled) return;
      offset.current.lerp(targetOffset.current, reduced.current ? 1 : 1 - Math.exp(-CAMERA_RESPONSE.damping * delta));
      const {camera}=getThree();
      applyOverviewPose(camera,response,offset.current);
      if (offset.current.distanceToSquared(targetOffset.current) > 0.000001) invalidate();
      return;
    }
    if(!active)return;
    motion.elapsed+=Math.min(delta,0.05);
    const t=motion.duration?Math.min(1,motion.elapsed/motion.duration):1;
    const {camera}=getThree();
    camera.position.lerpVectors(motion.from,motion.to,cameraEase(t));
    camera.zoom=THREE.MathUtils.lerp(motion.fromZoom,motion.toZoom,cameraEase(t));
    camera.quaternion.slerpQuaternions(motion.fromQuaternion,motion.toQuaternion,cameraEase(t));
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
    if(t===1){animation.current=null;overview.current=command?.kind === "overview";motion.done();}
    else invalidate();
  }, -1);
  return null;
}
