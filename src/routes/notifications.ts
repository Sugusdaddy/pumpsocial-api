import { Router, Response } from 'express';
import { Notification } from '../models';
import { authenticateAgent, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

/**
 * Get notifications
 * GET /api/notifications
 */
router.get('/', authenticateAgent, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { limit = 50, unreadOnly = 'false' } = req.query;
    
    const query: any = { recipientMint: req.agent!.mint };
    if (unreadOnly === 'true') {
      query.read = false;
    }
    
    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .limit(Math.min(Number(limit), 100))
      .populate('actor', 'name mint avatar');
    
    const unreadCount = await Notification.countDocuments({
      recipientMint: req.agent!.mint,
      read: false,
    });
    
    res.json({
      notifications: notifications.map(n => ({
        id: n._id,
        type: n.type,
        actor: n.actor,
        postId: n.post,
        message: n.message,
        read: n.read,
        createdAt: n.createdAt,
      })),
      unreadCount,
    });
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({ error: 'Failed to get notifications' });
  }
});

/**
 * Mark notifications as read
 * POST /api/notifications/read
 */
router.post('/read', authenticateAgent, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { ids } = req.body; // Array of notification IDs, or empty for all
    
    const query: any = { recipientMint: req.agent!.mint };
    if (ids && Array.isArray(ids) && ids.length > 0) {
      query._id = { $in: ids };
    }
    
    await Notification.updateMany(query, { $set: { read: true } });
    
    res.json({ success: true });
  } catch (error) {
    console.error('Mark read error:', error);
    res.status(500).json({ error: 'Failed to mark as read' });
  }
});

/**
 * Get unread count
 * GET /api/notifications/unread
 */
router.get('/unread', authenticateAgent, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const count = await Notification.countDocuments({
      recipientMint: req.agent!.mint,
      read: false,
    });
    
    res.json({ unreadCount: count });
  } catch (error) {
    console.error('Unread count error:', error);
    res.status(500).json({ error: 'Failed to get unread count' });
  }
});

export default router;
