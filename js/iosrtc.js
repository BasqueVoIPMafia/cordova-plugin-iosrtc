/**
 * Variables.
 */

var // Dictionary of MediaStreamRenderers.
	// - key: MediaStreamRenderer id.
	// - value: MediaStreamRenderer.
	mediaStreamRenderers = {},
	// Dictionary of MediaStreams.
	// - key: MediaStream blobId.
	// - value: MediaStream.
	mediaStreams = {},
	/**
	 * Dependencies.
	 */
	debug = require('debug')('iosrtc'),
	exec = require('cordova/exec'),
	domready = require('domready'),
	getUserMedia = require('./getUserMedia'),
	enumerateDevices = require('./enumerateDevices'),
	RTCPeerConnection = require('./RTCPeerConnection'),
	RTCSessionDescription = require('./RTCSessionDescription'),
	RTCIceCandidate = require('./RTCIceCandidate'),
	MediaDevices = require('./MediaDevices'),
	MediaStream = require('./MediaStream'),
	{ MediaStreamTrack } = require('./MediaStreamTrack'),
	videoElementsHandler = require('./videoElementsHandler'),
	{ RTCRtpTransceiver } = require('./RTCRtpTransceiver');

/**
 * Expose the iosrtc object.
 */
module.exports = {
	// Expose WebRTC classes and functions.
	getUserMedia: getUserMedia,
	enumerateDevices: enumerateDevices,
	getMediaDevices: enumerateDevices, // TMP
	RTCPeerConnection: RTCPeerConnection,
	RTCSessionDescription: RTCSessionDescription,
	RTCIceCandidate: RTCIceCandidate,
	MediaDevices: MediaDevices,
	MediaStream: MediaStream,
	MediaStreamTrack: MediaStreamTrack,

	// Expose a function to refresh current videos rendering a MediaStream.
	refreshVideos: videoElementsHandler.refreshVideos,

	// Expose a function to handle a video not yet inserted in the DOM.
	observeVideo: videoElementsHandler.observeVideo,

	// Select audio output (earpiece or speaker).
	selectAudioOutput: selectAudioOutput,

	// turnOnSpeaker with options
	turnOnSpeaker: turnOnSpeaker,

	// Checking permision (audio and camera)
	requestPermission: requestPermission,

	// Expose a function to initAudioDevices if needed, sets the audio session active
	initAudioDevices: initAudioDevices,

	// Expose a function to pollute window and naigator namespaces.
	registerGlobals: registerGlobals,

	// Expose the debug module.
	debug: require('debug'),

	// Debug function to see what happens internally.
	dump: dump,

	// Debug Stores to see what happens internally.
	mediaStreamRenderers: mediaStreamRenderers,
	mediaStreams: mediaStreams
};

domready(function () {
	// Let the MediaStream class and the videoElementsHandler share same MediaStreams container.
	MediaStream.setMediaStreams(mediaStreams);
	videoElementsHandler(mediaStreams, mediaStreamRenderers);

	// refreshVideos on device orientation change to resize peers video
	// while local video will resize du orientation change
	window.addEventListener('resize', function () {
		videoElementsHandler.refreshVideos();
	});
});

function selectAudioOutput(output) {
	debug('selectAudioOutput() | [output:"%s"]', output);

	switch (output) {
		case 'earpiece':
			exec(null, null, 'iosrtcPlugin', 'selectAudioOutputEarpiece', []);
			break;
		case 'speaker':
			exec(null, null, 'iosrtcPlugin', 'selectAudioOutputSpeaker', []);
			break;
		default:
			throw new Error('output must be "earpiece" or "speaker"');
	}
}

function turnOnSpeaker(isTurnOn) {
	debug('turnOnSpeaker() | [isTurnOn:"%s"]', isTurnOn);

	exec(null, null, 'iosrtcPlugin', 'RTCTurnOnSpeaker', [isTurnOn]);
}

function requestPermission(needMic, needCamera, callback) {
	debug('requestPermission() | [needMic:"%s", needCamera:"%s"]', needMic, needCamera);

	function ok() {
		callback(true);
	}

	function error() {
		callback(false);
	}
	exec(ok, error, 'iosrtcPlugin', 'RTCRequestPermission', [needMic, needCamera]);
}

function initAudioDevices() {
	debug('initAudioDevices()');

	exec(null, null, 'iosrtcPlugin', 'initAudioDevices', []);
}

function callbackifyMethod(originalMethod) {
	return function () {
		var success,
			failure,
			originalArgs = Array.prototype.slice.call(arguments);

		var callbackArgs = [];
		originalArgs.forEach(function (arg) {
			if (typeof arg === 'function') {
				if (!success) {
					success = arg;
				} else {
					failure = arg;
				}
			} else {
				callbackArgs.push(arg);
			}
		});

		var promiseResult = originalMethod.apply(this, callbackArgs);

		// Only apply then if callback success available
		if (typeof success === 'function') {
			promiseResult = promiseResult.then(success);
		}

		// Only apply catch if callback failure available
		if (typeof failure === 'function') {
			promiseResult = promiseResult.catch(failure);
		}

		return promiseResult;
	};
}

function callbackifyPrototype(proto, method) {
	var originalMethod = proto[method];
	proto[method] = callbackifyMethod(originalMethod);
}

function restoreCallbacksSupport() {
	debug('restoreCallbacksSupport()');
	getUserMedia = callbackifyMethod(getUserMedia);
	enumerateDevices = callbackifyMethod(enumerateDevices);
	callbackifyPrototype(RTCPeerConnection.prototype, 'createAnswer');
	callbackifyPrototype(RTCPeerConnection.prototype, 'createOffer');
	callbackifyPrototype(RTCPeerConnection.prototype, 'setRemoteDescription');
	callbackifyPrototype(RTCPeerConnection.prototype, 'setLocalDescription');
	callbackifyPrototype(RTCPeerConnection.prototype, 'addIceCandidate');
	callbackifyPrototype(RTCPeerConnection.prototype, 'getStats');
}

function registerGlobals(doNotRestoreCallbacksSupport) {
	debug('registerGlobals()');

	if (!global.navigator) {
		global.navigator = {};
	}

	// Restore Callback support
	if (!doNotRestoreCallbacksSupport) {
		restoreCallbacksSupport();
	}

	navigator.getUserMedia = getUserMedia;
	navigator.webkitGetUserMedia = getUserMedia;

	// Prevent WebRTC-adapter to overide navigator.mediaDevices after shim is applied since ios 14.3
	if (!(navigator.mediaDevices instanceof MediaDevices)) {
		Object.defineProperty(
			navigator,
			'mediaDevices',
			{
				value: new MediaDevices(),
				writable: false
			},
			{
				enumerable: false,
				configurable: false,
				writable: false,
				value: 'static'
			}
		);
	}

	// Prevent WebRTC-adapter to overide navigator.mediaDevices after shim is applied since ios 14.3
	Object.freeze(navigator.mediaDevices);

	window.RTCPeerConnection = RTCPeerConnection;
	window.webkitRTCPeerConnection = RTCPeerConnection;
	window.RTCSessionDescription = RTCSessionDescription;
	window.RTCIceCandidate = RTCIceCandidate;
	window.MediaStream = MediaStream;
	window.webkitMediaStream = MediaStream;
	window.MediaStreamTrack = MediaStreamTrack;
	window.RTCRtpTransceiver = RTCRtpTransceiver;

	// Apply CanvasRenderingContext2D.drawImage monkey patch
	var drawImage = CanvasRenderingContext2D.prototype.drawImage;
	CanvasRenderingContext2D.prototype.drawImage = (function () {
		// Methods to address the memory leaks problems in Safari
		let temporaryImage, imageElement;
		const BASE64_MARKER = ';base64,';
		const objectURL = window.URL || window.webkitURL;

		function convertDataURIToBlob(dataURI) {
			// Validate input data
			if (!dataURI) {
				return;
			}

			// Convert image (in base64) to binary data
			const base64Index = dataURI.indexOf(BASE64_MARKER) + BASE64_MARKER.length;
			const base64 = dataURI.substring(base64Index);
			const raw = window.atob(base64);
			const rawLength = raw.length;
			let array = new Uint8Array(new ArrayBuffer(rawLength));

			for (let i = 0; i < rawLength; i++) {
				array[i] = raw.charCodeAt(i);
			}

			// Create and return a new blob object using binary data
			return new Blob([array], { type: 'image/jpeg' });
		}

		return function (arg) {
			const context = this;
			let args = Array.prototype.slice.call(arguments);
			if (arg instanceof HTMLVideoElement && arg.render) {
				arg.render.save(function (base64Image) {
					// Destroy old image
					if (temporaryImage) {
						objectURL.revokeObjectURL(temporaryImage);
					}

					// Create a new image from binary data
					const imageDataBlob = convertDataURIToBlob(
						'data:image/jpg;base64,' + base64Image
					);

					// Create a new object URL object
					imageElement = imageElement || new Image();
					temporaryImage = objectURL.createObjectURL(imageDataBlob);

					imageElement.addEventListener('load', function () {
						args.splice(0, 1, imageElement);
						drawImage.apply(context, args);
					});

					// Set the new image
					imageElement.src = temporaryImage;
				});
			} else {
				return drawImage.apply(context, args);
			}
		};
	})();
}

function dump() {
	exec(null, null, 'iosrtcPlugin', 'dump', []);
}
