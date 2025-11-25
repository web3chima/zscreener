import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server as HTTPServer } from 'http';
import { authService } from './auth-service.js';
import { AlertNotification } from '../types/alert.js';
import axios from 'axios';

export class NotificationService {
  private io: SocketIOServer | null = null;
  private userSockets: Map<string, Set<string>> = new Map(); // userId -> Set of socket IDs

  /**
   * Initialize WebSocket server
   */
  initialize(httpServer: HTTPServer): void {
    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: process.env.CORS_ORIGIN || '*',
        credentials: true,
      },
      path: '/socket.io',
    });

    this.setupSocketHandlers();
    console.log('WebSocket notification service initialized');
  }

  /**
   * Setup WebSocket connection handlers
   */
  private setupSocketHandlers(): void {
    if (!this.io) return;

    this.io.on('connection', async (socket: Socket) => {
      console.log(`Client connected: ${socket.id}`);

      // Authenticate socket connection
      const token = socket.handshake.auth.token || socket.handshake.query.token;

      if (!token) {
        console.log(`Unauthenticated connection attempt: ${socket.id}`);
        socket.emit('error', { code: 'UNAUTHORIZED', message: 'Authentication required' });
        socket.disconnect();
        return;
      }

      try {
        // Verify JWT token
        const payload = authService.verifyJWT(token as string);
        const session = await authService.getSession(payload.userId);

        if (!session) {
          socket.emit('error', { code: 'SESSION_EXPIRED', message: 'Session expired' });
          socket.disconnect();
          return;
        }

        // Store socket connection for user
        const userId = payload.userId;
        if (!this.userSockets.has(userId)) {
          this.userSockets.set(userId, new Set());
        }
        this.userSockets.get(userId)!.add(socket.id);

        // Store userId in socket data
        (socket as any).userId = userId;

        console.log(`User ${userId} authenticated on socket ${socket.id}`);

        // Send connection success
        socket.emit('connected', {
          message: 'Connected to notification service',
          userId,
        });

        // Subscribe to user's notification room
        socket.join(`user:${userId}`);

        // Handle disconnection
        socket.on('disconnect', () => {
          console.log(`Client disconnected: ${socket.id}`);
          this.handleDisconnect(socket);
        });

        // Handle notification acknowledgment
        socket.on('notification:ack', (data: { notificationId: string }) => {
          console.log(`Notification ${data.notificationId} acknowledged by user ${userId}`);
        });

        // Handle subscription to specific alert
        socket.on('alert:subscribe', (data: { alertId: string }) => {
          socket.join(`alert:${data.alertId}`);
          console.log(`User ${userId} subscribed to alert ${data.alertId}`);
        });

        // Handle unsubscription from specific alert
        socket.on('alert:unsubscribe', (data: { alertId: string }) => {
          socket.leave(`alert:${data.alertId}`);
          console.log(`User ${userId} unsubscribed from alert ${data.alertId}`);
        });
      } catch (error) {
        console.error('Socket authentication error:', error);
        socket.emit('error', { code: 'AUTH_FAILED', message: 'Authentication failed' });
        socket.disconnect();
      }
    });
  }

  /**
   * Handle socket disconnection
   */
  private handleDisconnect(socket: Socket): void {
    const userId = (socket as any).userId;

    if (userId && this.userSockets.has(userId)) {
      const sockets = this.userSockets.get(userId)!;
      sockets.delete(socket.id);

      if (sockets.size === 0) {
        this.userSockets.delete(userId);
      }
    }
  }

  /**
   * Send notification to user via WebSocket
   */
  async sendNotificationToUser(
    userId: string,
    notification: AlertNotification
  ): Promise<boolean> {
    if (!this.io) {
      console.warn('WebSocket server not initialized');
      return false;
    }

    try {
      // Send to user's room
      this.io.to(`user:${userId}`).emit('notification', {
        id: notification.id,
        alertId: notification.alertId,
        message: notification.notificationData.message,
        details: notification.notificationData.details,
        triggeredAt: notification.triggeredAt,
        timestamp: Date.now(),
      });

      console.log(`Notification sent to user ${userId}`);
      return true;
    } catch (error) {
      console.error(`Failed to send notification to user ${userId}:`, error);
      return false;
    }
  }

  /**
   * Send notification to specific alert subscribers
   */
  async sendNotificationToAlert(
    alertId: string,
    notification: AlertNotification
  ): Promise<boolean> {
    if (!this.io) {
      console.warn('WebSocket server not initialized');
      return false;
    }

    try {
      this.io.to(`alert:${alertId}`).emit('alert-notification', {
        id: notification.id,
        alertId: notification.alertId,
        message: notification.notificationData.message,
        details: notification.notificationData.details,
        triggeredAt: notification.triggeredAt,
        timestamp: Date.now(),
      });

      console.log(`Notification sent to alert ${alertId} subscribers`);
      return true;
    } catch (error) {
      console.error(`Failed to send notification to alert ${alertId}:`, error);
      return false;
    }
  }

  /**
   * Broadcast notification to all connected clients
   */
  async broadcastNotification(notification: {
    message: string;
    details?: any;
  }): Promise<boolean> {
    if (!this.io) {
      console.warn('WebSocket server not initialized');
      return false;
    }

    try {
      this.io.emit('broadcast', {
        message: notification.message,
        details: notification.details,
        timestamp: Date.now(),
      });

      console.log('Notification broadcasted to all clients');
      return true;
    } catch (error) {
      console.error('Failed to broadcast notification:', error);
      return false;
    }
  }

  /**
   * Send email notification
   */
  async sendEmailNotification(
    email: string,
    notification: AlertNotification
  ): Promise<boolean> {
    try {
      // In production, integrate with email service (SendGrid, AWS SES, etc.)
      console.log(`Sending email notification to ${email}`);
      console.log(`Subject: Alert Triggered - ${notification.notificationData.message}`);
      console.log(`Body:`, notification.notificationData.details);

      // Placeholder for actual email sending
      // await emailService.send({
      //   to: email,
      //   subject: `Alert Triggered - ${notification.notificationData.message}`,
      //   body: JSON.stringify(notification.notificationData.details, null, 2),
      // });

      return true;
    } catch (error) {
      console.error(`Failed to send email to ${email}:`, error);
      return false;
    }
  }

  /**
   * Send webhook notification
   */
  async sendWebhookNotification(
    webhookUrl: string,
    notification: AlertNotification
  ): Promise<boolean> {
    try {
      const payload = {
        id: notification.id,
        alertId: notification.alertId,
        message: notification.notificationData.message,
        details: notification.notificationData.details,
        triggeredAt: notification.triggeredAt,
        timestamp: Date.now(),
      };

      const response = await axios.post(webhookUrl, payload, {
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Zscreener-Alert-Service/1.0',
        },
        timeout: 5000,
      });

      if (response.status >= 200 && response.status < 300) {
        console.log(`Webhook notification sent to ${webhookUrl}`);
        return true;
      } else {
        console.error(`Webhook returned status ${response.status}`);
        return false;
      }
    } catch (error) {
      console.error(`Failed to send webhook to ${webhookUrl}:`, error);
      return false;
    }
  }

  /**
   * Deliver notification based on alert configuration
   */
  async deliverNotification(
    alertId: string,
    notification: AlertNotification
  ): Promise<void> {
    try {
      // Get alert configuration
      const { pool } = await import('../config/database.js');
      const client = await pool.connect();
      
      try {
        const result = await client.query(
          'SELECT user_id, notification_method, webhook_url, email FROM alerts WHERE id = $1',
          [alertId]
        );

        if (result.rows.length === 0) {
          console.warn(`Alert ${alertId} not found`);
          return;
        }

        const alert = result.rows[0];
        const userId = alert.user_id;
        const method = alert.notification_method;

        // Deliver based on notification method
        switch (method) {
          case 'ui':
            await this.sendNotificationToUser(userId, notification);
            break;

          case 'email':
            if (alert.email) {
              await this.sendEmailNotification(alert.email, notification);
            } else {
              console.warn(`No email configured for alert ${alertId}`);
            }
            break;

          case 'webhook':
            if (alert.webhook_url) {
              await this.sendWebhookNotification(alert.webhook_url, notification);
            } else {
              console.warn(`No webhook URL configured for alert ${alertId}`);
            }
            break;

          default:
            console.warn(`Unknown notification method: ${method}`);
        }
      } finally {
        client.release();
      }
    } catch (error) {
      console.error(`Failed to deliver notification for alert ${alertId}:`, error);
    }
  }

  /**
   * Get connected users count
   */
  getConnectedUsersCount(): number {
    return this.userSockets.size;
  }

  /**
   * Check if user is connected
   */
  isUserConnected(userId: string): boolean {
    return this.userSockets.has(userId) && this.userSockets.get(userId)!.size > 0;
  }

  /**
   * Get user's socket count
   */
  getUserSocketCount(userId: string): number {
    return this.userSockets.get(userId)?.size || 0;
  }

  /**
   * Broadcast price update to all connected clients
   */
  broadcastPriceUpdate(priceData: any): boolean {
    if (!this.io) {
      console.warn('WebSocket server not initialized');
      return false;
    }

    try {
      this.io.emit('price:update', {
        data: priceData,
        timestamp: Date.now(),
      });

      return true;
    } catch (error) {
      console.error('Failed to broadcast price update:', error);
      return false;
    }
  }

  /**
   * Broadcast new transaction to all connected clients
   */
  broadcastNewTransaction(transaction: any): boolean {
    if (!this.io) {
      console.warn('WebSocket server not initialized');
      return false;
    }

    try {
      this.io.emit('transaction:new', {
        data: transaction,
        timestamp: Date.now(),
      });

      return true;
    } catch (error) {
      console.error('Failed to broadcast new transaction:', error);
      return false;
    }
  }
}

export const notificationService = new NotificationService();
