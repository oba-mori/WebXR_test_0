console.log("Hello WebXR!!");

// Modules
import {Gltf2Node} from "./libs/threejs/render/nodes/gltf2.js";
import {InlineViewerHelper} from "./libs/threejs/util/inline-viewer-helper.js";
import {QueryArgs} from "./libs/threejs/util/query-args.js";
import {Renderer, createWebGLContext} from "./libs/threejs/render/core/renderer.js";
import {Scene} from "./libs/threejs/render/scenes/scene.js";
import {SkyboxNode} from "./libs/threejs/render/nodes/skybox.js";
import {WebXRButton} from "./libs/threejs/util/webxr-button.js";

const XR_SESSION_STRING = "immersive-ar";

window.onload = (e)=>{
	appendLog("Onload");
	startWebXR("./assets/gltf/space/space.gltf");// Start WebXR!!
}

function startWebXR(location){
	appendLog("startWebXR");

	// XR
	let xrButton            = null;
	let xrImmersiveRefSpace = null;
	let isXRAvailable       = false;

	// WebGL
	let gl                  = null;
	let renderer            = null;
	let scene               = new Scene();
	
	// GLTF
	let model               = new Gltf2Node({url: location.gltf});
	model.scale             = [0.1, 0.1, 0.1];
	scene.addNode(model);

	let all_previous_anchors = new Set();

	initXR();// Start the XR application.

	function initXR(){
		appendLog("initXR");

		// Button
		xrButton = new WebXRButton({
			onRequestSession: onRequestSession,
			onEndSession: onEndSession,
			textXRNotFoundTitle: "XR NOT FOUND",
			textEnterXRTitle: "START XR",
			textExitXRTitle: "EXIT  XR"
		});
		document.querySelector("#inner").appendChild(xrButton.domElement);

		if(navigator.xr){

			navigator.xr.isSessionSupported(XR_SESSION_STRING).then((supported)=>{
				isXRAvailable = supported;
				xrButton.enabled = supported;
				appendLog("isXRAvailable:" + supported);
			});

			navigator.xr.requestSession("inline").then(onSessionStarted);
		}
	}

	function onRequestSession(){
		appendLog("onRequestSession");
		return navigator.xr.requestSession(XR_SESSION_STRING, {requiredFeatures: ["anchors"]}).then((session)=>{
			session.isImmersive = true;
			xrButton.setSession(session);
			onSessionStarted(session);
		});
	}

	function onSessionStarted(session){
		appendLog("onSessionStarted");
		session.addEventListener("end", onSessionEnded);

		if(session.isImmersive) initGL();

		scene.inputRenderer.useProfileControllerMeshes(session);
		session.updateRenderState({baseLayer: new XRWebGLLayer(session, gl)});
		session.requestReferenceSpace("local").then((refSpace)=>{
			if(session.isImmersive) xrImmersiveRefSpace = refSpace;
			session.requestAnimationFrame(onXRFrame);
		});
	}

	function onEndSession(session){
		appendLog("onEndSession");
		session.end();
	}

	function onSessionEnded(event){
		appendLog("onSessionEnded");
		document.querySelector("#xrview").innerHTML = "";
		if(event.session.isImmersive) xrButton.setSession(null);
	}

	function initGL(){
		appendLog("initGL");

		if(gl) return;
		gl = createWebGLContext({xrCompatible: true});
		document.querySelector("#xrview").appendChild(gl.canvas);

		function onResize(){
			gl.canvas.width = gl.canvas.clientWidth * window.devicePixelRatio;
			gl.canvas.height = gl.canvas.clientHeight * window.devicePixelRatio;
		}
		window.addEventListener("resize", onResize);
		onResize();
		renderer = new Renderer(gl);
		scene.setRenderer(renderer);
	}

	function onXRFrame(t, frame){
		let session = frame.session;
		let xrRefSpace = xrImmersiveRefSpace;
		let pose = frame.getViewerPose(xrRefSpace);

		const tracked_anchors = frame.trackedAnchors;
		if(tracked_anchors){

			all_previous_anchors.forEach((anchor)=>{
				if(!tracked_anchors.has(anchor)){
					scene.removeNode(anchor.sceneObject);
				}
			});

			tracked_anchors.forEach((anchor)=>{
				const anchorPose = frame.getPose(anchor.anchorSpace, xrRefSpace);
				if(anchorPose){
					anchor.context.sceneObject.matrix = anchorPose.transform.matrix;
					anchor.context.sceneObject.visible = true;
				}else{
					anchor.context.sceneObject.visible = false;
				}
			});
			all_previous_anchors = tracked_anchors;

		}else{
			all_previous_anchors.forEach((anchor)=>{
				scene.removeNode(anchor.sceneObject);
			});
			all_previous_anchors = new Set();
		}
		
		scene.updateInputSources(frame, xrRefSpace);
		scene.startFrame();
		session.requestAnimationFrame(onXRFrame);
		scene.drawXRFrame(frame, pose);
		scene.endFrame();
	}  
}

function appendLog(str){
	let elem = document.createElement("li");
	elem.innerText = str;
	document.querySelector("#log ul").appendChild(elem);
}