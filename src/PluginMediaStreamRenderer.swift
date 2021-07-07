import Foundation
import AVFoundation

class PluginMediaStreamRenderer : NSObject, RTCEAGLVideoViewDelegate, RTCVideoRenderer {

	var id: String
	var eventListener: (_ data: NSDictionary) -> Void
	var closed: Bool

	var servicePort: Int
	var cbData: (_ uuid: String, _ data: NSData?) -> Void

	var webView: UIView
	var elementView: UIView?
	var pluginMediaStream: PluginMediaStream?

	var videoView: RTCEAGLVideoView?
	var rtcAudioTrack: RTCAudioTrack?
	var rtcVideoTrack: RTCVideoTrack?
    var pluginVideoTrack: PluginMediaStreamTrack?

	init(
		servicePort: Int,
		cbData: @escaping (_ uuid:String, _ data: NSData?) -> Void,
		webView: UIView,
		eventListener: @escaping (_ data: NSDictionary) -> Void
	) {
		NSLog("PluginMediaStreamRenderer#init()")

		// Open Renderer
		self.id = UUID().uuidString;
		self.closed = false

		// The browser HTML view.
		self.servicePort = servicePort
		self.cbData = cbData
		self.webView = webView
		self.eventListener = eventListener

		if (self.servicePort > 0) {
			// will render in canvas over websocket
			return;
		}

		let useManualLayoutRenderer = Bundle.main.object(forInfoDictionaryKey: "UseManualLayoutRenderer") as? Bool ?? false

		// The video element view.
		let guide = webView.safeAreaLayoutGuide;
		self.elementView = useManualLayoutRenderer
			? UIView(frame: CGRect(x: 0.0, y: guide.layoutFrame.minY, width: guide.layoutFrame.width, height: guide.layoutFrame.height))
			: UIView()

		// The effective video view in which the the video stream is shown.
		// It's placed over the elementView.
		self.videoView = RTCEAGLVideoView()
		self.videoView?.isUserInteractionEnabled = false

		self.elementView.isUserInteractionEnabled = false
		self.elementView.isHidden = true
		self.elementView.backgroundColor = UIColor.black
		self.elementView.addSubview(self.videoView)
		self.elementView.layer.masksToBounds = true
		self.elementView.translatesAutoresizingMaskIntoConstraints = false

		// Place the video element view inside the WebView's superview
		self.webView.addSubview(view)
		self.webView.isOpaque = false
		self.webView.backgroundColor = UIColor.clear

		// https://stackoverflow.com/questions/46317061/use-safe-area-layout-programmatically
		// https://developer.apple.com/documentation/uikit/uiview/2891102-safearealayoutguide
		// https://developer.apple.com/documentation/uikit/

		let view = self.elementView;
		if !useManualLayoutRenderer {
			if #available(iOS 11.0, *) {
				view.topAnchor.constraint(equalTo: guide.topAnchor).isActive = true
				view.bottomAnchor.constraint(equalTo: guide.bottomAnchor).isActive = true
				view.leftAnchor.constraint(equalTo: guide.leftAnchor).isActive = true
				view.rightAnchor.constraint(equalTo: guide.rightAnchor).isActive = true
			} else {
				NSLayoutConstraint(item: view, attribute: .top, relatedBy: .equal, toItem: webView, attribute: .top, multiplier: 1.0, constant: 0).isActive = true
				NSLayoutConstraint(item: view, attribute: .bottom, relatedBy: .equal, toItem: webView, attribute: .bottom, multiplier: 1.0, constant: 0).isActive = true
				NSLayoutConstraint(item: view, attribute: .leading, relatedBy: .equal, toItem: webView, attribute: .leading, multiplier: 1.0, constant: 0).isActive = true
				NSLayoutConstraint(item: view, attribute: .trailing, relatedBy: .equal, toItem: webView, attribute: .trailing, multiplier: 1.0, constant: 0).isActive = true
			}
		}
	}

	deinit {
		NSLog("PluginMediaStreamRenderer#deinit()")
	}

	func run() {
		NSLog("PluginMediaStreamRenderer#run()")

		if (self.videoView != nil) {
			self.videoView?.delegate = self
		} else {
			self.eventListener([
				"type": "videowebsocket",
				"action": "run",
				"ws" : [
					"uuid": self.id,
					"port": self.servicePort
				]
			])
		}
	}

	func render(_ pluginMediaStream: PluginMediaStream) {
		NSLog("PluginMediaStreamRenderer#render()")

		if self.pluginMediaStream != nil {
			self.reset()
		}

		self.pluginMediaStream = pluginMediaStream

		// Take the first audio track.
		for (_, track) in pluginMediaStream.audioTracks {
			self.rtcAudioTrack = track.rtcMediaStreamTrack as? RTCAudioTrack
			break
		}

		// Take the first video track.
		for (_, track) in pluginMediaStream.videoTracks {
            self.pluginVideoTrack = track
			self.rtcVideoTrack = track.rtcMediaStreamTrack as? RTCVideoTrack
			break
		}


		if self.rtcVideoTrack != nil {
			self.rtcVideoTrack!.add(self.videoView)
            self.pluginVideoTrack?.registerRender(render: self)
		}
	}

	func mediaStreamChanged() {
		NSLog("PluginMediaStreamRenderer#mediaStreamChanged()")

		if self.pluginMediaStream == nil {
			return
		}

        let oldPluginVideoTrack: PluginMediaStreamTrack? = self.pluginVideoTrack
		let oldRtcVideoTrack: RTCVideoTrack? = self.rtcVideoTrack

		self.rtcAudioTrack = nil
		self.rtcVideoTrack = nil
        self.pluginVideoTrack = nil

		// Take the first audio track.
		for (_, track) in self.pluginMediaStream!.audioTracks {
			self.rtcAudioTrack = track.rtcMediaStreamTrack as? RTCAudioTrack
			break
		}

		// Take the first video track.
		for (_, track) in pluginMediaStream!.videoTracks {
            self.pluginVideoTrack = track
			self.rtcVideoTrack = track.rtcMediaStreamTrack as? RTCVideoTrack
			break
		}

		let view = getVideoView();

		// If same video track as before do nothing.
		if oldRtcVideoTrack != nil && self.rtcVideoTrack != nil &&
			oldRtcVideoTrack!.trackId == self.rtcVideoTrack!.trackId {
			NSLog("PluginMediaStreamRenderer#mediaStreamChanged() | same video track as before")
		}

		// Different video track.
		else if oldRtcVideoTrack != nil && self.rtcVideoTrack != nil &&
			oldRtcVideoTrack!.trackId != self.rtcVideoTrack!.trackId {
			NSLog("PluginMediaStreamRenderer#mediaStreamChanged() | has a new video track")

            oldPluginVideoTrack?.unregisterRender(render: self)
			oldRtcVideoTrack!.remove(self.videoView)
            self.pluginVideoTrack?.registerRender(render: self)
			self.rtcVideoTrack!.add(self.videoView)
		}

		// Did not have video but now it has.
		else if oldRtcVideoTrack == nil && self.rtcVideoTrack != nil {
			NSLog("PluginMediaStreamRenderer#mediaStreamChanged() | video track added")

            if oldPluginVideoTrack != nil{
                oldPluginVideoTrack?.unregisterRender(render: self)
            }
            self.pluginVideoTrack?.registerRender(render: self)
			self.rtcVideoTrack!.add(self.videoView)
		}

		// Had video but now it has not.
		else if oldRtcVideoTrack != nil && self.rtcVideoTrack == nil {
			NSLog("PluginMediaStreamRenderer#mediaStreamChanged() | video track removed")

            oldPluginVideoTrack?.unregisterRender(render: self)
			oldRtcVideoTrack!.remove(self.videoView)
		}
	}

	func refresh(_ data: NSDictionary) {
		if (self.elementView == nil) {
			return;
		}
		let view = self.elementView!

		let elementLeft = data.object(forKey: "elementLeft") as? Double ?? 0
		let elementTop = data.object(forKey: "elementTop") as? Double ?? 0
		let elementWidth = data.object(forKey: "elementWidth") as? Double ?? 0
		let elementHeight = data.object(forKey: "elementHeight") as? Double ?? 0
		var videoViewWidth = data.object(forKey: "videoViewWidth") as? Double ?? 0
		var videoViewHeight = data.object(forKey: "videoViewHeight") as? Double ?? 0
		let visible = data.object(forKey: "visible") as? Bool ?? true
		let opacity = data.object(forKey: "opacity") as? Double ?? 1
		let zIndex = data.object(forKey: "zIndex") as? Double ?? 0
		let mirrored = data.object(forKey: "mirrored") as? Bool ?? false
		let clip = data.object(forKey: "clip") as? Bool ?? true
		let borderRadius = data.object(forKey: "borderRadius") as? Double ?? 0
		let backgroundColor = data.object(forKey: "backgroundColor") as? String ?? "0,0,0"

		NSLog("PluginMediaStreamRenderer#refresh() [elementLeft:%@, elementTop:%@, elementWidth:%@, elementHeight:%@, videoViewWidth:%@, videoViewHeight:%@, visible:%@, opacity:%@, zIndex:%@, mirrored:%@, clip:%@, borderRadius:%@]",
			String(elementLeft), String(elementTop), String(elementWidth), String(elementHeight),
			String(videoViewWidth), String(videoViewHeight), String(visible), String(opacity), String(zIndex),
			String(mirrored), String(clip), String(borderRadius))

		let videoViewLeft: Double = (elementWidth - videoViewWidth) / 2
		let videoViewTop: Double = (elementHeight - videoViewHeight) / 2

		view.frame = CGRect(
			x: CGFloat(elementLeft),
			y: CGFloat(elementTop),
			width: CGFloat(elementWidth),
			height: CGFloat(elementHeight)
		)

		// NOTE: Avoid a zero-size UIView for the video (the library complains).
		if videoViewWidth == 0 || videoViewHeight == 0 {
			videoViewWidth = 1
			videoViewHeight = 1
			self.videoView?.isHidden = true
		} else {
			self.videoView?.isHidden = false
		}

		self.videoView?.frame = CGRect(
			x: CGFloat(videoViewLeft),
			y: CGFloat(videoViewTop),
			width: CGFloat(videoViewWidth),
			height: CGFloat(videoViewHeight)
		)

		if visible {
			view.isHidden = false
		} else {
			view.isHidden = true
		}

		view.alpha = CGFloat(opacity)
		view.layer.zPosition = CGFloat(zIndex)

		// if the zIndex is 0 (the default) bring the view to the top, last one wins
		if zIndex == 0 {
			self.webView.bringSubviewToFront(view)
			//self.webView?.bringSubview(toFront: self.elementView)
		}

		if !mirrored {
			view.transform = CGAffineTransform.identity
		} else {
			view.transform = CGAffineTransform(scaleX: -1.0, y: 1.0)
		}

		if clip {
			view.clipsToBounds = true
		} else {
			view.clipsToBounds = false
		}

		view.layer.cornerRadius = CGFloat(borderRadius)
		let rgb = backgroundColor.components(separatedBy: ",").map{ CGFloat(($0 as NSString).floatValue) / 256.0 }
		let color = UIColor(red: rgb[0], green: rgb[1], blue: rgb[2], alpha: 1)
		view.backgroundColor = color
	}

	func save(callback: (_ data: String) -> Void,
			  errback: (_ error: String) -> Void) {
		//NSLog("PluginMediaStreamRenderer#save()")
		if (self.videoView != nil) {
			let view = self.videoView!
			UIGraphicsBeginImageContextWithOptions(view.bounds.size, view.isOpaque, 0.0)
			view.drawHierarchy(in: view.bounds, afterScreenUpdates: false)
			let snapshotImageFromMyView = UIGraphicsGetImageFromCurrentImageContext()
			UIGraphicsEndImageContext()
			let imageData = snapshotImageFromMyView?.jpegData(compressionQuality: 1.0)
			let strBase64 = imageData?.base64EncodedString(options: .lineLength64Characters)

			callback(strBase64!);
		}
	}

	func stop() {
		NSLog("PluginMediaStreamRenderer | video stop")

		if (self.videoView != nil) {
			self.eventListener([
				"type": "videowebsocket",
				"action": "stop"
			])
		}
	}

	func close() {
		NSLog("PluginMediaStreamRenderer#close()")
		self.closed = true
		self.reset()
		self.elementView?.removeFromSuperview()
	}


	/**
	 * Private API.
	 */

	fileprivate func reset() {
		NSLog("PluginMediaStreamRenderer#reset()")

		if self.rtcVideoTrack != nil {
			self.rtcVideoTrack!.remove(getVideoView())
		}
        if self.pluginVideoTrack != nil {
            self.pluginVideoTrack?.unregisterRender(render: self)
        }
        self.pluginVideoTrack = nil
		self.pluginMediaStream = nil
		self.rtcAudioTrack = nil
		self.rtcVideoTrack = nil
	}

	fileprivate func getVideoView() -> RTCVideoRenderer {
		/**
		 * when current is canvas render, will use self(RTCVideoRenderer) as video view
		 */
		if (self.videoView != nil) {
			return self.videoView!
		} else {
			return self
		}
	}

	fileprivate func onVideoChanged(size: CGSize) {
		NSLog("PluginMediaStreamRenderer | video size changed [width:%@, height:%@]",
			  String(describing: size.width), String(describing: size.height))

		self.eventListener([
			"type": "videoresize",
			"size": [
				"width": Int(size.width),
				"height": Int(size.height)
			]
		])
	}


	/**
	 * Methods inherited from RTCEAGLVideoViewDelegate.
	 */

	func videoView(_ videoView: RTCVideoRenderer, didChangeVideoSize size: CGSize) {
		onVideoChanged(size: size);
	}

	/**
	 * Methods inherited from RTCVideoRenderer
	 */

	func setSize(_ size: CGSize) {
		onVideoChanged(size: size);
	}

	func renderFrame(_ frame: RTCVideoFrame?) {
		if (frame == nil) {
			return
		}

		var rotation: Int16 = Int16(frame!.rotation.rawValue)
		//var timestamp: UInt32 = UInt32(frame!.timeStamp)

		// format: head + body
		// 	head: type(2B)+len(4B)+width(2B)+height(2B)+rotation(2B)+timestamp(4B)
		// 	body: data(len)
		let headSize: Int32 = 16
		var pduType: UInt16 = 0x2401

		// copy buffer
		let i420: RTCI420BufferProtocol = frame!.buffer.toI420()
		var width: Int16 = Int16(i420.width);
		var height: Int16 = Int16(i420.height);
		var frameSize: Int32 = Int32(width) * Int32(height) * 3 / 2;

		let pduData: NSMutableData? = NSMutableData(length: Int(headSize + frameSize))
		let headPtr: UnsafeMutableRawPointer = pduData!.mutableBytes
		let YPtr = headPtr + Int(headSize);
		let UPtr = YPtr + Int(i420.width*i420.height);
		let VPtr = UPtr + Int(i420.chromaWidth*i420.chromaHeight);

		// copy Y: e.g, width(640),height(480),strideY(704)
		if (i420.width != i420.strideY) {
			for y in 0..<i420.height {
				memcpy(YPtr + Int(y * i420.width), i420.dataY + Int(y * i420.strideY), Int(i420.width));
			}
		} else {
			memcpy(YPtr, i420.dataY, Int(i420.width * i420.height));
		}

		// copy U: e.g, chromaHeight(320), chromaHeight(240), strideU(352)
		if (i420.chromaWidth != i420.strideU) {
			for y in 0..<i420.chromaHeight {
				memcpy(UPtr + Int(y * i420.chromaWidth), i420.dataU + Int(y * i420.strideU), Int(i420.chromaWidth));
			}
		} else {
			memcpy(UPtr, i420.dataU, Int(i420.chromaWidth * i420.chromaHeight));
		}

		// copy V: e.g, chromaHeight(320), chromaHeight(240), strideV(352)
		if (i420.chromaWidth != i420.strideV) {
			for y in 0..<i420.chromaHeight {
				memcpy(VPtr + Int(y * i420.chromaWidth), i420.dataV + Int(y * i420.strideV), Int(i420.chromaWidth));
			}
		} else {
			memcpy(VPtr, i420.dataV, Int(i420.chromaWidth * i420.chromaHeight));
		}

		memcpy(headPtr, &pduType, 2)
		memcpy(headPtr+2, &frameSize, 4)
		memcpy(headPtr+2+4, &width, 2)
		memcpy(headPtr+2+4+2, &height, 2)
		memcpy(headPtr+2+4+2+2, &rotation, 2)
		//memcpy(headPtr+2+4+2+2+2, &timestamp, 4)

		self.cbData(self.id, pduData)
	}

}
