import Foundation
import AVFoundation
import ReplayKit

class PluginGetDisplayMedia {

	var rtcPeerConnectionFactory: RTCPeerConnectionFactory

	init(rtcPeerConnectionFactory: RTCPeerConnectionFactory) {
		NSLog("PluginGetDisplayMedia#init()")
		self.rtcPeerConnectionFactory = rtcPeerConnectionFactory
	}

	deinit {
		NSLog("PluginGetDisplayMedia#deinit()")
	}

	func call(
		_ constraints: NSDictionary,
		callback: @escaping (_ data: NSDictionary) -> Void,
		errback: @escaping (_ error: String) -> Void,
		eventListenerForNewStream: @escaping (_ pluginMediaStream: PluginMediaStream) -> Void
	) {

		NSLog("PluginGetDisplayMedia#call()")
		if #available(iOS 11.0, *) {
			
			let recorder = RPScreenRecorder.shared()
			
			if (recorder.isRecording) {
				recorder.stopRecording {(preview, error) in
					if (error != nil) {
						errback(error!.localizedDescription)
					} else {
						self.startCapture(recorder: recorder, callback: callback, errback: errback, eventListenerForNewStream: eventListenerForNewStream)
					}
				}
			} else if (recorder.isAvailable) {
				self.startCapture(recorder: recorder, callback: callback, errback: errback, eventListenerForNewStream: eventListenerForNewStream)
			} else {
				errback("Screen recorder is not available!")
			}
			
		} else {
			errback("Screen recorder is not available!")
		}
	}
	
	@available(iOS 11.0, *)
	func startCapture(
		recorder: RPScreenRecorder,
		callback: @escaping (_ data: NSDictionary) -> Void,
		errback: @escaping (_ error: String) -> Void,
		eventListenerForNewStream: @escaping (_ pluginMediaStream: PluginMediaStream) -> Void
	) {

		let rtcVideoSource: RTCVideoSource = self.rtcPeerConnectionFactory.videoSource()
		let videoCapturer: RTCVideoCapturer = RTCVideoCapturer(delegate: rtcVideoSource)
		let rtcMediaStream: RTCMediaStream = self.rtcPeerConnectionFactory.mediaStream(withStreamId: UUID().uuidString)
		let rtcVideoTrack: RTCVideoTrack = self.rtcPeerConnectionFactory.videoTrack(
			with: rtcVideoSource, trackId: UUID().uuidString)
	  
		let videoCaptureController: PluginRTCScreenCaptureController = PluginRTCScreenCaptureController(capturer: videoCapturer, recorder: recorder, source: rtcVideoSource)
		rtcVideoTrack.videoCaptureController = videoCaptureController
		
		// TODO use startCapture completionHandler
		let captureStarted = videoCaptureController.startCapture()
		if (!captureStarted) {
			errback("constraints failed")
			return
		}
		
		// If videoSource state is "ended" it means that constraints were not satisfied so
		// invoke the given errback.
		if (rtcVideoSource.state == RTCSourceState.ended) {
		  NSLog("PluginGetDisplayMedia() | rtcVideoSource.state is 'ended', constraints not satisfied")

		  errback("constraints not satisfied")
		  return
		}

		rtcMediaStream.addVideoTrack(rtcVideoTrack)
		
		let pluginMediaStream: PluginMediaStream = PluginMediaStream(rtcMediaStream: rtcMediaStream)
		pluginMediaStream.run()

		// Let the plugin store it in its dictionary.
		eventListenerForNewStream(pluginMediaStream)

		callback([
			"stream": pluginMediaStream.getJSON()
		])
	}
}
