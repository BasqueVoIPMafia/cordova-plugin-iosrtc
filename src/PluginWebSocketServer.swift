import Foundation

class WSClient : NSObject {
	var uuid: String
	var sock: PSWebSocket
	var didclose: Bool
	var raddr: String!
	var protocols: String!
	var resource: String!
	
	init(uuid: String, sock: PSWebSocket) {
		self.uuid = uuid
		self.sock = sock
		self.didclose = false
	}
}

public class PluginWebSocketServer : NSObject, PSWebSocketServerDelegate {
	fileprivate var wsserver: PSWebSocketServer?
	fileprivate var port: Int
	var realport: Int
	fileprivate var origins: [String]?
	fileprivate var protocols: [String]?
	fileprivate var clients: [String : WSClient]!
	fileprivate var didStopOrDidFail: Bool
	fileprivate var guuids: [String : Bool]!
	
	override init() {
		port = 0
		realport = 0
		origins = ["file://", "http://", "https://", "ws://", "wss://"]
		protocols = ["proto-v1", "proto-v2"]
		clients = [:]
		didStopOrDidFail = false
	}
	
	deinit {
		if let server = wsserver {
			server.stop()
			wsserver = nil
			clients.removeAll()
		}
	}
	
	@objc public func getInterfaces() {
		var obj = [String: [String: [String]]]()
		var intfobj: [String: [String]]
		var ipv4Addresses: [String]
		var ipv6Addresses: [String]
		
		for intf in PluginInterface.allInterfaces() {
			if !intf.isLoopback {
				if let ifobj = obj[intf.name] {
					intfobj = ifobj
					ipv4Addresses = intfobj["ipv4Addresses"]!
					ipv6Addresses = intfobj["ipv6Addresses"]!
				} else {
					intfobj = [:]
					ipv4Addresses = []
					ipv6Addresses = []
				}
				
				if intf.family == .ipv6 {
					if ipv6Addresses.index(of: intf.address!) == nil {
						ipv6Addresses.append(intf.address!)
					}
				} else if intf.family == .ipv4 {
					if ipv4Addresses.index(of: intf.address!) == nil {
						ipv4Addresses.append(intf.address!)
					}
				}
				
				if (!ipv4Addresses.isEmpty) || (!ipv6Addresses.isEmpty) {
					intfobj["ipv4Addresses"] = ipv4Addresses
					intfobj["ipv6Addresses"] = ipv6Addresses
					obj[intf.name] = intfobj
				}
			}
		}
		
		NSLog("WebSocketServer: getInterfaces: %@", obj)
	}
	
	func getClient(sock: PSWebSocket) -> WSClient? {
		for (_, client) in clients {
			if (client.sock == sock) {
				return client
			}
		}
		return nil
	}
	
	public func start(lport:Int, tcpNoDelay:Bool?) {
		NSLog("WebSocketServer: start")
		
		if didStopOrDidFail {
			wsserver = nil
			didStopOrDidFail = false
		}
		
		if wsserver != nil {
			NSLog("Server already running")
			return
		}
		
		port = lport
		realport = 0
		if port < 0 || port > 65535 {
			NSLog("Port number error");
			return
		}
		
		if let server = PSWebSocketServer(host: nil, port: UInt(port)) {
			wsserver = server
			server.delegate = self
			
			if tcpNoDelay != nil {
				server.setTcpNoDelay(tcpNoDelay!)
			}
			
			server.start()
		}
	}

	public func isStarted() -> Bool {
		if (didStopOrDidFail || self.wsserver == nil) {
			return false
		} else {
			return true
		}
	}

	@objc public func stop() {
		NSLog("WebSocketServer: stop")
		
		if didStopOrDidFail {
			wsserver = nil
			didStopOrDidFail = false
		}
		
		if wsserver == nil {
			NSLog("Server is not running");
			return
		}
		
		if let server = wsserver {
			server.stop()
		}
	}
	
	@objc public func send(uuid: String?, msg: NSData?) {
		//NSLog("WebSocketServer: send")
		
		if uuid != nil && msg != nil {
			if let client = clients[uuid!] {
				client.sock.send(msg)
			} else {
				//NSLog("WebSocketServer: Send: unknown socket.")
			}
		} else {
			NSLog("WebSocketServer: Send: UUID or msg not specified.")
		}
	}
	
	@objc public func close(uuid: String?, code: Int, reason: String?) {
		NSLog("WebSocketServer: close")
		
		if uuid != nil {
			if let client = clients[uuid!] {
				if (code == -1) {
					client.sock.close()
				} else {
					client.sock.close(withCode: code, reason: reason)
				}
			} else {
				//NSLog("WebSocketServer: Close: unknown socket.")
			}
		} else {
			NSLog("WebSocketServer: Close: UUID not specified.")
		}
	}
	
	
	/** Events from PSWebSocketServerDelegate
	*/
	
	public func serverDidStart(_ server: PSWebSocketServer!) {
		NSLog("WebSocketServer: Server did start…")
		
		realport = Int(server.realPort)
		
		let status: NSDictionary = NSDictionary(
			objects: ["0.0.0.0", Int(server.realPort)],
			forKeys: ["addr" as NSCopying, "port" as NSCopying])
		NSLog("WebSocketServer: Server did start:%@", status)
	}
	
	public func serverDidStop(_ server: PSWebSocketServer!) {
		NSLog("WebSocketServer: Server did stop…")
		
		didStopOrDidFail = true
		clients.removeAll()
		
		let status: NSDictionary = NSDictionary(
			objects: ["0.0.0.0", Int(server.realPort)],
			forKeys: ["addr" as NSCopying, "port" as NSCopying])
		NSLog("WebSocketServer: Server did stop:%@", status)
	}
	
	public func server(_ server: PSWebSocketServer!, didFailWithError error: Error!) {
		NSLog("WebSocketServer: Server did fail with error:%@", error.localizedDescription)
		
		// normally already stopped. just making sure!
		wsserver?.stop()
		didStopOrDidFail = true
		clients.removeAll();
		
		let status: NSDictionary = NSDictionary(
			objects: ["onFailure", "0.0.0.0", port, error.localizedDescription],
			forKeys: ["action" as NSCopying, "addr" as NSCopying, "port" as NSCopying, "reason" as String as NSCopying])
		NSLog("WebSocketServer: Server did fail with error:%@", status)
	}
	
	public func server(_ server: PSWebSocketServer!, acceptWebSocketFrom address: Data, with request: URLRequest,
					   trust: SecTrust, response: AutoreleasingUnsafeMutablePointer<HTTPURLResponse?>) -> Bool {
		NSLog("WebSocketServer: Server should accept request:%@, %@",
			  request.description, request.allHTTPHeaderFields!)
		
		if let o = origins {
			let origin = request.value(forHTTPHeaderField: "Origin")
			if o.index(of: origin!) == nil {
				NSLog("WebSocketServer: Invalid Origin:%@", origin!)
				//return false
			}
		}
		
		if let _ = protocols {
			if let acceptedProtocol = getAcceptedProtocol(request) {
				let headerFields = [
					"Sec-WebSocket-Protocol" : acceptedProtocol,
					"Sec-WebSocket-Extensions" : "permessage-deflate"
				]
				let r = HTTPURLResponse.init(
					url: request.url!, statusCode: 200, httpVersion: "1.1", headerFields: headerFields)!
				response.pointee = r
			} else {
				if let secWebSocketProtocol = request.value(forHTTPHeaderField: "Sec-WebSocket-Protocol") {
					NSLog("WebSocketServer: Sec-WebSocket-Protocol denied:%@", secWebSocketProtocol)
					return false
				}else {
					NSLog("WebSocketServer: Sec-WebSocket-Protocol not exist")
				}
			}
		}
		
		return true
	}
	
	public func server(_ server: PSWebSocketServer!, webSocketDidOpen webSocket: PSWebSocket!) {
		NSLog("WebSocketServer: WebSocket did open")
		
		// clean previously closed sockets
		var closeds: [String] = []
		for (key, client) in clients {
			if (client.didclose) {
				closeds.append(key)
			}
		}
		for key in closeds {
			clients.removeValue(forKey: key)
		}
		
		let remoteAddr = webSocket.remoteHost!
		
		var acceptedProtocol = ""
		if let _ = protocols {
			if let proto = getAcceptedProtocol(webSocket.urlRequest) {
				acceptedProtocol = proto
			}
		}
		
		var uuid: String!
		var resource = ""
		if (webSocket.urlRequest.url!.query != nil) {
			resource = String(cString: (webSocket.urlRequest.url!.query?.cString(using: String.Encoding.utf8))! )
			let pos:Range<String.Index>? = resource.range(of: "uuid=")
			if (pos != nil) {
				//let index = resource.index(after: pos!.upperBound)
				uuid = resource.substring(from: pos!.upperBound)
			}
		}
		if uuid == nil || clients[uuid] != nil {
			NSLog("uuid is null or exists, uuid=%@", uuid)
			// prevent collision
			uuid = UUID().uuidString
		}
		
		let client = WSClient(uuid:uuid, sock: webSocket)
		client.raddr = remoteAddr
		client.protocols = acceptedProtocol
		client.resource = resource
		clients[uuid] = client
		NSLog("WebSocketServer: WebSocket did open, uuid:%@, resource:%@", uuid, resource)
	}
	
	public func server(_ server: PSWebSocketServer!, webSocket: PSWebSocket!, didReceiveMessage message: Any) {
		NSLog("WebSocketServer: Websocket did receive message")
		
		if let client = getClient(sock: webSocket) {
			let uuid: String = client.uuid
			NSLog("WebSocketServer: Websocket did receive message from:%@", uuid)
		} else {
			NSLog("WebSocketServer: unknown socket")
		}
	}
	
	public func server(_ server: PSWebSocketServer!, webSocket: PSWebSocket!, didCloseWithCode code: Int, reason: String, wasClean: Bool) {
		//NSLog("WebSocketServer: WebSocket did close with code: %@, reason: %@, wasClean: %@", code, reason, wasClean)
		
		if let client = getClient(sock: webSocket)  {
			client.didclose = true
			let uuid: String = client.uuid
			let status: NSDictionary = NSDictionary(
				objects: ["onClose", uuid, code, reason, wasClean],
				forKeys: ["action" as NSCopying, "uuid" as NSCopying, "code" as NSCopying, "reason" as NSCopying,
						  "wasClean" as NSCopying])
			NSLog("WebSocketServer: WebSocket did close:%@", status)
		} else {
			NSLog("WebSocketServer: unknown socket")
		}
	}
	
	public func server(_ server: PSWebSocketServer!, webSocket: PSWebSocket!, didFailWithError error: Error!) {
		NSLog("WebSocketServer: WebSocket did fail with error:%@", error!.localizedDescription)
		if (webSocket.readyState == PSWebSocketReadyState.open) {
			webSocket.close(withCode: 1011, reason: "")
		}
	}
	
	fileprivate func getAcceptedProtocol(_ request: URLRequest) -> String? {
		var acceptedProtocol: String?
		if let secWebSocketProtocol = request.value(forHTTPHeaderField: "Sec-WebSocket-Protocol") {
			let requestedProtocols = secWebSocketProtocol.components(separatedBy: ", ")
			for requestedProtocol in requestedProtocols {
				if protocols!.index(of: requestedProtocol) != nil {
					// returns first matching protocol.
					// assumes in order of preference.
					acceptedProtocol = requestedProtocol
					break
				}
			}
			
			NSLog("WebSocketServer: Sec-WebSocket-Protocol:%@", secWebSocketProtocol)
			NSLog("WebSocketServer: Accepted Protocol:%@", acceptedProtocol!)
		}
		return acceptedProtocol
	}
}

