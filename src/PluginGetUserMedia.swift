import Foundation
import AVFoundation
import UIKit.UIDevice

class PluginGetUserMedia {

	var rtcPeerConnectionFactory: RTCPeerConnectionFactory

	init(rtcPeerConnectionFactory: RTCPeerConnectionFactory) {
		NSLog("PluginGetUserMedia#init()")
		self.rtcPeerConnectionFactory = rtcPeerConnectionFactory
		UIDevice.current.beginGeneratingDeviceOrientationNotifications()
	}

	deinit {
		NSLog("PluginGetUserMedia#deinit()")
		UIDevice.current.endGeneratingDeviceOrientationNotifications()
	}

	func call(
		_ constraints: NSDictionary,
		callback: (_ data: NSDictionary) -> Void,
		errback: (_ error: String) -> Void,
		eventListenerForNewStream: (_ pluginMediaStream: PluginMediaStream) -> Void
	) {

		NSLog("PluginGetUserMedia#call()")

		var videoRequested: Bool = false
		var audioRequested: Bool = false

		if (constraints.object(forKey: "video") != nil) {
			videoRequested = true
		}

		if constraints.object(forKey: "audio") != nil {
			audioRequested = true
		}

		var rtcMediaStream: RTCMediaStream
		var pluginMediaStream: PluginMediaStream?
		var rtcAudioTrack: RTCAudioTrack?
		var rtcVideoTrack: RTCVideoTrack?
		var rtcVideoSource: RTCVideoSource?

		if videoRequested == true {
			switch AVCaptureDevice.authorizationStatus(for: AVMediaType.video) {
			case AVAuthorizationStatus.notDetermined:
				NSLog("PluginGetUserMedia#call() | video authorization: not determined")
			case AVAuthorizationStatus.authorized:
				NSLog("PluginGetUserMedia#call() | video authorization: authorized")
			case AVAuthorizationStatus.denied:
				NSLog("PluginGetUserMedia#call() | video authorization: denied")
				errback("video denied")
				return
			case AVAuthorizationStatus.restricted:
				NSLog("PluginGetUserMedia#call() | video authorization: restricted")
				errback("video restricted")
				return
			}
		}

		if audioRequested == true {
			switch AVCaptureDevice.authorizationStatus(for: AVMediaType.audio) {
			case AVAuthorizationStatus.notDetermined:
				NSLog("PluginGetUserMedia#call() | audio authorization: not determined")
			case AVAuthorizationStatus.authorized:
				NSLog("PluginGetUserMedia#call() | audio authorization: authorized")
			case AVAuthorizationStatus.denied:
				NSLog("PluginGetUserMedia#call() | audio authorization: denied")
				errback("audio denied")
				return
			case AVAuthorizationStatus.restricted:
				NSLog("PluginGetUserMedia#call() | audio authorization: restricted")
				errback("audio restricted")
				return
			}
		}

		rtcMediaStream = self.rtcPeerConnectionFactory.mediaStream(withStreamId: UUID().uuidString)

		if videoRequested {

			NSLog("PluginGetUserMedia#call() | video requested")

			rtcVideoSource = self.rtcPeerConnectionFactory.videoSource()

			rtcVideoTrack = self.rtcPeerConnectionFactory.videoTrack(with: rtcVideoSource!, trackId: UUID().uuidString)

			// Handle legacy plugin instance or video: true
			var videoConstraints : NSDictionary = [:];
			if (!(constraints.object(forKey: "video") is Bool)) {
			   videoConstraints = constraints.object(forKey: "video") as! NSDictionary
			}

			NSLog("PluginGetUserMedia#call() | chosen video constraints: %@", videoConstraints)

// Ignore Simulator cause does not support Camera
#if !targetEnvironment(simulator)
			let videoCapturer: RTCCameraVideoCapturer = RTCCameraVideoCapturer(delegate: rtcVideoSource!)
			let videoCaptureController: PluginRTCCameraCaptureController = PluginRTCCameraCaptureController(capturer: videoCapturer)
			rtcVideoTrack!.videoCaptureController = videoCaptureController

			let constraintsSatisfied = videoCaptureController.setConstraints(constraints: videoConstraints)
			if (!constraintsSatisfied) {
				errback("constraints not satisfied")
				return
			}

			let captureStarted = videoCaptureController.startCapture()
			if (!captureStarted) {
				errback("constraints failed")
				return
			}
#endif

			// If videoSource state is "ended" it means that constraints were not satisfied so
			// invoke the given errback.
			if (rtcVideoSource!.state == RTCSourceState.ended) {
				NSLog("PluginGetUserMedia() | rtcVideoSource.state is 'ended', constraints not satisfied")

				errback("constraints not satisfied")
				return
			}

			if let device = rtcVideoTrack!.videoCaptureController?.device {
				rtcVideoTrack!.capabilities["deviceId"] = device.uniqueID
			}

			rtcMediaStream.addVideoTrack(rtcVideoTrack!)
		}

		if audioRequested == true {

			NSLog("PluginGetUserMedia#call() | audio requested")

			// Handle legacy plugin instance or audio: true
			var audioConstraints : NSDictionary = [:];
			if (!(constraints.object(forKey: "audio") is Bool)) {
			   audioConstraints = constraints.object(forKey: "audio") as! NSDictionary
			}

			NSLog("PluginGetUserMedia#call() | chosen audio constraints: %@", audioConstraints)


			var audioDeviceId = audioConstraints.object(forKey: "deviceId") as? String
			if(audioDeviceId == nil && audioConstraints.object(forKey: "deviceId") != nil){
				let audioId = audioConstraints.object(forKey: "deviceId") as! NSDictionary
				audioDeviceId = audioId.object(forKey: "exact") as? String
				if(audioDeviceId == nil){
					audioDeviceId = audioId.object(forKey: "ideal") as? String
				}
			}

			rtcAudioTrack = self.rtcPeerConnectionFactory.audioTrack(withTrackId: UUID().uuidString)
			rtcMediaStream.addAudioTrack(rtcAudioTrack!)

			if (audioDeviceId != nil) {
				PluginRTCAudioController.saveInputAudioDevice(inputDeviceUID: audioDeviceId!)
			}
		}

		pluginMediaStream = PluginMediaStream(rtcMediaStream: rtcMediaStream)
		pluginMediaStream!.run()

		// Let the plugin store it in its dictionary.
		eventListenerForNewStream(pluginMediaStream!)

		callback([
			"stream": pluginMediaStream!.getJSON()
		])
	}
}
