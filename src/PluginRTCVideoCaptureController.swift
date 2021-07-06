import Foundation
import AVFoundation
import ReplayKit

import func ObjectiveC.objc_getAssociatedObject
import func ObjectiveC.objc_setAssociatedObject
import enum ObjectiveC.objc_AssociationPolicy

public func objc_getx<TargetObject: AnyObject, AssociatedObject: AnyObject>
	(object getObject: @autoclosure () -> AssociatedObject,
	 associatedTo target:TargetObject,
	 withConstPtrKey ptr:UnsafeRawPointer)
	-> AssociatedObject
{
	var object = objc_getAssociatedObject(target, ptr) as? AssociatedObject
	if object == nil {
		object = getObject()
		objc_setAssociatedObject(target, ptr, object, objc_AssociationPolicy.OBJC_ASSOCIATION_RETAIN_NONATOMIC)
	}
	return object!
}

/* Expose videoCaptureController on RTCMediaStreamTrack */
extension RTCMediaStreamTrack {

	class PropClass {
		var videoCaptureController: PluginRTCVideoCaptureController?
		let capabilities = NSMutableDictionary()
	}

	var _propClass : PropClass {
		get {
			let key: UnsafeRawPointer! = UnsafeRawPointer.init(bitPattern:self.hashValue)
			return objc_getx(object: PropClass(), associatedTo: self, withConstPtrKey: key)
		}
	}

	var videoCaptureController: PluginRTCVideoCaptureController? {
		get {
			return _propClass.videoCaptureController
		}
		set {
			_propClass.videoCaptureController = newValue
		}
	}

	var capabilities: NSMutableDictionary {
		get {
			return _propClass.capabilities
		}
	}
}

class PluginRTCVideoCaptureController : NSObject {

	var isCapturing: Bool = false;

	// Default to the front camera.
	var device: AVCaptureDevice?
	var deviceFormat: AVCaptureDevice.Format?
	var deviceFrameRate: Int?

	var constraints: NSDictionary = [:]

	func startCapture(completionHandler: ((Error?) -> Void)? = nil) -> Bool {
		return isCapturing;
	}

	func stopCapture() {

	}
}

class PluginRTCScreenCaptureController : PluginRTCVideoCaptureController {

	var capturer: RTCVideoCapturer
	var source: RTCVideoSource
	var recorder: RPScreenRecorder

	init(capturer: RTCVideoCapturer, recorder: RPScreenRecorder, source: RTCVideoSource) {
		self.capturer = capturer
		self.recorder = recorder;
		self.source = source;
	}

	override func startCapture(completionHandler: ((Error?) -> Void)? = nil) -> Bool {

		// Stop previous capture in case of setConstraints, followed by startCapture
		// aka future applyConstraints
		if (isCapturing) {
			stopCapture();
		}

		if #available(iOS 11.0, *) {
			recorder.isMicrophoneEnabled = false
			recorder.startCapture(handler: {(sampleBuffer, bufferType, error) in
				if (bufferType == RPSampleBufferType.video) {
					self.handleSourceBuffer(
						source: self.source,
						sampleBuffer: sampleBuffer,
						sampleType: bufferType
					)
				}
				if (error != nil) {
					completionHandler!(error)
				}
			}) { (error) in
				if (error != nil) {
					completionHandler!(error)
				} else {
					// TODO Optional closure parameter
					//completionHandler!()
				}
			}

			isCapturing = true
	
			NSLog("PluginRTCScreenCaptureController#startCapture Capture started");
		}

		return isCapturing;
	}

	override func stopCapture() {
		// TODO: stopCaptureWithCompletionHandler with DispatchSemaphore
		if (isCapturing) {
			if #available(iOS 11.0, *) {
				recorder.stopCapture {(error) in
					// TODO debug error
				}
				isCapturing = false

				NSLog("PluginRTCScreenCaptureController#stopCapture Capture stopped");
			}
		}
	}

	func handleSourceBuffer(source: RTCVideoSource, sampleBuffer: CMSampleBuffer, sampleType: RPSampleBufferType) {
		if (CMSampleBufferGetNumSamples(sampleBuffer) != 1 || !CMSampleBufferIsValid(sampleBuffer) ||
			!CMSampleBufferDataIsReady(sampleBuffer)) {
			return;
		}

		let pixelBuffer = CMSampleBufferGetImageBuffer(sampleBuffer);
		if (pixelBuffer == nil) {
			return;
		}

		let width = CVPixelBufferGetWidth(pixelBuffer!);
		let height = CVPixelBufferGetHeight(pixelBuffer!);

		source.adaptOutputFormat(toWidth: Int32(width/2), height: Int32(height/2), fps: 8)

		let rtcPixelBuffer = RTCCVPixelBuffer(pixelBuffer: pixelBuffer!)
		let timeStampNs =
			CMTimeGetSeconds(CMSampleBufferGetPresentationTimeStamp(sampleBuffer)) * Float64(NSEC_PER_SEC)
		let videoFrame =  RTCVideoFrame(buffer: rtcPixelBuffer, rotation: RTCVideoRotation._0, timeStampNs: Int64(timeStampNs))
		source.capturer(capturer, didCapture: videoFrame)
	}
}

class PluginRTCCameraCaptureController : PluginRTCVideoCaptureController {

	private let DEFAULT_HEIGHT : Int32 = 480
	private let DEFAULT_WIDTH : Int32 = 640

	private let DEFAULT_FPS : Int = 15
	private let DEFAULT_ASPECT_RATIO : Float32 = 4/3
	private let FACING_MODE_USER : String = "user";
	private let FACING_MODE_ENV : String = "environment";

	var capturer: RTCCameraVideoCapturer
	
	init(capturer: RTCCameraVideoCapturer) {
		self.capturer = capturer
	}
	
	/*
	// See: https://www.w3.org/TR/mediacapture-streams/#media-track-constraints
	dictionary MediaTrackConstraintSet {
	 // Supported
	 ConstrainDOMString deviceId;
	 ConstrainDOMString facingMode;
	 ConstrainULong     width;
	 ConstrainULong     height;
	 ConstrainDouble    aspectRatio;
	 ConstrainDouble    frameRate;
	 ConstrainULong     sampleRate;
	 // Not Supported
	 ConstrainDOMString resizeMode;
	 ConstrainULong     sampleSize;
	 ConstrainBoolean   echoCancellation;
	 ConstrainBoolean   autoGainControl;
	 ConstrainBoolean   noiseSuppression;
	 ConstrainDouble    latency;
	 ConstrainULong     channelCount;
	 ConstrainDOMString groupId;
	};
	 
	 // typedef ([Clamp] unsigned long or ConstrainULongRange) ConstrainULong;
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
	 dictionary DoubleRange {
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
	 dictionary ConstrainDOMStringParameters {
		(DOMString or sequence<DOMString>) exact;
		(DOMString or sequence<DOMString>) ideal;
	 };
	*/
	func setConstraints(constraints: NSDictionary) -> Bool {
		
		self.constraints = constraints;
		
		self.device = findDevice()
		
		return device != nil;
	}
	
	override func startCapture(completionHandler: ((Error?) -> Void)? = nil) -> Bool {
		
		// Stop previous capture in case of setConstraints, followed by startCapture
		// aka future applyConstraints
		if (isCapturing) {
			stopCapture();
		}
		
		if (device == nil) {
			NSLog("PluginRTCVideoCaptureController#startCapture No matching device found for constraints %@", constraints);
			return false;
		}
		
		if (deviceFormat == nil) {
			NSLog("PluginRTCVideoCaptureController#startCapture No valid formats for device %@", device!);
			return false;
		}
		
		// TODO: completionHandler with DispatchSemaphore
		capturer.startCapture(
			with: device!,
			format: deviceFormat!,
			fps: deviceFrameRate!
		)
		isCapturing = true
		
		NSLog("PluginRTCVideoCaptureController#startCapture Capture started, device:%@, format:%@", device!, deviceFormat!);
		
		return isCapturing;
	}
	
	override func stopCapture() {
		// TODO: stopCaptureWithCompletionHandler with DispatchSemaphore
		if (isCapturing) {
			capturer.stopCapture()
			isCapturing = false
			
			NSLog("PluginRTCVideoCaptureController#stopCapture Capture stopped");
		}
	}
	
	fileprivate func findDevice() -> AVCaptureDevice? {
		
		var device : AVCaptureDevice?;
		
		// facingMode ConstrainDOMString NSDictionary
		// Check the video contraints: examine facingMode and deviceId
		// and pick a default if neither are specified.
		var position : AVCaptureDevice.Position = AVCaptureDevice.Position.unspecified;
		
		let facingMode = self.getConstrainDOMStringValue(constraint: "facingMode"),
			facingModeRequired = self.isConstrainDOMStringExact(constraint: "facingMode");
		
		if (facingMode.count > 0) {
			let isfacingModeEnv = facingMode == self.FACING_MODE_ENV,
				isfacingModeUser = facingMode == self.FACING_MODE_USER;
		 
			position = isfacingModeEnv ? AVCaptureDevice.Position.back :
				isfacingModeUser ? AVCaptureDevice.Position.front : AVCaptureDevice.Position.unspecified;
			
			if (facingModeRequired && position == AVCaptureDevice.Position.unspecified) {
				NSLog("PluginRTCVideoCaptureController#findDevice facingMode fail exact requirement");
				return nil;
			}
			
			NSLog("PluginRTCVideoCaptureController#findDevice facingMode:%@ env:%@ user:%@", facingMode,
				  isfacingModeEnv ? "YES" : "NO",
				  isfacingModeUser ? "YES" : "NO"
			);
		}
		
		// deviceId ConstrainDOMString NSDictionary
		let deviceId = self.getConstrainDOMStringValue(constraint: "deviceId");
		if (deviceId.count > 0) {
			device = AVCaptureDevice(uniqueID: deviceId)
			if (device != nil && !device!.isConnected) {
				device = nil
			}
			
			if (device == nil && self.isConstrainDOMStringExact(constraint: "deviceId")) {
				NSLog("PluginRTCVideoCaptureController#findDevice deviceId fail exact requirement");
				return nil;
			}
		}

		if (device == nil) {
			device = findDeviceForPosition(position: position);
		}
		
		NSLog("PluginRTCVideoCaptureController#findDevice device:%@", device!);
		
		// Check facingMode requirements
		if (facingModeRequired && (
			device == nil ||
				facingMode == "environment" && device?.position != AVCaptureDevice.Position.back ||
					facingMode == "user" && device?.position != AVCaptureDevice.Position.front
		)) {

			NSLog("PluginRTCVideoCaptureController#findDevice facingMode fail exact requirement");
			return nil;
		}
		
		deviceFormat = findFormatForDevice(device:device!);
		
		if (deviceFormat == nil) {
			return nil;
		}
		
		let frameRateRange: NSDictionary = getConstraintDoubleValues(constraint: "frameRate", defaultValue: self.DEFAULT_FPS),
			minFrameRate = frameRateRange.object(forKey: "min") as! Int,
			maxFrameRate = frameRateRange.object(forKey: "max") as! Int
			
		if (minFrameRate > 0 || maxFrameRate > 0) {
			let formatFrameRateRange: AVFrameRateRange = deviceFormat!.videoSupportedFrameRateRanges[0]
		 
			// Fail if frameRate is exact and formatFrameRateRange is not capable
			if (
				isConstrainRangeExact(constraint: "frameRate") && (
					Int(formatFrameRateRange.maxFrameRate) < maxFrameRate ||
						Int(formatFrameRateRange.minFrameRate) > minFrameRate
				)
			) {
				NSLog("PluginRTCVideoCaptureController#findDevice frameRate fail exact requirement");
				return nil;
			}
			
			deviceFrameRate = Int(maxFrameRate > 0 ? maxFrameRate : minFrameRate)
			
			NSLog("PluginRTCVideoCaptureController#findDevice deviceFrameRate:%i", deviceFrameRate!);
			
		// Apply default deviceFrameRate
		} else {
			deviceFrameRate = DEFAULT_FPS;
		}
		
		return device;
	}
	
	fileprivate func findDeviceForPosition(position: AVCaptureDevice.Position) -> AVCaptureDevice? {
		let captureDevices: NSArray = RTCCameraVideoCapturer.captureDevices() as NSArray
		for device: Any in captureDevices {
			let avDevice = device as! AVCaptureDevice
			if (
				avDevice.position == position ||
					// Default to front if unspecified
					(avDevice.position == AVCaptureDevice.Position.front && position == AVCaptureDevice.Position.unspecified)
			) {
				return avDevice
			}
		}
	
		// TODO fail on no match ?
		return captureDevices.firstObject as? AVCaptureDevice
	}
	
	/*
	func switchCamera() -> Bool {
		
		if (self.capturer.captureSession.isRunning) {
			self.capturer.stopCapture()
		}

		self.device = self.findAlternativeDevicePosition(currentDevice: self.device)
		
		self.deviceFormat = self.findFormatForDevice(device: self.device!)
		
		return self.startCapture()
	}
	*/
	
	fileprivate func findAlternativeDevicePosition(currentDevice: AVCaptureDevice?) -> AVCaptureDevice? {
		let captureDevices: NSArray = RTCCameraVideoCapturer.captureDevices() as NSArray
		for device: Any in captureDevices {
			let avDevice = device as! AVCaptureDevice
			if (avDevice.position != currentDevice!.position) {
				return avDevice
			}
		}
	
		return nil
	}
	
	
	// TODO use in isConstrainExact and findFormatForDevice
	/*
	 For string valued constraints, we define "==" below to be true if one of the values in the sequence is exactly the same as the value being compared against.

	 1. We define the fitness distance between a settings dictionary and a constraint set CS as the sum, for each member (represented by a constraintName and constraintValue pair) present in CS, of the following values:

	 2. If constraintName is not supported by the browser, the fitness distance is 0.

	 3. If the constraint is required (constraintValue either contains one or more members named 'min', 'max', or 'exact', or is itself a bare value and bare values are to be treated as 'exact'), and the settings dictionary's value for the constraint does not satisfy the constraint, the fitness distance is positive infinity.

	 4. If the constraint is not required, and does not apply for this type of device, the fitness distance is 0 (that is, the constraint does not influence the fitness distance).

	 5. If no ideal value is specified (constraintValue either contains no member named 'ideal', or, if bare values are to be treated as 'ideal', isn't a bare value), the fitness distance is 0.
	 
	 6. For all positive numeric non-required constraints (such as height, width, frameRate, aspectRatio, sampleRate and sampleSize), the fitness distance is the result of the formula
	 (actual == ideal) ? 0 : |actual - ideal| / max(|actual|, |ideal|)
	 
	 7. For all string and enum non-required constraints (e.g. deviceId, groupId, facingMode, resizeMode, echoCancellation), the fitness distance is the result of the formula
	 (actual == ideal) ? 0 : 1
	*/
	
	fileprivate func findFormatForDevice(device: AVCaptureDevice) -> AVCaptureDevice.Format? {
		
		var selectedFormat: AVCaptureDevice.Format? = nil
		let formats: NSArray = RTCCameraVideoCapturer.supportedFormats(for: device) as NSArray
		
		var widthRange: NSDictionary = getConstraintDoubleValues(constraint: "width", defaultValue: 0),
			minWidth = widthRange.object(forKey: "min") as! Int32,
			maxWidth = widthRange.object(forKey: "max") as! Int32
			
		var heightRange: NSDictionary = getConstraintDoubleValues(constraint: "height", defaultValue: 0),
			minHeight = heightRange.object(forKey: "min") as! Int32,
			maxHeight = heightRange.object(forKey: "max") as! Int32
		
		let aspectRatioRange: NSDictionary = getConstraintLongValues(constraint: "aspectRatio", defaultValue: 0.0),
			minAspectRatio = aspectRatioRange.object(forKey: "min") as! Float32,
			maxAspectRatio = aspectRatioRange.object(forKey: "max") as! Float32
			
		let frameRateRange: NSDictionary = getConstraintDoubleValues(constraint: "frameRate", defaultValue: self.DEFAULT_FPS),
			minFrameRate = frameRateRange.object(forKey: "min") as! Float64,
			maxFrameRate = frameRateRange.object(forKey: "max") as! Float64
		
		// If aspectRatioRange > 0
		if (minAspectRatio > 0 || maxAspectRatio  > 0) {

			// and only one dimension is provided compute missing dimension
			if (((minWidth > 0 || maxWidth > 0) && minHeight == 0 && maxHeight == 0)) {
				minHeight = Int32(Float32(minWidth) / (minAspectRatio > 0 ? minAspectRatio : maxAspectRatio));
				maxHeight = Int32(Float32(maxWidth) / (minAspectRatio > 0 ? minAspectRatio : maxAspectRatio));
			} else if (((minHeight > 0 || maxHeight > 0) && minWidth == 0 && maxWidth == 0)) {
				minWidth = Int32(Float32(maxHeight) * (minAspectRatio > 0 ? minAspectRatio : maxAspectRatio));
				maxWidth = Int32(Float32(maxHeight) * (minAspectRatio > 0 ? minAspectRatio : maxAspectRatio));
			}
			
			NSLog("PluginRTCVideoCaptureController#findFormatForDevice contraints using aspectRatioRange - width:%i/%i, height:%i/%i, aspectRatio: %f/%f", minWidth, maxWidth, minHeight, maxHeight, minAspectRatio, maxAspectRatio);
			
		// If no aspectRatioRange and no dimension is provided use default dimension
		} else if (minHeight == 0 && maxHeight == 0 && minWidth == 0 && maxWidth == 0)  {
			minHeight = self.DEFAULT_HEIGHT;
			maxHeight = self.DEFAULT_HEIGHT;
			maxWidth = self.DEFAULT_WIDTH;
			maxWidth = self.DEFAULT_WIDTH;
			
			NSLog("PluginRTCVideoCaptureController#findFormatForDevice contraints using default - width:%i/%i, height:%i/%i, aspectRatio: %f/%f", minWidth, maxWidth, minHeight, maxHeight, minAspectRatio, maxAspectRatio);
		}
		
		for format: Any in formats {
			
			let devFormat: AVCaptureDevice.Format = format as! AVCaptureDevice.Format
			let pixelFormat: FourCharCode = CMFormatDescriptionGetMediaSubType(devFormat.formatDescription)
		
			let dimension: CMVideoDimensions = CMVideoFormatDescriptionGetDimensions(devFormat.formatDescription)
			
			let aspectRatio : Float32 = (Float32(dimension.width) / Float32(dimension.height));
			
			let frameRateRanges: [AVFrameRateRange] = devFormat.videoSupportedFrameRateRanges
			let frameRates = frameRateRanges[0];
			
			NSLog("PluginRTCVideoCaptureController#findFormatForDevice device format - width:%i, height:%i, aspectRatio: %f, frameRateRanges:%f/%f", dimension.width, dimension.height, aspectRatio, frameRates.minFrameRate, frameRates.maxFrameRate);
			
			
			if (
				(minAspectRatio == 0 && maxAspectRatio == 0) || (
					(minAspectRatio == 0 || checkDoubleIsEqual(fromFloat: aspectRatio, toFloat: minAspectRatio)) ||
								(maxAspectRatio == 0 || checkDoubleIsEqual(fromFloat: aspectRatio, toFloat: maxAspectRatio))
				)
			) {
				//selectedFormat = devFormat
			} else {
					
				// Skip next tests
				//NSLog("Bad aspectRatio");
				continue
			}
			
			// dimension.height and dimension.width Matches
			if (
				((maxHeight == 0 || dimension.height <= maxHeight) && (minHeight == 0 || dimension.height >= minHeight)) &&
						((maxWidth == 0 || dimension.width <= maxWidth) && (minWidth == 0 || dimension.width >= minWidth))
			) {
				//NSLog("dimensions %i/%i, aspectRatio: %f",  dimension.width,  dimension.height, aspectRatio);
			} else {
				
				// Skip next tests
				//NSLog("Bad dimensions");
				continue
			}
			
			if (
				(minFrameRate == 0 && maxFrameRate == 0) || (
					(maxFrameRate == 0 || frameRates.maxFrameRate >= maxFrameRate) &&
						(minFrameRate  == 0 || frameRates.minFrameRate <= minFrameRate)
					)
			) {
				//selectedFormat = devFormat
			} else {
				
				// Skip next tests
				//NSLog("Bad frameRate");
				continue
			}
			
			if (pixelFormat != self.capturer.preferredOutputPixelFormat()) {
				
				// Skip next tests
				//NSLog("Bad pixelFormat");
				continue
			}
			
			selectedFormat = devFormat;
			
			// TODO Handle isConstrainExact for required constraint
		}

		if (selectedFormat != nil) {

			let dimension: CMVideoDimensions = CMVideoFormatDescriptionGetDimensions(selectedFormat!.formatDescription)
			let aspectRatio : Float32 = (Float32(dimension.width) / Float32(dimension.height));
			let frameRateRanges: [AVFrameRateRange] = selectedFormat!.videoSupportedFrameRateRanges
			let frameRates = frameRateRanges[0];
			
			// TODO Apply frameRates via minFrameRate/maxFrameRate
			
			NSLog("PluginRTCVideoCaptureController#findFormatForDevice selected format - width:%i, height:%i, aspectRatio: %f, frameRateRanges:%f/%f", dimension.width, dimension.height, aspectRatio, frameRates.minFrameRate, frameRates.maxFrameRate);
		}
	
		return selectedFormat
	}

	//
	// constraints parsers
	//
	
	fileprivate func getConstrainDOMStringValue(constraint: String) -> String {
		var finalValue: String = "";
		let constraints = self.constraints;
		let value = constraints.object(forKey: constraint);
		
		if value is String {
			finalValue = value as! String
		} else if value is NSDictionary {
			let value = value as! NSDictionary;
			if (value.object(forKey: "exact") != nil) {
				finalValue = value.object(forKey: "exact") as! String
			} else if (value.object(forKey: "ideal") != nil) {
				finalValue = value.object(forKey: "ideal") as! String
			}
		}
		
		return finalValue;
	}
	
	// If the constraint is required (constraintValue either contains one or more members named 'min', 'max', or 'exact',
	// or is itself a bare value and bare values are to be treated as 'exact'), and the settings dictionary's value for
	// the constraint does not satisfy the constraint, the fitness distance is positive infinity.
	
	private let NON_REQUIRE_CONSTRAINTS = ["height", "width", "frameRate", "aspectRatio", "sampleRate", "sampleSize"]
	private let REQUIRE_CONSTRAINTS = ["deviceId", "groupId", "facingMode", "resizeMode", "echoCancellation"]
	
	fileprivate func isConstrainDOMStringExact(constraint: String) -> Bool {
		return isConstrainExact(constraint: constraint);
	}
	
	fileprivate func isConstrainExact(constraint: String) -> Bool {
		var isRequired: Bool = false;
		let constraints = self.constraints;
		let value = constraints.object(forKey: constraint);
		
		if value is String {
			isRequired = (value as! String).count > 0;
		} else if value is NSNumber {
			isRequired = (value as! NSNumber).floatValue > 0;
		} else if value is NSDictionary {
			let value = value as! NSDictionary;
			if (value.object(forKey: "exact") != nil) {
				isRequired = (value.object(forKey: "exact") as! String).count > 0
			} else if (value.object(forKey: "ideal") != nil) {
				isRequired = false;
			}
		}
		
		return isRequired;
	}
	
	
	fileprivate func getConstrainDoubleIdealValue(constraint: String) -> Int {
		return getConstrainIdealValue(constraint: constraint) as! Int;
	}
	
	fileprivate func getConstraintLongIdealValue(constraint: String) -> Float32 {
		return getConstrainIdealValue(constraint: constraint).floatValue;
	}
	
	fileprivate func getConstrainIdealValue(constraint: String) -> NSNumber {
		var idealValue: NSNumber = -1;
		let constraints = self.constraints;
		let value = constraints.object(forKey: constraint);
		
		if value is NSDictionary {
			let value = value as! NSDictionary;
			if (value.object(forKey: "ideal") != nil) {
				idealValue = value.object(forKey: "ideal") as! NSNumber;
			}
		}
		
		return idealValue;
	}
	
	// Convert NSNumber to Float32 (e.g 1.7777777777777777 to 1.777778)
	fileprivate func NSNumberToFloat32(number: NSNumber) -> Float32 {
		return number.floatValue;
		//return Float32(String(format: "%.7f", number.floatValue))!;
	}
	
	// Handle (e.g Compare 1.7777777777777777 with 1.777778)
	func checkDoubleIsEqual(fromFloat: Float32, toFloat : Float32, includingNumberOfFractionalDigits : Int = 6) -> Bool {

	   let denominator : Float32 = pow(10.0, Float32(includingNumberOfFractionalDigits))
	   let maximumDifference : Float32 = 1.0 / denominator
	   let realDifference : Float32 = abs(fromFloat - toFloat)

	   if realDifference >= maximumDifference {
		   return false
	   } else {
		   return true
	   }
	  }
	
	fileprivate func getConstraintDoubleValues(constraint: String, defaultValue: Int) -> NSDictionary {
		return getConstrainRangeValues(constraint: constraint, defaultValue: NSNumber(value: defaultValue));
	}
	
	fileprivate func getConstraintLongValues(constraint: String, defaultValue: Float) -> NSDictionary {
		let finalValue = getConstrainRangeValues(constraint: constraint, defaultValue: NSNumber(value: defaultValue));
		
		return [
			"min": NSNumberToFloat32(number: finalValue.object(forKey: "min") as! NSNumber),
			"max": NSNumberToFloat32(number: finalValue.object(forKey: "max") as! NSNumber)
		];
	}
	
	fileprivate func getConstrainRangeValues(constraint: String, defaultValue: NSNumber) -> NSDictionary {
		let constraints = self.constraints;
		let finalValue: NSMutableDictionary = [:];
		finalValue.setValue(defaultValue, forKey: "min")
		finalValue.setValue(defaultValue, forKey: "max")
		
		let value = constraints.object(forKey: constraint);
		
		if value is NSNumber {
			finalValue.setValue(value, forKey: "min")
			finalValue.setValue(value, forKey: "max")
		} else if value is NSDictionary {
			let value = value as! NSDictionary;
			if (value.object(forKey: "exact") != nil) {
				let value = value.object(forKey: "exact") as! NSNumber
				finalValue.setValue(value, forKey: "min")
				finalValue.setValue(value, forKey: "max")
			} else if (value.object(forKey: "ideal") != nil) {
				let value = value.object(forKey: "ideal") as! NSNumber
				finalValue.setValue(value, forKey: "min")
				finalValue.setValue(value, forKey: "max")
			}
			// Note: We do not support (exact|ideal) + min/min at root, min/max will take over for now.
			if (value.object(forKey: "min") != nil) {
				let value = value.object(forKey: "min") as! NSNumber
				finalValue.setValue(value, forKey: "min")
			}
			if (value.object(forKey: "max") != nil) {
				let value = value.object(forKey: "max") as! NSNumber
				finalValue.setValue(value, forKey: "max")
			}
		}
		
		return finalValue;
	}
	
	fileprivate func isConstrainRangeExact(constraint: String) -> Bool {
		let constraints = self.constraints;
		var isRequired: Bool = false;
		let value = constraints.object(forKey: constraint);
		
		if value is Int32 {
			isRequired = (value as! Int32) > 0;
		} else if value is NSDictionary {
			if (constraints.object(forKey: "exact") != nil) {
				isRequired = true;
			} else if (constraints.object(forKey: "ideal") != nil) {
				isRequired = false;
			}
		}
		
		return isRequired;
	}
}
