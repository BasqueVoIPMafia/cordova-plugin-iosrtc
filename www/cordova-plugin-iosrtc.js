/*
 * cordova-plugin-iosrtc v8.0.0
 * Cordova iOS plugin exposing the full WebRTC W3C JavaScript APIs
 * Copyright 2015-2017 eFace2Face, Inc. (https://eface2face.com)
 * Copyright 2015-2019 BasqueVoIPMafia (https://github.com/BasqueVoIPMafia)
 * Copyright 2017-2021 Cordova-RTC (https://github.com/cordova-rtc)
 * License MIT
 */

(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.iosrtc = f()}})(function(){var define,module,exports;return (function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(_dereq_,module,exports){
/**
 * Expose an object with WebRTC Errors.
 */
var Errors = (module.exports = {}),
	/**
	 * Local variables.
	 */
	IntermediateInheritor = function () {};

IntermediateInheritor.prototype = Error.prototype;

/**
 * Create error classes.
 */
addError('InvalidStateError');
addError('InvalidSessionDescriptionError');
addError('InternalError');
addError('MediaStreamError');

function addError(name) {
	Errors[name] = function () {
		var tmp = Error.apply(this, arguments);

		this.name = tmp.name = name;
		this.message = tmp.message;

		Object.defineProperty(this, 'stack', {
			get: function () {
				return tmp.stack;
			}
		});

		return this;
	};

	Errors[name].prototype = new IntermediateInheritor();
}

// Detect callback usage to assist 5.0.1 to 5.0.2 migration
// TODO remove on 6.0.0
Errors.detectDeprecatedCallbaksUsage = function detectDeprecatedCallbaksUsage(funcName, arg) {
	if (typeof arg[1] === 'function' || typeof arg[2] === 'function') {
		throw new Error(
			'Callbacks are not supported by "' + funcName + '" anymore, use Promise instead.'
		);
	}
};

},{}],2:[function(_dereq_,module,exports){
/**
 * Dependencies.
 */
var YaetiEventTarget = _dereq_('yaeti').EventTarget;

var EventTarget = function () {
	YaetiEventTarget.call(this);
};

EventTarget.prototype = Object.create(YaetiEventTarget.prototype);
EventTarget.prototype.constructor = EventTarget;

Object.defineProperties(
	EventTarget.prototype,
	Object.getOwnPropertyDescriptors(YaetiEventTarget.prototype)
);

EventTarget.prototype.dispatchEvent = function (event) {
	Object.defineProperty(event, 'target', {
		value: this,
		writable: false
	});

	YaetiEventTarget.prototype.dispatchEvent.call(this, event);
};

/**
 * Expose the EventTarget class.
 */
module.exports = EventTarget;

},{"yaeti":31}],3:[function(_dereq_,module,exports){
/**
 * Expose the MediaDeviceInfo class.
 */
module.exports = MediaDeviceInfo;

function MediaDeviceInfo(data) {
	data = data || {};

	Object.defineProperties(this, {
		// MediaDeviceInfo spec.
		deviceId: {
			value: data.deviceId
		},
		kind: {
			value: data.kind
		},
		label: {
			value: data.label
		},
		groupId: {
			value: data.groupId || ''
		},
		// SourceInfo old spec.
		id: {
			value: data.deviceId
		},
		// Deprecated, but useful until there is an alternative
		facing: {
			value: ''
		}
	});
}

},{}],4:[function(_dereq_,module,exports){
/**
 * Expose the MediaDevices class.
 */
module.exports = MediaDevices;

/**
 * Spec: https://w3c.github.io/mediacapture-main/#dom-mediadevices
 */

/**
 * Dependencies.
 */
var EventTarget = _dereq_('./EventTarget'),
	getUserMedia = _dereq_('./getUserMedia'),
	enumerateDevices = _dereq_('./enumerateDevices');

function MediaDevices(data) {
	//ondevicechange
	//enumerateDevices
	//getDisplayMedia
	//getSupportedConstraints
	//getUserMedia

	var self = this;

	// Make this an EventTarget.
	EventTarget.call(self);

	data = data || {};
}

MediaDevices.prototype = Object.create(EventTarget.prototype);
MediaDevices.prototype.constructor = MediaDevices;

MediaDevices.prototype.getUserMedia = function (constraints) {
	return getUserMedia(constraints);
};

MediaDevices.prototype.enumerateDevices = function () {
	return enumerateDevices();
};

MediaDevices.prototype.getSupportedConstraints = function () {
	return {
		// Supported
		height: true,
		width: true,
		deviceId: true,
		frameRate: true,
		sampleRate: true,
		aspectRatio: true,
		// Not Supported
		autoGainControl: false,
		brightness: false,
		channelCount: false,
		colorTemperature: false,
		contrast: false,
		echoCancellation: false,
		exposureCompensation: false,
		exposureMode: false,
		exposureTime: false,
		facingMode: true,
		focusDistance: false,
		focusMode: false,
		groupId: false,
		iso: false,
		latency: false,
		noiseSuppression: false,
		pointsOfInterest: false,
		resizeMode: false,
		sampleSize: false,
		saturation: false,
		sharpness: false,
		torch: false,
		whiteBalanceMode: false,
		zoom: false
	};
};

},{"./EventTarget":2,"./enumerateDevices":19,"./getUserMedia":21}],5:[function(_dereq_,module,exports){
/**
 * Expose the MediaStream class.
 */
module.exports = MediaStream;

/**
 * Spec: http://w3c.github.io/mediacapture-main/#mediastream
 */

/**
 * Dependencies.
 */
var debug = _dereq_('debug')('iosrtc:MediaStream'),
	exec = _dereq_('cordova/exec'),
	EventTarget = _dereq_('./EventTarget'),
	{ MediaStreamTrack } = _dereq_('./MediaStreamTrack'),
	/**
	 * Local variables.
	 */

	// Dictionary of MediaStreams (provided via getMediaStreams() class method).
	// - key: MediaStream blobId.
	// - value: MediaStream.
	mediaStreams;

// TODO longer UUID like native call
// - "4021904575-2849079001-3048689102-1644344044-4021904575-2849079001-3048689102-1644344044"
function newMediaStreamId() {
	return window.crypto.getRandomValues(new Uint32Array(4)).join('-');
}

// Save original MediaStream
var originalMediaStream = window.MediaStream || window.Blob;
//var originalMediaStream = window.Blob;
var originalMediaStreamTrack = MediaStreamTrack.originalMediaStreamTrack;

/**
 * Expose the MediaStream class.
 */
function MediaStream(arg, id) {
	debug('new MediaStream(arg) | [arg:%o]', arg);

	// Detect native MediaStream usage
	// new MediaStream(originalMediaStream) // stream
	// new MediaStream(originalMediaStreamTrack[]) // tracks
	if (
		(!(arg instanceof window.Blob) &&
			arg instanceof originalMediaStream &&
			typeof arg.getBlobId === 'undefined') ||
		(Array.isArray(arg) && arg[0] instanceof originalMediaStreamTrack)
	) {
		return new originalMediaStream(arg);
	}

	// new MediaStream(MediaStream) // stream
	// new MediaStream(MediaStreamTrack[]) // tracks
	// new MediaStream() // empty

	id = id || newMediaStreamId();
	var blobId = 'MediaStream_' + id;

	// Extend returned MediaTream with custom MediaStream
	var stream;
	if (originalMediaStream !== window.Blob) {
		stream = new (Function.prototype.bind.apply(originalMediaStream.bind(this), []))();
	} else {
		// Fallback on Blob if originalMediaStream is not a MediaStream and Emulate EventTarget
		stream = new Blob([blobId], {
			type: 'stream'
		});

		var target = document.createTextNode(null);
		stream.addEventListener = target.addEventListener.bind(target);
		stream.removeEventListener = target.removeEventListener.bind(target);
		stream.dispatchEvent = target.dispatchEvent.bind(target);
	}

	Object.defineProperties(stream, Object.getOwnPropertyDescriptors(MediaStream.prototype));

	// Make it an EventTarget.
	EventTarget.call(stream);

	// Public atributes.
	stream._id = id || newMediaStreamId();
	stream._active = true;

	// Init Stream by Id
	exec(null, null, 'iosrtcPlugin', 'MediaStream_init', [stream.id]);

	// Public but internal attributes.
	stream.connected = false;

	stream._addedToConnection = false;

	// Private attributes.
	stream._audioTracks = {};
	stream._videoTracks = {};

	// Store the stream into the dictionary.
	stream._blobId = blobId;
	mediaStreams[stream._blobId] = stream;

	// Convert arg to array of tracks if possible
	if (arg instanceof MediaStream || arg instanceof MediaStream.originalMediaStream) {
		arg = arg.getTracks();
	}

	if (Array.isArray(arg)) {
		arg.forEach(function (track) {
			stream.addTrack(track);
		});
	} else if (typeof arg !== 'undefined') {
		throw new TypeError(
			"Failed to construct 'MediaStream': No matching constructor signature."
		);
	}

	function onResultOK(data) {
		onEvent.call(stream, data);
	}
	exec(onResultOK, null, 'iosrtcPlugin', 'MediaStream_setListener', [stream.id]);

	return stream;
}

MediaStream.prototype = Object.create(originalMediaStream.prototype, {
	id: {
		get: function () {
			return this._id;
		}
	},
	active: {
		get: function () {
			return this._active;
		}
	},
	// Backwards compatibility.
	label: {
		get: function () {
			return this._id;
		}
	},
	addedToConnection: {
		get: function () {
			return this._addedToConnection;
		},
		set: function (value) {
			this._addedToConnection = value;
		}
	}
});

Object.defineProperties(
	MediaStream.prototype,
	Object.getOwnPropertyDescriptors(EventTarget.prototype)
);

MediaStream.prototype.constructor = MediaStream;

// Static reference to original MediaStream
MediaStream.originalMediaStream = originalMediaStream;

/**
 * Class methods.
 */

MediaStream.setMediaStreams = function (_mediaStreams) {
	mediaStreams = _mediaStreams;
};

MediaStream.getMediaStreams = function () {
	return mediaStreams;
};

MediaStream.create = function (dataFromEvent) {
	debug('create() | [dataFromEvent:%o]', dataFromEvent);

	var trackId,
		track,
		stream = new MediaStream([], dataFromEvent.id);

	// We do not use addTrack to prevent false positive "ERROR: video track not added" and "ERROR: audio track not added"
	// cause the rtcMediaStream already has them internaly.

	for (trackId in dataFromEvent.audioTracks) {
		if (dataFromEvent.audioTracks.hasOwnProperty(trackId)) {
			track = new MediaStreamTrack(dataFromEvent.audioTracks[trackId]);

			stream._audioTracks[track.id] = track;

			addListenerForTrackEnded.call(stream, track);
		}
	}

	for (trackId in dataFromEvent.videoTracks) {
		if (dataFromEvent.videoTracks.hasOwnProperty(trackId)) {
			track = new MediaStreamTrack(dataFromEvent.videoTracks[trackId]);

			stream._videoTracks[track.id] = track;

			addListenerForTrackEnded.call(stream, track);
		}
	}

	return stream;
};

MediaStream.prototype.getBlobId = function () {
	return this._blobId;
};

MediaStream.prototype.getAudioTracks = function () {
	debug('getAudioTracks()');

	var tracks = [],
		id;

	for (id in this._audioTracks) {
		if (this._audioTracks.hasOwnProperty(id)) {
			tracks.push(this._audioTracks[id]);
		}
	}

	return tracks;
};

MediaStream.prototype.getVideoTracks = function () {
	debug('getVideoTracks()');

	var tracks = [],
		id;

	for (id in this._videoTracks) {
		if (this._videoTracks.hasOwnProperty(id)) {
			tracks.push(this._videoTracks[id]);
		}
	}

	return tracks;
};

MediaStream.prototype.getTracks = function () {
	debug('getTracks()');

	var tracks = [],
		id;

	for (id in this._audioTracks) {
		if (this._audioTracks.hasOwnProperty(id)) {
			tracks.push(this._audioTracks[id]);
		}
	}

	for (id in this._videoTracks) {
		if (this._videoTracks.hasOwnProperty(id)) {
			tracks.push(this._videoTracks[id]);
		}
	}

	return tracks;
};

MediaStream.prototype.getTrackById = function (id) {
	debug('getTrackById()');

	return this._audioTracks[id] || this._videoTracks[id] || null;
};

MediaStream.prototype.addTrack = function (track) {
	debug('addTrack() [track:%o]', track);

	if (!(track instanceof MediaStreamTrack)) {
		throw new Error('argument must be an instance of MediaStreamTrack');
	}

	if (this._audioTracks[track.id] || this._videoTracks[track.id]) {
		return;
	}

	if (track.kind === 'audio') {
		this._audioTracks[track.id] = track;
	} else if (track.kind === 'video') {
		this._videoTracks[track.id] = track;
	} else {
		throw new Error('unknown kind attribute: ' + track.kind);
	}

	addListenerForTrackEnded.call(this, track);

	exec(null, null, 'iosrtcPlugin', 'MediaStream_addTrack', [this.id, track.id]);

	this.dispatchEvent(new Event('update'));

	this.emitConnected();
};

MediaStream.prototype.removeTrack = function (track) {
	debug('removeTrack() [track:%o]', track);

	if (!(track instanceof MediaStreamTrack)) {
		throw new Error('argument must be an instance of MediaStreamTrack');
	}

	if (!this._audioTracks[track.id] && !this._videoTracks[track.id]) {
		return;
	}

	if (track.kind === 'audio') {
		delete this._audioTracks[track.id];
	} else if (track.kind === 'video') {
		delete this._videoTracks[track.id];
	} else {
		throw new Error('unknown kind attribute: ' + track.kind);
	}

	exec(null, null, 'iosrtcPlugin', 'MediaStream_removeTrack', [this.id, track.id]);

	this.dispatchEvent(new Event('update'));

	checkActive.call(this);
};

MediaStream.prototype.clone = function () {
	var newStream = MediaStream();
	this.getTracks().forEach(function (track) {
		newStream.addTrack(track.clone());
	});

	return newStream;
};

// Backwards compatible API.
MediaStream.prototype.stop = function () {
	debug('stop()');

	var trackId;

	for (trackId in this._audioTracks) {
		if (this._audioTracks.hasOwnProperty(trackId)) {
			this._audioTracks[trackId].stop();
		}
	}

	for (trackId in this._videoTracks) {
		if (this._videoTracks.hasOwnProperty(trackId)) {
			this._videoTracks[trackId].stop();
		}
	}
};

// TODO: API methods and events.

/**
 * Private API.
 */

MediaStream.prototype.emitConnected = function () {
	debug('emitConnected()');

	var self = this;

	if (this.connected) {
		return;
	}
	this.connected = true;

	setTimeout(
		function (self) {
			var event = new Event('connected');
			Object.defineProperty(event, 'target', { value: self, enumerable: true });
			self.dispatchEvent(event);
		},
		0,
		self
	);
};

function addListenerForTrackEnded(track) {
	var self = this;

	track.addEventListener('ended', function () {
		if (track.kind === 'audio' && !self._audioTracks[track.id]) {
			return;
		} else if (track.kind === 'video' && !self._videoTracks[track.id]) {
			return;
		}

		checkActive.call(self);
	});
}

function checkActive() {
	// A MediaStream object is said to be active when it has at least one MediaStreamTrack
	// that has not ended. A MediaStream that does not have any tracks or only has tracks
	// that are ended is inactive.

	var self = this,
		trackId;

	if (!this.active) {
		return;
	}
	// Fixes Twilio fails to read a local video if the stream is released.
	if (this._addedToConnection) {
		return;
	}

	if (
		Object.keys(this._audioTracks).length === 0 &&
		Object.keys(this._videoTracks).length === 0
	) {
		debug('no tracks, releasing MediaStream');

		release();
		return;
	}

	for (trackId in this._audioTracks) {
		if (this._audioTracks.hasOwnProperty(trackId)) {
			if (this._audioTracks[trackId].readyState !== 'ended') {
				return;
			}
		}
	}

	for (trackId in this._videoTracks) {
		if (this._videoTracks.hasOwnProperty(trackId)) {
			if (this._videoTracks[trackId].readyState !== 'ended') {
				return;
			}
		}
	}

	release();

	function release() {
		debug('all tracks are ended, releasing MediaStream %s', self.id);
		self._active = false;
		self.dispatchEvent(new Event('inactive'));

		// Remove the stream from the dictionary.
		delete mediaStreams[self._blobId];

		exec(null, null, 'iosrtcPlugin', 'MediaStream_release', [self.id]);
	}
}

function onEvent(data) {
	var type = data.type,
		event,
		track;

	debug('onEvent() | [type:%s, data:%o]', type, data);

	switch (type) {
		case 'addtrack':
			// check if a track already exists before initializing a new
			// track and calling setListener again.
			if (data.track.kind === 'audio') {
				track = this._audioTracks[data.track.id];
			} else if (data.track.kind === 'video') {
				track = this._videoTracks[data.track.id];
			}
			if (!track) {
				track = new MediaStreamTrack(data.track);
				if (track.kind === 'audio') {
					this._audioTracks[track.id] = track;
				} else if (track.kind === 'video') {
					this._videoTracks[track.id] = track;
				}
				addListenerForTrackEnded.call(this, track);
			}

			event = new Event('addtrack');
			event.track = track;

			this.dispatchEvent(event);

			// Also emit 'update' for the MediaStreamRenderer.
			this.dispatchEvent(new Event('update'));
			break;

		case 'removetrack':
			if (data.track.kind === 'audio') {
				track = this._audioTracks[data.track.id];
				delete this._audioTracks[data.track.id];
			} else if (data.track.kind === 'video') {
				track = this._videoTracks[data.track.id];
				delete this._videoTracks[data.track.id];
			}

			if (!track) {
				throw new Error(
					'"removetrack" event fired on MediaStream for a non existing MediaStreamTrack'
				);
			}

			event = new Event('removetrack');
			event.track = track;

			this.dispatchEvent(event);

			// Also emit 'update' for the MediaStreamRenderer.
			this.dispatchEvent(new Event('update'));

			// Check whether the MediaStream still is active.
			checkActive.call(this);
			break;
	}
}

},{"./EventTarget":2,"./MediaStreamTrack":7,"cordova/exec":undefined,"debug":24}],6:[function(_dereq_,module,exports){
/**
 * Expose the MediaStreamRenderer class.
 */
module.exports = MediaStreamRenderer;

/**
 * Dependencies.
 */
var debug = _dereq_('debug')('iosrtc:MediaStreamRenderer'),
	exec = _dereq_('cordova/exec'),
	randomNumber = _dereq_('random-number').generator({ min: 10000, max: 99999, integer: true }),
	EventTarget = _dereq_('./EventTarget'),
	MediaStream = _dereq_('./MediaStream');

function MediaStreamRenderer(element) {
	debug('new() | [element:"%s"]', element);

	var self = this;

	// Make this an EventTarget.
	EventTarget.call(this);

	if (!(element instanceof HTMLElement)) {
		throw new Error('a valid HTMLElement is required');
	}

	// Public atributes.
	this.element = element;
	this.stream = undefined;
	this.videoWidth = undefined;
	this.videoHeight = undefined;

	// Private attributes.
	this.id = randomNumber();

	function onResultOK(data) {
		onEvent.call(self, data);
	}

	exec(onResultOK, null, 'iosrtcPlugin', 'new_MediaStreamRenderer', [this.id]);

	this.refresh();

	// TODO cause video resizing jiggling add semaphore
	//this.refreshInterval = setInterval(function () {
	//	self.refresh(self);
	//}, 500);

	element.render = this;
}

MediaStreamRenderer.prototype = Object.create(EventTarget.prototype);
MediaStreamRenderer.prototype.constructor = MediaStreamRenderer;

MediaStreamRenderer.prototype.render = function (stream) {
	debug('render() [stream:%o]', stream);

	var self = this;

	if (!(stream instanceof MediaStream.originalMediaStream)) {
		throw new Error('render() requires a MediaStream instance as argument');
	}

	self.stream = stream;

	exec(null, null, 'iosrtcPlugin', 'MediaStreamRenderer_render', [self.id, stream.id]);

	// Subscribe to 'update' event so we call native mediaStreamChanged() on it.
	stream.addEventListener('update', function () {
		if (self.stream !== stream) {
			return;
		}

		debug('MediaStream emits "update", calling native mediaStreamChanged()');

		exec(null, null, 'iosrtcPlugin', 'MediaStreamRenderer_mediaStreamChanged', [self.id]);
	});

	// Subscribe to 'inactive' event and emit "close" so the video element can react.
	stream.addEventListener('inactive', function () {
		if (self.stream !== stream) {
			return;
		}

		debug('MediaStream emits "inactive", emiting "close" and closing this MediaStreamRenderer');

		self.dispatchEvent(new Event('close'));
		self.close();
	});

	if (stream.connected) {
		connected();
	} else {
		// Otherwise subscribe to 'connected' event to emulate video elements events.
		stream.addEventListener('connected', function () {
			if (self.stream !== stream) {
				return;
			}

			connected();
		});
	}

	function connected() {
		// Emit video events.
		self.element.dispatchEvent(new Event('loadedmetadata'));
		self.element.dispatchEvent(new Event('loadeddata'));
		self.element.dispatchEvent(new Event('canplay'));
		self.element.dispatchEvent(new Event('canplaythrough'));
	}
};

MediaStreamRenderer.prototype.save = function (callback) {
	debug('save()');

	if (!this.stream) {
		callback(null);
		return;
	}

	function onResultOK(data) {
		callback(data);
	}

	function onResultError() {
		callback(null);
	}

	exec(onResultOK, onResultError, 'iosrtcPlugin', 'MediaStreamRenderer_save', [this.id]);
};

MediaStreamRenderer.prototype.refresh = function () {
	debug('refresh()');

	var elementPositionAndSize = getElementPositionAndSize.call(this),
		computedStyle,
		videoRatio,
		elementRatio,
		elementLeft = elementPositionAndSize.left,
		elementTop = elementPositionAndSize.top,
		elementWidth = elementPositionAndSize.width,
		elementHeight = elementPositionAndSize.height,
		videoViewWidth,
		videoViewHeight,
		visible,
		opacity,
		zIndex,
		mirrored,
		objectFit,
		clip,
		borderRadius,
		paddingTop,
		paddingBottom,
		paddingLeft,
		paddingRight,
		backgroundColorRgba,
		self = this;

	computedStyle = window.getComputedStyle(this.element);

	// get background color
	backgroundColorRgba = computedStyle.backgroundColor
		.replace(/rgba?\((.*)\)/, '$1')
		.split(',')
		.map(function (x) {
			return x.trim();
		});
	backgroundColorRgba[3] = '0';
	this.element.style.backgroundColor = 'rgba(' + backgroundColorRgba.join(',') + ')';
	backgroundColorRgba.length = 3;

	// get padding values
	paddingTop = parseInt(computedStyle.paddingTop) | 0;
	paddingBottom = parseInt(computedStyle.paddingBottom) | 0;
	paddingLeft = parseInt(computedStyle.paddingLeft) | 0;
	paddingRight = parseInt(computedStyle.paddingRight) | 0;

	// fix position according to padding
	elementLeft += paddingLeft;
	elementTop += paddingTop;

	// fix width and height according to padding
	elementWidth -= paddingLeft + paddingRight;
	elementHeight -= paddingTop + paddingBottom;

	videoViewWidth = elementWidth;
	videoViewHeight = elementHeight;

	// visible
	if (computedStyle.visibility === 'hidden') {
		visible = false;
	} else {
		visible = !!this.element.offsetHeight; // Returns 0 if element or any parent is hidden.
	}

	// opacity
	opacity = parseFloat(computedStyle.opacity);

	// zIndex
	zIndex = parseFloat(computedStyle.zIndex) || parseFloat(this.element.style.zIndex) || 0;

	// mirrored (detect "-webkit-transform: scaleX(-1);" or equivalent)
	if (
		computedStyle.transform === 'matrix(-1, 0, 0, 1, 0, 0)' ||
		computedStyle['-webkit-transform'] === 'matrix(-1, 0, 0, 1, 0, 0)'
	) {
		mirrored = true;
	} else {
		mirrored = false;
	}

	// objectFit ('contain' is set as default value)
	objectFit = computedStyle.objectFit || 'contain';

	// clip
	if (objectFit === 'none') {
		clip = false;
	} else {
		clip = true;
	}

	// borderRadius
	borderRadius = parseFloat(computedStyle.borderRadius);
	if (/%$/.test(borderRadius)) {
		borderRadius = Math.min(elementHeight, elementWidth) * borderRadius;
	}

	/**
	 * No video yet, so just update the UIView with the element settings.
	 */

	if (!this.videoWidth || !this.videoHeight) {
		debug('refresh() | no video track yet');

		nativeRefresh.call(this);
		return;
	}

	videoRatio = this.videoWidth / this.videoHeight;

	/**
	 * Element has no width and/or no height.
	 */

	if (!elementWidth || !elementHeight) {
		debug('refresh() | video element has 0 width and/or 0 height');

		nativeRefresh.call(this);
		return;
	}

	/**
	 * Set video view position and size.
	 */

	elementRatio = elementWidth / elementHeight;

	switch (objectFit) {
		case 'cover':
			// The element has higher or equal width/height ratio than the video.
			if (elementRatio >= videoRatio) {
				videoViewWidth = elementWidth;
				videoViewHeight = videoViewWidth / videoRatio;
			} else if (elementRatio < videoRatio) {
				// The element has lower width/height ratio than the video.
				videoViewHeight = elementHeight;
				videoViewWidth = videoViewHeight * videoRatio;
			}
			break;

		case 'fill':
			videoViewHeight = elementHeight;
			videoViewWidth = elementWidth;
			break;

		case 'none':
			videoViewHeight = this.videoHeight;
			videoViewWidth = this.videoWidth;
			break;

		case 'scale-down':
			// Same as 'none'.
			if (this.videoWidth <= elementWidth && this.videoHeight <= elementHeight) {
				videoViewHeight = this.videoHeight;
				videoViewWidth = this.videoWidth;
			} else {
				// Same as 'contain'.
				if (elementRatio >= videoRatio) {
					// The element has higher or equal width/height ratio than the video.
					videoViewHeight = elementHeight;
					videoViewWidth = videoViewHeight * videoRatio;
				} else if (elementRatio < videoRatio) {
					// The element has lower width/height ratio than the video.
					videoViewWidth = elementWidth;
					videoViewHeight = videoViewWidth / videoRatio;
				}
			}
			break;

		default:
			// 'contain'.
			objectFit = 'contain';
			if (elementRatio >= videoRatio) {
				// The element has higher or equal width/height ratio than the video.
				videoViewHeight = elementHeight;
				videoViewWidth = videoViewHeight * videoRatio;
			} else if (elementRatio < videoRatio) {
				// The element has lower width/height ratio than the video.
				videoViewWidth = elementWidth;
				videoViewHeight = videoViewWidth / videoRatio;
			}
			break;
	}

	nativeRefresh.call(this);

	function hash(str) {
		var hash = 5381,
			i = str.length;

		while (i) {
			hash = (hash * 33) ^ str.charCodeAt(--i);
		}

		return hash >>> 0;
	}

	function nativeRefresh() {
		var data = {
				elementLeft: Math.round(elementLeft),
				elementTop: Math.round(elementTop),
				elementWidth: Math.round(elementWidth),
				elementHeight: Math.round(elementHeight),
				videoViewWidth: Math.round(videoViewWidth),
				videoViewHeight: Math.round(videoViewHeight),
				visible: visible,
				backgroundColor: backgroundColorRgba.join(','),
				opacity: opacity,
				zIndex: zIndex,
				mirrored: mirrored,
				objectFit: objectFit,
				clip: clip,
				borderRadius: borderRadius
			},
			newRefreshCached = hash(JSON.stringify(data));

		if (newRefreshCached === self.refreshCached) {
			return;
		}

		self.refreshCached = newRefreshCached;

		debug('refresh() | [data:%o]', data);

		exec(null, null, 'iosrtcPlugin', 'MediaStreamRenderer_refresh', [this.id, data]);
	}
};

MediaStreamRenderer.prototype.close = function () {
	debug('close()');

	if (!this.stream) {
		return;
	}
	this.stream = undefined;

	exec(null, null, 'iosrtcPlugin', 'MediaStreamRenderer_close', [this.id]);
	if (this.refreshInterval) {
		clearInterval(this.refreshInterval);
		delete this.refreshInterval;
	}
};

/**
 * Private API.
 */

function onEvent(data) {
	var type = data.type,
		event;

	debug('onEvent() | [type:%s, data:%o]', type, data);

	switch (type) {
		case 'videoresize':
			this.videoWidth = data.size.width;
			this.videoHeight = data.size.height;
			this.refresh();

			event = new Event(type);
			event.videoWidth = data.size.width;
			event.videoHeight = data.size.height;
			this.dispatchEvent(event);

			break;
	}
}

function getElementPositionAndSize() {
	var rect = this.element.getBoundingClientRect();

	return {
		left: rect.left + this.element.clientLeft,
		top: rect.top + this.element.clientTop,
		width: this.element.clientWidth,
		height: this.element.clientHeight
	};
}

},{"./EventTarget":2,"./MediaStream":5,"cordova/exec":undefined,"debug":24,"random-number":29}],7:[function(_dereq_,module,exports){
/**
 * Expose the MediaStreamTrack class.
 */
module.exports.MediaStreamTrack = MediaStreamTrack;
module.exports.newMediaStreamTrackId = newMediaStreamTrackId;

/**
 * Spec: http://w3c.github.io/mediacapture-main/#mediastreamtrack
 */

/**
 * Dependencies.
 */
var debug = _dereq_('debug')('iosrtc:MediaStreamTrack'),
	exec = _dereq_('cordova/exec'),
	enumerateDevices = _dereq_('./enumerateDevices'),
	MediaTrackCapabilities = _dereq_('./MediaTrackCapabilities'),
	MediaTrackSettings = _dereq_('./MediaTrackSettings'),
	EventTarget = _dereq_('./EventTarget');

// Save original MediaStreamTrack
var originalMediaStreamTrack = window.MediaStreamTrack || function dummyMediaStreamTrack() {};

function newMediaStreamTrackId() {
	return window.crypto.getRandomValues(new Uint32Array(4)).join('-');
}

function MediaStreamTrack(dataFromEvent) {
	if (!dataFromEvent) {
		throw new Error('Illegal constructor');
	}

	debug('new() | [dataFromEvent:%o]', dataFromEvent);

	var self = this;

	// Make this an EventTarget.
	EventTarget.call(this);

	// Public atributes.
	this.id = dataFromEvent.id; // NOTE: It's a string.
	this.kind = dataFromEvent.kind;
	this.label = dataFromEvent.label;
	this.muted = false; // TODO: No "muted" property in ObjC API.
	this.capabilities = dataFromEvent.capabilities;
	this.readyState = dataFromEvent.readyState;

	// Private attributes.
	this._enabled = dataFromEvent.enabled;
	this._ended = false;

	this.dataFromEvent = dataFromEvent;

	function onResultOK(data) {
		onEvent.call(self, data);
	}

	exec(onResultOK, null, 'iosrtcPlugin', 'MediaStreamTrack_setListener', [this.id]);
}

MediaStreamTrack.prototype = Object.create(EventTarget.prototype);
MediaStreamTrack.prototype.constructor = MediaStreamTrack;

// Static reference to original MediaStreamTrack
MediaStreamTrack.originalMediaStreamTrack = originalMediaStreamTrack;

// Setters.
Object.defineProperty(MediaStreamTrack.prototype, 'enabled', {
	get: function () {
		return this._enabled;
	},
	set: function (value) {
		debug('enabled = %s', !!value);

		this._enabled = !!value;
		exec(null, null, 'iosrtcPlugin', 'MediaStreamTrack_setEnabled', [this.id, this._enabled]);
	}
});

MediaStreamTrack.prototype.getConstraints = function () {
	debug('MediaStreamTrack.prototype.getConstraints  is not implemented.');
	return {};
};

MediaStreamTrack.prototype.applyConstraints = function (constraints) {
	debug('MediaStreamTrack.prototype.applyConstraints  is not implemented.', constraints);
	return Promise.reject(new Error('applyConstraints is not implemented.'));
};

MediaStreamTrack.prototype.clone = function () {
	var newTrackId = newMediaStreamTrackId();

	exec(null, null, 'iosrtcPlugin', 'MediaStreamTrack_clone', [this.id, newTrackId]);

	return new MediaStreamTrack({
		id: newTrackId,
		kind: this.kind,
		label: this.label,
		readyState: this.readyState,
		enabled: this.enabled,
		trackId: this.dataFromEvent.trackId
	});
};

MediaStreamTrack.prototype.getCapabilities = function () {
	return new MediaTrackCapabilities(this.capabilities);
};

MediaStreamTrack.prototype.getSettings = function () {
	//throw new Error('Not implemented.');
	// SHAM
	return new MediaTrackSettings();
};

MediaStreamTrack.prototype.stop = function () {
	debug('stop()');

	if (this._ended) {
		return;
	}

	exec(null, null, 'iosrtcPlugin', 'MediaStreamTrack_stop', [this.id]);
};

// TODO: API methods and events.

/**
 * Class methods.
 */

MediaStreamTrack.getSources = function () {
	debug('getSources()');

	return enumerateDevices.apply(this, arguments);
};

/**
 * Private API.
 */

function onEvent(data) {
	var type = data.type;

	debug('onEvent() | [type:%s, data:%o]', type, data);

	switch (type) {
		case 'statechange':
			this.readyState = data.readyState;
			this._enabled = data.enabled;

			switch (data.readyState) {
				case 'initializing':
					break;
				case 'live':
					break;
				case 'ended':
					this._ended = true;
					this.dispatchEvent(new Event('ended'));
					break;
				case 'failed':
					break;
			}
			break;
	}
}

},{"./EventTarget":2,"./MediaTrackCapabilities":8,"./MediaTrackSettings":9,"./enumerateDevices":19,"cordova/exec":undefined,"debug":24}],8:[function(_dereq_,module,exports){
/**
 * Expose the MediaTrackSettings class.
 */
module.exports = MediaTrackCapabilities;

// Ref https://www.w3.org/TR/mediacapture-streams/#dom-mediatrackcapabilities
function MediaTrackCapabilities(data) {
	data = data || {};

	this.deviceId = data.deviceId;
}

},{}],9:[function(_dereq_,module,exports){
/**
 * Expose the MediaTrackSettings class.
 */
module.exports = MediaTrackSettings;

// Ref https://www.w3.org/TR/mediacapture-streams/#dom-mediatracksettings
function MediaTrackSettings(data) {
	data = data || {};
}

},{}],10:[function(_dereq_,module,exports){
/**
 * Expose the RTCDTMFSender class.
 */
module.exports = RTCDTMFSender;

/**
 * Dependencies.
 */
var debug = _dereq_('debug')('iosrtc:RTCDTMFSender'),
	debugerror = _dereq_('debug')('iosrtc:ERROR:RTCDTMFSender'),
	exec = _dereq_('cordova/exec'),
	randomNumber = _dereq_('random-number').generator({ min: 10000, max: 99999, integer: true }),
	EventTarget = _dereq_('./EventTarget');

debugerror.log = console.warn.bind(console);

function RTCDTMFSender(peerConnection, track) {
	var self = this;

	// Make this an EventTarget.
	EventTarget.call(this);

	debug('new() | [track:%o]', track);

	// Public atributes (accessed as read-only properties)
	this._track = track;
	// TODO: read these from the properties exposed in Swift?
	this._duration = 100;
	this._interToneGap = 70;
	this._toneBuffer = '';

	// Private attributes.
	this.peerConnection = peerConnection;
	this.dsId = randomNumber();

	function onResultOK(data) {
		onEvent.call(self, data);
	}

	exec(onResultOK, null, 'iosrtcPlugin', 'RTCPeerConnection_createDTMFSender', [
		this.peerConnection.pcId,
		this.dsId,
		this._track.id
	]);
}

RTCDTMFSender.prototype = Object.create(EventTarget.prototype);
RTCDTMFSender.prototype.constructor = RTCDTMFSender;

Object.defineProperty(RTCDTMFSender.prototype, 'canInsertDTMF', {
	get: function () {
		// TODO: check if it's muted or stopped?
		return this._track && this._track.kind === 'audio' && this._track.enabled;
	}
});

Object.defineProperty(RTCDTMFSender.prototype, 'track', {
	get: function () {
		return this._track;
	}
});

Object.defineProperty(RTCDTMFSender.prototype, 'duration', {
	get: function () {
		return this._duration;
	}
});

Object.defineProperty(RTCDTMFSender.prototype, 'interToneGap', {
	get: function () {
		return this._interToneGap;
	}
});

Object.defineProperty(RTCDTMFSender.prototype, 'toneBuffer', {
	get: function () {
		return this._toneBuffer;
	}
});

RTCDTMFSender.prototype.insertDTMF = function (tones, duration, interToneGap) {
	if (isClosed.call(this)) {
		return;
	}

	debug('insertDTMF() | [tones:%o, duration:%o, interToneGap:%o]', tones, duration, interToneGap);

	if (!tones) {
		return;
	}

	this._duration = duration || 100;
	this._interToneGap = interToneGap || 70;

	var self = this;

	function onResultOK(data) {
		onEvent.call(self, data);
	}

	exec(onResultOK, null, 'iosrtcPlugin', 'RTCPeerConnection_RTCDTMFSender_insertDTMF', [
		this.peerConnection.pcId,
		this.dsId,
		tones,
		this._duration,
		this._interToneGap
	]);
};

/**
 * Private API.
 */

function isClosed() {
	return this.peerConnection.signalingState === 'closed';
}

function onEvent(data) {
	var type = data.type,
		event;

	debug('onEvent() | [type:%s, data:%o]', type, data);

	if (type === 'tonechange') {
		event = new Event('tonechange');
		event.tone = data.tone;
		this.dispatchEvent(event);
	}
}

},{"./EventTarget":2,"cordova/exec":undefined,"debug":24,"random-number":29}],11:[function(_dereq_,module,exports){
(function (setImmediate){
/**
 * Expose the RTCDataChannel class.
 */
module.exports = RTCDataChannel;

/**
 * Dependencies.
 */
var debug = _dereq_('debug')('iosrtc:RTCDataChannel'),
	debugerror = _dereq_('debug')('iosrtc:ERROR:RTCDataChannel'),
	exec = _dereq_('cordova/exec'),
	randomNumber = _dereq_('random-number').generator({ min: 10000, max: 99999, integer: true }),
	EventTarget = _dereq_('./EventTarget');

debugerror.log = console.warn.bind(console);

function RTCDataChannel(peerConnection, label, options, dataFromEvent) {
	var self = this;

	// Make this an EventTarget.
	EventTarget.call(this);

	// Created via pc.createDataChannel().
	if (!dataFromEvent) {
		debug('new() | [label:%o, options:%o]', label, options);

		if (typeof label !== 'string') {
			label = '';
		}

		options = options || {};

		if (
			options.hasOwnProperty('maxPacketLifeTime') &&
			options.hasOwnProperty('maxRetransmits')
		) {
			throw new SyntaxError('both maxPacketLifeTime and maxRetransmits can not be present');
		}

		if (options.hasOwnProperty('id')) {
			if (typeof options.id !== 'number' || isNaN(options.id) || options.id < 0) {
				throw new SyntaxError('id must be a number');
			}
			// TODO:
			//   https://code.google.com/p/webrtc/issues/detail?id=4618
			if (options.id > 1023) {
				throw new SyntaxError(
					'id cannot be greater than 1023 (https://code.google.com/p/webrtc/issues/detail?id=4614)'
				);
			}
		}

		// Public atributes.
		this.label = label;
		this.ordered = options.hasOwnProperty('ordered') ? !!options.ordered : true;
		this.maxPacketLifeTime = options.hasOwnProperty('maxPacketLifeTime')
			? Number(options.maxPacketLifeTime)
			: null;
		this.maxRetransmits = options.hasOwnProperty('maxRetransmits')
			? Number(options.maxRetransmits)
			: null;
		this.protocol = options.hasOwnProperty('protocol') ? String(options.protocol) : '';
		this.negotiated = options.hasOwnProperty('negotiated') ? !!options.negotiated : false;
		this.id = options.hasOwnProperty('id') ? Number(options.id) : undefined;
		this.readyState = 'connecting';
		this.bufferedAmount = 0;
		this.bufferedAmountLowThreshold = 0;

		// Private attributes.
		this.peerConnection = peerConnection;
		this.dcId = randomNumber();

		exec(onResultOK, null, 'iosrtcPlugin', 'RTCPeerConnection_createDataChannel', [
			this.peerConnection.pcId,
			this.dcId,
			label,
			options
		]);
	} else {
		// Created via pc.ondatachannel.
		debug('new() | [dataFromEvent:%o]', dataFromEvent);

		// Public atributes.
		this.label = dataFromEvent.label;
		this.ordered = dataFromEvent.ordered;
		this.maxPacketLifeTime = dataFromEvent.maxPacketLifeTime;
		this.maxRetransmits = dataFromEvent.maxRetransmits;
		this.protocol = dataFromEvent.protocol;
		this.negotiated = dataFromEvent.negotiated;
		this.id = dataFromEvent.id;
		this.readyState = dataFromEvent.readyState;
		this.bufferedAmount = dataFromEvent.bufferedAmount;
		this.bufferedAmountLowThreshold = dataFromEvent.bufferedAmountLowThreshold;

		// Private attributes.
		this.peerConnection = peerConnection;
		this.dcId = dataFromEvent.dcId;

		exec(onResultOK, null, 'iosrtcPlugin', 'RTCPeerConnection_RTCDataChannel_setListener', [
			this.peerConnection.pcId,
			this.dcId
		]);
	}

	function onResultOK(data) {
		if (data.type) {
			onEvent.call(self, data);
		} else {
			// Special handler for received binary message.
			onEvent.call(self, {
				type: 'message',
				message: data
			});
		}
	}
}

RTCDataChannel.prototype = Object.create(EventTarget.prototype);
RTCDataChannel.prototype.constructor = RTCDataChannel;

// Just 'arraybuffer' binaryType is implemented in Chromium.
Object.defineProperty(RTCDataChannel.prototype, 'binaryType', {
	get: function () {
		return 'arraybuffer';
	},
	set: function (type) {
		if (type !== 'arraybuffer') {
			throw new Error('just "arraybuffer" is implemented for binaryType');
		}
	}
});

RTCDataChannel.prototype.send = function (data) {
	if (isClosed.call(this) || this.readyState !== 'open') {
		return;
	}

	debug('send() | [data:%o]', data);

	if (!data) {
		return;
	}

	setImmediate(() => {
		if (typeof data === 'string' || data instanceof String) {
			exec(null, null, 'iosrtcPlugin', 'RTCPeerConnection_RTCDataChannel_sendString', [
				this.peerConnection.pcId,
				this.dcId,
				data
			]);
		} else if (window.ArrayBuffer && data instanceof window.ArrayBuffer) {
			exec(null, null, 'iosrtcPlugin', 'RTCPeerConnection_RTCDataChannel_sendBinary', [
				this.peerConnection.pcId,
				this.dcId,
				data
			]);
		} else if (
			(window.Int8Array && data instanceof window.Int8Array) ||
			(window.Uint8Array && data instanceof window.Uint8Array) ||
			(window.Uint8ClampedArray && data instanceof window.Uint8ClampedArray) ||
			(window.Int16Array && data instanceof window.Int16Array) ||
			(window.Uint16Array && data instanceof window.Uint16Array) ||
			(window.Int32Array && data instanceof window.Int32Array) ||
			(window.Uint32Array && data instanceof window.Uint32Array) ||
			(window.Float32Array && data instanceof window.Float32Array) ||
			(window.Float64Array && data instanceof window.Float64Array) ||
			(window.DataView && data instanceof window.DataView)
		) {
			exec(null, null, 'iosrtcPlugin', 'RTCPeerConnection_RTCDataChannel_sendBinary', [
				this.peerConnection.pcId,
				this.dcId,
				data.buffer
			]);
		} else {
			throw new Error('invalid data type');
		}
	});
};

RTCDataChannel.prototype.close = function () {
	if (isClosed.call(this)) {
		return;
	}

	debug('close()');

	this.readyState = 'closing';

	exec(null, null, 'iosrtcPlugin', 'RTCPeerConnection_RTCDataChannel_close', [
		this.peerConnection.pcId,
		this.dcId
	]);
};

/**
 * Private API.
 */

function isClosed() {
	return (
		this.readyState === 'closed' ||
		this.readyState === 'closing' ||
		this.peerConnection.signalingState === 'closed'
	);
}

function onEvent(data) {
	var type = data.type,
		event;

	debug('onEvent() | [type:%s, data:%o]', type, data);

	switch (type) {
		case 'new':
			// Update properties and exit without firing the event.
			this.ordered = data.channel.ordered;
			this.maxPacketLifeTime = data.channel.maxPacketLifeTime;
			this.maxRetransmits = data.channel.maxRetransmits;
			this.protocol = data.channel.protocol;
			this.negotiated = data.channel.negotiated;
			this.id = data.channel.id;
			this.readyState = data.channel.readyState;
			this.bufferedAmount = data.channel.bufferedAmount;
			break;

		case 'statechange':
			this.readyState = data.readyState;

			switch (data.readyState) {
				case 'connecting':
					break;
				case 'open':
					this.dispatchEvent(new Event('open'));
					break;
				case 'closing':
					break;
				case 'closed':
					this.dispatchEvent(new Event('close'));
					break;
			}
			break;

		case 'message':
			event = new Event('message');
			event.data = data.message;
			this.dispatchEvent(event);
			break;

		case 'bufferedamount':
			this.bufferedAmount = data.bufferedAmount;

			if (
				this.bufferedAmountLowThreshold > 0 &&
				this.bufferedAmountLowThreshold > this.bufferedAmount
			) {
				event = new Event('bufferedamountlow');
				event.bufferedAmount = this.bufferedAmount;
				this.dispatchEvent(event);
			}

			break;
	}
}

}).call(this,_dereq_("timers").setImmediate)
},{"./EventTarget":2,"cordova/exec":undefined,"debug":24,"random-number":29,"timers":30}],12:[function(_dereq_,module,exports){
/**
 * Expose the RTCIceCandidate class.
 */
module.exports = RTCIceCandidate;

/**
* RFC-5245: http://tools.ietf.org/html/rfc5245#section-15.1
*
* candidate-attribute   = "candidate" ":" foundation SP component-id SP
                           transport SP
                           priority SP
                           connection-address SP     ;from RFC 4566
                           port         ;port from RFC 4566
                           SP cand-type
                           [SP rel-addr]
                           [SP rel-port]
                           *(SP extension-att-name SP
                                extension-att-value)
*
* foundation            = 1*32ice-char
* component-id          = 1*5DIGIT
* transport             = "UDP" / transport-extension
* transport-extension   = token              ; from RFC 3261
* priority              = 1*10DIGIT
* cand-type             = "typ" SP candidate-types
* candidate-types       = "host" / "srflx" / "prflx" / "relay" / token
* rel-addr              = "raddr" SP connection-address
* rel-port              = "rport" SP port
* extension-att-name    = byte-string    ;from RFC 4566
* extension-att-value   = byte-string
* ice-char              = ALPHA / DIGIT / "+" / "/"
*/

/**
* RFC-3261: https://tools.ietf.org/html/rfc3261#section-25.1
*
* token          =  1*(alphanum / "-" / "." / "!" / "%" / "*"
                     / "_" / "+" / "`" / "'" / "~" )
*/

/*
* RFC-4566: https://tools.ietf.org/html/rfc4566#section-9
*
* port =                1*DIGIT
* IP4-address =         b1 3("." decimal-uchar)
* b1 =                  decimal-uchar
                         ; less than "224"
* ; The following is consistent with RFC 2373 [30], Appendix B.
* IP6-address =         hexpart [ ":" IP4-address ]
* hexpart =             hexseq / hexseq "::" [ hexseq ] /
                         "::" [ hexseq ]
* hexseq  =             hex4 *( ":" hex4)
* hex4    =             1*4HEXDIG
* decimal-uchar =       DIGIT
                         / POS-DIGIT DIGIT
                         / ("1" 2*(DIGIT))
                         / ("2" ("0"/"1"/"2"/"3"/"4") DIGIT)
                         / ("2" "5" ("0"/"1"/"2"/"3"/"4"/"5"))
*/

var candidateToJson = (function () {
	var candidateFieldName = {
		FOUNDATION: 'foundation',
		COMPONENT_ID: 'componentId',
		TRANSPORT: 'transport',
		PRIORITY: 'priority',
		CONNECTION_ADDRESS: 'connectionAddress',
		PORT: 'port',
		CANDIDATE_TYPE: 'candidateType',
		REMOTE_CANDIDATE_ADDRESS: 'remoteConnectionAddress',
		REMOTE_CANDIDATE_PORT: 'remotePort'
	};

	var candidateType = {
		HOST: 'host',
		SRFLX: 'srflx',
		PRFLX: 'prflx',
		RELAY: 'relay'
	};

	var transport = {
		TCP: 'TCP',
		UDP: 'UDP'
	};

	var IPV4SEG = '(?:25[0-5]|(?:2[0-4]|1{0,1}[0-9]){0,1}[0-9])';
	var IPV4ADDR = `(?:${IPV4SEG}\\.){3}${IPV4SEG}`;
	var IPV6SEG = '[0-9a-fA-F]{1,4}';
	var IPV6ADDR =
		`(?:${IPV6SEG}:){7,7}${IPV6SEG}|` + // 1:2:3:4:5:6:7:8
		`(?:${IPV6SEG}:){1,7}:|` + // 1::                              1:2:3:4:5:6:7::
		`(?:${IPV6SEG}:){1,6}:${IPV6SEG}|` + // 1::8             1:2:3:4:5:6::8  1:2:3:4:5:6::8
		`(?:${IPV6SEG}:){1,5}(?::${IPV6SEG}){1,2}|` + // 1::7:8           1:2:3:4:5::7:8  1:2:3:4:5::8
		`(?:${IPV6SEG}:){1,4}(?::${IPV6SEG}){1,3}|` + // 1::6:7:8         1:2:3:4::6:7:8  1:2:3:4::8
		`(?:${IPV6SEG}:){1,3}(?::${IPV6SEG}){1,4}|` + // 1::5:6:7:8       1:2:3::5:6:7:8  1:2:3::8
		`(?:${IPV6SEG}:){1,2}(?::${IPV6SEG}){1,5}|` + // 1::4:5:6:7:8     1:2::4:5:6:7:8  1:2::8
		`${IPV6SEG}:(?:(?::${IPV6SEG}){1,6})|` + // 1::3:4:5:6:7:8   1::3:4:5:6:7:8  1::8
		`:(?:(?::${IPV6SEG}){1,7}|:)|` + // ::2:3:4:5:6:7:8  ::2:3:4:5:6:7:8 ::8       ::
		`fe80:(?::${IPV6SEG}){0,4}%[0-9a-zA-Z]{1,}|` + // fe80::7:8%eth0   fe80::7:8%1     (link-local IPv6 addresses with zone index)
		`::(?:ffff(?::0{1,4}){0,1}:){0,1}${IPV4ADDR}|` + // ::255.255.255.255   ::ffff:255.255.255.255  ::ffff:0:255.255.255.255 (IPv4-mapped IPv6 addresses and IPv4-translated addresses)
		`(?:${IPV6SEG}:){1,4}:${IPV4ADDR}`; // 2001:db8:3:4::192.0.2.33  64:ff9b::192.0.2.33 (IPv4-Embedded IPv6 Address)

	var TOKEN = "[0-9a-zA-Z\\-\\.!\\%\\*_\\+\\`\\'\\~]+";

	var CANDIDATE_TYPE = '';
	Object.keys(candidateType).forEach(function (key) {
		CANDIDATE_TYPE += candidateType[key] + '|';
	});
	CANDIDATE_TYPE += TOKEN;

	var pattern = {
		COMPONENT_ID: '[0-9]{1,5}',
		FOUNDATION: '[a-zA-Z0-9\\+\\/\\-]+',
		PRIORITY: '[0-9]{1,10}',
		TRANSPORT: transport.UDP + '|' + TOKEN,
		CONNECTION_ADDRESS: IPV4ADDR + '|' + IPV6ADDR,
		PORT: '[0-9]{1,5}',
		CANDIDATE_TYPE: CANDIDATE_TYPE
	};

	return function candidateToJson(iceCandidate) {
		var iceCandidateJson = null;

		if (iceCandidate && typeof iceCandidate === 'string') {
			var ICE_CANDIDATE_PATTERN = new RegExp(
				`candidate:(${pattern.FOUNDATION})` + // 10
					`\\s(${pattern.COMPONENT_ID})` + // 1
					`\\s(${pattern.TRANSPORT})` + // UDP
					`\\s(${pattern.PRIORITY})` + // 1845494271
					`\\s(${pattern.CONNECTION_ADDRESS})` + // 13.93.107.159
					`\\s(${pattern.PORT})` + // 53705
					'\\s' +
					'typ' +
					`\\s(${pattern.CANDIDATE_TYPE})` + // typ prflx
					'(?:\\s' +
					'raddr' +
					`\\s(${pattern.CONNECTION_ADDRESS})` + // raddr 10.1.221.7
					'\\s' +
					'rport' +
					`\\s(${pattern.PORT}))?` // rport 54805
			);

			var iceCandidateFields = iceCandidate.match(ICE_CANDIDATE_PATTERN);
			if (iceCandidateFields) {
				iceCandidateJson = {};
				Object.keys(candidateFieldName).forEach(function (key, i) {
					// i+1 because match returns the entire match result
					// and the parentheses-captured matched results.
					if (iceCandidateFields.length > i + 1 && iceCandidateFields[i + 1]) {
						iceCandidateJson[candidateFieldName[key]] = iceCandidateFields[i + 1];
					}
				});
			}
		}

		return iceCandidateJson;
	};
})();

// See https://developer.mozilla.org/en-US/docs/Web/API/RTCIceCandidate/RTCIceCandidate
function RTCIceCandidate(data) {
	data = data || {};

	// Public atributes.
	this.sdpMid = data.sdpMid;
	this.sdpMLineIndex = data.sdpMLineIndex;
	this.candidate = data.candidate;

	// Parse candidate SDP:
	// Example: candidate:1829696681 1 udp 2122262783 2a01:cb05:8d3e:a300:e1ad:79c1:7096:8ba0 49778 typ host generation 0 ufrag c9L6 network-id 2 network-cost 10
	var iceCandidateFields = candidateToJson(this.candidate);
	if (iceCandidateFields) {
		this.foundation = iceCandidateFields.foundation;
		this.component = iceCandidateFields.componentId;
		this.priority = iceCandidateFields.priority;
		this.type = iceCandidateFields.candidateType;

		this.address = iceCandidateFields.connectionAddress;
		this.ip = iceCandidateFields.connectionAddress;
		this.protocol = iceCandidateFields.transport;
		this.port = iceCandidateFields.port;

		this.relatedAddress = iceCandidateFields.remoteConnectionAddress || null;
		this.relatedPort = iceCandidateFields.remotePort || null;
	}
}

},{}],13:[function(_dereq_,module,exports){
(function (global){
/**
 * Expose the RTCPeerConnection class.
 */
module.exports = RTCPeerConnection;

/**
 * Dependencies.
 */
var debug = _dereq_('debug')('iosrtc:RTCPeerConnection'),
	debugerror = _dereq_('debug')('iosrtc:ERROR:RTCPeerConnection'),
	exec = _dereq_('cordova/exec'),
	randomNumber = _dereq_('random-number').generator({ min: 10000, max: 99999, integer: true }),
	EventTarget = _dereq_('./EventTarget'),
	RTCSessionDescription = _dereq_('./RTCSessionDescription'),
	RTCIceCandidate = _dereq_('./RTCIceCandidate'),
	RTCDataChannel = _dereq_('./RTCDataChannel'),
	RTCDTMFSender = _dereq_('./RTCDTMFSender'),
	RTCRtpReceiver = _dereq_('./RTCRtpReceiver'),
	RTCRtpSender = _dereq_('./RTCRtpSender'),
	{ RTCRtpTransceiver, addTransceiverToPeerConnection } = _dereq_('./RTCRtpTransceiver'),
	RTCStatsReport = _dereq_('./RTCStatsReport'),
	MediaStream = _dereq_('./MediaStream'),
	{ MediaStreamTrack, newMediaStreamTrackId } = _dereq_('./MediaStreamTrack'),
	Errors = _dereq_('./Errors');

debugerror.log = console.warn.bind(console);

function deprecateWarning(method, newMethod) {
	if (!newMethod) {
		console.warn(method + ' is deprecated.');
	} else {
		console.warn(method + ' method is deprecated, use ' + newMethod + ' instead.');
	}
}

function RTCPeerConnection(pcConfig, pcConstraints) {
	debug('new() | [pcConfig:%o, pcConstraints:%o]', pcConfig, pcConstraints);

	var self = this;

	// Make this an EventTarget.
	EventTarget.call(this);

	// Restore corrupted RTCPeerConnection.prototype
	// TODO find why webrtc-adapter prevent events onnegotiationneeded to be trigger.
	// Object.defineProperties(this, RTCPeerConnection.prototype_descriptor);

	// Fix webrtc-adapter bad SHIM on addTrack causing error when original does support multiple streams.
	// NotSupportedError: The adapter.js addTrack, addStream polyfill only supports a single stream which is associated with the specified track.
	Object.defineProperty(this, 'addTrack', RTCPeerConnection.prototype_descriptor.addTrack);
	Object.defineProperty(this, 'addStream', RTCPeerConnection.prototype_descriptor.addStream);
	Object.defineProperty(
		this,
		'getLocalStreams',
		RTCPeerConnection.prototype_descriptor.getLocalStreams
	);
	Object.defineProperty(
		this,
		'addTransceiver',
		RTCPeerConnection.prototype_descriptor.addTransceiver
	);
	Object.defineProperty(
		this,
		'getOrCreateTrack',
		RTCPeerConnection.prototype_descriptor.getOrCreateTrack
	);

	// Public atributes.
	this._localDescription = null;
	this.remoteDescription = null;
	this.signalingState = 'stable';
	this.iceGatheringState = 'new';
	this.iceConnectionState = 'new';
	this.pcConfig = fixPcConfig(pcConfig);

	// Private attributes.
	this.pcId = randomNumber();
	this.localStreams = {};
	this.remoteStreams = {};

	this.tracks = {};
	this.transceivers = [];

	function onResultOK(data) {
		onEvent.call(self, data);
	}

	exec(onResultOK, null, 'iosrtcPlugin', 'new_RTCPeerConnection', [
		this.pcId,
		this.pcConfig,
		pcConstraints
	]);
}

RTCPeerConnection.prototype = Object.create(EventTarget.prototype);
RTCPeerConnection.prototype.constructor = RTCPeerConnection;

Object.defineProperties(RTCPeerConnection.prototype, {
	localDescription: {
		// Fix webrtc-adapter TypeError: Attempting to change the getter of an unconfigurable property.
		configurable: true,
		get: function () {
			return this._localDescription;
		}
	},
	connectionState: {
		get: function () {
			return this.iceConnectionState;
		}
	},
	onicecandidate: {
		// Fix webrtc-adapter TypeError: Attempting to change the getter of an unconfigurable property.
		configurable: true,
		set: function (callback) {
			return this.addEventListener('icecandidate', callback);
		}
	},
	onaddstream: {
		// Fix webrtc-adapter TypeError: Attempting to change the getter of an unconfigurable property.
		configurable: true,
		set: function (callback) {
			return this.addEventListener('addstream', callback);
		}
	},
	ontrack: {
		// Fix webrtc-adapter TypeError: Attempting to change the getter of an unconfigurable property.
		configurable: true,
		set: function (callback) {
			return this.addEventListener('track', callback);
		}
	},
	oniceconnectionstatechange: {
		// Fix webrtc-adapter TypeError: Attempting to change the getter of an unconfigurable property.
		configurable: true,
		set: function (callback) {
			return this.addEventListener('iceconnectionstatechange', callback);
		}
	},
	onnegotiationneeded: {
		// Fix webrtc-adapter TypeError: Attempting to change the getter of an unconfigurable property.
		configurable: true,
		set: function (callback) {
			return this.addEventListener('negotiationneeded', callback);
		}
	}
});

RTCPeerConnection.prototype.createOffer = function (options) {
	// Detect callback usage to assist 5.0.1 to 5.0.2 migration
	// TODO remove on 6.0.0
	Errors.detectDeprecatedCallbaksUsage('RTCPeerConnection.prototype.createOffer', arguments);

	var self = this;

	if (isClosed.call(this)) {
		return;
	}

	debug('createOffer() [options:%o]', options);

	return new Promise(function (resolve, reject) {
		function onResultOK(data) {
			if (isClosed.call(self)) {
				return;
			}

			if (data.transceivers) {
				self.updateTransceiversState(data.transceivers);
			}

			var desc = new RTCSessionDescription(data);

			debug('createOffer() | success [desc:%o]', desc);
			resolve(desc);
		}

		function onResultError(error) {
			if (isClosed.call(self)) {
				return;
			}

			debugerror('createOffer() | failure: %s', error);
			reject(new global.DOMException(error));
		}

		exec(onResultOK, onResultError, 'iosrtcPlugin', 'RTCPeerConnection_createOffer', [
			self.pcId,
			options
		]);
	});
};

RTCPeerConnection.prototype.createAnswer = function (options) {
	// Detect callback usage to assist 5.0.1 to 5.0.2 migration
	// TODO remove on 6.0.0
	Errors.detectDeprecatedCallbaksUsage('RTCPeerConnection.prototype.createAnswer', arguments);

	var self = this;

	if (isClosed.call(this)) {
		return;
	}

	debug('createAnswer() [options:%o]', options);

	return new Promise(function (resolve, reject) {
		function onResultOK(data) {
			if (isClosed.call(self)) {
				return;
			}

			if (data.transceivers) {
				self.updateTransceiversState(data.transceivers);
			}

			var desc = new RTCSessionDescription(data);

			debug('createAnswer() | success [desc:%o]', desc);
			resolve(desc);
		}

		function onResultError(error) {
			if (isClosed.call(self)) {
				return;
			}

			debugerror('createAnswer() | failure: %s', error);
			reject(new global.DOMException(error));
		}

		exec(onResultOK, onResultError, 'iosrtcPlugin', 'RTCPeerConnection_createAnswer', [
			self.pcId,
			options
		]);
	});
};

RTCPeerConnection.prototype.setLocalDescription = function (desc) {
	// Detect callback usage to assist 5.0.1 to 5.0.2 migration
	// TODO remove on 6.0.0
	Errors.detectDeprecatedCallbaksUsage(
		'RTCPeerConnection.prototype.setLocalDescription',
		arguments
	);

	var self = this;

	if (isClosed.call(this)) {
		return new Promise(function (resolve, reject) {
			reject(new Errors.InvalidStateError('peerconnection is closed'));
		});
	}

	// "This is no longer necessary, however; RTCPeerConnection.setLocalDescription() and other
	// methods which take SDP as input now directly accept an object conforming to the RTCSessionDescriptionInit dictionary,
	// so you don't have to instantiate an RTCSessionDescription yourself.""
	// Source: https://developer.mozilla.org/en-US/docs/Web/API/RTCSessionDescription/RTCSessionDescription#Example
	// Still we do instnanciate RTCSessionDescription, so internal object is used properly.

	if (!(desc instanceof RTCSessionDescription)) {
		desc = new RTCSessionDescription(desc);
	}

	return new Promise(function (resolve, reject) {
		function onResultOK(data) {
			if (isClosed.call(self)) {
				return;
			}

			if (data.transceivers) {
				self.updateTransceiversState(data.transceivers);
			}

			debug('setLocalDescription() | success');
			// Update localDescription.
			self._localDescription = new RTCSessionDescription(data);
			resolve();
		}

		function onResultError(error) {
			if (isClosed.call(self)) {
				return;
			}

			debugerror('setLocalDescription() | failure: %s', error);
			reject(
				new Errors.InvalidSessionDescriptionError('setLocalDescription() failed: ' + error)
			);
		}

		exec(onResultOK, onResultError, 'iosrtcPlugin', 'RTCPeerConnection_setLocalDescription', [
			self.pcId,
			desc
		]);
	});
};

RTCPeerConnection.prototype.setRemoteDescription = function (desc) {
	// Detect callback usage to assist 5.0.1 to 5.0.2 migration
	// TODO remove on 6.0.0
	Errors.detectDeprecatedCallbaksUsage(
		'RTCPeerConnection.prototype.setRemoteDescription',
		arguments
	);

	var self = this;

	if (isClosed.call(this)) {
		return new Promise(function (resolve, reject) {
			reject(new Errors.InvalidStateError('peerconnection is closed'));
		});
	}

	debug('setRemoteDescription() [desc:%o]', desc);

	// Remove extmap-allow-mixed sdp header
	if (desc && desc.sdp && desc.sdp.indexOf('\na=extmap-allow-mixed') !== -1) {
		desc = new RTCSessionDescription({
			type: desc.type,
			sdp: desc.sdp
				.split('\n')
				.filter((line) => {
					return line.trim() !== 'a=extmap-allow-mixed';
				})
				.join('\n')
		});
	}

	// "This is no longer necessary, however; RTCPeerConnection.setLocalDescription() and other
	// methods which take SDP as input now directly accept an object conforming to the RTCSessionDescriptionInit dictionary,
	// so you don't have to instantiate an RTCSessionDescription yourself.""
	// Source: https://developer.mozilla.org/en-US/docs/Web/API/RTCSessionDescription/RTCSessionDescription#Example
	// Still we do instnanciate RTCSessionDescription so internal object is used properly.

	if (!(desc instanceof RTCSessionDescription)) {
		desc = new RTCSessionDescription(desc);
	}

	return new Promise(function (resolve, reject) {
		function onResultOK(data) {
			if (isClosed.call(self)) {
				return;
			}

			if (data.transceivers) {
				self.updateTransceiversState(data.transceivers);
			}

			debug('setRemoteDescription() | success');
			// Update remoteDescription.
			self.remoteDescription = new RTCSessionDescription(data);
			resolve();
		}

		function onResultError(error) {
			if (isClosed.call(self)) {
				return;
			}

			debugerror('setRemoteDescription() | failure: %s', error);
			reject(
				new Errors.InvalidSessionDescriptionError('setRemoteDescription() failed: ' + error)
			);
		}

		exec(onResultOK, onResultError, 'iosrtcPlugin', 'RTCPeerConnection_setRemoteDescription', [
			self.pcId,
			desc
		]);
	});
};

RTCPeerConnection.prototype.addIceCandidate = function (candidate) {
	// Detect callback usage to assist 5.0.1 to 5.0.2 migration
	// TODO remove on 6.0.0
	Errors.detectDeprecatedCallbaksUsage('RTCPeerConnection.prototype.addIceCandidate', arguments);

	var self = this;

	if (isClosed.call(this)) {
		return new Promise(function (resolve, reject) {
			reject(new Errors.InvalidStateError('peerconnection is closed'));
		});
	}

	debug('addIceCandidate() | [candidate:%o]', candidate);

	if (typeof candidate !== 'object') {
		return new Promise(function (resolve, reject) {
			reject(
				new global.DOMException(
					'addIceCandidate() must be called with a RTCIceCandidate instance or RTCIceCandidateInit object as argument'
				)
			);
		});
	}

	return new Promise(function (resolve, reject) {
		function onResultOK(data) {
			if (isClosed.call(self)) {
				return;
			}

			debug('addIceCandidate() | success');
			// Update remoteDescription.
			if (self.remoteDescription && data.remoteDescription) {
				self.remoteDescription.type = data.remoteDescription.type;
				self.remoteDescription.sdp = data.remoteDescription.sdp;
			} else if (data.remoteDescription) {
				self.remoteDescription = new RTCSessionDescription(data.remoteDescription);
			}
			resolve();
		}

		function onResultError() {
			if (isClosed.call(self)) {
				return;
			}

			debugerror('addIceCandidate() | failure');
			reject(new global.DOMException('addIceCandidate() failed'));
		}

		exec(onResultOK, onResultError, 'iosrtcPlugin', 'RTCPeerConnection_addIceCandidate', [
			self.pcId,
			candidate
		]);
	});
};

RTCPeerConnection.prototype.getConfiguration = function () {
	debug('getConfiguration()');

	return this.pcConfig;
};

RTCPeerConnection.prototype.getLocalStreams = function () {
	debug('getLocalStreams()');
	deprecateWarning('getLocalStreams', 'getSenders');

	var streams = [],
		id;

	for (id in this.localStreams) {
		if (this.localStreams.hasOwnProperty(id)) {
			streams.push(this.localStreams[id]);
		}
	}

	return streams;
};

RTCPeerConnection.prototype.getRemoteStreams = function () {
	debug('getRemoteStreams()');
	deprecateWarning('getRemoteStreams', 'getReceivers');

	var streams = [],
		id;

	for (id in this.remoteStreams) {
		if (this.remoteStreams.hasOwnProperty(id)) {
			streams.push(this.remoteStreams[id]);
		}
	}

	return streams;
};

RTCPeerConnection.prototype.getReceivers = function () {
	return this.getTransceivers()
		.filter((transceiver) => !transceiver.stopped)
		.map((transceiver) => transceiver.receiver);
};

RTCPeerConnection.prototype.getSenders = function () {
	return this.getTransceivers()
		.filter((transceiver) => !transceiver.stopped)
		.map((transceiver) => transceiver.sender);
};

RTCPeerConnection.prototype.getTransceivers = function () {
	return this.transceivers;
};

RTCPeerConnection.prototype.addTrack = function (track, ...streams) {
	var stream = streams[0];

	if (isClosed.call(this)) {
		throw new Errors.InvalidStateError('peerconnection is closed');
	}

	// Add localStreams if missing
	// Disable to match browser behavior
	//stream = stream || Object.values(this.localStreams)[0] || new MediaStream();

	// Fix webrtc-adapter bad SHIM on addStream
	if (stream) {
		this.addStream(stream);
	}

	var transceiver = new RTCRtpTransceiver(this, {
		sender: new RTCRtpSender(this, {
			track: track
		}),
		receiver: new RTCRtpReceiver(this),
		direction: 'sendrecv',
		currentDirection: null,
		mid: null
	});

	for (var streamId in this.localStreams) {
		if (this.localStreams.hasOwnProperty(streamId)) {
			// Target provided stream argument or first added stream to group track
			if (!stream || (stream && stream.id === streamId)) {
				stream = this.localStreams[streamId];
				stream.addTrack(track);
				exec(null, null, 'iosrtcPlugin', 'RTCPeerConnection_addTrack', [
					this.pcId,
					track.id,
					transceiver._id,
					transceiver.receiver._id,
					transceiver.sender._id,
					streamId
				]);
				break;
			}
		}
	}

	// No Stream matched add track without stream
	if (!stream) {
		exec(null, null, 'iosrtcPlugin', 'RTCPeerConnection_addTrack', [
			this.pcId,
			track.id,
			transceiver._id,
			transceiver.receiver._id,
			transceiver.sender._id,
			null
		]);
	}

	this.getOrCreateTrack(track);

	this.transceivers.push(transceiver);

	return transceiver.sender;
};

RTCPeerConnection.prototype.removeTrack = function (sender) {
	var id, track, stream, hasTrack;

	if (!(sender instanceof RTCRtpSender)) {
		throw new Error('removeTrack() must be called with a RTCRtpSender instance as argument');
	}

	track = sender.track;

	function matchLocalTrack(localTrack) {
		return localTrack.id === track.id;
	}

	for (id in this.localStreams) {
		if (this.localStreams.hasOwnProperty(id)) {
			// Check if track is belong to stream
			hasTrack = this.localStreams[id].getTracks().filter(matchLocalTrack).length > 0;

			if (hasTrack) {
				stream = this.localStreams[id];
				stream.removeTrack(track);
				exec(null, null, 'iosrtcPlugin', 'RTCPeerConnection_removeTrack', [
					this.pcId,
					sender._id
				]);
				delete this.tracks[track.id];
				break;
			}
		}
	}

	// No Stream matched remove track without stream
	if (!stream) {
		for (id in this.tracks) {
			if (this.tracks.hasOwnProperty(id)) {
				if (track.id === id) {
					exec(null, null, 'iosrtcPlugin', 'RTCPeerConnection_removeTrack', [
						this.pcId,
						sender._id
					]);
					delete this.tracks[track.id];
				}
			}
		}
	}
};

RTCPeerConnection.prototype.getOrCreateTrack = function (trackInput) {
	var { id } = trackInput,
		existingTrack = this.tracks[id];

	if (existingTrack) {
		return existingTrack;
	}

	var track;
	if (trackInput instanceof MediaStreamTrack) {
		track = trackInput;
	} else {
		track = new MediaStreamTrack(trackInput);
	}

	this.tracks[id] = track;
	track.addEventListener('ended', () => {
		delete this.tracks[id];
	});

	return track;
};

RTCPeerConnection.prototype.addTransceiver = function (trackOrKind, init) {
	if (isClosed.call(this)) {
		throw new Errors.InvalidStateError('peerconnection is closed');
	}

	var kind,
		track = null,
		self = this,
		trackIdOrKind;
	if (trackOrKind instanceof MediaStreamTrack) {
		kind = trackOrKind.kind;
		track = trackOrKind;
		trackIdOrKind = trackOrKind.id;
	} else {
		if (!(trackOrKind === 'audio' || trackOrKind === 'video')) {
			throw new TypeError(
				'An invalid string was specified as trackOrKind. The string must be either "audio" or "video".'
			);
		}
		kind = trackOrKind;
		trackIdOrKind = trackOrKind;
	}

	var receiverTrackID = newMediaStreamTrackId();

	var receiver = new RTCRtpReceiver(this, {
		track: new MediaStreamTrack({
			id: receiverTrackID,
			kind,
			enabled: true,
			readyState: 'live',
			trackId: 'unknown'
		})
	});

	var sender = new RTCRtpSender(this, {
		track
	});

	var data = init || {};
	data.sender = sender;
	data.receiver = receiver;

	var transceiver = new RTCRtpTransceiver(this, data);

	this.transceivers.push(transceiver);

	var initJson = {};
	if (init && init.direction) {
		initJson.direction = init.direction;
	} else {
		initJson.direction = 'sendrecv';
	}

	if (init && init.sendEncodings) {
		initJson.sendEncodings = init.sendEncodings;
	}

	if (init && init.streams) {
		initJson.streams = init.streams.map((stream) => stream.id);
	} else {
		initJson.streams = [];
	}

	debug(
		'addTransceiver() [trackIdOrKind:%s, init:%o, initJson: %o]',
		trackIdOrKind,
		init,
		initJson
	);

	addTransceiverToPeerConnection(this, trackIdOrKind, initJson, transceiver)
		.then((update) => {
			self.updateTransceiversState(update.transceivers);
		})
		.catch((error) => {
			debugerror('addTransceiver() | failure: %s', error);
		});

	return transceiver;
};

RTCPeerConnection.prototype.updateTransceiversState = function (transceivers) {
	debug('updateTransceiversState()');
	this.transceivers = transceivers.map((transceiver) => {
		const existingTransceiver = this.transceivers.find(
			(localTransceiver) => localTransceiver._id === transceiver.id
		);

		if (existingTransceiver) {
			existingTransceiver.update(transceiver);
			return existingTransceiver;
		}

		return new RTCRtpTransceiver(this, transceiver);
	});
};

RTCPeerConnection.prototype.getStreamById = function (id) {
	debug('getStreamById()');

	return this.localStreams[id] || this.remoteStreams[id] || null;
};

RTCPeerConnection.prototype.addStream = function (stream) {
	var self = this;

	if (isClosed.call(this)) {
		throw new Errors.InvalidStateError('peerconnection is closed');
	}

	debug('addStream()');

	if (!(stream instanceof MediaStream.originalMediaStream)) {
		throw new Error('addStream() must be called with a MediaStream instance as argument');
	}

	if (this.localStreams[stream.id]) {
		debugerror('addStream() | given stream already in present in local streams');
		return;
	}

	this.localStreams[stream.id] = stream;

	stream.addedToConnection = true;

	stream.getTracks().forEach(function (track) {
		self.getOrCreateTrack(track);
	});

	exec(null, null, 'iosrtcPlugin', 'RTCPeerConnection_addStream', [this.pcId, stream.id]);
};

RTCPeerConnection.prototype.removeStream = function (stream) {
	var self = this;

	if (isClosed.call(this)) {
		throw new Errors.InvalidStateError('peerconnection is closed');
	}

	debug('removeStream()');

	if (!(stream instanceof MediaStream.originalMediaStream)) {
		throw new Error('removeStream() must be called with a MediaStream instance as argument');
	}

	if (!this.localStreams[stream.id]) {
		debugerror('removeStream() | given stream not present in local streams');
		return;
	}

	delete this.localStreams[stream.id];

	stream.getTracks().forEach(function (track) {
		delete self.tracks[track.id];
	});

	exec(null, null, 'iosrtcPlugin', 'RTCPeerConnection_removeStream', [this.pcId, stream.id]);
};

RTCPeerConnection.prototype.createDataChannel = function (label, options) {
	if (isClosed.call(this)) {
		throw new Errors.InvalidStateError('peerconnection is closed');
	}

	debug('createDataChannel() [label:%s, options:%o]', label, options);

	return new RTCDataChannel(this, label, options);
};

RTCPeerConnection.prototype.createDTMFSender = function (track) {
	if (isClosed.call(this)) {
		throw new Errors.InvalidStateError('peerconnection is closed');
	}

	debug('createDTMFSender() [track:%o]', track);

	return new RTCDTMFSender(this, track);
};

RTCPeerConnection.prototype.getStats = function (selector) {
	// Detect callback usage to assist 5.0.1 to 5.0.2 migration
	// TODO remove on 6.0.0
	Errors.detectDeprecatedCallbaksUsage('RTCPeerConnection.prototype.getStats', arguments);

	var self = this;

	if (selector && !(selector instanceof MediaStreamTrack)) {
		throw new Error(
			'getStats() must be called with null or a valid MediaStreamTrack instance as argument'
		);
	}

	if (isClosed.call(this)) {
		throw new Errors.InvalidStateError('peerconnection is closed');
	}

	// debug('getStats() [selector:%o]', selector);

	return new Promise(function (resolve, reject) {
		function onResultOK(array) {
			if (isClosed.call(self)) {
				return;
			}

			resolve(new RTCStatsReport(array));
		}

		function onResultError(error) {
			if (isClosed.call(self)) {
				return;
			}

			debugerror('getStats() | failure: %s', error);
			reject(new global.DOMException(error));
		}

		exec(onResultOK, onResultError, 'iosrtcPlugin', 'RTCPeerConnection_getStats', [
			self.pcId,
			selector ? selector.id : null
		]);
	});
};

RTCPeerConnection.prototype.close = function () {
	if (isClosed.call(this)) {
		return;
	}

	debug('close()');

	exec(null, null, 'iosrtcPlugin', 'RTCPeerConnection_close', [this.pcId]);
};

// Save current RTCPeerConnection.prototype
RTCPeerConnection.prototype_descriptor = Object.getOwnPropertyDescriptors(
	RTCPeerConnection.prototype
);

/**
 * Private API.
 */
function fixPcConfig(pcConfig) {
	if (!pcConfig) {
		return {
			iceServers: []
		};
	}

	var iceServers = pcConfig.iceServers,
		i,
		len,
		iceServer;

	if (!Array.isArray(iceServers)) {
		pcConfig.iceServers = [];
		return pcConfig;
	}

	for (i = 0, len = iceServers.length; i < len; i++) {
		iceServer = iceServers[i];

		// THe Objective-C wrapper of WebRTC is old and does not implement .urls.
		if (iceServer.url) {
			continue;
		} else if (Array.isArray(iceServer.urls)) {
			iceServer.url = iceServer.urls[0];
		} else if (typeof iceServer.urls === 'string') {
			iceServer.url = iceServer.urls;
		}
	}

	return pcConfig;
}

function isClosed() {
	return this.signalingState === 'closed';
}

function onEvent(data) {
	var type = data.type,
		self = this,
		event = new Event(type),
		dataChannel,
		transceiver,
		id;

	Object.defineProperty(event, 'target', { value: self, enumerable: true });

	debug('onEvent() | [type:%s, data:%o]', type, data);

	if (data.transceivers) {
		this.updateTransceiversState(data.transceivers);
	}

	switch (type) {
		case 'signalingstatechange':
			this.signalingState = data.signalingState;
			break;

		case 'icegatheringstatechange':
			this.iceGatheringState = data.iceGatheringState;
			break;

		case 'iceconnectionstatechange':
			this.iceConnectionState = data.iceConnectionState;

			// Emit "connected" on remote streams if ICE connected.
			if (data.iceConnectionState === 'connected') {
				for (id in this.remoteStreams) {
					if (this.remoteStreams.hasOwnProperty(id)) {
						this.remoteStreams[id].emitConnected();
					}
				}
			}
			break;

		case 'icecandidate':
			if (data.candidate) {
				event.candidate = new RTCIceCandidate(data.candidate);
			} else {
				event.candidate = null;
			}
			// Update _localDescription.
			if (this._localDescription && data.localDescription) {
				this._localDescription.type = data.localDescription.type;
				this._localDescription.sdp = data.localDescription.sdp;
			} else if (data.localDescription) {
				this._localDescription = new RTCSessionDescription(data.localDescription);
			}
			break;

		case 'negotiationneeded':
			break;

		case 'track':
			var track = (event.track = new MediaStreamTrack(data.track));
			event.receiver = new RTCRtpReceiver(self, { track: track });

			transceiver = this.transceivers.find((t) => t.receiver.track.id === track.id);
			event.transceiver = transceiver;
			event.streams = [];

			// Add stream only if available in case of Unified-Plan of track event without stream
			if (data.stream && data.streamId) {
				var stream = this.remoteStreams[data.streamId] || MediaStream.create(data.stream);
				event.streams.push(stream);
			}

			// Store remote track
			this.getOrCreateTrack(track);

			break;

		case 'addstream':
			// Append to the remote streams.
			this.remoteStreams[data.streamId] =
				this.remoteStreams[data.streamId] || MediaStream.create(data.stream);

			event.stream = this.remoteStreams[data.streamId];

			// Emit "connected" on the stream if ICE connected.
			if (
				this.iceConnectionState === 'connected' ||
				this.iceConnectionState === 'completed'
			) {
				event.stream.emitConnected();
			}
			break;

		case 'removestream':
			event.stream = this.remoteStreams[data.streamId];

			// Remove from the remote streams.
			delete this.remoteStreams[data.streamId];
			break;

		case 'datachannel':
			dataChannel = new RTCDataChannel(this, null, null, data.channel);
			event.channel = dataChannel;
			break;
	}

	this.dispatchEvent(event);
}

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"./Errors":1,"./EventTarget":2,"./MediaStream":5,"./MediaStreamTrack":7,"./RTCDTMFSender":10,"./RTCDataChannel":11,"./RTCIceCandidate":12,"./RTCRtpReceiver":14,"./RTCRtpSender":15,"./RTCRtpTransceiver":16,"./RTCSessionDescription":17,"./RTCStatsReport":18,"cordova/exec":undefined,"debug":24,"random-number":29}],14:[function(_dereq_,module,exports){
/**
 * Expose the RTCRtpReceiver class.
 */
module.exports = RTCRtpReceiver;

var randomNumber = _dereq_('random-number').generator({ min: 10000, max: 99999, integer: true });

function RTCRtpReceiver(pc, data) {
	data = data || {};
	this._id = data.id || randomNumber();

	this._pc = pc;
	this.track = data.track ? pc.getOrCreateTrack(data.track) : null;
	this.params = data.params || {};
}

RTCRtpReceiver.prototype.getParameters = function () {
	return this.params;
};

RTCRtpReceiver.prototype.getStats = function () {
	return this._pc.getStats();
};

RTCRtpReceiver.prototype.update = function ({ track, params }) {
	if (track) {
		this.track = this._pc.getOrCreateTrack(track);
	} else {
		this.track = null;
	}

	this.params = params;
};

},{"random-number":29}],15:[function(_dereq_,module,exports){
/**
 * Expose the RTCRtpSender class.
 */
module.exports = RTCRtpSender;

/**
 * Dependencies.
 */
var exec = _dereq_('cordova/exec'),
	MediaStreamTrack = _dereq_('./MediaStreamTrack'),
	randomNumber = _dereq_('random-number').generator({ min: 10000, max: 99999, integer: true });

function RTCRtpSender(pc, data) {
	data = data || {};
	this._id = data.id || randomNumber();

	this._pc = pc;
	this.track = data.track ? pc.getOrCreateTrack(data.track) : null;
	this.params = data.params || {};
}

RTCRtpSender.prototype.getParameters = function () {
	return this.params;
};

RTCRtpSender.prototype.getStats = function () {
	return this._pc.getStats();
};

RTCRtpSender.prototype.setParameters = function (params) {
	Object.assign(this.params, params);
	return new Promise((resolve, reject) => {
		function onResultOK(result) {
			resolve(result);
		}

		function onResultError(error) {
			reject(error);
		}

		exec(
			onResultOK,
			onResultError,
			'iosrtcPlugin',
			'RTCPeerConnection_RTCRtpSender_setParameters',
			[this._pc.pcId, this._id, params]
		);
	});
};

RTCRtpSender.prototype.replaceTrack = function (withTrack) {
	var self = this,
		pc = self._pc;

	return new Promise((resolve, reject) => {
		function onResultOK(result) {
			self.track = result.track ? new MediaStreamTrack(result.track) : null;
			resolve();
		}

		function onResultError(error) {
			reject(error);
		}

		var trackId = withTrack ? withTrack.id : null;

		exec(
			onResultOK,
			onResultError,
			'iosrtcPlugin',
			'RTCPeerConnection_RTCRtpSender_replaceTrack',
			[this._pc.pcId, this._id, trackId]
		);

		// https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection/negotiationneeded_event
		var event = new Event('negotiationneeded');
		pc.dispatchEvent(event);

		pc.addEventListener('signalingstatechange', function listener() {
			if (pc.signalingState === 'closed') {
				pc.removeEventListener('signalingstatechange', listener);
				reject();
			} else if (pc.signalingState === 'stable') {
				pc.removeEventListener('signalingstatechange', listener);
				resolve();
			}
		});
	});
};

RTCRtpSender.prototype.update = function ({ track, params }) {
	if (track) {
		this.track = this._pc.getOrCreateTrack(track);
	} else {
		this.track = null;
	}

	this.params = params;
};

},{"./MediaStreamTrack":7,"cordova/exec":undefined,"random-number":29}],16:[function(_dereq_,module,exports){
const RTCRtpSender = _dereq_('./RTCRtpSender');
const RTCRtpReceiver = _dereq_('./RTCRtpReceiver');

/**
 * Expose the RTCRtpTransceiver class.
 */
module.exports = { RTCRtpTransceiver, addTransceiverToPeerConnection };

/**
 * Dependencies.
 */
var debugerror = _dereq_('debug')('iosrtc:ERROR:RTCRtpTransceiver'),
	exec = _dereq_('cordova/exec'),
	randomNumber = _dereq_('random-number').generator({ min: 10000, max: 99999, integer: true }),
	EventTarget = _dereq_('./EventTarget');

debugerror.log = console.warn.bind(console);

function addTransceiverToPeerConnection(peerConnection, trackIdOrKind, init, transceiver) {
	return new Promise((resolve, reject) => {
		exec(onResultOK, reject, 'iosrtcPlugin', 'RTCPeerConnection_addTransceiver', [
			peerConnection.pcId,
			trackIdOrKind,
			init,
			transceiver._id,
			transceiver.sender ? transceiver.sender._id : 0,
			transceiver.receiver ? transceiver.receiver._id : 0,
			transceiver.receiver && transceiver.receiver.track
				? transceiver.receiver.track.id
				: null
		]);

		function onResultOK(data) {
			resolve(data);
		}
	});
}

function RTCRtpTransceiver(peerConnection, data) {
	data = data || {};

	this.peerConnection = peerConnection;

	this._id = data.id || randomNumber();
	this._receiver =
		data.receiver instanceof RTCRtpReceiver
			? data.receiver
			: new RTCRtpReceiver(peerConnection, data.receiver);
	this._sender =
		data.sender instanceof RTCRtpSender
			? data.sender
			: new RTCRtpSender(peerConnection, data.sender);
	this._stopped = false;

	if (data.mid) {
		this._mid = data.mid;
	} else {
		this._mid = null;
	}

	if (data.direction) {
		this._direction = data.direction;
		this._currentDirection = data.direction;
	} else {
		this._direction = 'sendrecv';
		this._currentDirection = 'sendrecv';
	}
}

RTCRtpTransceiver.prototype = Object.create(EventTarget.prototype);
RTCRtpTransceiver.prototype.constructor = RTCRtpTransceiver;

Object.defineProperties(RTCRtpTransceiver.prototype, {
	currentDirection: {
		get: function () {
			return this._currentDirection;
		}
	},
	direction: {
		get: function () {
			return this._direction;
		},
		set: function (direction) {
			var self = this;
			this._direction = direction;

			exec(
				onResultOK,
				null,
				'iosrtcPlugin',
				'RTCPeerConnection_RTCRtpTransceiver_setDirection',
				[this.peerConnection.pcId, this._id, direction]
			);

			function onResultOK(data) {
				self.peerConnection.updateTransceiversState(data.transceivers);
			}
		}
	},
	mid: {
		get: function () {
			return this._mid;
		}
	},
	receiver: {
		get: function () {
			return this._receiver;
		}
	},
	sender: {
		get: function () {
			return this._sender;
		}
	},
	stopped: {
		get: function () {
			return this._stopped;
		}
	},
	receiverId: {
		get: function () {
			return this._receiver.track.id;
		}
	}
});

RTCRtpTransceiver.prototype.stop = function () {
	var self = this;

	exec(onResultOK, null, 'iosrtcPlugin', 'RTCPeerConnection_RTCRtpTransceiver_stop', [
		this.peerConnection.pcId,
		this._id
	]);

	function onResultOK(data) {
		self.peerConnection.updateTransceiversState(data.transceivers);
	}
};

RTCRtpTransceiver.prototype.update = function (data) {
	if (data.direction) {
		this._direction = data.direction;
	}
	if (data.currentDirection) {
		this._currentDirection = data.currentDirection;
	}
	if (data.mid) {
		this._mid = data.mid;
	}

	this._stopped = data.stopped;

	this.receiver.update(data.receiver);
	this.sender.update(data.sender);
};

},{"./EventTarget":2,"./RTCRtpReceiver":14,"./RTCRtpSender":15,"cordova/exec":undefined,"debug":24,"random-number":29}],17:[function(_dereq_,module,exports){
/**
 * Expose the RTCSessionDescription class.
 */
module.exports = RTCSessionDescription;

function RTCSessionDescription(data) {
	data = data || {};

	// Public atributes.
	this.type = data.type;
	this.sdp = data.sdp;
}

},{}],18:[function(_dereq_,module,exports){
class RTCStatsReport {
	constructor(data) {
		const arr = data || [];
		this.data = {};
		arr.forEach((el) => {
			this.data[el.reportId] = el;
		});
		this.size = arr.length;
	}

	entries() {
		return this.keys().map((k) => [k, this.data[k]]);
	}

	keys() {
		return Object.getOwnPropertyNames(this.data);
	}

	values() {
		return this.keys().map((k) => this.data[k]);
	}

	get(key) {
		return this.data[key];
	}
}

/**
 * Expose the RTCStatsReport class.
 */
module.exports = RTCStatsReport;

},{}],19:[function(_dereq_,module,exports){
/**
 * Expose the enumerateDevices function.
 */
module.exports = enumerateDevices;

/**
 * Dependencies.
 */
var debug = _dereq_('debug')('iosrtc:enumerateDevices'),
	exec = _dereq_('cordova/exec'),
	MediaDeviceInfo = _dereq_('./MediaDeviceInfo'),
	Errors = _dereq_('./Errors');

function enumerateDevices() {
	// Detect callback usage to assist 5.0.1 to 5.0.2 migration
	// TODO remove on 6.0.0
	Errors.detectDeprecatedCallbaksUsage('cordova.plugins.iosrtc.enumerateDevices', arguments);

	return new Promise(function (resolve) {
		function onResultOK(data) {
			debug('enumerateDevices() | success');
			resolve(getMediaDeviceInfos(data.devices));
		}

		exec(onResultOK, null, 'iosrtcPlugin', 'enumerateDevices', []);
	});
}

/**
 * Private API.
 */

function getMediaDeviceInfos(devices) {
	debug('getMediaDeviceInfos() | [devices:%o]', devices);

	var id,
		mediaDeviceInfos = [];

	for (id in devices) {
		if (devices.hasOwnProperty(id)) {
			mediaDeviceInfos.push(new MediaDeviceInfo(devices[id]));
		}
	}

	return mediaDeviceInfos;
}

},{"./Errors":1,"./MediaDeviceInfo":3,"cordova/exec":undefined,"debug":24}],20:[function(_dereq_,module,exports){
/**
 * Expose the getDisplayMedia function.
 */
module.exports = getDisplayMedia;

/**
 * Dependencies.
 */
var debug = _dereq_('debug')('iosrtc:getDisplayMedia'),
	debugerror = _dereq_('debug')('iosrtc:ERROR:getDisplayMedia'),
	exec = _dereq_('cordova/exec'),
	MediaStream = _dereq_('./MediaStream'),
	Errors = _dereq_('./Errors');

function getDisplayMedia(constraints) {
	// Detect callback usage to assist 5.0.1 to 5.0.2 migration
	// TODO remove on 6.0.0
	Errors.detectDeprecatedCallbaksUsage('cordova.plugins.iosrtc.getDisplayMedia', arguments);

	debug('[original constraints:%o]', constraints);

	var newConstraints = {};

	if (
		typeof constraints !== 'object' ||
		(!constraints.hasOwnProperty('audio') && !constraints.hasOwnProperty('video'))
	) {
		return new Promise(function (resolve, reject) {
			reject(
				new Errors.MediaStreamError(
					'constraints must be an object with at least "audio" or "video" keys'
				)
			);
		});
	}

	debug('[computed constraints:%o]', newConstraints);

	return new Promise(function (resolve, reject) {
		function onResultOK(data) {
			debug('getDisplayMedia() | success');
			var stream = MediaStream.create(data.stream);
			resolve(stream);
			// Emit "connected" on the stream.
			stream.emitConnected();
		}

		function onResultError(error) {
			debugerror('getDisplayMedia() | failure: %s', error);
			reject(new Errors.MediaStreamError('getDisplayMedia() failed: ' + error));
		}

		exec(onResultOK, onResultError, 'iosrtcPlugin', 'getDisplayMedia', [newConstraints]);
	});
}

},{"./Errors":1,"./MediaStream":5,"cordova/exec":undefined,"debug":24}],21:[function(_dereq_,module,exports){
/**
 * Expose the getUserMedia function.
 */
module.exports = getUserMedia;

/**
 * Dependencies.
 */
var debug = _dereq_('debug')('iosrtc:getUserMedia'),
	debugerror = _dereq_('debug')('iosrtc:ERROR:getUserMedia'),
	exec = _dereq_('cordova/exec'),
	MediaStream = _dereq_('./MediaStream'),
	Errors = _dereq_('./Errors');

function isPositiveInteger(number) {
	return typeof number === 'number' && number >= 0 && number % 1 === 0;
}

function isPositiveFloat(number) {
	return typeof number === 'number' && number >= 0;
}

function getUserMedia(constraints) {
	// Detect callback usage to assist 5.0.1 to 5.0.2 migration
	// TODO remove on 6.0.0
	Errors.detectDeprecatedCallbaksUsage('cordova.plugins.iosrtc.getUserMedia', arguments);

	debug('[original constraints:%o]', constraints);

	var audioRequested = false,
		videoRequested = false,
		newConstraints = {};

	if (
		typeof constraints !== 'object' ||
		(!constraints.hasOwnProperty('audio') && !constraints.hasOwnProperty('video'))
	) {
		return new Promise(function (resolve, reject) {
			reject(
				new Errors.MediaStreamError(
					'constraints must be an object with at least "audio" or "video" keys'
				)
			);
		});
	}

	if (constraints.audio) {
		audioRequested = true;
	}

	if (constraints.video) {
		videoRequested = true;
	}

	// https://developer.mozilla.org/en-US/docs/Web/API/MediaTrackConstraints
	// Example:
	//
	// getUserMedia({
	//  audio: {
	//      deviceId: 'azer-asdf-zxcv',
	//  },
	//  video: {
	//      deviceId: 'qwer-asdf-zxcv',
	//      aspectRatio: 1.777.
	//      facingMode: 'user',
	//      width: {
	//          min: 400,
	//          max: 600
	//      },
	//      frameRate: {
	//          min: 1.0,
	//          max: 60.0
	//      }
	//  }
	// });

	/*
	// See: https://www.w3.org/TR/mediacapture-streams/#media-track-constraints
	dictionary MediaTrackConstraintSet {
	 ConstrainULong     width;
	 ConstrainULong     height;
	 ConstrainDouble    aspectRatio;
	 ConstrainDouble    frameRate;
	 ConstrainDOMString facingMode;
	 ConstrainDOMString resizeMode;
	 ConstrainULong     sampleRate;
	 ConstrainULong     sampleSize;
	 ConstrainBoolean   echoCancellation;
	 ConstrainBoolean   autoGainControl;
	 ConstrainBoolean   noiseSuppression;
	 ConstrainDouble    latency;
	 ConstrainULong     channelCount;
	 ConstrainDOMString deviceId;
	 ConstrainDOMString groupId;
	};

	 // typedef ([Clamp] unsigned long or ConstrainULongRange) ConstrainULong;
	 // We convert unsigned long to ConstrainULongRange.exact

	 dictionary ULongRange {
		[Clamp] unsigned long max;
		[Clamp] unsigned long min;
	 };

	 dictionary ConstrainULongRange : ULongRange {
		  [Clamp] unsigned long exact;
		  [Clamp] unsigned long ideal;
	 };

	 // See: https://www.w3.org/TR/mediacapture-streams/#dom-doublerange
	 // typedef (double or ConstrainDoubleRange) ConstrainDouble;
	 // We convert double to ConstrainDoubleRange.exact
	 dictionary ConstrainDouble {
		double max;
		double min;
	 };

	 dictionary ConstrainDoubleRange : DoubleRange {
		double exact;
		double ideal;
	 };

	 // typedef (boolean or ConstrainBooleanParameters) ConstrainBoolean;
	 dictionary ConstrainBooleanParameters {
		boolean exact;
		boolean ideal;
	 };

	 // typedef (DOMString or sequence<DOMString> or ConstrainDOMStringParameters) ConstrainDOMString;
	 // We convert DOMString to ConstrainDOMStringParameters.exact
	 dictionary ConstrainDOMStringParameters {
		(DOMString or sequence<DOMString>) exact;
		(DOMString or sequence<DOMString>) ideal;
	 };
	*/

	// Get video constraints
	if (videoRequested) {
		// Handle object video constraints
		newConstraints.video = {};

		// Handle Stupid not up-to-date webrtc-adapter
		// Note: Firefox [38+] does support a subset of constraints with getUserMedia(), but not the outdated syntax that Chrome and Opera are using.
		// The mandatory / optional syntax was deprecated a in 2014, and minWidth and minHeight the year before that.
		if (
			typeof constraints.video === 'object' &&
			(typeof constraints.video.optional === 'object' ||
				typeof constraints.video.mandatory === 'object')
		) {
			var videoConstraints = {};

			if (Array.isArray(constraints.video.optional)) {
				/*
				Example of constraints.video.optional:
					{
						"optional": [
							{
								"minWidth": 640
							},
							{
								"maxWidth": 640
							},
							{
								"minHeight": 480
							},
							{
								"maxHeight": 480
							},
							{
								"sourceId": "com.apple.avfoundation.avcapturedevice.built-in_video:0"
							}
						]
					}
				*/

				// Convert optional array to object
				Object.values(constraints.video.optional).forEach(function (optional) {
					var optionalConstraintName = Object.keys(optional)[0],
						optionalConstraintValue = optional[optionalConstraintName];
					videoConstraints[optionalConstraintName] = Array.isArray(
						optionalConstraintValue
					)
						? optionalConstraintValue[0]
						: optionalConstraintValue;
				});
			} else if (typeof constraints.video.mandatory === 'object') {
				videoConstraints = constraints.video.mandatory;
			}

			if (typeof videoConstraints.sourceId === 'string') {
				newConstraints.video.deviceId = {
					ideal: videoConstraints.sourceId
				};
			}

			if (isPositiveInteger(videoConstraints.minWidth)) {
				newConstraints.video.width = {
					min: videoConstraints.minWidth
				};
			}

			if (isPositiveInteger(videoConstraints.maxWidth)) {
				newConstraints.video.width = newConstraints.video.width || {};
				newConstraints.video.width.max = videoConstraints.maxWidth;
			}

			if (isPositiveInteger(videoConstraints.minHeight)) {
				newConstraints.video.height = {
					min: videoConstraints.minHeight
				};
			}

			if (isPositiveInteger(videoConstraints.maxHeight)) {
				newConstraints.video.height = newConstraints.video.height || {};
				newConstraints.video.height.max = videoConstraints.maxHeight;
			}

			if (isPositiveFloat(videoConstraints.minFrameRate)) {
				newConstraints.video.frameRate = {
					min: parseFloat(videoConstraints.minFrameRate, 10)
				};
			}

			if (isPositiveFloat(videoConstraints.maxFrameRate)) {
				newConstraints.video.frameRate = newConstraints.video.frameRate || {};
				newConstraints.video.frameRate.max = parseFloat(videoConstraints.maxFrameRate, 10);
			}
		}

		// Get requested video deviceId.
		if (typeof constraints.video.deviceId === 'string') {
			newConstraints.video.deviceId = {
				exact: constraints.video.deviceId
			};
		} else if (typeof constraints.video.sourceId === 'string') {
			// Also check video sourceId (mangled by adapter.js).
			newConstraints.video.deviceId = {
				exact: constraints.video.sourceId
			};
		} else if (typeof constraints.video.deviceId === 'object') {
			// Also check deviceId.(exact|ideal)
			if (!!constraints.video.deviceId.exact) {
				newConstraints.video.deviceId = {
					exact: Array.isArray(constraints.video.deviceId.exact)
						? constraints.video.deviceId.exact[0]
						: constraints.video.deviceId.exact
				};
			} else if (!!constraints.video.deviceId.ideal) {
				newConstraints.video.deviceId = {
					ideal: Array.isArray(constraints.video.deviceId.ideal)
						? constraints.video.deviceId.ideal[0]
						: constraints.video.deviceId.ideal
				};
			}
		}

		// Get requested width min/max, exact.
		if (typeof constraints.video.width === 'object') {
			newConstraints.video.width = {};
			if (isPositiveInteger(constraints.video.width.min)) {
				newConstraints.video.width.min = constraints.video.width.min;
			}
			if (isPositiveInteger(constraints.video.width.max)) {
				newConstraints.video.width.max = constraints.video.width.max;
			}
			if (isPositiveInteger(constraints.video.width.exact)) {
				newConstraints.video.width.exact = constraints.video.width.exact;
			}
			if (isPositiveInteger(constraints.video.width.ideal)) {
				newConstraints.video.width.ideal = constraints.video.width.ideal;
			}
		} else if (isPositiveInteger(constraints.video.width)) {
			// Get requested width long as exact
			newConstraints.video.width = {
				exact: constraints.video.width
			};
		}

		// Get requested height min/max, exact.
		if (typeof constraints.video.height === 'object') {
			newConstraints.video.height = {};
			if (isPositiveInteger(constraints.video.height.min)) {
				newConstraints.video.height.min = constraints.video.height.min;
			}
			if (isPositiveInteger(constraints.video.height.max)) {
				newConstraints.video.height.max = constraints.video.height.max;
			}
			if (isPositiveInteger(constraints.video.height.exact)) {
				newConstraints.video.height.exact = constraints.video.height.exact;
			}
			if (isPositiveInteger(constraints.video.height.ideal)) {
				newConstraints.video.height.ideal = constraints.video.height.ideal;
			}
		} else if (isPositiveInteger(constraints.video.height)) {
			// Get requested height long as exact
			newConstraints.video.height = {
				exact: constraints.video.height
			};
		}

		// Get requested frameRate min/max.
		if (typeof constraints.video.frameRate === 'object') {
			newConstraints.video.frameRate = {};
			if (isPositiveFloat(constraints.video.frameRate.min)) {
				newConstraints.video.frameRate.min = parseFloat(
					constraints.video.frameRate.min,
					10
				);
			}
			if (isPositiveFloat(constraints.video.frameRate.max)) {
				newConstraints.video.frameRate.max = parseFloat(
					constraints.video.frameRate.max,
					10
				);
			}
			if (isPositiveInteger(constraints.video.frameRate.exact)) {
				newConstraints.video.frameRate.exact = constraints.video.frameRate.exact;
			}
			if (isPositiveInteger(constraints.video.frameRate.ideal)) {
				newConstraints.video.frameRate.ideal = constraints.video.frameRate.ideal;
			}
		} else if (isPositiveFloat(constraints.video.frameRate)) {
			// Get requested frameRate double as exact
			newConstraints.video.frameRate = {
				exact: parseFloat(constraints.video.frameRate, 10)
			};
		}

		// get aspectRatio (e.g 1.7777777777777777)
		// TODO ConstrainDouble min, max
		if (typeof constraints.video.aspectRatio === 'object') {
			newConstraints.video.aspectRatio = {};
			if (isPositiveFloat(constraints.video.aspectRatio.min)) {
				newConstraints.video.aspectRatio.min = parseFloat(
					constraints.video.aspectRatio.min,
					10
				);
			}
			if (isPositiveFloat(constraints.video.aspectRatio.max)) {
				newConstraints.video.aspectRatio.max = parseFloat(
					constraints.video.aspectRatio.max,
					10
				);
			}
			if (isPositiveInteger(constraints.video.aspectRatio.exact)) {
				newConstraints.video.aspectRatio.exact = constraints.video.aspectRatio.exact;
			}
			if (isPositiveInteger(constraints.video.aspectRatio.ideal)) {
				newConstraints.video.aspectRatio.ideal = constraints.video.aspectRatio.ideal;
			}
		} else if (isPositiveFloat(constraints.video.aspectRatio)) {
			newConstraints.video.aspectRatio = {
				exact: parseFloat(constraints.video.aspectRatio, 10)
			};
		}

		// get facingMode (e.g environment, user)
		// TODO ConstrainDOMStringParameters ideal, exact
		if (typeof constraints.video.facingMode === 'string') {
			newConstraints.video.facingMode = {
				exact: constraints.video.facingMode
			};
		} else if (typeof constraints.video.facingMode === 'object') {
			if (typeof constraints.video.facingMode.exact === 'string') {
				newConstraints.video.facingMode = {
					exact: constraints.video.facingMode.exact
				};
			} else if (typeof constraints.video.facingMode.ideal === 'string') {
				newConstraints.video.facingMode = {
					ideal: constraints.video.facingMode.ideal
				};
			}
		}
	}

	// Get audio constraints
	if (audioRequested) {
		// Handle object audio constraints
		newConstraints.audio = {};

		// Handle Stupid not up-to-date webrtc-adapter
		// Note: Firefox [38+] does support a subset of constraints with getUserMedia(), but not the outdated syntax that Chrome and Opera are using.
		// The mandatory / optional syntax was deprecated a in 2014, and minWidth and minHeight the year before that.
		if (
			typeof constraints.audio === 'object' &&
			(typeof constraints.audio.optional === 'object' ||
				typeof constraints.audio.mandatory === 'object')
		) {
			if (typeof constraints.audio.optional === 'object') {
				if (typeof constraints.audio.optional.sourceId === 'string') {
					newConstraints.audio.deviceId = {
						ideal: constraints.audio.optional.sourceId
					};
				} else if (
					Array.isArray(constraints.audio.optional) &&
					typeof constraints.audio.optional[0] === 'object' &&
					typeof constraints.audio.optional[0].sourceId === 'string'
				) {
					newConstraints.audio.deviceId = {
						ideal: constraints.audio.optional[0].sourceId
					};
				}
			} else if (
				constraints.audio.mandatory &&
				typeof constraints.audio.mandatory.sourceId === 'string'
			) {
				newConstraints.audio.deviceId = {
					exact: constraints.audio.mandatory.sourceId
				};
			}
		}

		// Get requested audio deviceId.
		if (typeof constraints.audio.deviceId === 'string') {
			newConstraints.audio.deviceId = {
				exact: constraints.audio.deviceId
			};
		} else if (typeof constraints.audio.sourceId === 'string') {
			// Also check audio sourceId (mangled by adapter.js).
			newConstraints.audio.deviceId = {
				exact: constraints.audio.sourceId
			};
		} else if (typeof constraints.audio.deviceId === 'object') {
			// Also check deviceId.(exact|ideal)
			if (!!constraints.audio.deviceId.exact) {
				newConstraints.audio.deviceId = {
					exact: Array.isArray(constraints.audio.deviceId.exact)
						? constraints.audio.deviceId.exact[0]
						: constraints.audio.deviceId.exact
				};
			} else if (!!constraints.audio.deviceId.ideal) {
				newConstraints.audio.deviceId = {
					ideal: Array.isArray(constraints.audio.deviceId.ideal)
						? constraints.audio.deviceId.ideal[0]
						: constraints.audio.deviceId.ideal
				};
			}
		}
	}

	debug('[computed constraints:%o]', newConstraints);

	return new Promise(function (resolve, reject) {
		function onResultOK(data) {
			debug('getUserMedia() | success');
			var stream = MediaStream.create(data.stream);
			resolve(stream);
			// Emit "connected" on the stream.
			stream.emitConnected();
		}

		function onResultError(error) {
			debugerror('getUserMedia() | failure: %s', error);
			reject(new Errors.MediaStreamError('getUserMedia() failed: ' + error));
		}

		exec(onResultOK, onResultError, 'iosrtcPlugin', 'getUserMedia', [newConstraints]);
	});
}

},{"./Errors":1,"./MediaStream":5,"cordova/exec":undefined,"debug":24}],22:[function(_dereq_,module,exports){
(function (global){
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
	debug = _dereq_('debug')('iosrtc'),
	exec = _dereq_('cordova/exec'),
	domready = _dereq_('domready'),
	getUserMedia = _dereq_('./getUserMedia'),
	getDisplayMedia = _dereq_('./getDisplayMedia'),
	enumerateDevices = _dereq_('./enumerateDevices'),
	RTCPeerConnection = _dereq_('./RTCPeerConnection'),
	RTCSessionDescription = _dereq_('./RTCSessionDescription'),
	RTCIceCandidate = _dereq_('./RTCIceCandidate'),
	MediaDevices = _dereq_('./MediaDevices'),
	MediaStream = _dereq_('./MediaStream'),
	{ MediaStreamTrack } = _dereq_('./MediaStreamTrack'),
	videoElementsHandler = _dereq_('./videoElementsHandler'),
	{ RTCRtpTransceiver } = _dereq_('./RTCRtpTransceiver');

/**
 * Expose the iosrtc object.
 */
module.exports = {
	// Expose WebRTC classes and functions.
	getUserMedia: getUserMedia,
	getDisplayMedia: getDisplayMedia,
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
	debug: _dereq_('debug'),

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

	navigator.getDisplayMedia = getDisplayMedia;
	navigator.mediaDevices.getDisplayMedia = getDisplayMedia;
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

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"./MediaDevices":4,"./MediaStream":5,"./MediaStreamTrack":7,"./RTCIceCandidate":12,"./RTCPeerConnection":13,"./RTCRtpTransceiver":16,"./RTCSessionDescription":17,"./enumerateDevices":19,"./getDisplayMedia":20,"./getUserMedia":21,"./videoElementsHandler":23,"cordova/exec":undefined,"debug":24,"domready":26}],23:[function(_dereq_,module,exports){
/**
 * Expose a function that must be called when the library is loaded.
 * And also a helper function.
 */
module.exports = videoElementsHandler;
module.exports.observeVideo = observeVideo;
module.exports.refreshVideos = refreshVideos;

/**
 * Dependencies.
 */
var debug = _dereq_('debug')('iosrtc:videoElementsHandler'),
	MediaStreamRenderer = _dereq_('./MediaStreamRenderer'),
	/**
	 * Local variables.
	 */

	// RegExp for Blob URI.
	BLOB_INTERNAL_URI_REGEX = new RegExp(/^blob:/),
	// Dictionary of MediaStreamRenderers (provided via module argument).
	// - key: MediaStreamRenderer id.
	// - value: MediaStreamRenderer.
	mediaStreamRenderers,
	// Dictionary of MediaStreams (provided via module argument).
	// - key: MediaStream blobId.
	// - value: MediaStream.
	mediaStreams,
	// Video element mutation observer.
	videoObserver = new MutationObserver(function (mutations) {
		var i, numMutations, mutation, video;

		for (i = 0, numMutations = mutations.length; i < numMutations; i++) {
			mutation = mutations[i];

			// HTML video element.
			video = mutation.target;

			// .srcObject removed.
			if (!video.srcObject && !video.src) {
				// If this video element was previously handling a MediaStreamRenderer, release it.
				releaseMediaStreamRenderer(video);
				continue;
			}

			handleVideo(video);
		}
	}),
	// DOM mutation observer.
	domObserver = new MutationObserver(function (mutations) {
		var i, numMutations, mutation, j, numNodes, node;

		for (i = 0, numMutations = mutations.length; i < numMutations; i++) {
			mutation = mutations[i];

			// Check if there has been addition or deletion of nodes.
			if (mutation.type !== 'childList') {
				continue;
			}

			// Check added nodes.
			for (j = 0, numNodes = mutation.addedNodes.length; j < numNodes; j++) {
				node = mutation.addedNodes[j];

				checkNewNode(node);
			}

			// Check removed nodes.
			for (j = 0, numNodes = mutation.removedNodes.length; j < numNodes; j++) {
				node = mutation.removedNodes[j];

				checkRemovedNode(node);
			}
		}

		function checkNewNode(node) {
			var j, childNode;

			if (node.nodeName === 'VIDEO') {
				debug('new video element added');

				// Avoid same node firing more than once (really, may happen in some cases).
				if (node._iosrtcVideoHandled) {
					return;
				}
				node._iosrtcVideoHandled = true;

				// Observe changes in the video element.
				observeVideo(node);
			} else {
				for (j = 0; j < node.childNodes.length; j++) {
					childNode = node.childNodes.item(j);

					checkNewNode(childNode);
				}
			}
		}

		function checkRemovedNode(node) {
			var j, childNode;

			if (node.nodeName === 'VIDEO') {
				debug('video element removed');

				// If this video element was previously handling a MediaStreamRenderer, release it.
				releaseMediaStreamRenderer(node);
				delete node._iosrtcVideoHandled;
			} else {
				for (j = 0; j < node.childNodes.length; j++) {
					childNode = node.childNodes.item(j);

					checkRemovedNode(childNode);
				}
			}
		}
	});

function refreshVideos() {
	debug('refreshVideos()');

	var id;

	for (id in mediaStreamRenderers) {
		if (mediaStreamRenderers.hasOwnProperty(id)) {
			mediaStreamRenderers[id].refresh();
		}
	}
}

function videoElementsHandler(_mediaStreams, _mediaStreamRenderers) {
	var existingVideos = document.querySelectorAll('video'),
		i,
		len,
		video;

	mediaStreams = _mediaStreams;
	mediaStreamRenderers = _mediaStreamRenderers;

	// Search the whole document for already existing HTML video elements and observe them.
	for (i = 0, len = existingVideos.length; i < len; i++) {
		video = existingVideos.item(i);

		debug('video element found');

		observeVideo(video);
	}

	// Observe the whole document for additions of new HTML video elements and observe them.
	domObserver.observe(document, {
		// Set to true if additions and removals of the target node's child elements (including text nodes) are to
		// be observed.
		childList: true,
		// Set to true if mutations to target's attributes are to be observed.
		attributes: false,
		// Set to true if mutations to target's data are to be observed.
		characterData: false,
		// Set to true if mutations to not just target, but also target's descendants are to be observed.
		subtree: true,
		// Set to true if attributes is set to true and target's attribute value before the mutation needs to be
		// recorded.
		attributeOldValue: false,
		// Set to true if characterData is set to true and target's data before the mutation needs to be recorded.
		characterDataOldValue: false
		// Set to an array of attribute local names (without namespace) if not all attribute mutations need to be
		// observed.
		// attributeFilter:
	});
}

function observeVideo(video) {
	debug('observeVideo()');

	// If the video already has a srcObject property but is not yet handled by the plugin
	// then handle it now.
	var hasStream = video.srcObject || video.src;
	if (hasStream && !video._iosrtcMediaStreamRendererId) {
		handleVideo(video);
	}

	// Add .srcObject observer to the video element.
	videoObserver.observe(video, {
		// Set to true if additions and removals of the target node's child elements (including text
		// nodes) are to be observed.
		childList: false,
		// Set to true if mutations to target's attributes are to be observed.
		attributes: true,
		// Set to true if mutations to target's data are to be observed.
		characterData: false,
		// Set to true if mutations to not just target, but also target's descendants are to be observed.
		subtree: false,
		// Set to true if attributes is set to true and target's attribute value before the mutation
		// needs to be recorded.
		attributeOldValue: false,
		// Set to true if characterData is set to true and target's data before the mutation needs to be
		// recorded.
		characterDataOldValue: false,
		// Set to an array of attribute local names (without namespace) if not all attribute mutations
		// need to be observed.
		// srcObject DO not trigger MutationObserver
		attributeFilter: ['srcObject', 'src']
	});

	// MutationObserver fail to trigger when using srcObject on ony tested browser.
	// But video.srcObject = new MediaStream() will trigger onloadstart and
	// video.srcObject = null will trigger onemptied events.

	video.addEventListener('loadstart', function () {
		var hasStream = video.srcObject || video.src;

		if (hasStream && !video._iosrtcMediaStreamRendererId) {
			// If this video element was NOT previously handling a MediaStreamRenderer, release it.
			handleVideo(video);
		} else if (hasStream && video._iosrtcMediaStreamRendererId) {
			// The video element has received a new srcObject.
			var stream = video.srcObject;
			if (stream && typeof stream.getBlobId === 'function') {
				// Release previous renderer
				releaseMediaStreamRenderer(video);
				// Install new renderer
				provideMediaStreamRenderer(video, stream.getBlobId());
			}
		}
	});

	video.addEventListener('emptied', function () {
		var hasStream = video.srcObject || video.src;
		if (!hasStream && video._iosrtcMediaStreamRendererId) {
			// If this video element was previously handling a MediaStreamRenderer, release it.
			releaseMediaStreamRenderer(video);
		}
	});

	// Intercept video 'error' events if it's due to the attached MediaStream.
	video.addEventListener('error', function (event) {
		if (
			video.error.code === window.MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED &&
			BLOB_INTERNAL_URI_REGEX.test(video.src)
		) {
			debug('stopping "error" event propagation for video element');

			event.stopImmediatePropagation();
		}
	});
}

/**
 * Private API.
 */

function handleVideo(video) {
	var stream;

	// The app has set video.srcObject.
	if (video.srcObject) {
		stream = video.srcObject;
		if (stream && typeof stream.getBlobId === 'function') {
			if (!stream.getBlobId()) {
				// If this video element was previously handling a MediaStreamRenderer, release it.
				releaseMediaStreamRenderer(video);

				return;
			}

			provideMediaStreamRenderer(video, stream.getBlobId());
		}
	} else if (video.src) {
		var xhr = new XMLHttpRequest();
		xhr.open('GET', video.src, true);
		xhr.responseType = 'blob';
		xhr.onload = function () {
			if (xhr.status !== 200) {
				// If this video element was previously handling a MediaStreamRenderer, release it.
				releaseMediaStreamRenderer(video);

				return;
			}

			var reader = new FileReader();

			// Some versions of Safari fail to set onloadend property, some others do not react
			// on 'loadend' event. Try everything here.
			try {
				reader.onloadend = onloadend;
			} catch (error) {
				reader.addEventListener('loadend', onloadend);
			}
			reader.readAsText(xhr.response);

			function onloadend() {
				var mediaStreamBlobId = reader.result;

				// The retrieved URL does not point to a MediaStream.
				if (!mediaStreamBlobId || typeof mediaStreamBlobId !== 'string') {
					// If this video element was previously handling a MediaStreamRenderer, release it.
					releaseMediaStreamRenderer(video);

					return;
				}

				provideMediaStreamRenderer(video, mediaStreamBlobId);
			}
		};
		xhr.send();
	}
}

function provideMediaStreamRenderer(video, mediaStreamBlobId) {
	var mediaStream = mediaStreams[mediaStreamBlobId],
		mediaStreamRenderer = mediaStreamRenderers[video._iosrtcMediaStreamRendererId];

	if (!mediaStream) {
		releaseMediaStreamRenderer(video);

		return;
	}

	if (mediaStreamRenderer) {
		mediaStreamRenderer.render(mediaStream);
	} else {
		mediaStreamRenderer = new MediaStreamRenderer(video);
		mediaStreamRenderer.render(mediaStream);

		mediaStreamRenderers[mediaStreamRenderer.id] = mediaStreamRenderer;
		video._iosrtcMediaStreamRendererId = mediaStreamRenderer.id;
	}

	// Close the MediaStreamRenderer of this video if it emits "close" event.
	mediaStreamRenderer.addEventListener('close', function () {
		if (mediaStreamRenderers[video._iosrtcMediaStreamRendererId] !== mediaStreamRenderer) {
			return;
		}

		releaseMediaStreamRenderer(video);
	});

	// Override some <video> properties.
	// NOTE: This is a terrible hack but it works.
	Object.defineProperties(video, {
		videoWidth: {
			configurable: true,
			get: function () {
				return mediaStreamRenderer.videoWidth || 0;
			}
		},
		videoHeight: {
			configurable: true,
			get: function () {
				return mediaStreamRenderer.videoHeight || 0;
			}
		},
		readyState: {
			configurable: true,
			get: function () {
				if (
					mediaStreamRenderer &&
					mediaStreamRenderer.stream &&
					mediaStreamRenderer.stream.connected
				) {
					return video.HAVE_ENOUGH_DATA;
				} else {
					return video.HAVE_NOTHING;
				}
			}
		}
	});
}

function releaseMediaStreamRenderer(video) {
	if (!video._iosrtcMediaStreamRendererId) {
		return;
	}

	var mediaStreamRenderer = mediaStreamRenderers[video._iosrtcMediaStreamRendererId];

	if (mediaStreamRenderer) {
		delete mediaStreamRenderers[video._iosrtcMediaStreamRendererId];
		mediaStreamRenderer.close();
	}

	delete video._iosrtcMediaStreamRendererId;

	// Remove overrided <video> properties.
	delete video.videoWidth;
	delete video.videoHeight;
	delete video.readyState;
}

},{"./MediaStreamRenderer":6,"debug":24}],24:[function(_dereq_,module,exports){
(function (process){
/* eslint-env browser */

/**
 * This is the web browser implementation of `debug()`.
 */

exports.log = log;
exports.formatArgs = formatArgs;
exports.save = save;
exports.load = load;
exports.useColors = useColors;
exports.storage = localstorage();

/**
 * Colors.
 */

exports.colors = [
	'#0000CC',
	'#0000FF',
	'#0033CC',
	'#0033FF',
	'#0066CC',
	'#0066FF',
	'#0099CC',
	'#0099FF',
	'#00CC00',
	'#00CC33',
	'#00CC66',
	'#00CC99',
	'#00CCCC',
	'#00CCFF',
	'#3300CC',
	'#3300FF',
	'#3333CC',
	'#3333FF',
	'#3366CC',
	'#3366FF',
	'#3399CC',
	'#3399FF',
	'#33CC00',
	'#33CC33',
	'#33CC66',
	'#33CC99',
	'#33CCCC',
	'#33CCFF',
	'#6600CC',
	'#6600FF',
	'#6633CC',
	'#6633FF',
	'#66CC00',
	'#66CC33',
	'#9900CC',
	'#9900FF',
	'#9933CC',
	'#9933FF',
	'#99CC00',
	'#99CC33',
	'#CC0000',
	'#CC0033',
	'#CC0066',
	'#CC0099',
	'#CC00CC',
	'#CC00FF',
	'#CC3300',
	'#CC3333',
	'#CC3366',
	'#CC3399',
	'#CC33CC',
	'#CC33FF',
	'#CC6600',
	'#CC6633',
	'#CC9900',
	'#CC9933',
	'#CCCC00',
	'#CCCC33',
	'#FF0000',
	'#FF0033',
	'#FF0066',
	'#FF0099',
	'#FF00CC',
	'#FF00FF',
	'#FF3300',
	'#FF3333',
	'#FF3366',
	'#FF3399',
	'#FF33CC',
	'#FF33FF',
	'#FF6600',
	'#FF6633',
	'#FF9900',
	'#FF9933',
	'#FFCC00',
	'#FFCC33'
];

/**
 * Currently only WebKit-based Web Inspectors, Firefox >= v31,
 * and the Firebug extension (any Firefox version) are known
 * to support "%c" CSS customizations.
 *
 * TODO: add a `localStorage` variable to explicitly enable/disable colors
 */

// eslint-disable-next-line complexity
function useColors() {
	// NB: In an Electron preload script, document will be defined but not fully
	// initialized. Since we know we're in Chrome, we'll just detect this case
	// explicitly
	if (typeof window !== 'undefined' && window.process && (window.process.type === 'renderer' || window.process.__nwjs)) {
		return true;
	}

	// Internet Explorer and Edge do not support colors.
	if (typeof navigator !== 'undefined' && navigator.userAgent && navigator.userAgent.toLowerCase().match(/(edge|trident)\/(\d+)/)) {
		return false;
	}

	// Is webkit? http://stackoverflow.com/a/16459606/376773
	// document is undefined in react-native: https://github.com/facebook/react-native/pull/1632
	return (typeof document !== 'undefined' && document.documentElement && document.documentElement.style && document.documentElement.style.WebkitAppearance) ||
		// Is firebug? http://stackoverflow.com/a/398120/376773
		(typeof window !== 'undefined' && window.console && (window.console.firebug || (window.console.exception && window.console.table))) ||
		// Is firefox >= v31?
		// https://developer.mozilla.org/en-US/docs/Tools/Web_Console#Styling_messages
		(typeof navigator !== 'undefined' && navigator.userAgent && navigator.userAgent.toLowerCase().match(/firefox\/(\d+)/) && parseInt(RegExp.$1, 10) >= 31) ||
		// Double check webkit in userAgent just in case we are in a worker
		(typeof navigator !== 'undefined' && navigator.userAgent && navigator.userAgent.toLowerCase().match(/applewebkit\/(\d+)/));
}

/**
 * Colorize log arguments if enabled.
 *
 * @api public
 */

function formatArgs(args) {
	args[0] = (this.useColors ? '%c' : '') +
		this.namespace +
		(this.useColors ? ' %c' : ' ') +
		args[0] +
		(this.useColors ? '%c ' : ' ') +
		'+' + module.exports.humanize(this.diff);

	if (!this.useColors) {
		return;
	}

	const c = 'color: ' + this.color;
	args.splice(1, 0, c, 'color: inherit');

	// The final "%c" is somewhat tricky, because there could be other
	// arguments passed either before or after the %c, so we need to
	// figure out the correct index to insert the CSS into
	let index = 0;
	let lastC = 0;
	args[0].replace(/%[a-zA-Z%]/g, match => {
		if (match === '%%') {
			return;
		}
		index++;
		if (match === '%c') {
			// We only are interested in the *last* %c
			// (the user may have provided their own)
			lastC = index;
		}
	});

	args.splice(lastC, 0, c);
}

/**
 * Invokes `console.log()` when available.
 * No-op when `console.log` is not a "function".
 *
 * @api public
 */
function log(...args) {
	// This hackery is required for IE8/9, where
	// the `console.log` function doesn't have 'apply'
	return typeof console === 'object' &&
		console.log &&
		console.log(...args);
}

/**
 * Save `namespaces`.
 *
 * @param {String} namespaces
 * @api private
 */
function save(namespaces) {
	try {
		if (namespaces) {
			exports.storage.setItem('debug', namespaces);
		} else {
			exports.storage.removeItem('debug');
		}
	} catch (error) {
		// Swallow
		// XXX (@Qix-) should we be logging these?
	}
}

/**
 * Load `namespaces`.
 *
 * @return {String} returns the previously persisted debug modes
 * @api private
 */
function load() {
	let r;
	try {
		r = exports.storage.getItem('debug');
	} catch (error) {
		// Swallow
		// XXX (@Qix-) should we be logging these?
	}

	// If debug isn't set in LS, and we're in Electron, try to load $DEBUG
	if (!r && typeof process !== 'undefined' && 'env' in process) {
		r = process.env.DEBUG;
	}

	return r;
}

/**
 * Localstorage attempts to return the localstorage.
 *
 * This is necessary because safari throws
 * when a user disables cookies/localstorage
 * and you attempt to access it.
 *
 * @return {LocalStorage}
 * @api private
 */

function localstorage() {
	try {
		// TVMLKit (Apple TV JS Runtime) does not have a window object, just localStorage in the global context
		// The Browser also has localStorage in the global context.
		return localStorage;
	} catch (error) {
		// Swallow
		// XXX (@Qix-) should we be logging these?
	}
}

module.exports = _dereq_('./common')(exports);

const {formatters} = module.exports;

/**
 * Map %j to `JSON.stringify()`, since no Web Inspectors do that by default.
 */

formatters.j = function (v) {
	try {
		return JSON.stringify(v);
	} catch (error) {
		return '[UnexpectedJSONParseError]: ' + error.message;
	}
};

}).call(this,_dereq_('_process'))
},{"./common":25,"_process":28}],25:[function(_dereq_,module,exports){

/**
 * This is the common logic for both the Node.js and web browser
 * implementations of `debug()`.
 */

function setup(env) {
	createDebug.debug = createDebug;
	createDebug.default = createDebug;
	createDebug.coerce = coerce;
	createDebug.disable = disable;
	createDebug.enable = enable;
	createDebug.enabled = enabled;
	createDebug.humanize = _dereq_('ms');

	Object.keys(env).forEach(key => {
		createDebug[key] = env[key];
	});

	/**
	* Active `debug` instances.
	*/
	createDebug.instances = [];

	/**
	* The currently active debug mode names, and names to skip.
	*/

	createDebug.names = [];
	createDebug.skips = [];

	/**
	* Map of special "%n" handling functions, for the debug "format" argument.
	*
	* Valid key names are a single, lower or upper-case letter, i.e. "n" and "N".
	*/
	createDebug.formatters = {};

	/**
	* Selects a color for a debug namespace
	* @param {String} namespace The namespace string for the for the debug instance to be colored
	* @return {Number|String} An ANSI color code for the given namespace
	* @api private
	*/
	function selectColor(namespace) {
		let hash = 0;

		for (let i = 0; i < namespace.length; i++) {
			hash = ((hash << 5) - hash) + namespace.charCodeAt(i);
			hash |= 0; // Convert to 32bit integer
		}

		return createDebug.colors[Math.abs(hash) % createDebug.colors.length];
	}
	createDebug.selectColor = selectColor;

	/**
	* Create a debugger with the given `namespace`.
	*
	* @param {String} namespace
	* @return {Function}
	* @api public
	*/
	function createDebug(namespace) {
		let prevTime;

		function debug(...args) {
			// Disabled?
			if (!debug.enabled) {
				return;
			}

			const self = debug;

			// Set `diff` timestamp
			const curr = Number(new Date());
			const ms = curr - (prevTime || curr);
			self.diff = ms;
			self.prev = prevTime;
			self.curr = curr;
			prevTime = curr;

			args[0] = createDebug.coerce(args[0]);

			if (typeof args[0] !== 'string') {
				// Anything else let's inspect with %O
				args.unshift('%O');
			}

			// Apply any `formatters` transformations
			let index = 0;
			args[0] = args[0].replace(/%([a-zA-Z%])/g, (match, format) => {
				// If we encounter an escaped % then don't increase the array index
				if (match === '%%') {
					return match;
				}
				index++;
				const formatter = createDebug.formatters[format];
				if (typeof formatter === 'function') {
					const val = args[index];
					match = formatter.call(self, val);

					// Now we need to remove `args[index]` since it's inlined in the `format`
					args.splice(index, 1);
					index--;
				}
				return match;
			});

			// Apply env-specific formatting (colors, etc.)
			createDebug.formatArgs.call(self, args);

			const logFn = self.log || createDebug.log;
			logFn.apply(self, args);
		}

		debug.namespace = namespace;
		debug.enabled = createDebug.enabled(namespace);
		debug.useColors = createDebug.useColors();
		debug.color = selectColor(namespace);
		debug.destroy = destroy;
		debug.extend = extend;
		// Debug.formatArgs = formatArgs;
		// debug.rawLog = rawLog;

		// env-specific initialization logic for debug instances
		if (typeof createDebug.init === 'function') {
			createDebug.init(debug);
		}

		createDebug.instances.push(debug);

		return debug;
	}

	function destroy() {
		const index = createDebug.instances.indexOf(this);
		if (index !== -1) {
			createDebug.instances.splice(index, 1);
			return true;
		}
		return false;
	}

	function extend(namespace, delimiter) {
		const newDebug = createDebug(this.namespace + (typeof delimiter === 'undefined' ? ':' : delimiter) + namespace);
		newDebug.log = this.log;
		return newDebug;
	}

	/**
	* Enables a debug mode by namespaces. This can include modes
	* separated by a colon and wildcards.
	*
	* @param {String} namespaces
	* @api public
	*/
	function enable(namespaces) {
		createDebug.save(namespaces);

		createDebug.names = [];
		createDebug.skips = [];

		let i;
		const split = (typeof namespaces === 'string' ? namespaces : '').split(/[\s,]+/);
		const len = split.length;

		for (i = 0; i < len; i++) {
			if (!split[i]) {
				// ignore empty strings
				continue;
			}

			namespaces = split[i].replace(/\*/g, '.*?');

			if (namespaces[0] === '-') {
				createDebug.skips.push(new RegExp('^' + namespaces.substr(1) + '$'));
			} else {
				createDebug.names.push(new RegExp('^' + namespaces + '$'));
			}
		}

		for (i = 0; i < createDebug.instances.length; i++) {
			const instance = createDebug.instances[i];
			instance.enabled = createDebug.enabled(instance.namespace);
		}
	}

	/**
	* Disable debug output.
	*
	* @return {String} namespaces
	* @api public
	*/
	function disable() {
		const namespaces = [
			...createDebug.names.map(toNamespace),
			...createDebug.skips.map(toNamespace).map(namespace => '-' + namespace)
		].join(',');
		createDebug.enable('');
		return namespaces;
	}

	/**
	* Returns true if the given mode name is enabled, false otherwise.
	*
	* @param {String} name
	* @return {Boolean}
	* @api public
	*/
	function enabled(name) {
		if (name[name.length - 1] === '*') {
			return true;
		}

		let i;
		let len;

		for (i = 0, len = createDebug.skips.length; i < len; i++) {
			if (createDebug.skips[i].test(name)) {
				return false;
			}
		}

		for (i = 0, len = createDebug.names.length; i < len; i++) {
			if (createDebug.names[i].test(name)) {
				return true;
			}
		}

		return false;
	}

	/**
	* Convert regexp to namespace
	*
	* @param {RegExp} regxep
	* @return {String} namespace
	* @api private
	*/
	function toNamespace(regexp) {
		return regexp.toString()
			.substring(2, regexp.toString().length - 2)
			.replace(/\.\*\?$/, '*');
	}

	/**
	* Coerce `val`.
	*
	* @param {Mixed} val
	* @return {Mixed}
	* @api private
	*/
	function coerce(val) {
		if (val instanceof Error) {
			return val.stack || val.message;
		}
		return val;
	}

	createDebug.enable(createDebug.load());

	return createDebug;
}

module.exports = setup;

},{"ms":27}],26:[function(_dereq_,module,exports){
/*!
  * domready (c) Dustin Diaz 2014 - License MIT
  */
!function (name, definition) {

  if (typeof module != 'undefined') module.exports = definition()
  else if (typeof define == 'function' && typeof define.amd == 'object') define(definition)
  else this[name] = definition()

}('domready', function () {

  var fns = [], listener
    , doc = document
    , hack = doc.documentElement.doScroll
    , domContentLoaded = 'DOMContentLoaded'
    , loaded = (hack ? /^loaded|^c/ : /^loaded|^i|^c/).test(doc.readyState)


  if (!loaded)
  doc.addEventListener(domContentLoaded, listener = function () {
    doc.removeEventListener(domContentLoaded, listener)
    loaded = 1
    while (listener = fns.shift()) listener()
  })

  return function (fn) {
    loaded ? setTimeout(fn, 0) : fns.push(fn)
  }

});

},{}],27:[function(_dereq_,module,exports){
/**
 * Helpers.
 */

var s = 1000;
var m = s * 60;
var h = m * 60;
var d = h * 24;
var w = d * 7;
var y = d * 365.25;

/**
 * Parse or format the given `val`.
 *
 * Options:
 *
 *  - `long` verbose formatting [false]
 *
 * @param {String|Number} val
 * @param {Object} [options]
 * @throws {Error} throw an error if val is not a non-empty string or a number
 * @return {String|Number}
 * @api public
 */

module.exports = function(val, options) {
  options = options || {};
  var type = typeof val;
  if (type === 'string' && val.length > 0) {
    return parse(val);
  } else if (type === 'number' && isFinite(val)) {
    return options.long ? fmtLong(val) : fmtShort(val);
  }
  throw new Error(
    'val is not a non-empty string or a valid number. val=' +
      JSON.stringify(val)
  );
};

/**
 * Parse the given `str` and return milliseconds.
 *
 * @param {String} str
 * @return {Number}
 * @api private
 */

function parse(str) {
  str = String(str);
  if (str.length > 100) {
    return;
  }
  var match = /^(-?(?:\d+)?\.?\d+) *(milliseconds?|msecs?|ms|seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|h|days?|d|weeks?|w|years?|yrs?|y)?$/i.exec(
    str
  );
  if (!match) {
    return;
  }
  var n = parseFloat(match[1]);
  var type = (match[2] || 'ms').toLowerCase();
  switch (type) {
    case 'years':
    case 'year':
    case 'yrs':
    case 'yr':
    case 'y':
      return n * y;
    case 'weeks':
    case 'week':
    case 'w':
      return n * w;
    case 'days':
    case 'day':
    case 'd':
      return n * d;
    case 'hours':
    case 'hour':
    case 'hrs':
    case 'hr':
    case 'h':
      return n * h;
    case 'minutes':
    case 'minute':
    case 'mins':
    case 'min':
    case 'm':
      return n * m;
    case 'seconds':
    case 'second':
    case 'secs':
    case 'sec':
    case 's':
      return n * s;
    case 'milliseconds':
    case 'millisecond':
    case 'msecs':
    case 'msec':
    case 'ms':
      return n;
    default:
      return undefined;
  }
}

/**
 * Short format for `ms`.
 *
 * @param {Number} ms
 * @return {String}
 * @api private
 */

function fmtShort(ms) {
  var msAbs = Math.abs(ms);
  if (msAbs >= d) {
    return Math.round(ms / d) + 'd';
  }
  if (msAbs >= h) {
    return Math.round(ms / h) + 'h';
  }
  if (msAbs >= m) {
    return Math.round(ms / m) + 'm';
  }
  if (msAbs >= s) {
    return Math.round(ms / s) + 's';
  }
  return ms + 'ms';
}

/**
 * Long format for `ms`.
 *
 * @param {Number} ms
 * @return {String}
 * @api private
 */

function fmtLong(ms) {
  var msAbs = Math.abs(ms);
  if (msAbs >= d) {
    return plural(ms, msAbs, d, 'day');
  }
  if (msAbs >= h) {
    return plural(ms, msAbs, h, 'hour');
  }
  if (msAbs >= m) {
    return plural(ms, msAbs, m, 'minute');
  }
  if (msAbs >= s) {
    return plural(ms, msAbs, s, 'second');
  }
  return ms + ' ms';
}

/**
 * Pluralization helper.
 */

function plural(ms, msAbs, n, name) {
  var isPlural = msAbs >= n * 1.5;
  return Math.round(ms / n) + ' ' + name + (isPlural ? 's' : '');
}

},{}],28:[function(_dereq_,module,exports){
// shim for using process in browser
var process = module.exports = {};

// cached from whatever global is present so that test runners that stub it
// don't break things.  But we need to wrap it in a try catch in case it is
// wrapped in strict mode code which doesn't define any globals.  It's inside a
// function because try/catches deoptimize in certain engines.

var cachedSetTimeout;
var cachedClearTimeout;

function defaultSetTimout() {
    throw new Error('setTimeout has not been defined');
}
function defaultClearTimeout () {
    throw new Error('clearTimeout has not been defined');
}
(function () {
    try {
        if (typeof setTimeout === 'function') {
            cachedSetTimeout = setTimeout;
        } else {
            cachedSetTimeout = defaultSetTimout;
        }
    } catch (e) {
        cachedSetTimeout = defaultSetTimout;
    }
    try {
        if (typeof clearTimeout === 'function') {
            cachedClearTimeout = clearTimeout;
        } else {
            cachedClearTimeout = defaultClearTimeout;
        }
    } catch (e) {
        cachedClearTimeout = defaultClearTimeout;
    }
} ())
function runTimeout(fun) {
    if (cachedSetTimeout === setTimeout) {
        //normal enviroments in sane situations
        return setTimeout(fun, 0);
    }
    // if setTimeout wasn't available but was latter defined
    if ((cachedSetTimeout === defaultSetTimout || !cachedSetTimeout) && setTimeout) {
        cachedSetTimeout = setTimeout;
        return setTimeout(fun, 0);
    }
    try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return cachedSetTimeout(fun, 0);
    } catch(e){
        try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't trust the global object when called normally
            return cachedSetTimeout.call(null, fun, 0);
        } catch(e){
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error
            return cachedSetTimeout.call(this, fun, 0);
        }
    }


}
function runClearTimeout(marker) {
    if (cachedClearTimeout === clearTimeout) {
        //normal enviroments in sane situations
        return clearTimeout(marker);
    }
    // if clearTimeout wasn't available but was latter defined
    if ((cachedClearTimeout === defaultClearTimeout || !cachedClearTimeout) && clearTimeout) {
        cachedClearTimeout = clearTimeout;
        return clearTimeout(marker);
    }
    try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return cachedClearTimeout(marker);
    } catch (e){
        try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't  trust the global object when called normally
            return cachedClearTimeout.call(null, marker);
        } catch (e){
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error.
            // Some versions of I.E. have different rules for clearTimeout vs setTimeout
            return cachedClearTimeout.call(this, marker);
        }
    }



}
var queue = [];
var draining = false;
var currentQueue;
var queueIndex = -1;

function cleanUpNextTick() {
    if (!draining || !currentQueue) {
        return;
    }
    draining = false;
    if (currentQueue.length) {
        queue = currentQueue.concat(queue);
    } else {
        queueIndex = -1;
    }
    if (queue.length) {
        drainQueue();
    }
}

function drainQueue() {
    if (draining) {
        return;
    }
    var timeout = runTimeout(cleanUpNextTick);
    draining = true;

    var len = queue.length;
    while(len) {
        currentQueue = queue;
        queue = [];
        while (++queueIndex < len) {
            if (currentQueue) {
                currentQueue[queueIndex].run();
            }
        }
        queueIndex = -1;
        len = queue.length;
    }
    currentQueue = null;
    draining = false;
    runClearTimeout(timeout);
}

process.nextTick = function (fun) {
    var args = new Array(arguments.length - 1);
    if (arguments.length > 1) {
        for (var i = 1; i < arguments.length; i++) {
            args[i - 1] = arguments[i];
        }
    }
    queue.push(new Item(fun, args));
    if (queue.length === 1 && !draining) {
        runTimeout(drainQueue);
    }
};

// v8 likes predictible objects
function Item(fun, array) {
    this.fun = fun;
    this.array = array;
}
Item.prototype.run = function () {
    this.fun.apply(null, this.array);
};
process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];
process.version = ''; // empty string to avoid regexp issues
process.versions = {};

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;
process.prependListener = noop;
process.prependOnceListener = noop;

process.listeners = function (name) { return [] }

process.binding = function (name) {
    throw new Error('process.binding is not supported');
};

process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};
process.umask = function() { return 0; };

},{}],29:[function(_dereq_,module,exports){
void function(root){

  function defaults(options){
    var options = options || {}
    var min = options.min
    var max = options.max
    var integer = options.integer || false
    if ( min == null && max == null ) {
      min = 0
      max = 1
    } else if ( min == null ) {
      min = max - 1
    } else if ( max == null ) {
      max = min + 1
    }
    if ( max < min ) throw new Error('invalid options, max must be >= min')
    return {
      min:     min
    , max:     max
    , integer: integer
    }
  }

  function random(options){
    options = defaults(options)
    if ( options.max === options.min ) return options.min
    var r = Math.random() * (options.max - options.min + Number(!!options.integer)) + options.min
    return options.integer ? Math.floor(r) : r
  }

  function generator(options){
    options = defaults(options)
    return function(min, max, integer){
      options.min     = min != null ? min : options.min
      options.max     = max != null ? max : options.max
      options.integer = integer != null ? integer : options.integer
      return random(options)
    }
  }

  module.exports =  random
  module.exports.generator = generator
  module.exports.defaults = defaults
}(this)

},{}],30:[function(_dereq_,module,exports){
(function (setImmediate,clearImmediate){
var nextTick = _dereq_('process/browser.js').nextTick;
var apply = Function.prototype.apply;
var slice = Array.prototype.slice;
var immediateIds = {};
var nextImmediateId = 0;

// DOM APIs, for completeness

exports.setTimeout = function() {
  return new Timeout(apply.call(setTimeout, window, arguments), clearTimeout);
};
exports.setInterval = function() {
  return new Timeout(apply.call(setInterval, window, arguments), clearInterval);
};
exports.clearTimeout =
exports.clearInterval = function(timeout) { timeout.close(); };

function Timeout(id, clearFn) {
  this._id = id;
  this._clearFn = clearFn;
}
Timeout.prototype.unref = Timeout.prototype.ref = function() {};
Timeout.prototype.close = function() {
  this._clearFn.call(window, this._id);
};

// Does not start the time, just sets up the members needed.
exports.enroll = function(item, msecs) {
  clearTimeout(item._idleTimeoutId);
  item._idleTimeout = msecs;
};

exports.unenroll = function(item) {
  clearTimeout(item._idleTimeoutId);
  item._idleTimeout = -1;
};

exports._unrefActive = exports.active = function(item) {
  clearTimeout(item._idleTimeoutId);

  var msecs = item._idleTimeout;
  if (msecs >= 0) {
    item._idleTimeoutId = setTimeout(function onTimeout() {
      if (item._onTimeout)
        item._onTimeout();
    }, msecs);
  }
};

// That's not how node.js implements it but the exposed api is the same.
exports.setImmediate = typeof setImmediate === "function" ? setImmediate : function(fn) {
  var id = nextImmediateId++;
  var args = arguments.length < 2 ? false : slice.call(arguments, 1);

  immediateIds[id] = true;

  nextTick(function onNextTick() {
    if (immediateIds[id]) {
      // fn.call() is faster so we optimize for the common use-case
      // @see http://jsperf.com/call-apply-segu
      if (args) {
        fn.apply(null, args);
      } else {
        fn.call(null);
      }
      // Prevent ids from leaking
      exports.clearImmediate(id);
    }
  });

  return id;
};

exports.clearImmediate = typeof clearImmediate === "function" ? clearImmediate : function(id) {
  delete immediateIds[id];
};
}).call(this,_dereq_("timers").setImmediate,_dereq_("timers").clearImmediate)
},{"process/browser.js":28,"timers":30}],31:[function(_dereq_,module,exports){
module.exports =
{
	EventTarget : _dereq_('./lib/EventTarget'),
	Event       : _dereq_('./lib/Event')
};

},{"./lib/Event":32,"./lib/EventTarget":33}],32:[function(_dereq_,module,exports){
(function (global){
/**
 * In browsers export the native Event interface.
 */

module.exports = global.Event;

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}],33:[function(_dereq_,module,exports){
function yaetiEventTarget()
{
	this._listeners = {};
}

Object.defineProperties(yaetiEventTarget.prototype,
	{
		listeners:
		{
			get: function()
			{
				return this._listeners;
			}
		}
	});

yaetiEventTarget.prototype.addEventListener = function(type, newListener)
{
	var listenersType;
	var i;
	var listener;

	if (!type || !newListener)
		return;

	listenersType = this._listeners[type];

	if (listenersType === undefined)
		this._listeners[type] = listenersType = [];

	for (i = 0; !!(listener = listenersType[i]); i++)
	{
		if (listener === newListener)
			return;
	}

	listenersType.push(newListener);
};

yaetiEventTarget.prototype.removeEventListener = function(type, oldListener)
{
	var listenersType;
	var i;
	var listener;

	if (!type || !oldListener)
		return;

	listenersType = this._listeners[type];

	if (listenersType === undefined)
		return;

	for (i = 0; !!(listener = listenersType[i]); i++)
	{
		if (listener === oldListener)
		{
			listenersType.splice(i, 1);
			break;
		}
	}

	if (listenersType.length === 0)
		delete this._listeners[type];
};

yaetiEventTarget.prototype.dispatchEvent = function(event)
{
	var type;
	var listenersType;
	var dummyListener;
	var stopImmediatePropagation = false;
	var i;
	var listener;

	if (!event || typeof event.type !== 'string')
		throw new Error('`event` must have a valid `type` property');

	// Do some stuff to emulate DOM Event behavior (just if this is not a
	// DOM Event object).
	if (event._yaeti)
	{
		event.target = this;
		event.cancelable = true;
	}

	// Attempt to override the stopImmediatePropagation() method.
	try
	{
		event.stopImmediatePropagation = function()
		{
			stopImmediatePropagation = true;
		};
	}
	catch (error)
	{}

	type = event.type;
	listenersType = (this._listeners[type] || []);

	dummyListener = this['on' + type];

	if (typeof dummyListener === 'function')
	{
		try
		{
			dummyListener.call(this, event);
		}
		catch (error)
		{
			console.error(error);
		}
	}

	for (i = 0; !!(listener = listenersType[i]); i++)
	{
		if (stopImmediatePropagation)
			break;

		try
		{
			listener.call(this, event);
		}
		catch (error)
		{
			console.error(error);
		}
	}

	return !event.defaultPrevented;
};

module.exports = yaetiEventTarget;

},{}]},{},[22])(22)
});
