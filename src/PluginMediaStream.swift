import Foundation

class PluginMediaStream : NSObject {

	var rtcMediaStream: RTCMediaStream
	var id: String
	var audioTracks: [String : PluginMediaStreamTrack] = [:]
	var videoTracks: [String : PluginMediaStreamTrack] = [:]
	var eventListener: ((_ data: NSDictionary) -> Void)?
	var eventListenerForAddTrack: ((_ pluginMediaStreamTrack: PluginMediaStreamTrack) -> Void)?
	var eventListenerForRemoveTrack: ((_ pluginMediaStreamTrack: PluginMediaStreamTrack) -> Void)?

	/**
	 * Constructor for pc.onaddstream event and getUserMedia().
	 */
	init(rtcMediaStream: RTCMediaStream, streamId: String? = nil) {
		NSLog("PluginMediaStream#init()")

		self.rtcMediaStream = rtcMediaStream;

		if (streamId == nil) {

			// Handle possible duplicate remote trackId with janus or short duplicate name
			// See following issues:
			// - https://github.com/cordova-rtc/cordova-plugin-iosrtc/issues/432
			// - https://github.com/cordova-rtc/cordova-plugin-iosrtc/issues/647

			let shouldPreffixInvalidMediaId = Bundle.main.object(forInfoDictionaryKey: "PreffixInvalidMediaId") as? String

			if (shouldPreffixInvalidMediaId == "TRUE" && rtcMediaStream.streamId.count < 36) {
				self.id = rtcMediaStream.streamId + "_" + UUID().uuidString;
			} else {
				self.id = rtcMediaStream.streamId;
			}
		} else {
			self.id = streamId!;
		}

		for track: RTCMediaStreamTrack in (self.rtcMediaStream.audioTracks as Array<RTCMediaStreamTrack>) {
			let pluginMediaStreamTrack = PluginMediaStreamTrack(rtcMediaStreamTrack: track)

			pluginMediaStreamTrack.run()
			self.audioTracks[pluginMediaStreamTrack.id] = pluginMediaStreamTrack
		}

		for track: RTCMediaStreamTrack in (self.rtcMediaStream.videoTracks as Array<RTCMediaStreamTrack>) {
			let pluginMediaStreamTrack = PluginMediaStreamTrack(rtcMediaStreamTrack: track)

			pluginMediaStreamTrack.run()
			self.videoTracks[pluginMediaStreamTrack.id] = pluginMediaStreamTrack
		}
	}

	deinit {
		NSLog("PluginMediaStream#deinit()")
		stop();
	}

	func run() {
		NSLog("PluginMediaStream#run()")
	}

	func stop() {
		NSLog("PluginMediaStream#stop()")

		for (_, track) in audioTracks {
			if(self.eventListenerForRemoveTrack != nil) {
				self.eventListenerForRemoveTrack!(track)
			}
		}
		for (_, track) in videoTracks {
			if(self.eventListenerForRemoveTrack != nil) {
				self.eventListenerForRemoveTrack!(track)
			}
		}
	}

	func getJSON() -> NSDictionary {
		let json: NSMutableDictionary = [
			"id": self.id,
			"audioTracks": NSMutableDictionary(),
			"videoTracks": NSMutableDictionary()
		]

		for (id, pluginMediaStreamTrack) in self.audioTracks {
			(json["audioTracks"] as! NSMutableDictionary)[id] = pluginMediaStreamTrack.getJSON()
		}

		for (id, pluginMediaStreamTrack) in self.videoTracks {
			(json["videoTracks"] as! NSMutableDictionary)[id] = pluginMediaStreamTrack.getJSON()
		}

		return json as NSDictionary
	}

	func setListener(
		_ eventListener: @escaping (_ data: NSDictionary) -> Void,
		eventListenerForAddTrack: ((_ pluginMediaStreamTrack: PluginMediaStreamTrack) -> Void)?,
		eventListenerForRemoveTrack: ((_ pluginMediaStreamTrack: PluginMediaStreamTrack) -> Void)?
	) {
		NSLog("PluginMediaStream#setListener()")

		self.eventListener = eventListener
		self.eventListenerForAddTrack = eventListenerForAddTrack
		self.eventListenerForRemoveTrack = eventListenerForRemoveTrack
	}

	func hasTrack(_ pluginMediaStreamTrack: PluginMediaStreamTrack) -> Bool {
		if pluginMediaStreamTrack.kind == "audio" {
			return self.audioTracks[pluginMediaStreamTrack.id] != nil;
		} else if pluginMediaStreamTrack.kind == "video" {
			return self.videoTracks[pluginMediaStreamTrack.id] != nil;
		} else {
			return false
		}
	}

	func addTrack(_ pluginMediaStreamTrack: PluginMediaStreamTrack) -> Bool {
		NSLog("PluginMediaStream#addTrack()")

		if pluginMediaStreamTrack.kind == "audio" {
			self.rtcMediaStream.addAudioTrack(pluginMediaStreamTrack.rtcMediaStreamTrack as! RTCAudioTrack)
			NSLog("PluginMediaStream#addTrack() | audio track added")
			self.audioTracks[pluginMediaStreamTrack.id] = pluginMediaStreamTrack
		} else if pluginMediaStreamTrack.kind == "video" {
			self.rtcMediaStream.addVideoTrack(pluginMediaStreamTrack.rtcMediaStreamTrack as! RTCVideoTrack)
			NSLog("PluginMediaStream#addTrack() | video track added")
			self.videoTracks[pluginMediaStreamTrack.id] = pluginMediaStreamTrack
		} else {
			return false
		}

		onAddTrack(pluginMediaStreamTrack)
		return true
	}

	func removeTrack(_ pluginMediaStreamTrack: PluginMediaStreamTrack) -> Bool {
		NSLog("PluginMediaStream#removeTrack()")

		if pluginMediaStreamTrack.kind == "audio" {
			self.audioTracks[pluginMediaStreamTrack.id] = nil
			self.rtcMediaStream.removeAudioTrack(pluginMediaStreamTrack.rtcMediaStreamTrack as! RTCAudioTrack)
			NSLog("PluginMediaStream#removeTrack() | audio track removed")
		} else if pluginMediaStreamTrack.kind == "video" {
			self.videoTracks[pluginMediaStreamTrack.id] = nil
			self.rtcMediaStream.removeVideoTrack(pluginMediaStreamTrack.rtcMediaStreamTrack as! RTCVideoTrack)
			NSLog("PluginMediaStream#removeTrack() | video track removed")
		} else {
			return false
		}

		onRemoveTrack(pluginMediaStreamTrack)
		return true
	}

	func onAddTrack(_ track: PluginMediaStreamTrack) {
		NSLog("PluginMediaStream | OnAddTrack [label:%@]", String(track.id))

		track.run()

		if self.eventListener != nil {
			self.eventListenerForAddTrack!(track)

			self.eventListener!([
				"type": "addtrack",
				"track": track.getJSON()
			])
		}
	}

	func onRemoveTrack(_ track: PluginMediaStreamTrack) {
		NSLog("PluginMediaStream | OnRemoveTrack [label:%@]", String(track.id))

		// It may happen that track was removed due to user action (removeTrack()).
		if self.audioTracks[track.id] != nil {
			self.audioTracks[track.id] = nil
		} else if self.videoTracks[track.id] != nil {
			self.videoTracks[track.id] = nil
		} else {
			return
		}

		if self.eventListener != nil {
			self.eventListenerForRemoveTrack!(track)

			self.eventListener!([
				"type": "removetrack",
				"track": [
					"id": track.id,
					"kind": track.kind
				]
			])
		}
	}
}
