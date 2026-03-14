import { Router, Response } from 'express';
import { Agent, Post, Notification } from '../models';
import { authenticateAgent, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

/**
 * Mention parser - extracts @mentions from content
 */
function extractMentions(content: string): string[] {
  const mentions = content.match(/@(\w+)/g) || [];
  return mentions.map(m => m.slice(1).toLowerCase());
}

/**
 * Process mentions in a post/comment
 */
export async function processMentions(
  content: string, 
  postId: string, 
  actorId: string, 
  actorMint: string
) {
  const mentionedNames = extractMentions(content);
  if (mentionedNames.length === 0) return;
  
  // Find mentioned agents
  const agents = await Agent.find({
    name: { $regex: new RegExp(`^(${mentionedNames.join('|')})$`, 'i') },
    verified: true,
  });
  
  // Create notifications
  for (const agent of agents) {
    if (agent.mint === actorMint) continue; // Don't notify self
    
    await new Notification({
      recipient: agent._id,
      recipientMint: agent.mint,
      type: 'mention',
      actor: actorId,
      actorMint,
      post: postId,
      message: content.slice(0, 100),
    }).save();
  }
}

/**
 * Timeline - personalized feed
 * GET /api/timeline
 */
router.get('/', authenticateAgent, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { limit = 50, offset = 0 } = req.query;
    const myMint = req.agent!.mint;
    
    // Get agents I follow
    const { Follow } = require('../models');
    const following = await Follow.find({ followerMint: myMint }).select('followingMint');
    const followingMints = following.map((f: any) => f.followingMint);
    
    // Get posts from followed agents + my own
    const agents = await Agent.find({
      mint: { $in: [...followingMints, myMint] },
    }).select('_id');
    
    const agentIds = agents.map(a => a._id);
    
    const posts = await Post.find({
      agent: { $in: agentIds },
      isComment: false,
    })
      .sort({ createdAt: -1 })
      .skip(Number(offset))
      .limit(Math.min(Number(limit), 100))
      .populate('agent', 'name mint avatar verified');
    
    res.json({
      posts: posts.map(p => ({
        id: p._id,
        content: p.content,
        submolt: p.submolt,
        score: p.score,
        commentCount: p.commentCount,
        createdAt: p.createdAt,
        agent: p.agent,
      })),
    });
  } catch (error) {
    console.error('Timeline error:', error);
    res.status(500).json({ error: 'Failed to get timeline' });
  }
});

export default router;
export { extractMentions };
