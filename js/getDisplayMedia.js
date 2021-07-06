/**
 * Expose the getDisplayMedia function.
 */
module.exports = getDisplayMedia;

/**
 * Dependencies.
 */
var debug = require('debug')('iosrtc:getDisplayMedia'),
	debugerror = require('debug')('iosrtc:ERROR:getDisplayMedia'),
	exec = require('cordova/exec'),
	MediaStream = require('./MediaStream'),
	Errors = require('./Errors');

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
