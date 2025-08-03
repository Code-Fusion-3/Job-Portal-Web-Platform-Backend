const WebSocket = require('ws');
const jwt = require('jsonwebtoken');

class WebSocketServer {
  constructor(server) {
    this.wss = new WebSocket.Server({ 
      server,
      maxPayload: 1024 * 1024, // 1MB max payload
      perMessageDeflate: false // Disable compression to reduce CPU usage
    });
    this.clients = new Map(); // Map to store client connections
    this.maxConnections = 100; // Limit concurrent connections
    this.setupWebSocket();
  }

  setupWebSocket() {
    this.wss.on('connection', (ws, req) => {
      // Check connection limit
      if (this.clients.size >= this.maxConnections) {
        console.log('Max connections reached, rejecting new connection');
        ws.close(1013, 'Too many connections');
        return;
      }

      console.log('WebSocket client connected');

      // Set connection timeout
      ws.connectionTimeout = setTimeout(() => {
        if (ws.readyState === WebSocket.CONNECTING) {
          console.log('Connection timeout, closing');
          ws.close(1000, 'Connection timeout');
        }
      }, 10000); // 10 second timeout

      // Authenticate the connection
      this.authenticateConnection(ws, req);

      ws.on('message', (message) => {
        try {
          const data = JSON.parse(message);
          this.handleMessage(ws, data);
        } catch (error) {
          console.error('WebSocket message parsing error:', error);
        }
      });

      ws.on('close', (code, reason) => {
        this.removeClient(ws);
        console.log('WebSocket client disconnected', code, reason);
      });

      ws.on('error', (error) => {
        console.error('WebSocket error:', error);
        this.removeClient(ws);
      });

      // Handle ping/pong for connection health
      ws.isAlive = true;
      ws.on('pong', () => {
        ws.isAlive = true;
      });
    });

    // Set up heartbeat to detect stale connections
    this.heartbeat = setInterval(() => {
      this.wss.clients.forEach((ws) => {
        if (ws.isAlive === false) {
          console.log('Terminating stale connection');
          return ws.terminate();
        }
        
        ws.isAlive = false;
        ws.ping();
      });
    }, 30000); // Check every 30 seconds
  }

  authenticateConnection(ws, req) {
    // Extract token from query parameters or headers
    let token = null;
    
    // Try to extract from URL query parameters
    if (req.url && req.url.includes('token=')) {
      const urlParams = new URLSearchParams(req.url.split('?')[1]);
      token = urlParams.get('token');
    }
    
    // Fallback to Authorization header
    if (!token && req.headers.authorization) {
      token = req.headers.authorization.split(' ')[1];
    }
    
    if (!token) {
      console.log('WebSocket connection rejected: No token provided');
      ws.close(1008, 'Authentication required');
      return;
    }

    try {
      // Validate token format before verification
      if (typeof token !== 'string' || token.split('.').length !== 3) {
        console.log('WebSocket connection rejected: Malformed token');
        ws.close(1008, 'Invalid token format');
        return;
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      ws.userId = decoded.userId;
      ws.userRole = decoded.role;
      
      // Clear connection timeout on successful auth
      if (ws.connectionTimeout) {
        clearTimeout(ws.connectionTimeout);
        ws.connectionTimeout = null;
      }
      
      // Store client connection
      this.clients.set(ws.userId, {
        ws,
        role: ws.userRole,
        connectedAt: new Date()
      });

      // Send welcome message
      this.sendToClient(ws, {
        type: 'connection',
        message: 'Connected successfully',
        userId: ws.userId,
        role: ws.userRole
      });

    } catch (error) {
      console.error('WebSocket authentication error:', error.message);
      ws.close(1008, 'Invalid token');
    }
  }

  handleMessage(ws, data) {
    switch (data.type) {
      case 'subscribe':
        this.handleSubscribe(ws, data);
        break;
      case 'unsubscribe':
        this.handleUnsubscribe(ws, data);
        break;
      case 'ping':
        this.sendToClient(ws, { type: 'pong', timestamp: Date.now() });
        break;
      default:
        console.log('Unknown message type:', data.type);
    }
  }

  handleSubscribe(ws, data) {
    const { channel } = data;
    
    if (!ws.subscriptions) {
      ws.subscriptions = new Set();
    }
    
    ws.subscriptions.add(channel);
    
    this.sendToClient(ws, {
      type: 'subscribed',
      channel,
      message: `Subscribed to ${channel}`
    });
  }

  handleUnsubscribe(ws, data) {
    const { channel } = data;
    
    if (ws.subscriptions) {
      ws.subscriptions.delete(channel);
    }
    
    this.sendToClient(ws, {
      type: 'unsubscribed',
      channel,
      message: `Unsubscribed from ${channel}`
    });
  }

  sendToClient(ws, data) {
    if (ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify(data));
      } catch (error) {
        console.error('Error sending message to client:', error);
        this.removeClient(ws);
      }
    }
  }

  broadcastToRole(role, data) {
    this.wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN && client.userRole === role) {
        this.sendToClient(client, data);
      }
    });
  }

  broadcastToChannel(channel, data) {
    this.wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN && 
          client.subscriptions && 
          client.subscriptions.has(channel)) {
        this.sendToClient(client, data);
      }
    });
  }

  sendToUser(userId, data) {
    const client = this.clients.get(userId);
    if (client && client.ws.readyState === WebSocket.OPEN) {
      this.sendToClient(client.ws, data);
    }
  }

  removeClient(ws) {
    // Clear connection timeout
    if (ws.connectionTimeout) {
      clearTimeout(ws.connectionTimeout);
      ws.connectionTimeout = null;
    }

    // Remove from clients map
    if (ws.userId) {
      this.clients.delete(ws.userId);
    }

    // Close connection if still open
    if (ws.readyState !== WebSocket.CLOSED) {
      ws.close();
    }
  }

  // Cleanup method
  cleanup() {
    if (this.heartbeat) {
      clearInterval(this.heartbeat);
    }
    
    this.wss.clients.forEach((ws) => {
      this.removeClient(ws);
    });
    
    this.wss.close();
  }

  notifyDashboardUpdate(role = 'admin') {
    this.broadcastToRole(role, {
      type: 'dashboard_update',
      message: 'Dashboard data updated',
      timestamp: Date.now()
    });
  }

  notifyNewRequest(request) {
    this.broadcastToRole('admin', {
      type: 'new_request',
      message: `New request from ${request.name}`,
      data: request,
      timestamp: Date.now()
    });
  }

  notifyRequestStatusChange(requestId, status, role = 'admin') {
    this.broadcastToRole(role, {
      type: 'request_status_change',
      message: `Request ${requestId} status changed to ${status}`,
      data: { requestId, status },
      timestamp: Date.now()
    });
  }

  notifyNewJobSeeker(jobSeeker) {
    this.broadcastToRole('admin', {
      type: 'new_job_seeker',
      message: `New job seeker registered: ${jobSeeker.profile?.firstName} ${jobSeeker.profile?.lastName}`,
      data: jobSeeker,
      timestamp: Date.now()
    });
  }

  notifySystemMessage(message, role = 'admin') {
    this.broadcastToRole(role, {
      type: 'system_message',
      message,
      timestamp: Date.now()
    });
  }

  getStats() {
    return {
      totalConnections: this.clients.size,
      maxConnections: this.maxConnections,
      activeConnections: this.wss.clients.size
    };
  }
}

module.exports = WebSocketServer; 