//
//  Use this file to import your target's public headers that you would like to expose to Swift.
//


#import <Cordova/CDVPlugin.h>

#import <WebRTC/RTCAudioSource.h>
#import <WebRTC/RTCAudioTrack.h>
#import <WebRTC/RTCDataChannel.h>
#import <WebRTC/RTCDtmfSender.h>
#import <WebRTC/RTCEAGLVideoView.h>
#import <WebRTC/RTCIceCandidate.h>
#import <WebRTC/RTCIceServer.h>
#import <WebRTC/RTCMediaConstraints.h>
#import <WebRTC/RTCMediaSource.h>
#import <WebRTC/RTCMediaStream.h>
#import <WebRTC/RTCMediaStreamTrack.h>
#import <WebRTC/RTCPeerConnection.h>
#import <WebRTC/RTCPeerConnectionFactory.h>
#import <WebRTC/RTCSessionDescription.h>
#import <WebRTC/RTCVideoCapturer.h>
#import <WebRTC/RTCVideoRenderer.h>
#import <WebRTC/RTCVideoSource.h>
#import <WebRTC/RTCVideoTrack.h>
#import <WebRTC/RTCRtpReceiver.h>

#import "PSWebSocket.h"
#import "PSWebSocketServer.h"
#include <ifaddrs.h>

// Expose RTCEAGLVideoViewDelegate to Swift
RTC_OBJC_EXPORT
@protocol RTCEAGLVideoViewDelegate <RTCVideoViewDelegate>
@end
