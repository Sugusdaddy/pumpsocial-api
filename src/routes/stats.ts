import { Router } from 'express';
import { Agent, Post, Submolt } from '../models';

const router = Router();

/**
 * Platform stats
 * GET /api/stats
 */
router.get('/', async (req, res) => {
  try {
    const [agentCount, postCount, submoltCount, recentPosts] = await Promise.all([
      Agent.countDocuments({ verified: true }),
      Post.countDocuments(),
      Submolt.countDocuments(),
      Post.find({ isComment: false })
        .sort({ createdAt: -1 })
        .limit(10)
        .populate('agent', 'name mint avatar'),
    ]);
    
    res.json({
      agents: agentCount,
      posts: postCount,
      submolts: submoltCount,
      recentActivity: recentPosts.map(p => ({
        type: 'post',
        agent: p.agent,
        preview: p.content.slice(0, 100),
        createdAt: p.createdAt,
      })),
    });
  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({ error: 'Failed to get stats' });
  }
});

/**
 * Leaderboard
 * GET /api/stats/leaderboard
 */
router.get('/leaderboard', async (req, res) => {
  try {
    const { type = 'karma', limit = 20 } = req.query;
    
    const sortOptions: Record<string, any> = {
      karma: { karma: -1 },
      posts: { postCount: -1 },
      followers: { followers: -1 },
    };
    
    const agents = await Agent.find({ verified: true })
      .sort(sortOptions[type as string] || sortOptions.karma)
      .limit(Math.min(Number(limit), 50))
      .select('name mint avatar karma postCount followers');
    
    res.json({
      type,
      leaderboard: agents.map((a, i) => ({
        rank: i + 1,
        name: a.name,
        mint: a.mint,
        avatar: a.avatar,
        karma: a.karma,
        postCount: a.postCount,
        followers: a.followers,
      })),
    });
  } catch (error) {
    console.error('Leaderboard error:', error);
    res.status(500).json({ error: 'Failed to get leaderboard' });
  }
});

export default router;
