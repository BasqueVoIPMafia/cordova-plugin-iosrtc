/**
 * Expose the MediaStreamRenderer class.
 */
module.exports = MediaStreamRenderer;

/**
 * Dependencies.
 */
var debug = require('debug')('iosrtc:MediaStreamRenderer'),
	exec = require('cordova/exec'),
	randomNumber = require('random-number').generator({ min: 10000, max: 99999, integer: true }),
	EventTarget = require('./EventTarget'),
	MediaStream = require('./MediaStream');

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

	// Support canvas to render
	this.videoStopped = false;
	this.webSocketUrl = undefined;
	this.webSocketClient = undefined;
	this.canvasCtx = undefined;
	this.canvasId = (element.id || Date.now()) + '__canvas';

	var hasCanvas = false;
	var canvasElement = document.getElementById(this.canvasId);
	debug('render() [canvas-id:%s, ele:%o]', this.canvasId, canvasElement);
	if (!canvasElement) {
		canvasElement = document.createElement('canvas');
		canvasElement.id = this.canvasId;
		element.parentNode.insertBefore(canvasElement, element.nextSibling);
	}
	if (canvasElement) {
		hasCanvas = true;
		this.canvasCtx = createCanvasContext(canvasElement);
	}

	// Private attributes.
	this.id = randomNumber();

	function onResultOK(data) {
		onEvent.call(self, data);
	}

	exec(onResultOK, null, 'iosrtcPlugin', 'new_MediaStreamRenderer', [this.id, hasCanvas]);

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
	self.videoStopped = false;

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

	if (this.webSocketClient) {
		this.webSocketClient.close();
		this.webSocketClient = undefined;
	}

	if (this.canvasCtx) {
		this.canvasCtx.fillBlack();
		this.canvasCtx = undefined;
	}

	exec(null, null, 'iosrtcPlugin', 'MediaStreamRenderer_close', [this.id]);
	if (this.refreshInterval) {
		clearInterval(this.refreshInterval);
		delete this.refreshInterval;
	}
};

MediaStreamRenderer.prototype.openWebSocket = function (host, port, uuid) {
	if (!this.canvasCtx) {
		debug('websocket no canvas context');
		return;
	}

	var self = this;
	this.webSocketUrl = 'ws://' + host + ':' + port + '?uuid=' + uuid;
	debug('websocket url=' + this.webSocketUrl);

	this.webSocketClient = new window.WebSocket(this.webSocketUrl);
	this.webSocketClient.binaryType = 'arraybuffer';
	this.webSocketClient.onopen = function () {
		debug('websocket open for uuid:' + uuid);
	};
	this.webSocketClient.onerror = function (event) {
		var errorStr = JSON.stringify(event, null, 4);
		debug('websocket error for uuid:' + uuid + ', error:' + errorStr);
	};
	this.webSocketClient.onclose = function (event) {
		var errorStr = JSON.stringify(event, null, 4);
		debug('websocket close for uuid:' + uuid + ', error:' + errorStr);
	};
	this.webSocketClient.onmessage = function (event) {
		//debug('websocket message uuid:' + uuid + ', length:' + event.data.length);
		if (!self.stream) {
			return;
		}
		if (self.videoStopped) {
			return;
		}

		// data format: 16B-head + body
		//		head: type(2B) + len(4B) + width(2B) + height(2B) + rotation(2B) + timestamp(4B)
		//		body: len
		var headLen = 16;
		var pdu = new DataView(event.data);
		var pduLen = pdu.byteLength;
		if (pduLen < headLen) {
			return;
		}

		// parse head
		//var pduType = pdu.getUint16(0);
		var bodyLen = pdu.getUint32(2, true);
		var width = pdu.getUint16(6, true);
		var height = pdu.getUint16(8, true);
		//var rotation = pdu.getUint16(10, true);
		//var timestamp = pdu.getUint32(12, true);
		//debug('websocket message: body='+bodyLen+',resloution='+width+'x'+height+",size="+pduLen);
		if (pduLen !== headLen + bodyLen) {
			debug('websocket message, wrong data length');
		} else {
			var typedArray = new Uint8Array(event.data);
			var frame = typedArray.subarray(headLen, headLen + bodyLen);
			self.drawFrame(frame, width, height);
		}
	};
};

MediaStreamRenderer.prototype.drawFrame = function (frame, width, height) {
	//debug('drawFrame canvas, length=' + frame.length);
	if (this.canvasCtx) {
		var uOffset = parseInt(width * height);
		var vOffset = parseInt(uOffset + uOffset / 4);
		this.canvasCtx.render(frame, width, height, uOffset, vOffset);
	}
};

/**
 * WebGLTexture API.
 */

function WebGLTexture(gl) {
	this.gl = gl;
	this.texture = gl.createTexture();
	gl.bindTexture(gl.TEXTURE_2D, this.texture);

	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);

	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
}

WebGLTexture.prototype.bind = function (n, program, name) {
	var gl = this.gl;
	gl.activeTexture([gl.TEXTURE0, gl.TEXTURE1, gl.TEXTURE2][n]);
	gl.bindTexture(gl.TEXTURE_2D, this.texture);
	gl.uniform1i(gl.getUniformLocation(program, name), n);
};

WebGLTexture.prototype.fill = function (width, height, data) {
	var gl = this.gl;
	var level = 0;
	var internalFormat = gl.LUMINANCE; //gl.RGBA;
	var border = 0;
	var srcFormat = gl.LUMINANCE; //gl.RGBA;
	var srcType = gl.UNSIGNED_BYTE;
	gl.bindTexture(gl.TEXTURE_2D, this.texture);
	gl.texImage2D(
		gl.TEXTURE_2D,
		level,
		internalFormat,
		width,
		height,
		border,
		srcFormat,
		srcType,
		data
	);
};

/**
 * Canvas API.
 */

function setupCanvasWebGL(canvas, options) {
	var gl = canvas.getContext('webgl', {
		preserveDrawingBuffer: Boolean(options.preserveDrawingBuffer)
	});
	if (!gl) {
		return null;
	}
	var program = gl.createProgram();
	var vertexShaderSource = [
		'attribute highp vec4 aVertexPosition;',
		'attribute vec2 aTextureCoord;',
		'varying highp vec2 vTextureCoord;',
		'void main(void) {',
		' gl_Position = aVertexPosition;',
		' vTextureCoord = aTextureCoord;',
		'}'
	].join('\n');

	var vertexShader = gl.createShader(gl.VERTEX_SHADER);
	gl.shaderSource(vertexShader, vertexShaderSource);
	gl.compileShader(vertexShader);

	var fragmentShaderSource = [
		'precision highp float;',
		'varying lowp vec2 vTextureCoord;',
		'uniform sampler2D YTexture;',
		'uniform sampler2D UTexture;',
		'uniform sampler2D VTexture;',
		'const mat4 YUV2RGB = mat4',
		'(',
		' 1.1643828125, 0, 1.59602734375, -.87078515625,',
		' 1.1643828125, -.39176171875, -.81296875, .52959375,',
		' 1.1643828125, 2.017234375, 0, -1.081390625,',
		' 0, 0, 0, 1',
		');',
		'void main(void) {',
		' gl_FragColor = vec4( texture2D(YTexture, vTextureCoord).x, texture2D(UTexture, vTextureCoord).x, texture2D(VTexture, vTextureCoord).x, 1) * YUV2RGB;',
		'}'
	].join('\n');

	var fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
	gl.shaderSource(fragmentShader, fragmentShaderSource);
	gl.compileShader(fragmentShader);
	gl.attachShader(program, vertexShader);
	gl.attachShader(program, fragmentShader);
	gl.linkProgram(program);
	gl.useProgram(program);
	if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
		debug('gl Shader link failed.');
	}
	var vertexPositionAttribute = gl.getAttribLocation(program, 'aVertexPosition');
	gl.enableVertexAttribArray(vertexPositionAttribute);
	var textureCoordAttribute = gl.getAttribLocation(program, 'aTextureCoord');
	gl.enableVertexAttribArray(textureCoordAttribute);

	var verticesBuffer = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, verticesBuffer);
	gl.bufferData(
		gl.ARRAY_BUFFER,
		new Float32Array([1.0, 1.0, 0.0, -1.0, 1.0, 0.0, 1.0, -1.0, 0.0, -1.0, -1.0, 0.0]),
		gl.STATIC_DRAW
	);
	gl.vertexAttribPointer(vertexPositionAttribute, 3, gl.FLOAT, false, 0, 0);
	var texCoordBuffer = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
	gl.bufferData(
		gl.ARRAY_BUFFER,
		new Float32Array([1.0, 0.0, 0.0, 0.0, 1.0, 1.0, 0.0, 1.0]),
		gl.STATIC_DRAW
	);
	gl.vertexAttribPointer(textureCoordAttribute, 2, gl.FLOAT, false, 0, 0);

	gl.y = new WebGLTexture(gl);
	gl.u = new WebGLTexture(gl);
	gl.v = new WebGLTexture(gl);
	gl.y.bind(0, program, 'YTexture');
	gl.u.bind(1, program, 'UTexture');
	gl.v.bind(2, program, 'VTexture');
	return gl;
}

function CanvasI420Context(canvas, gl) {
	this.canvas = canvas;
	this.gl = gl;
	this.width = 0;
	this.height = 0;
}

CanvasI420Context.prototype.render = function (frame, width, height, uOffset, vOffset) {
	if (width === 0 || height === 0) {
		return;
	}

	var canvas = this.canvas;
	if (width !== this.width || height !== this.height) {
		var glWidth = canvas.clientWidth;
		//var glHeight = canvas.clientHeight;
		var glHeight = glWidth * (height / width);

		var glX = 0;
		var glY = 0;
		if (canvas.clientHeight > glHeight) {
			glY = parseInt((canvas.clientHeight - glHeight) / 2);
		}

		debug(
			'canvas render change from=' +
				this.width +
				'x' +
				this.height +
				' to ' +
				width +
				'x' +
				height +
				', clientSize=' +
				canvas.clientWidth +
				'x' +
				canvas.clientHeight +
				', offsetSize=' +
				canvas.offsetWidth +
				'x' +
				canvas.offsetHeight +
				', glSize=' +
				glWidth +
				'x' +
				glHeight +
				'-' +
				glX +
				'x' +
				glY
		);

		this.frameSetup(glX, glY, glWidth, glHeight);
		this.width = width;
		this.height = height;
	}
	this.renderFrame(frame, uOffset, vOffset);
};

CanvasI420Context.prototype.frameSetup = function (glx, gly, width, height) {
	var canvas = this.canvas;
	var gl = this.gl;
	if (canvas.width !== canvas.clientWidth || canvas.height !== canvas.clientHeight) {
		canvas.width = canvas.clientWidth;
		canvas.height = canvas.clientHeight;
	}
	gl.viewport(glx, gly, width, height);
};

CanvasI420Context.prototype.renderFrame = function (frame, uOffset, vOffset) {
	var gl = this.gl;
	var width = this.width;
	var height = this.height;
	gl.y.fill(width, height, frame.subarray(0, uOffset));
	gl.u.fill(width >> 1, height >> 1, frame.subarray(uOffset, vOffset));
	gl.v.fill(width >> 1, height >> 1, frame.subarray(vOffset, frame.length));
	gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
};

CanvasI420Context.prototype.fillBlack = function () {
	var gl = this.gl;
	var arr1 = new Uint8Array(1),
		arr2 = new Uint8Array(1);

	arr1[0] = 0;
	arr2[0] = 128;

	gl.y.fill(1, 1, arr1);
	gl.u.fill(1, 1, arr2);
	gl.v.fill(1, 1, arr2);

	gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
};

function createCanvasContext(element, options) {
	var canvas;
	if (typeof element === 'string') {
		canvas = window.document.querySelector(element);
	} else if (element instanceof HTMLCanvasElement) {
		canvas = element;
	}

	if (!canvas) {
		debug('find no canvas element=' + element);
		return null;
	}

	if (!options) {
		options = {
			preserveDrawingBuffer: false
		};
	}

	var glCtx = setupCanvasWebGL(canvas, options);
	if (!glCtx) {
		debug('fail to setupCanvasWebGL');
		return null;
	}

	var i420Ctx = new CanvasI420Context(canvas, glCtx);
	i420Ctx.fillBlack();
	return i420Ctx;
}

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
		case 'videowebsocket':
			switch (data.action) {
				case 'run':
					if (data.ws) {
						this.videoStopped = false;
						this.openWebSocket('localhost', data.ws.port, data.ws.uuid);
					}
					break;
				case 'stop':
					this.videoStopped = true;
					break;
			}
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
