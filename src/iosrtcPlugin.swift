import Foundation
import AVFoundation


@objc(iosrtcPlugin) // This class must be accesible from Objective-C.
class iosrtcPlugin : CDVPlugin {
	// RTCPeerConnectionFactory single instance.
	var rtcPeerConnectionFactory: RTCPeerConnectionFactory!
	// Single PluginGetUserMedia instance.
	var pluginGetUserMedia: PluginGetUserMedia!
	// PluginRTCPeerConnection dictionary.
	var pluginRTCPeerConnections: [Int : PluginRTCPeerConnection]!
	// PluginMediaStream dictionary.
	var pluginMediaStreams: [String : PluginMediaStream]!
	// PluginMediaStreamTrack dictionary.
	var pluginMediaStreamTracks: [String : PluginMediaStreamTrack]!
	// PluginMediaStreamRenderer dictionary.
	var pluginMediaStreamRenderers: [Int : PluginMediaStreamRenderer]!
	// Dispatch queue for serial operations.
	var queue: DispatchQueue!
	// Auto selecting output speaker
	var audioOutputController: PluginRTCAudioController!
	// Single PluginWebSocketServer instance.
	var webSocketServer: PluginWebSocketServer?



	// This is just called if <param name="onload" value="true" /> in plugin.xml.
	@objc(pluginInitialize) override func pluginInitialize() {
		NSLog("iosrtcPlugin#pluginInitialize()")

		// Make the web view transparent
		self.webView!.isOpaque = false
		self.webView!.backgroundColor = UIColor.clear

		pluginMediaStreams = [:]
		pluginMediaStreamTracks = [:]
		pluginMediaStreamRenderers = [:]
		queue = DispatchQueue(label: "cordova-plugin-iosrtc", attributes: [])
		pluginRTCPeerConnections = [:]

		// Initialize DTLS stuff.
		RTCInitializeSSL()
		//RTCSetMinDebugLogLevel(RTCLoggingSeverity.warning)

		// Create a RTCPeerConnectionFactory.
		self.initPeerConnectionFactory();

		// Create a PluginGetUserMedia instance.
		self.pluginGetUserMedia = PluginGetUserMedia(
			rtcPeerConnectionFactory: rtcPeerConnectionFactory
		)

		// Create a PluginRTCAudioController instance.
		self.audioOutputController = PluginRTCAudioController()

		// Create a PluginWebSocketServer instance.
		self.webSocketServer = PluginWebSocketServer()
		
		// Start server here for testing.
		// (there have interfaces start/stopCanvasServer which can be called from js)
		startWebSocketServer(listenPort: 12345)
	}

	private func initPeerConnectionFactory() {
		let encoderFactory = RTCDefaultVideoEncoderFactory()
		let decoderFactory = RTCDefaultVideoDecoderFactory()
		encoderFactory.preferredCodec = getSupportedVideoEncoder(factory: encoderFactory)

		self.rtcPeerConnectionFactory = RTCPeerConnectionFactory(
			encoderFactory: encoderFactory,
			decoderFactory: decoderFactory
		)
	}

	private func getSupportedVideoEncoder(factory: RTCDefaultVideoEncoderFactory) -> RTCVideoCodecInfo {
		let supportedCodecs: [RTCVideoCodecInfo] = RTCDefaultVideoEncoderFactory.supportedCodecs()
		if supportedCodecs.contains(RTCVideoCodecInfo.init(name: kRTCH264CodecName)){
			return RTCVideoCodecInfo.init(name: kRTCH264CodecName)
		} else if supportedCodecs.contains(RTCVideoCodecInfo.init(name: kRTCVp9CodecName)) {
			return RTCVideoCodecInfo.init(name: kRTCVp9CodecName)
		} else {
			return RTCVideoCodecInfo.init(name: kRTCVp8CodecName)
		}
	}

	private func startWebSocketServer(listenPort: Int) {
		let started = self.webSocketServer?.isStarted() ?? false
		if (!started) {
			self.webSocketServer?.start(lport: listenPort, tcpNoDelay: true)
		}
	}

	private func stopWebSocketServer() {
		self.webSocketServer?.stop()
	}

	@objc(onReset) override func onReset() {
		NSLog("iosrtcPlugin#onReset() | cleanup")
		cleanup();
	}

	@objc(onAppTerminate) override func onAppTerminate() {
		NSLog("iosrtcPlugin#onAppTerminate() | cleanup")
		cleanup();
		stopWebSocketServer();
	}

	@objc(new_RTCPeerConnection:) func new_RTCPeerConnection(_ command: CDVInvokedUrlCommand) {
		NSLog("iosrtcPlugin#new_RTCPeerConnection()")

		let pcId = command.argument(at: 0) as! Int
		var pcConfig: NSDictionary?
		var pcConstraints: NSDictionary?

		if command.argument(at: 1) != nil {
			pcConfig = command.argument(at: 1) as? NSDictionary
		}

		if command.argument(at: 2) != nil {
			pcConstraints = command.argument(at: 2) as? NSDictionary
		}

		let pluginRTCPeerConnection = PluginRTCPeerConnection(
			rtcPeerConnectionFactory: self.rtcPeerConnectionFactory,
			pcConfig: pcConfig,
			pcConstraints: pcConstraints,
			eventListener: { (data: NSDictionary) -> Void in
				let result = CDVPluginResult(
					status: CDVCommandStatus_OK,
					messageAs: data as? [AnyHashable: Any]
				)

				// Allow more callbacks.
				result?.setKeepCallbackAs(true);
				self.emit(command.callbackId, result: result!)
			},
			eventListenerForAddStream: self.saveMediaStream,
			eventListenerForRemoveStream: self.deleteMediaStream,
			eventListenerForAddTrack: self.saveMediaStreamTrack,
			eventListenerForRemoveTrack: self.deleteMediaStreamTrack
		)

		// Store the pluginRTCPeerConnection into the dictionary.
		self.pluginRTCPeerConnections[pcId] = pluginRTCPeerConnection

		// Run it.
		pluginRTCPeerConnection.run()
	}

	@objc(RTCPeerConnection_createOffer:) func RTCPeerConnection_createOffer(_ command: CDVInvokedUrlCommand) {
		NSLog("iosrtcPlugin#RTCPeerConnection_createOffer()")

		let pcId = command.argument(at: 0) as! Int
		var options: NSDictionary?

		if command.argument(at: 1) != nil {
			options = command.argument(at: 1) as? NSDictionary
		}

		let pluginRTCPeerConnection = self.pluginRTCPeerConnections[pcId]

		if pluginRTCPeerConnection == nil {
			NSLog("iosrtcPlugin#RTCPeerConnection_createOffer() | ERROR: pluginRTCPeerConnection with pcId=%@ does not exist", String(pcId))
			return;
		}

		self.queue.async { [weak pluginRTCPeerConnection] in
			pluginRTCPeerConnection?.createOffer(options,
				callback: { (data: NSDictionary) -> Void in
					self.emit(command.callbackId,
						result: CDVPluginResult(
							status: CDVCommandStatus_OK,
							messageAs: data as? [AnyHashable: Any]
						)
					)
				},
				errback: { (error: Error) -> Void in
					self.emit(command.callbackId,
						result: CDVPluginResult(status: CDVCommandStatus_ERROR, messageAs: error.localizedDescription)
					)
				}
			)
		}
	}

	@objc(RTCPeerConnection_createAnswer:) func RTCPeerConnection_createAnswer(_ command: CDVInvokedUrlCommand) {
		NSLog("iosrtcPlugin#RTCPeerConnection_createAnswer()")

		let pcId = command.argument(at: 0) as! Int
		var options: NSDictionary?

		if command.argument(at: 1) != nil {
			options = command.argument(at: 1) as? NSDictionary
		}

		let pluginRTCPeerConnection = self.pluginRTCPeerConnections[pcId]

		if pluginRTCPeerConnection == nil {
			NSLog("iosrtcPlugin#RTCPeerConnection_createAnswer() | ERROR: pluginRTCPeerConnection with pcId=%@ does not exist", String(pcId))
			return;
		}

		self.queue.async { [weak pluginRTCPeerConnection] in
			pluginRTCPeerConnection?.createAnswer(options,
				callback: { (data: NSDictionary) -> Void in
					self.emit(command.callbackId,
						result: CDVPluginResult(
							status: CDVCommandStatus_OK,
							messageAs: data as? [AnyHashable: Any]
						)
					)
				},
				errback: { (error: Error) -> Void in
					self.emit(command.callbackId,
						result: CDVPluginResult(status: CDVCommandStatus_ERROR, messageAs: error.localizedDescription)
					)
				}
			)
		}
	}

	@objc(RTCPeerConnection_setLocalDescription:) func RTCPeerConnection_setLocalDescription(_ command: CDVInvokedUrlCommand) {
		NSLog("iosrtcPlugin#RTCPeerConnection_setLocalDescription()")

		let pcId = command.argument(at: 0) as! Int
		let desc = command.argument(at: 1) as! NSDictionary
		let pluginRTCPeerConnection = self.pluginRTCPeerConnections[pcId]

		if pluginRTCPeerConnection == nil {
			NSLog("iosrtcPlugin#RTCPeerConnection_setLocalDescription() | ERROR: pluginRTCPeerConnection with pcId=%@ does not exist", String(pcId))
			return;
		}

		self.queue.async { [weak pluginRTCPeerConnection] in
			pluginRTCPeerConnection?.setLocalDescription(desc,
				callback: { (data: NSDictionary) -> Void in
					self.emit(command.callbackId,
						result: CDVPluginResult(
							status: CDVCommandStatus_OK,
							messageAs: data as? [AnyHashable: Any]
						)
					)
				},
				errback: { (error: Error) -> Void in
					self.emit(command.callbackId,
						result: CDVPluginResult(status: CDVCommandStatus_ERROR, messageAs: error.localizedDescription)
					)
				}
			)
		}
	}

	@objc(RTCPeerConnection_setRemoteDescription:) func RTCPeerConnection_setRemoteDescription(_ command: CDVInvokedUrlCommand) {
		NSLog("iosrtcPlugin#RTCPeerConnection_setRemoteDescription()")

		let pcId = command.argument(at: 0) as! Int
		let desc = command.argument(at: 1) as! NSDictionary
		let pluginRTCPeerConnection = self.pluginRTCPeerConnections[pcId]

		if pluginRTCPeerConnection == nil {
			NSLog("iosrtcPlugin#RTCPeerConnection_setRemoteDescription() | ERROR: pluginRTCPeerConnection with pcId=%@ does not exist", String(pcId))
			return;
		}

		self.queue.async { [weak pluginRTCPeerConnection] in
			pluginRTCPeerConnection?.setRemoteDescription(desc,
				callback: { (data: NSDictionary) -> Void in
					self.emit(command.callbackId,
						result: CDVPluginResult(
							status: CDVCommandStatus_OK,
							messageAs: data as? [AnyHashable: Any]
						)
					)
				},
				errback: { (error: Error) -> Void in
					self.emit(command.callbackId,
						result: CDVPluginResult(status: CDVCommandStatus_ERROR, messageAs: error.localizedDescription)
					)
				}
			)
		}
	}

	@objc(RTCPeerConnection_addIceCandidate:) func RTCPeerConnection_addIceCandidate(_ command: CDVInvokedUrlCommand) {
		NSLog("iosrtcPlugin#RTCPeerConnection_addIceCandidate()")

		if command.argument(at: 1) == nil {
			NSLog("iosrtcPlugin#RTCPeerConnection_addIceCandidate() | ERROR: pluginRTCPeerConnection argument is NIL")
			return;
		}

		let pcId = command.argument(at: 0) as! Int
		let candidate = command.argument(at: 1) as! NSDictionary
		let pluginRTCPeerConnection = self.pluginRTCPeerConnections[pcId]

		if pluginRTCPeerConnection == nil {
			NSLog("iosrtcPlugin#RTCPeerConnection_addIceCandidate() | ERROR: pluginRTCPeerConnection with pcId=%@ does not exist", String(pcId))
			return;
		}

		self.queue.async { [weak pluginRTCPeerConnection] in
			pluginRTCPeerConnection?.addIceCandidate(candidate,
				callback: { (data: NSDictionary) -> Void in
					self.emit(command.callbackId,
						result: CDVPluginResult(
							status: CDVCommandStatus_OK,
							messageAs: data as? [AnyHashable: Any]
						)
					)
				},
				errback: { () -> Void in
					self.emit(command.callbackId,
						result: CDVPluginResult(status: CDVCommandStatus_ERROR)
					)
				}
			)
		}
	}

	@objc(RTCPeerConnection_addStream:) func RTCPeerConnection_addStream(_ command: CDVInvokedUrlCommand) {
		NSLog("iosrtcPlugin#RTCPeerConnection_addStream()")

		let pcId = command.argument(at: 0) as! Int
		let streamId = command.argument(at: 1) as! String
		let pluginRTCPeerConnection = self.pluginRTCPeerConnections[pcId]
		let pluginMediaStream = self.pluginMediaStreams[streamId]

		if pluginRTCPeerConnection == nil {
			NSLog("iosrtcPlugin#RTCPeerConnection_addStream() | ERROR: pluginRTCPeerConnection with pcId=%@ does not exist", String(pcId))
			return;
		}

		if pluginMediaStream == nil {
			NSLog("iosrtcPlugin#RTCPeerConnection_addStream() | ERROR: pluginMediaStream with id=%@ does not exist", String(streamId))
			return;
		}

		self.queue.async { [weak pluginRTCPeerConnection, weak pluginMediaStream] in
			if pluginRTCPeerConnection?.addStream(pluginMediaStream!) == true {
				self.saveMediaStream(pluginMediaStream!)
			}
		}
	}

	@objc(RTCPeerConnection_removeStream:) func RTCPeerConnection_removeStream(_ command: CDVInvokedUrlCommand) {
		NSLog("iosrtcPlugin#RTCPeerConnection_removeStream()")

		let pcId = command.argument(at: 0) as! Int
		let streamId = command.argument(at: 1) as! String
		let pluginRTCPeerConnection = self.pluginRTCPeerConnections[pcId]
		let pluginMediaStream = self.pluginMediaStreams[streamId]

		if pluginRTCPeerConnection == nil {
			NSLog("iosrtcPlugin#RTCPeerConnection_removeStream() | ERROR: pluginRTCPeerConnection with pcId=%@ does not exist", String(pcId))
			return;
		}

		if pluginMediaStream == nil {
			NSLog("iosrtcPlugin#RTCPeerConnection_removeStream() | ERROR: pluginMediaStream with id=%@ does not exist", String(streamId))
			return;
		}

		self.queue.async { [weak pluginRTCPeerConnection, weak pluginMediaStream] in
			pluginRTCPeerConnection?.removeStream(pluginMediaStream!)
		}
	}

	@objc(RTCPeerConnection_addTrack:) func RTCPeerConnection_addTrack(_ command: CDVInvokedUrlCommand) {

		let pcId = command.argument(at: 0) as! Int
		let trackId = command.argument(at: 1) as! String
		let pluginRTCRtpTransceiverId = command.argument(at: 2) as! Int
		let pluginRTCRtpReceiverId = command.argument(at: 3) as! Int
		let pluginRTCRtpSenderId = command.argument(at: 4) as! Int
		var streamIds : [String] = [];
		let pluginRTCPeerConnection = self.pluginRTCPeerConnections[pcId]
		let pluginMediaStreamTrack = self.pluginMediaStreamTracks[trackId]

		if pluginRTCPeerConnection == nil {
			NSLog("iosrtcPlugin#RTCPeerConnection_addTrack() | ERROR: pluginRTCPeerConnection with pcId=%@ does not exist", String(pcId))
			return;
		}
		
		if command.argument(at: 5) != nil {
			let streamId = command.argument(at: 5) as! String
			let pluginMediaStream = self.pluginMediaStreams[streamId]
			
			if pluginMediaStream == nil {
				NSLog("iosrtcPlugin#RTCPeerConnection_addTrack() | ERROR: pluginMediaStream with id=%@ does not exist", String(streamId))
				return;
			}
			
			streamIds.append(pluginMediaStream!.id)
			self.saveMediaStream(pluginMediaStream!)
		}

		if pluginMediaStreamTrack == nil {
			NSLog("iosrtcPlugin#RTCPeerConnection_addTrack() | ERROR: pluginMediaStreamTrack with id=\(trackId) does not exist")
			return;
		}

		self.queue.async { [weak pluginRTCPeerConnection, weak pluginMediaStreamTrack] in
			let pluginRTCRtpSender = pluginRTCPeerConnection?.addTrack(pluginMediaStreamTrack!, pluginRTCRtpTransceiverId, pluginRTCRtpReceiverId, pluginRTCRtpSenderId, streamIds)
			self.emit(command.callbackId,
				result: CDVPluginResult(
					status: CDVCommandStatus_OK,
					messageAs: pluginRTCRtpSender?.getJSON() as? [AnyHashable: Any]
				)
			)
		}
	}

	@objc(RTCPeerConnection_removeTrack:) func RTCPeerConnection_removeTrack(_ command: CDVInvokedUrlCommand) {
		let pcId = command.argument(at: 0) as! Int
		let pluginRTCRtpSenderId = command.argument(at: 1) as! Int
		let pluginRTCPeerConnection = self.pluginRTCPeerConnections[pcId]

		if pluginRTCPeerConnection == nil {
			NSLog("iosrtcPlugin#RTCPeerConnection_removeTrack() | ERROR: pluginRTCPeerConnection with pcId=%@ does not exist", String(pcId))
			return;
		}
		
		self.queue.async { [weak pluginRTCPeerConnection] in
			let pluginRTCRtpSender = pluginRTCPeerConnection?.pluginRTCRtpSenders[pluginRTCRtpSenderId]
			if pluginRTCRtpSender == nil {
				NSLog("iosrtcPlugin#RTCPeerConnection_removeTrack() | ERROR: pluginRTCRtpSender with id=\(pluginRTCRtpSenderId) does not exist")
				return;
			}
			pluginRTCPeerConnection?.removeTrack(pluginRTCRtpSender!)
			// TODO remove only if not used by other stream
			// self.deleteMediaStreamTrack(pluginMediaStreamTrack!)
		}
	}

	@objc(RTCPeerConnection_addTransceiver:) func RTCPeerConnection_addTransceiver(_ command: CDVInvokedUrlCommand) {
		NSLog("iosrtcPlugin#RTCPeerConnection_addTransceiver()")

		let pcId = command.argument(at: 0) as! Int
		let trackIdOrMediaType = command.argument(at: 1) as? String

		var options: NSDictionary? = nil
		if command.argument(at: 2) != nil {
			options = command.argument(at: 2) as? NSDictionary
		}

		let transceiverId = command.argument(at: 3) as! Int
		let senderId = command.argument(at: 4) as! Int
		let receiverId = command.argument(at: 5) as! Int
		let receiverTrackId = command.argument(at: 6) as? String

		let pluginRTCPeerConnection = self.pluginRTCPeerConnections[pcId]

		if pluginRTCPeerConnection == nil {
			NSLog("iosrtcPlugin#RTCPeerConnection_addTransceiver() | ERROR: pluginRTCPeerConnection with pcId=%@ does not exist", String(pcId))
			return;
		}

		var pluginMediaStreamTrack: PluginMediaStreamTrack? = nil
		var mediaType: RTCRtpMediaType? = nil

		if trackIdOrMediaType == "video" {
			mediaType = RTCRtpMediaType.video
		} else if trackIdOrMediaType == "audio" {
			mediaType = RTCRtpMediaType.audio
		} else {
			pluginMediaStreamTrack = self.pluginMediaStreamTracks[trackIdOrMediaType!]

			if pluginMediaStreamTrack == nil {
            	NSLog("iosrtcPlugin#RTCPeerConnection_addTransceiver() | ERROR: pluginMediaStreamTrack with id=\(trackIdOrMediaType!) does not exist")
				return;
			}
		}

		self.queue.async { [weak pluginRTCPeerConnection, weak pluginMediaStreamTrack] in
            let callback = { (data: NSDictionary) -> Void in
                let result = CDVPluginResult(
                    status: CDVCommandStatus_OK,
                    messageAs: data as? [AnyHashable: Any]
                )
                
                result!.setKeepCallbackAs(true);
                self.emit(command.callbackId, result: result!)
            }

			pluginRTCPeerConnection!.addTransceiver(
				with: pluginMediaStreamTrack,
				of: mediaType,
				options: options,
				transceiverId: transceiverId,
				senderId: senderId,
				receiverId: receiverId,
				receiverTrackId: receiverTrackId!,
				callback: callback
            )
		}
	}

	@objc(RTCPeerConnection_RTCRtpTransceiver_setDirection:) func RTCPeerConnection_RTCRtpTransceiver_setDirection(_ command: CDVInvokedUrlCommand) {
		NSLog("iosrtcPlugin#RTCPeerConnection_RTCRtpTransceiver_setDirection()")

		let pcId = command.argument(at: 0) as! Int
		let tcId = command.argument(at: 1) as! Int
		let direction = command.argument(at: 2) as! String
        
        let pluginRTCPeerConnection = pluginRTCPeerConnections[pcId]
        
        if pluginRTCPeerConnection == nil {
            NSLog("iosrtcPlugin#RTCPeerConnection_RTCRtpTransceiver_setDirection() | ERROR: pluginRTCPeerConnection with pcId=%@ does not exist", String(pcId))
            return;
        }

        let pluginRTCRtpTransceiver = pluginRTCPeerConnection!.pluginRTCRtpTransceivers[tcId]
        
        if pluginRTCRtpTransceiver == nil {
            NSLog("iosrtcPlugin#RTCPeerConnection_RTCRtpTransceiver_setDirection() | ERROR: pluginRTCRtpTransceiver with id=\(tcId) does not exist")
            return;
        }

		self.queue.async { [weak pluginRTCPeerConnection, weak pluginRTCRtpTransceiver] in
            let callback = { (data: NSDictionary) -> Void in
                let result = CDVPluginResult(
                    status: CDVCommandStatus_OK,
                    messageAs: data as? [AnyHashable: Any]
                )
                
                result!.setKeepCallbackAs(true);
                self.emit(command.callbackId, result: result!)
            }

			pluginRTCRtpTransceiver!.setDirection(direction: direction)

			let response: NSDictionary = [
				"transceivers": pluginRTCPeerConnection!.getTransceiversJSON()
			]

			callback(response)
		}
	}

	@objc(RTCPeerConnection_RTCRtpTransceiver_stop:) func RTCPeerConnection_RTCRtpTransceiver_stop(_ command: CDVInvokedUrlCommand) {
		NSLog("iosrtcPlugin#RTCPeerConnection_RTCRtpTransceiver_stop()")

        let pcId = command.argument(at: 0) as! Int
        let tcId = command.argument(at: 1) as! Int
        
        let pluginRTCPeerConnection = pluginRTCPeerConnections[pcId]
        
        if pluginRTCPeerConnection == nil {
            NSLog("iosrtcPlugin#RTCPeerConnection_RTCRtpTransceiver_stop() | ERROR: pluginRTCPeerConnection with pcId=%@ does not exist", String(pcId))
            return;
        }

		self.queue.async { [weak pluginRTCPeerConnection] in
			let pluginRTCRtpTransceiver = pluginRTCPeerConnection!.pluginRTCRtpTransceivers[tcId]
			if pluginRTCRtpTransceiver == nil {
				NSLog("iosrtcPlugin#RTCPeerConnection_RTCRtpTransceiver_stop() | ERROR: pluginRTCRtpTransceiver with id=\(tcId) does not exist")
				return;
			}

            let callback = { (data: NSDictionary) -> Void in
                let result = CDVPluginResult(
                    status: CDVCommandStatus_OK,
                    messageAs: data as? [AnyHashable: Any]
                )
                
                result!.setKeepCallbackAs(true);
                self.emit(command.callbackId, result: result!)
            }

			pluginRTCRtpTransceiver!.stop()

			let response: NSDictionary = [
				"transceivers": pluginRTCPeerConnection!.getTransceiversJSON()
			]

			callback(response)
		}
	}

	@objc(RTCPeerConnection_createDataChannel:) func RTCPeerConnection_createDataChannel(_ command: CDVInvokedUrlCommand) {
		NSLog("iosrtcPlugin#RTCPeerConnection_createDataChannel()")

		let pcId = command.argument(at: 0) as! Int
		let dcId = command.argument(at: 1) as! Int
		let label = command.argument(at: 2) as! String
		var options: NSDictionary?

		if command.argument(at: 3) != nil {
			options = command.argument(at: 3) as? NSDictionary
		}

		let pluginRTCPeerConnection = self.pluginRTCPeerConnections[pcId]

		if pluginRTCPeerConnection == nil {
			NSLog("iosrtcPlugin#RTCPeerConnection_createDataChannel() | ERROR: pluginRTCPeerConnection with pcId=%@ does not exist", String(pcId))
			return;
		}

		self.queue.async { [weak pluginRTCPeerConnection] in
			pluginRTCPeerConnection?.createDataChannel(dcId,
				label: label,
				options: options,
				eventListener: { (data: NSDictionary) -> Void in
					let result = CDVPluginResult(
						status: CDVCommandStatus_OK,
						messageAs: data as? [AnyHashable: Any]
					)

					// Allow more callbacks.
					result!.setKeepCallbackAs(true);
					self.emit(command.callbackId, result: result!)
				},
				eventListenerForBinaryMessage: { (data: Data) -> Void in
					let result = CDVPluginResult(status: CDVCommandStatus_OK, messageAsArrayBuffer: data)

					// Allow more callbacks.
					result!.setKeepCallbackAs(true);
					self.emit(command.callbackId, result: result!)
				}
			)
		}
	}

	@objc(RTCPeerConnection_getStats:) func RTCPeerConnection_getStats(_ command: CDVInvokedUrlCommand) {
//		NSLog("iosrtcPlugin#RTCPeerConnection_getStats()")

		let pcId = command.argument(at: 0) as! Int
		let pluginRTCPeerConnection = self.pluginRTCPeerConnections[pcId]

		if pluginRTCPeerConnection == nil {
			NSLog("iosrtcPlugin#RTCPeerConnection_getStats() | ERROR: pluginRTCPeerConnection with pcId=\(pcId) does not exist")
			return;
		}

		var pluginMediaStreamTrack: PluginMediaStreamTrack?

		if command.argument(at: 1) != nil {
			let trackId = command.argument(at: 1) as! String
			pluginMediaStreamTrack = self.pluginMediaStreamTracks[trackId]

			if pluginMediaStreamTrack == nil {
				NSLog("iosrtcPlugin#RTCPeerConnection_getStats() | ERROR: pluginMediaStreamTrack with id=\(trackId) does not exist")
				return;
			}
		}

		self.queue.async { [weak pluginRTCPeerConnection, weak pluginMediaStreamTrack] in
			pluginRTCPeerConnection?.getStats(pluginMediaStreamTrack,
				callback: { (array: [[String:Any]]) -> Void in
					self.emit(command.callbackId,
						result: CDVPluginResult(
							status: CDVCommandStatus_OK,
							messageAs: array as [AnyObject]
						)
					)
				},
				errback: { (error: NSError) -> Void in
					self.emit(command.callbackId,
						result: CDVPluginResult(
							status: CDVCommandStatus_ERROR,
							messageAs: error.localizedDescription
						)
					)
				}
			)
		}
	}

	@objc(RTCPeerConnection_close:) func RTCPeerConnection_close(_ command: CDVInvokedUrlCommand) {
		NSLog("iosrtcPlugin#RTCPeerConnection_close()")

		let pcId = command.argument(at: 0) as! Int
		let pluginRTCPeerConnection = self.pluginRTCPeerConnections[pcId]

		if pluginRTCPeerConnection == nil {
			NSLog("iosrtcPlugin#RTCPeerConnection_close() | ERROR: pluginRTCPeerConnection with pcId=%@ does not exist", String(pcId))
			return;
		}

		self.queue.async { [weak pluginRTCPeerConnection] in
			if pluginRTCPeerConnection != nil {
				pluginRTCPeerConnection!.close()
			}

			// Remove the pluginRTCPeerConnection from the dictionary.
			self.pluginRTCPeerConnections[pcId] = nil
		}
	}

	@objc(RTCPeerConnection_RTCDataChannel_setListener:) func RTCPeerConnection_RTCDataChannel_setListener(_ command: CDVInvokedUrlCommand) {
		NSLog("iosrtcPlugin#RTCPeerConnection_RTCDataChannel_setListener()")

		let pcId = command.argument(at: 0) as! Int
		let dcId = command.argument(at: 1) as! Int
		let pluginRTCPeerConnection = self.pluginRTCPeerConnections[pcId]

		if pluginRTCPeerConnection == nil {
			NSLog("iosrtcPlugin#RTCPeerConnection_RTCDataChannel_setListener() | ERROR: pluginRTCPeerConnection with pcId=%@ does not exist", String(pcId))
			return;
		}

		self.queue.async { [weak pluginRTCPeerConnection] in
			pluginRTCPeerConnection?.RTCDataChannel_setListener(dcId,
				eventListener: { (data: NSDictionary) -> Void in
					let result = CDVPluginResult(
						status: CDVCommandStatus_OK,
						messageAs: data as? [AnyHashable: Any]
					)

					// Allow more callbacks.
					result!.setKeepCallbackAs(true);
					self.emit(command.callbackId, result: result!)
				},
				eventListenerForBinaryMessage: { (data: Data) -> Void in
					let result = CDVPluginResult(status: CDVCommandStatus_OK, messageAsArrayBuffer: data)

					// Allow more callbacks.
					result!.setKeepCallbackAs(true);
					self.emit(command.callbackId, result: result!)
				}
			)
		}
	}

	@objc(RTCPeerConnection_RTCDataChannel_sendString:) func RTCPeerConnection_RTCDataChannel_sendString(_ command: CDVInvokedUrlCommand) {
		NSLog("iosrtcPlugin#RTCPeerConnection_RTCDataChannel_sendString()")

		let pcId = command.argument(at: 0) as! Int
		let dcId = command.argument(at: 1) as! Int
		let data = command.argument(at: 2) as! String
		let pluginRTCPeerConnection = self.pluginRTCPeerConnections[pcId]

		if pluginRTCPeerConnection == nil {
			NSLog("iosrtcPlugin#RTCPeerConnection_RTCDataChannel_sendString() | ERROR: pluginRTCPeerConnection with pcId=%@ does not exist", String(pcId))
			return;
		}

		self.queue.async { [weak pluginRTCPeerConnection] in
			pluginRTCPeerConnection?.RTCDataChannel_sendString(dcId,
				data: data,
				callback: { (data: NSDictionary) -> Void in
					self.emit(command.callbackId,
						result: CDVPluginResult(
							status: CDVCommandStatus_OK,
							messageAs: data as? [AnyHashable: Any]
						)
					)
				}
			)
		}
	}

	@objc(RTCPeerConnection_RTCDataChannel_sendBinary:) func RTCPeerConnection_RTCDataChannel_sendBinary(_ command: CDVInvokedUrlCommand) {
		NSLog("iosrtcPlugin#RTCPeerConnection_RTCDataChannel_sendBinary()")

		let pcId = command.argument(at: 0) as! Int
		let dcId = command.argument(at: 1) as! Int
		let data = command.argument(at: 2) as! Data
		let pluginRTCPeerConnection = self.pluginRTCPeerConnections[pcId]

		if pluginRTCPeerConnection == nil {
			NSLog("iosrtcPlugin#RTCPeerConnection_RTCDataChannel_sendBinary() | ERROR: pluginRTCPeerConnection with pcId=%@ does not exist", String(pcId))
			return;
		}

		self.queue.async { [weak pluginRTCPeerConnection] in
			pluginRTCPeerConnection?.RTCDataChannel_sendBinary(dcId,
				data: data,
				callback: { (data: NSDictionary) -> Void in
					self.emit(command.callbackId,
						result: CDVPluginResult(
							status: CDVCommandStatus_OK,
							messageAs: data as? [AnyHashable: Any]
						)
					)
				}
			)
		}
	}

	@objc(RTCPeerConnection_RTCDataChannel_close:) func RTCPeerConnection_RTCDataChannel_close(_ command: CDVInvokedUrlCommand) {
		NSLog("iosrtcPlugin#RTCPeerConnection_RTCDataChannel_close()")

		let pcId = command.argument(at: 0) as! Int
		let dcId = command.argument(at: 1) as! Int
		let pluginRTCPeerConnection = self.pluginRTCPeerConnections[pcId]

		if pluginRTCPeerConnection == nil {
			NSLog("iosrtcPlugin#RTCPeerConnection_RTCDataChannel_close() | ERROR: pluginRTCPeerConnection with pcId=%@ does not exist", String(pcId))
			return;
		}

		self.queue.async { [weak pluginRTCPeerConnection] in
			pluginRTCPeerConnection?.RTCDataChannel_close(dcId)
		}
	}

	@objc(RTCPeerConnection_createDTMFSender:) func RTCPeerConnection_createDTMFSender(_ command: CDVInvokedUrlCommand) {
		NSLog("iosrtcPlugin#RTCPeerConnection_createDTMFSender()")

		let pcId = command.argument(at: 0) as! Int
		let dsId = command.argument(at: 1) as! Int
		let trackId = command.argument(at: 2) as! String
		let pluginRTCPeerConnection = self.pluginRTCPeerConnections[pcId]
		let pluginMediaStreamTrack = self.pluginMediaStreamTracks[trackId]

		if pluginRTCPeerConnection == nil {
			NSLog("iosrtcPlugin#RTCPeerConnection_createDTMFSender() | ERROR: pluginRTCPeerConnection with pcId=%@ does not exist", String(pcId))
			return;
		}

		if pluginMediaStreamTrack == nil {
			NSLog("iosrtcPlugin#RTCPeerConnection_createDTMFSender() | ERROR: pluginMediaStreamTrack with id=%@ does not exist", String(trackId))
			return;
		}


		self.queue.async { [weak pluginRTCPeerConnection] in
			pluginRTCPeerConnection?.createDTMFSender(dsId,
				track: pluginMediaStreamTrack!,
				eventListener: { (data: NSDictionary) -> Void in
					let result = CDVPluginResult(
						status: CDVCommandStatus_OK,
						messageAs: data as? [AnyHashable: Any]
					)

					// Allow more callbacks.
					result!.setKeepCallbackAs(true);
					self.emit(command.callbackId, result: result!)
				}
			)
		}
	}

	@objc(RTCPeerConnection_RTCDTMFSender_insertDTMF:) func RTCPeerConnection_RTCDTMFSender_insertDTMF(_ command: CDVInvokedUrlCommand) {
		NSLog("iosrtcPlugin#RTCPeerConnection_RTCDTMFSender_insertDTMF()")

		let pcId = command.argument(at: 0) as! Int
		let dsId = command.argument(at: 1) as! Int
		let tones = command.argument(at: 2) as! String
		let duration = command.argument(at: 3) as! Double
		let interToneGap = command.argument(at: 4) as! Double
		let pluginRTCPeerConnection = self.pluginRTCPeerConnections[pcId]

		if pluginRTCPeerConnection == nil {
			NSLog("iosrtcPlugin#RTCPeerConnection_RTCDTMFSender_insertDTMF() | ERROR: pluginRTCPeerConnection with pcId=%@ does not exist", String(pcId))
			return;
		}

		self.queue.async { [weak pluginRTCPeerConnection] in
			pluginRTCPeerConnection?.RTCDTMFSender_insertDTMF(dsId,
				tones: tones,
				duration: duration,
				interToneGap: interToneGap
			)
		}
	}

	@objc(MediaStream_init:) func MediaStream_init(_ command: CDVInvokedUrlCommand) {
		NSLog("iosrtcPlugin#MediaStream_init()")

		let streamId = command.argument(at: 0) as! String

		if self.pluginMediaStreams[streamId] == nil {
			let rtcMediaStream : RTCMediaStream = self.rtcPeerConnectionFactory.mediaStream(withStreamId: streamId)
			let pluginMediaStream = PluginMediaStream(rtcMediaStream: rtcMediaStream, streamId: streamId)
			pluginMediaStream.run()

			self.saveMediaStream(pluginMediaStream)
		} else {
			NSLog("iosrtcPlugin#MediaStream_init() | ERROR: pluginMediaStream with id=%@ already exist", String(streamId))
		}
	}

	@objc(MediaStream_setListener:) func MediaStream_setListener(_ command: CDVInvokedUrlCommand) {
		NSLog("iosrtcPlugin#MediaStream_setListener()")

		let id = command.argument(at: 0) as! String
		let pluginMediaStream = self.pluginMediaStreams[id]

		if pluginMediaStream == nil {
			NSLog("iosrtcPlugin#MediaStream_setListener() | ERROR: pluginMediaStream with id=%@ does not exist", String(id))
			return;
		}

		self.queue.async { [weak pluginMediaStream] in
			// Set the eventListener.
			pluginMediaStream?.setListener(
				{ (data: NSDictionary) -> Void in
					let result = CDVPluginResult(
						status: CDVCommandStatus_OK,
						messageAs: data as? [AnyHashable: Any]
					)

					// Allow more callbacks.
					result!.setKeepCallbackAs(true);
					self.emit(command.callbackId, result: result!)
				},
				eventListenerForAddTrack: self.saveMediaStreamTrack,
				eventListenerForRemoveTrack: self.deleteMediaStreamTrack
			)
		}
	}

	@objc(MediaStream_addTrack:) func MediaStream_addTrack(_ command: CDVInvokedUrlCommand) {


		let id = command.argument(at: 0) as! String
		let trackId = command.argument(at: 1) as! String
		let pluginMediaStream = self.pluginMediaStreams[id]
		let pluginMediaStreamTrack = self.pluginMediaStreamTracks[trackId]
		NSLog("iosrtcPlugin#MediaStream_addTrack() trackId=%@ " ,trackId)
		if pluginMediaStream == nil {
			NSLog("iosrtcPlugin#MediaStream_addTrack() | ERROR: pluginMediaStream with id=%@ does not exist", String(id))
			return
		}

		if pluginMediaStreamTrack == nil {
			NSLog("iosrtcPlugin#MediaStream_addTrack() | ERROR: pluginMediaStreamTrack with id=%@ does not exist", String(trackId))
			return;
		}

		self.queue.async { [weak pluginMediaStream, weak pluginMediaStreamTrack] in
			pluginMediaStream?.addTrack(pluginMediaStreamTrack!)
		}
	}

	@objc(MediaStream_removeTrack:) func MediaStream_removeTrack(_ command: CDVInvokedUrlCommand) {
		NSLog("iosrtcPlugin#MediaStream_removeTrack()")

		let id = command.argument(at: 0) as! String
		let trackId = command.argument(at: 1) as! String
		let pluginMediaStream = self.pluginMediaStreams[id]
		let pluginMediaStreamTrack = self.pluginMediaStreamTracks[trackId]

		if pluginMediaStream == nil {
			NSLog("iosrtcPlugin#MediaStream_removeTrack() | ERROR: pluginMediaStream with id=%@ does not exist", String(id))
			return
		}

		if pluginMediaStreamTrack == nil {
			NSLog("iosrtcPlugin#MediaStream_removeTrack() | ERROR: pluginMediaStreamTrack with id=%@ does not exist", String(trackId))
			return;
		}

		self.queue.async { [weak pluginMediaStream, weak pluginMediaStreamTrack] in
			pluginMediaStream?.removeTrack(pluginMediaStreamTrack!)

			// TODO only stop if no more pluginMediaStream attached only
			// currently pluginMediaStreamTrack can be attached to more than one pluginMediaStream
			// use track.stop() or stream.stop() to stop tracks
			//pluginMediaStreamTrack?.stop()
		}
	}

	@objc(MediaStream_release:) func MediaStream_release(_ command: CDVInvokedUrlCommand) {
		NSLog("iosrtcPlugin#MediaStream_release()")

		let id = command.argument(at: 0) as! String
		let pluginMediaStream = self.pluginMediaStreams[id]

		if pluginMediaStream == nil {
			NSLog("iosrtcPlugin#MediaStream_release() | ERROR: pluginMediaStream with id=%@ does not exist", String(id))
			return;
		}

		self.pluginMediaStreams[id] = nil
	}

	@objc(MediaStreamTrack_clone:) func MediaStreamTrack_clone(_ command: CDVInvokedUrlCommand) {


		let existingTrackId = command.argument(at: 0) as! String
		let newTrackId = command.argument(at: 1) as! String
		let pluginMediaStreamTrack = self.pluginMediaStreamTracks[existingTrackId]
		NSLog("iosrtcPlugin#MediaStreamTrack_clone() existing=%@ new=%@", existingTrackId, newTrackId)
		if pluginMediaStreamTrack == nil {
			NSLog("iosrtcPlugin#MediaStreamTrack_clone() | ERROR: pluginMediaStreamTrack with id=%@ does not exist", String(existingTrackId))
			return;
		}

		if self.pluginMediaStreams[newTrackId] == nil {
			var rtcMediaStreamTrack = self.pluginMediaStreamTracks[existingTrackId]!.rtcMediaStreamTrack;
			// twilio uses the sdp local description to map the track ids to the media id.
			// if the original rtcMediaStreamTrack is not cloned, the rtcPeerConnection
			// will not add the track and as such will not be found by Twilio.
			// it is unable to do the mapping and find track and thus
			// will not publish the local track.
			if pluginMediaStreamTrack?.kind == "video" {
				if let rtcVideoTrack = rtcMediaStreamTrack as? RTCVideoTrack{
					NSLog("iosrtcPlugin#MediaStreamTrack_clone() cloning video source");
					rtcMediaStreamTrack = self.rtcPeerConnectionFactory.videoTrack(with: rtcVideoTrack.source, trackId: newTrackId);
				}
			} else if pluginMediaStreamTrack?.kind == "audio" {
				if let rtcAudioTrack = rtcMediaStreamTrack as? RTCAudioTrack{
					NSLog("iosrtcPlugin#MediaStreamTrack_clone() cloning audio source");
					rtcMediaStreamTrack = self.rtcPeerConnectionFactory.audioTrack(with: rtcAudioTrack.source, trackId: newTrackId);
				}
			}
			let newPluginMediaStreamTrack = PluginMediaStreamTrack(rtcMediaStreamTrack: rtcMediaStreamTrack, trackId: newTrackId)

			self.saveMediaStreamTrack(newPluginMediaStreamTrack)
		} else {
			NSLog("iosrtcPlugin#MediaStreamTrack_clone() | ERROR: pluginMediaStreamTrack with id=%@ already exist", String(newTrackId))
		}
	}

	@objc(MediaStreamTrack_setListener:) func MediaStreamTrack_setListener(_ command: CDVInvokedUrlCommand) {
		NSLog("iosrtcPlugin#MediaStreamTrack_setListener()")

		let id = command.argument(at: 0) as! String
		let pluginMediaStreamTrack = self.pluginMediaStreamTracks[id]

		if pluginMediaStreamTrack == nil {
			NSLog("iosrtcPlugin#MediaStreamTrack_setListener() | ERROR: pluginMediaStreamTrack with id=%@ does not exist", String(id))
			return;
		}

		self.queue.async { [weak pluginMediaStreamTrack] in
			// Set the eventListener.
			pluginMediaStreamTrack?.setListener(
				{ (data: NSDictionary) -> Void in
					let result = CDVPluginResult(
						status: CDVCommandStatus_OK,
						messageAs: data as? [AnyHashable: Any]
					)

					// Allow more callbacks.
					result!.setKeepCallbackAs(true);
					self.emit(command.callbackId, result: result!)
				},
				eventListenerForEnded: { () -> Void in
					// Remove the track from the container.
					self.deleteMediaStreamTrack(pluginMediaStreamTrack!);
				}
			)
		}
	}

	@objc(MediaStreamTrack_setEnabled:) func MediaStreamTrack_setEnabled(_ command: CDVInvokedUrlCommand) {
		NSLog("iosrtcPlugin#MediaStreamTrack_setEnabled()")

		let id = command.argument(at: 0) as! String
		let value = command.argument(at: 1) as! Bool
		let pluginMediaStreamTrack = self.pluginMediaStreamTracks[id]

		if pluginMediaStreamTrack == nil {
			NSLog("iosrtcPlugin#MediaStreamTrack_setEnabled() | ERROR: pluginMediaStreamTrack with id=%@ does not exist", String(id))
			return;
		}

		self.queue.async {[weak pluginMediaStreamTrack] in
			pluginMediaStreamTrack?.setEnabled(value)
		}
	}

	@objc(MediaStreamTrack_stop:) func MediaStreamTrack_stop(_ command: CDVInvokedUrlCommand) {
		NSLog("iosrtcPlugin#MediaStreamTrack_stop()")

		let id = command.argument(at: 0) as! String
		let pluginMediaStreamTrack = self.pluginMediaStreamTracks[id]

		if pluginMediaStreamTrack == nil {
			NSLog("iosrtcPlugin#MediaStreamTrack_stop() | ERROR: pluginMediaStreamTrack with id=%@ does not exist", String(id))
			return;
		}

		self.queue.async { [weak pluginMediaStreamTrack] in
			pluginMediaStreamTrack?.stop()
		}
	}

	@objc(new_MediaStreamRenderer:) func new_MediaStreamRenderer(_ command: CDVInvokedUrlCommand) {
		NSLog("iosrtcPlugin#new_MediaStreamRenderer()")

		let id = command.argument(at: 0) as! Int
		let isCanvas = command.argument(at: 1) as! Bool

		var lport = 0
		if (isCanvas) {
			lport = self.webSocketServer?.realport ?? 0
		}

		NSLog("iosrtcPlugin#new_MediaStreamRenderer(), isCanvas:%d", isCanvas)
		let pluginMediaStreamRenderer = PluginMediaStreamRenderer(
			servicePort: lport,
			cbData: { (uuid: String, data: NSData?) -> Void in
				self.webSocketServer?.send(uuid: uuid, msg: data)
			},
			webView: self.webView!,
			eventListener: { (data: NSDictionary) -> Void in
				let result = CDVPluginResult(
					status: CDVCommandStatus_OK,
					messageAs: data as? [AnyHashable: Any]
				)

				// Allow more callbacks.
				result?.setKeepCallbackAs(true);
				self.emit(command.callbackId, result: result!)
			}
		)

		// Store into the dictionary.
		self.pluginMediaStreamRenderers[id] = pluginMediaStreamRenderer

		// Run it.
		pluginMediaStreamRenderer.run()
	}

	@objc(MediaStreamRenderer_render:) func MediaStreamRenderer_render(_ command: CDVInvokedUrlCommand) {
		NSLog("iosrtcPlugin#MediaStreamRenderer_render()")

		let id = command.argument(at: 0) as! Int
		let streamId = command.argument(at: 1) as! String
		let pluginMediaStreamRenderer = self.pluginMediaStreamRenderers[id]
		let pluginMediaStream = self.pluginMediaStreams[streamId]

		if pluginMediaStreamRenderer == nil {
			NSLog("iosrtcPlugin#MediaStreamRenderer_render() | ERROR: pluginMediaStreamRenderer with id=%@ does not exist", String(id))
			return
		}

		if pluginMediaStream == nil {
			NSLog("iosrtcPlugin#MediaStreamRenderer_render() | ERROR: pluginMediaStream with id=%@ does not exist", String(streamId))
			return;
		}

		pluginMediaStreamRenderer!.render(pluginMediaStream!)
	}

	@objc(MediaStreamRenderer_mediaStreamChanged:) func MediaStreamRenderer_mediaStreamChanged(_ command: CDVInvokedUrlCommand) {
		NSLog("iosrtcPlugin#MediaStreamRenderer_mediaStreamChanged()")

		let id = command.argument(at: 0) as! Int
		let pluginMediaStreamRenderer = self.pluginMediaStreamRenderers[id]

		if pluginMediaStreamRenderer == nil {
			NSLog("iosrtcPlugin#MediaStreamRenderer_mediaStreamChanged() | ERROR: pluginMediaStreamRenderer with id=%@ does not exist", String(id))
			return;
		}

		pluginMediaStreamRenderer!.mediaStreamChanged()
	}

	@objc(MediaStreamRenderer_refresh:) func MediaStreamRenderer_refresh(_ command: CDVInvokedUrlCommand) {
		NSLog("iosrtcPlugin#MediaStreamRenderer_refresh()")

		let id = command.argument(at: 0) as! Int
		let data = command.argument(at: 1) as! NSDictionary
		let pluginMediaStreamRenderer = self.pluginMediaStreamRenderers[id]

		if pluginMediaStreamRenderer == nil {
			NSLog("iosrtcPlugin#MediaStreamRenderer_refresh() | ERROR: pluginMediaStreamRenderer with id=%@ does not exist", String(id))
			return;
		}

		pluginMediaStreamRenderer!.refresh(data)
	}

	@objc(MediaStreamRenderer_save:) func MediaStreamRenderer_save(_ command: CDVInvokedUrlCommand) {
		//NSLog("iosrtcPlugin#MediaStreamRenderer_save()")

		let id = command.argument(at: 0) as! Int
		let pluginMediaStreamRenderer = self.pluginMediaStreamRenderers[id]

		if pluginMediaStreamRenderer == nil {
			NSLog("iosrtcPlugin#MediaStreamRenderer_save() | ERROR: pluginMediaStreamRenderer with id=%@ does not exist", String(id))
			return;
		}

		// Perform the task on a background queue.
		DispatchQueue.global().async {
			pluginMediaStreamRenderer!.save(
				callback: { (data: String) -> Void in
					DispatchQueue.main.async {
						self.emit(command.callbackId,
							result: CDVPluginResult(
								status: CDVCommandStatus_OK,
								messageAs: data
							)
						)
					}
				},
				errback: { (error: String) -> Void in
					self.emit(command.callbackId,
						result: CDVPluginResult(status: CDVCommandStatus_ERROR, messageAs: error)
					)
				}
			)
		}
	}

	@objc(MediaStreamRenderer_close:) func MediaStreamRenderer_close(_ command: CDVInvokedUrlCommand) {
		NSLog("iosrtcPlugin#MediaStreamRenderer_close()")

		let id = command.argument(at: 0) as! Int
		let pluginMediaStreamRenderer = self.pluginMediaStreamRenderers[id]

		if pluginMediaStreamRenderer == nil {
			NSLog("iosrtcPlugin#MediaStreamRenderer_close() | ERROR: pluginMediaStreamRenderer with id=%@ does not exist", String(id))
			return
		}

		pluginMediaStreamRenderer!.close()

		self.webSocketServer?.close(uuid: pluginMediaStreamRenderer?.id, code: -1, reason: "active close")

		// Remove from the dictionary.
		self.pluginMediaStreamRenderers[id] = nil
	}

	@objc(startWebSocketServer:) func startCanvasServer(_ command: CDVInvokedUrlCommand) {
		let lport = command.argument(at: 0) as! Int
		startWebSocketServer(listenPort:lport)
	}

	@objc(stopWebSocketServer:) func stopCanvasServer(_ command: CDVInvokedUrlCommand) {
		stopWebSocketServer()
	}

	@objc(getUserMedia:) func getUserMedia(_ command: CDVInvokedUrlCommand) {
		NSLog("iosrtcPlugin#getUserMedia()")

		let constraints = command.argument(at: 0) as! NSDictionary

		self.pluginGetUserMedia.call(constraints,
			callback: { (data: NSDictionary) -> Void in
				self.emit(command.callbackId,
					result: CDVPluginResult(
						status: CDVCommandStatus_OK,
						messageAs: data as? [AnyHashable: Any]
					)
				)
			},
			errback: { (error: String) -> Void in
				self.emit(command.callbackId,
					result: CDVPluginResult(status: CDVCommandStatus_ERROR, messageAs: error)
				)
			},
			eventListenerForNewStream: self.saveMediaStream
		)
	}

	@objc(enumerateDevices:) func enumerateDevices(_ command: CDVInvokedUrlCommand) {
		NSLog("iosrtcPlugin#enumerateDevices()")

		self.queue.async {
			PluginEnumerateDevices.call(
				{ (data: NSDictionary) -> Void in
					self.emit(command.callbackId,
						result: CDVPluginResult(
							status: CDVCommandStatus_OK,
							messageAs: data as? [AnyHashable: Any]
						)
					)
				}
			)
		}
	}

	@objc(RTCRequestPermission:) func RTCRequestPermission(_ command: CDVInvokedUrlCommand) {
		DispatchQueue.main.async {
			var status: Bool = false
			let audioRequested: Bool = CBool(command.arguments[0] as! Bool)
			let videoRequested: Bool = CBool(command.arguments[1] as! Bool)

			if videoRequested == true {
				switch AVCaptureDevice.authorizationStatus(for: AVMediaType.video) {
				case AVAuthorizationStatus.notDetermined:
					NSLog("PluginGetUserMedia#call() | video authorization: not determined")
				case AVAuthorizationStatus.restricted:
					NSLog("PluginGetUserMedia#call() | video authorization: restricted")
				case AVAuthorizationStatus.denied:
					NSLog("PluginGetUserMedia#call() | video authorization: denied")
				case AVAuthorizationStatus.authorized:
					NSLog("PluginGetUserMedia#call() | video authorization: authorized")
					status = true
				}
			}

			if audioRequested == true {
				switch AVCaptureDevice.authorizationStatus(for: AVMediaType.audio) {
				case AVAuthorizationStatus.notDetermined:
					NSLog("PluginGetUserMedia#call() | video authorization: not determined")
				case AVAuthorizationStatus.restricted:
					NSLog("PluginGetUserMedia#call() | video authorization: restricted")
				case AVAuthorizationStatus.denied:
					NSLog("PluginGetUserMedia#call() | video authorization: denied")
				case AVAuthorizationStatus.authorized:
					NSLog("PluginGetUserMedia#call() | video authorization: authorized")
					status = true
				}
			}

			if (status) {
				self.emit(command.callbackId,result: CDVPluginResult(status: CDVCommandStatus_OK))
			} else {
				self.emit(command.callbackId,result: CDVPluginResult(status: CDVCommandStatus_ERROR))
			}
		}
	}

	@objc(initAudioDevices:) func initAudioDevices(_ command: CDVInvokedUrlCommand) {
		NSLog("iosrtcPlugin#initAudioDevices()")

		PluginRTCAudioController.initAudioDevices()
	}

	@objc(RTCTurnOnSpeaker:) func RTCTurnOnSpeaker(_ command: CDVInvokedUrlCommand) {
		DispatchQueue.main.async {
			let isTurnOn: Bool = CBool(command.arguments[0] as! Bool)
			PluginRTCAudioController.setOutputSpeakerIfNeed(enabled: isTurnOn)
			self.emit(command.callbackId, result: CDVPluginResult(status: CDVCommandStatus_OK))
		}
	}

	@objc(selectAudioOutputEarpiece:) func selectAudioOutputEarpiece(_ command: CDVInvokedUrlCommand) {
		NSLog("iosrtcPlugin#selectAudioOutputEarpiece()")

		PluginRTCAudioController.selectAudioOutputEarpiece()
	}

	@objc(selectAudioOutputSpeaker:) func selectAudioOutputSpeaker(_ command: CDVInvokedUrlCommand) {
		NSLog("iosrtcPlugin#selectAudioOutputSpeaker()")

		PluginRTCAudioController.selectAudioOutputSpeaker()
	}

	@objc(dump:) func dump(_ command: CDVInvokedUrlCommand) {
		NSLog("iosrtcPlugin#dump()")

		for (id, _) in self.pluginRTCPeerConnections {
			NSLog("- PluginRTCPeerConnection [id:%@]", String(id))
		}

		for (_, pluginMediaStream) in self.pluginMediaStreams {
			NSLog("- PluginMediaStream %@", String(pluginMediaStream.rtcMediaStream.description))
		}

		for (id, pluginMediaStreamTrack) in self.pluginMediaStreamTracks {
			NSLog("- PluginMediaStreamTrack [id:%@, kind:%@]", String(id), String(pluginMediaStreamTrack.kind))
		}

		for (id, _) in self.pluginMediaStreamRenderers {
			NSLog("- PluginMediaStreamRenderer [id:%@]", String(id))
		}
	}

	/**
	 * Private API.
	 */

	fileprivate func emit(_ callbackId: String, result: CDVPluginResult) {
		DispatchQueue.main.async {
			self.commandDelegate!.send(result, callbackId: callbackId)
		}
	}

	fileprivate func saveMediaStream(_ pluginMediaStream: PluginMediaStream) {
		if self.pluginMediaStreams[pluginMediaStream.id] == nil {
			self.pluginMediaStreams[pluginMediaStream.id] = pluginMediaStream
		} else {
			NSLog("iosrtcPlugin#saveMediaStream() | WARN: PluginMediaStream already exist [id:%@]", String(pluginMediaStream.id))
			return;
		}

		// Store its PluginMediaStreamTracks' into the dictionary.
		for (_, pluginMediaStreamTrack) in pluginMediaStream.audioTracks {
			saveMediaStreamTrack(pluginMediaStreamTrack);
		}

		for (_, pluginMediaStreamTrack) in pluginMediaStream.videoTracks {
			saveMediaStreamTrack(pluginMediaStreamTrack);
		}
	}

	fileprivate func deleteMediaStream(_ pluginMediaStream: PluginMediaStream) {
		if (self.pluginMediaStreams[pluginMediaStream.id] != nil) {
			self.pluginMediaStreams[pluginMediaStream.id] = nil

			// deinit should call stop by itself
			//pluginMediaStream.stop();
		}
	}

	fileprivate func saveMediaStreamTrack(_ pluginMediaStreamTrack: PluginMediaStreamTrack) {
		if self.pluginMediaStreamTracks[pluginMediaStreamTrack.id] == nil {
			self.pluginMediaStreamTracks[pluginMediaStreamTrack.id] = pluginMediaStreamTrack
		}
	}

	fileprivate func deleteMediaStreamTrack(_ pluginMediaStreamTrack: PluginMediaStreamTrack) {
		if (self.pluginMediaStreamTracks[pluginMediaStreamTrack.id] != nil) {
			self.pluginMediaStreamTracks[pluginMediaStreamTrack.id] = nil

			// deinit should call stop by itself
			//pluginMediaStreamTrack.stop();
		}
	}

	fileprivate func cleanup() {

		// Close all RTCPeerConnections
		for (pcId, pluginRTCPeerConnection) in self.pluginRTCPeerConnections {
			pluginRTCPeerConnection.close()
			self.pluginRTCPeerConnections[pcId] = nil;
		}

		// Close all StreamRenderers
		for (id, pluginMediaStreamRenderer) in self.pluginMediaStreamRenderers {
			pluginMediaStreamRenderer.close()
			self.pluginMediaStreamRenderers[id] = nil;
		}

		// Close All MediaStream
		for (streamId, pluginMediaStream) in self.pluginMediaStreams {
			// Store its PluginMediaStreamTracks' into the dictionary.
			for (trackId, pluginMediaStreamTrack) in pluginMediaStream.audioTracks {
				pluginMediaStream.removeTrack(pluginMediaStreamTrack);
				deleteMediaStreamTrack(pluginMediaStreamTrack);
			}

			for (trackId, pluginMediaStreamTrack) in pluginMediaStream.videoTracks {
				pluginMediaStream.removeTrack(pluginMediaStreamTrack);
				deleteMediaStreamTrack(pluginMediaStreamTrack);
			}

			deleteMediaStream(pluginMediaStream);
		}

		// Close All MediaStreamTracks without MediaStream
		for (trackId, pluginMediaStreamTrack) in self.pluginMediaStreamTracks {
			deleteMediaStreamTrack(pluginMediaStreamTrack);
		}
	}

	@objc(RTCPeerConnection_RTCRtpSender_setParameters:) func RTCPeerConnection_RTCRtpSender_setParameters(_ command: CDVInvokedUrlCommand) {
		NSLog("iosrtcPlugin#RTCPeerConnection_RTCRtpSender_setParameters()")

		let pcId = command.argument(at: 0) as! Int
		let senderId = command.argument(at: 1) as! Int
		let params = command.argument(at: 2) as! [String : NSObject]

		let pluginRTCPeerConnection = self.pluginRTCPeerConnections[pcId]

		if pluginRTCPeerConnection == nil {
			NSLog("iosrtcPlugin#RTCRtpSender_setParameters() | ERROR: pluginRTCPeerConnection with pcId=%@ does not exist", String(pcId))
			return;
		}

		self.queue.async { [weak pluginRTCPeerConnection] in
			let pluginRTCRptSender = pluginRTCPeerConnection!.pluginRTCRtpSenders[senderId]
			if pluginRTCRptSender == nil {
				NSLog("iosrtcPlugin#RTCPeerConnection_RTCRtpSender_setParameters() | ERROR: pluginRTCRptSender with id=%@ does not exist", String(senderId))
				return;
			}

			let callback: (NSDictionary) -> Void = { data in
				self.emit(command.callbackId,
					result: CDVPluginResult(
						status: CDVCommandStatus_OK,
						messageAs: data as? [AnyHashable: Any]
					)
				)
			}
			let errback: (Error) -> Void = { error in
				self.emit(command.callbackId,
					result: CDVPluginResult(status: CDVCommandStatus_ERROR, messageAs: error.localizedDescription)
				)
			}
			pluginRTCRptSender!.setParameters(params, callback, errback);
		}
	}

	@objc(RTCPeerConnection_RTCRtpSender_replaceTrack:) func RTCPeerConnection_RTCRtpSender_replaceTrack(_ command: CDVInvokedUrlCommand) {
		NSLog("iosrtcPlugin#RTCPeerConnection_RTCRtpSender_replaceTrack()")

		let pcId = command.argument(at: 0) as! Int
		let senderId = command.argument(at: 1) as! Int
		let trackId : String? = command.argument(at: 2) as? String
		
		let pluginRTCPeerConnection = self.pluginRTCPeerConnections[pcId]

		if pluginRTCPeerConnection == nil {
			NSLog("iosrtcPlugin#RTCPeerConnection_RTCRtpSender_replaceTrack() | ERROR: pluginRTCPeerConnection with pcId=%@ does not exist", String(pcId))
			return;
		}

		let pluginMediaStreamTrack = trackId != nil ? self.pluginMediaStreamTracks[trackId!] : nil

		self.queue.async { [weak pluginRTCPeerConnection, weak pluginMediaStreamTrack] in
			let pluginRTCRptSender = pluginRTCPeerConnection!.pluginRTCRtpSenders[senderId]
			if pluginRTCRptSender == nil {
				NSLog("iosrtcPlugin#RTCPeerConnection_RTCRtpSender_replaceTrack() | ERROR: pluginRTCRptSender with id=%@ does not exist", String(senderId))
				self.emit(command.callbackId,
						  result: CDVPluginResult(
							status: CDVCommandStatus_ERROR,
							messageAs: "Cannot find native RTCRtpSender with id=\(senderId)"))
				return;
			}

			pluginRTCRptSender!.replaceTrack(pluginMediaStreamTrack)
			self.emit(command.callbackId,
					  result: CDVPluginResult(
						status: CDVCommandStatus_OK,
						messageAs: [
							"track": pluginMediaStreamTrack?.getJSON()
						]))
		}
	}
}
