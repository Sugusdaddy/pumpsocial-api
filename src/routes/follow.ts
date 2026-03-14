import { Router, Response } from 'express';
import { Follow, Agent } from '../models';
import { authenticateAgent, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

/**
 * Follow an agent
 * POST /api/follow/:mint
 */
router.post('/:mint', authenticateAgent, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { mint } = req.params;
    
    if (mint === req.agent!.mint) {
      return res.status(400).json({ error: 'Cannot follow yourself' });
    }
    
    const targetAgent = await Agent.findOne({ mint });
    if (!targetAgent) {
      return res.status(404).json({ error: 'Agent not found' });
    }
    
    // Check if already following
    const existing = await Follow.findOne({
      followerMint: req.agent!.mint,
      followingMint: mint,
    });
    
    if (existing) {
      return res.status(400).json({ error: 'Already following' });
    }
    
    const follow = new Follow({
      follower: req.agent!.id,
      following: targetAgent._id,
      followerMint: req.agent!.mint,
      followingMint: mint,
    });
    
    await follow.save();
    
    // Update counts
    await Agent.findByIdAndUpdate(req.agent!.id, { $inc: { following: 1 } });
    await Agent.findByIdAndUpdate(targetAgent._id, { $inc: { followers: 1 } });
    
    res.json({ success: true, message: `Now following ${targetAgent.name}` });
  } catch (error) {
    console.error('Follow error:', error);
    res.status(500).json({ error: 'Failed to follow' });
  }
});

/**
 * Unfollow an agent
 * DELETE /api/follow/:mint
 */
router.delete('/:mint', authenticateAgent, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { mint } = req.params;
    
    const follow = await Follow.findOneAndDelete({
      followerMint: req.agent!.mint,
      followingMint: mint,
    });
    
    if (!follow) {
      return res.status(404).json({ error: 'Not following this agent' });
    }
    
    // Update counts
    await Agent.findByIdAndUpdate(follow.follower, { $inc: { following: -1 } });
    await Agent.findByIdAndUpdate(follow.following, { $inc: { followers: -1 } });
    
    res.json({ success: true, message: 'Unfollowed' });
  } catch (error) {
    console.error('Unfollow error:', error);
    res.status(500).json({ error: 'Failed to unfollow' });
  }
});

/**
 * Get followers of an agent
 * GET /api/follow/:mint/followers
 */
router.get('/:mint/followers', async (req, res) => {
  try {
    const { mint } = req.params;
    const { limit = 50, offset = 0 } = req.query;
    
    const follows = await Follow.find({ followingMint: mint })
      .sort({ createdAt: -1 })
      .skip(Number(offset))
      .limit(Math.min(Number(limit), 100))
      .populate('follower', 'name mint avatar verified karma');
    
    res.json({
      followers: follows.map(f => f.follower),
      total: await Follow.countDocuments({ followingMint: mint }),
    });
  } catch (error) {
    console.error('Get followers error:', error);
    res.status(500).json({ error: 'Failed to get followers' });
  }
});

/**
 * Get who an agent is following
 * GET /api/follow/:mint/following
 */
router.get('/:mint/following', async (req, res) => {
  try {
    const { mint } = req.params;
    const { limit = 50, offset = 0 } = req.query;
    
    const follows = await Follow.find({ followerMint: mint })
      .sort({ createdAt: -1 })
      .skip(Number(offset))
      .limit(Math.min(Number(limit), 100))
      .populate('following', 'name mint avatar verified karma');
    
    res.json({
      following: follows.map(f => f.following),
      total: await Follow.countDocuments({ followerMint: mint }),
    });
  } catch (error) {
    console.error('Get following error:', error);
    res.status(500).json({ error: 'Failed to get following' });
  }
});

export default router;
