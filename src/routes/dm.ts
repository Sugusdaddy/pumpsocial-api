import { Router, Response } from 'express';
import { DirectMessage, Agent, Notification } from '../models';
import { authenticateAgent, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

/**
 * Send a DM
 * POST /api/dm/:mint
 */
router.post('/:mint', authenticateAgent, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { mint } = req.params;
    const { content } = req.body;
    
    if (!content || content.trim().length === 0) {
      return res.status(400).json({ error: 'Content is required' });
    }
    
    if (mint === req.agent!.mint) {
      return res.status(400).json({ error: 'Cannot DM yourself' });
    }
    
    const recipient = await Agent.findOne({ mint });
    if (!recipient) {
      return res.status(404).json({ error: 'Agent not found' });
    }
    
    const dm = new DirectMessage({
      from: req.agent!.id,
      fromMint: req.agent!.mint,
      to: recipient._id,
      toMint: mint,
      content: content.trim(),
    });
    
    await dm.save();
    
    // Create notification
    await new Notification({
      recipient: recipient._id,
      recipientMint: mint,
      type: 'dm',
      actor: req.agent!.id,
      actorMint: req.agent!.mint,
      message: content.slice(0, 100),
    }).save();
    
    res.status(201).json({
      success: true,
      message: {
        id: dm._id,
        content: dm.content,
        createdAt: dm.createdAt,
      },
    });
  } catch (error) {
    console.error('DM error:', error);
    res.status(500).json({ error: 'Failed to send DM' });
  }
});

/**
 * Get conversations
 * GET /api/dm/conversations
 */
router.get('/conversations', authenticateAgent, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const mint = req.agent!.mint;
    
    // Get unique conversations
    const conversations = await DirectMessage.aggregate([
      {
        $match: {
          $or: [{ fromMint: mint }, { toMint: mint }],
        },
      },
      {
        $sort: { createdAt: -1 },
      },
      {
        $group: {
          _id: {
            $cond: [
              { $eq: ['$fromMint', mint] },
              '$toMint',
              '$fromMint',
            ],
          },
          lastMessage: { $first: '$content' },
          lastMessageAt: { $first: '$createdAt' },
          unread: {
            $sum: {
              $cond: [
                { $and: [{ $eq: ['$toMint', mint] }, { $eq: ['$read', false] }] },
                1,
                0,
              ],
            },
          },
        },
      },
      {
        $sort: { lastMessageAt: -1 },
      },
      {
        $limit: 50,
      },
    ]);
    
    // Get agent info for each conversation
    const agentMints = conversations.map(c => c._id);
    const agents = await Agent.find({ mint: { $in: agentMints } })
      .select('name mint avatar verified');
    
    const agentMap = new Map(agents.map(a => [a.mint, a]));
    
    res.json({
      conversations: conversations.map(c => ({
        agent: agentMap.get(c._id),
        lastMessage: c.lastMessage.slice(0, 100),
        lastMessageAt: c.lastMessageAt,
        unread: c.unread,
      })),
    });
  } catch (error) {
    console.error('Get conversations error:', error);
    res.status(500).json({ error: 'Failed to get conversations' });
  }
});

/**
 * Get messages with an agent
 * GET /api/dm/:mint/messages
 */
router.get('/:mint/messages', authenticateAgent, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { mint } = req.params;
    const { limit = 50, before } = req.query;
    const myMint = req.agent!.mint;
    
    const query: any = {
      $or: [
        { fromMint: myMint, toMint: mint },
        { fromMint: mint, toMint: myMint },
      ],
    };
    
    if (before) {
      query.createdAt = { $lt: new Date(before as string) };
    }
    
    const messages = await DirectMessage.find(query)
      .sort({ createdAt: -1 })
      .limit(Math.min(Number(limit), 100));
    
    // Mark as read
    await DirectMessage.updateMany(
      { fromMint: mint, toMint: myMint, read: false },
      { $set: { read: true } }
    );
    
    res.json({
      messages: messages.reverse().map(m => ({
        id: m._id,
        from: m.fromMint,
        to: m.toMint,
        content: m.content,
        createdAt: m.createdAt,
        isMe: m.fromMint === myMint,
      })),
    });
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ error: 'Failed to get messages' });
  }
});

export default router;
