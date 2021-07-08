import Foundation


class PluginMediaStreamTrack : NSObject {
	var rtcMediaStreamTrack: RTCMediaStreamTrack
	var id: String
	var kind: String
	var eventListener: ((_ data: NSDictionary) -> Void)?
	var eventListenerForEnded: (() -> Void)?
	var lostStates = Array<String>()
	var renders: [String : PluginMediaStreamRenderer]

	init(rtcMediaStreamTrack: RTCMediaStreamTrack, trackId: String? = nil) {
		NSLog("PluginMediaStreamTrack#init()")

		self.rtcMediaStreamTrack = rtcMediaStreamTrack

		if (trackId == nil) {

			// Handle possible duplicate remote trackId with janus or short duplicate name
			// See following issues:
			// - https://github.com/cordova-rtc/cordova-plugin-iosrtc/issues/432
			// - https://github.com/cordova-rtc/cordova-plugin-iosrtc/issues/647

			let shouldPreffixInvalidMediaId = Bundle.main.object(forInfoDictionaryKey: "PreffixInvalidMediaId") as? String

			if (shouldPreffixInvalidMediaId == "TRUE" && rtcMediaStreamTrack.trackId.count < 36) {
				self.id = rtcMediaStreamTrack.trackId + "_" + UUID().uuidString;
			} else {
				self.id = rtcMediaStreamTrack.trackId;
			}
		} else {
			self.id = trackId!;
		}

		self.kind = rtcMediaStreamTrack.kind
		self.renders = [:]
	}

	deinit {
		NSLog("PluginMediaStreamTrack#deinit()")
		stop()
	}

	func run() {
		NSLog("PluginMediaStreamTrack#run() [kind:%@, id:%@]", String(self.kind), String(self.id))
	}

	func getReadyState() -> String {
		switch self.rtcMediaStreamTrack.readyState  {
		case RTCMediaStreamTrackState.live:
			return "live"
		case RTCMediaStreamTrackState.ended:
			return "ended"
		default:
			return "ended"
		}
	}

	func getJSON() -> NSDictionary {
		return [
			"id": self.id,
			"kind": self.kind,
			"trackId": self.rtcMediaStreamTrack.trackId,
			"enabled": self.rtcMediaStreamTrack.isEnabled ? true : false,
			"capabilities": self.rtcMediaStreamTrack.capabilities,
			"readyState": self.getReadyState()
		]
	}

	func setListener(
		_ eventListener: @escaping (_ data: NSDictionary) -> Void,
		eventListenerForEnded: @escaping () -> Void
	) {
		if(self.eventListener != nil){
			NSLog("PluginMediaStreamTrack#setListener():Error Listener already Set [kind:%@, id:%@]", String(self.kind), String(self.id));
			return;
		}

		NSLog("PluginMediaStreamTrack#setListener() [kind:%@, id:%@]", String(self.kind), String(self.id))

		self.eventListener = eventListener
		self.eventListenerForEnded = eventListenerForEnded

		for readyState in self.lostStates {
			self.eventListener!([
				"type": "statechange",
				"readyState": readyState,
				"enabled": self.rtcMediaStreamTrack.isEnabled ? true : false
			])

			if readyState == "ended" {
				if(self.eventListenerForEnded != nil) {
					self.eventListenerForEnded!()
				}
			}
		}
		self.lostStates.removeAll()
	}

	func setEnabled(_ value: Bool) {
		NSLog("PluginMediaStreamTrack#setEnabled() [kind:%@, id:%@, value:%@]",
			String(self.kind), String(self.id), String(value))

		if (self.rtcMediaStreamTrack.isEnabled != value) {
			self.rtcMediaStreamTrack.isEnabled = value
			if (value) {
				self.rtcMediaStreamTrack.videoCaptureController?.startCapture()
			}else {
				self.rtcMediaStreamTrack.videoCaptureController?.stopCapture()
			}
		}
	}

	func switchCamera() {
		self.rtcMediaStreamTrack.videoCaptureController?.switchCamera()
	}

	func registerRender(render: PluginMediaStreamRenderer) {
		if let exist = self.renders[render.id] {
			_ = exist
		} else {
			self.renders[render.id] = render
		}
	}

	func unregisterRender(render: PluginMediaStreamRenderer) {
		self.renders.removeValue(forKey: render.id);
	}

	func stop() {
		NSLog("PluginMediaStreamTrack#stop() [kind:%@, id:%@]", String(self.kind), String(self.id))

		self.rtcMediaStreamTrack.videoCaptureController?.stopCapture();

		// Let's try setEnabled(false), but it also fails.
		self.rtcMediaStreamTrack.isEnabled = false
		// eventListener could be null if the track is never used
		if(self.eventListener != nil){
			self.eventListener!([
				"type": "statechange",
				"readyState": "ended",
				"enabled": self.rtcMediaStreamTrack.isEnabled ? true : false
			])
		}

		for (_, render) in self.renders {
			render.stop()
		}
		self.renders.removeAll();
	}
}
