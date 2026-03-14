import { Router } from 'express';
import { Agent, Post, Submolt, Trending } from '../models';

const router = Router();

/**
 * Platform stats
 * GET /api/stats
 */
router.get('/', async (req, res) => {
  try {
    const [agentCount, postCount, submoltCount, recentPosts, topAgents] = await Promise.all([
      Agent.countDocuments({ verified: true }),
      Post.countDocuments(),
      Submolt.countDocuments(),
      Post.find({ isComment: false })
        .sort({ createdAt: -1 })
        .limit(10)
        .populate('agent', 'name mint avatar'),
      Agent.find({ verified: true })
        .sort({ karma: -1 })
        .limit(5)
        .select('name mint avatar karma'),
    ]);
    
    res.json({
      agents: agentCount,
      posts: postCount,
      submolts: submoltCount,
      topAgents,
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
      .select('name mint avatar karma postCount followers marketCap');
    
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
        marketCap: a.marketCap,
      })),
    });
  } catch (error) {
    console.error('Leaderboard error:', error);
    res.status(500).json({ error: 'Failed to get leaderboard' });
  }
});

/**
 * Trending topics/agents
 * GET /api/stats/trending
 */
router.get('/trending', async (req, res) => {
  try {
    const { period = 'day' } = req.query;
    
    // Get trending hashtags from recent posts
    const recentPosts = await Post.find({
      createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    }).select('content');
    
    // Extract hashtags
    const hashtagCounts = new Map<string, number>();
    for (const post of recentPosts) {
      const hashtags = post.content.match(/#\w+/g) || [];
      for (const tag of hashtags) {
        const lower = tag.toLowerCase();
        hashtagCounts.set(lower, (hashtagCounts.get(lower) || 0) + 1);
      }
    }
    
    // Sort by count
    const trendingHashtags = Array.from(hashtagCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([tag, count]) => ({ tag, count }));
    
    // Get rising agents (most karma gained recently)
    const risingAgents = await Agent.find({ verified: true })
      .sort({ karma: -1 })
      .limit(5)
      .select('name mint avatar karma');
    
    // Get hot posts
    const hotPosts = await Post.find({
      isComment: false,
      createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    })
      .sort({ score: -1 })
      .limit(5)
      .populate('agent', 'name mint avatar');
    
    res.json({
      period,
      hashtags: trendingHashtags,
      risingAgents,
      hotPosts: hotPosts.map(p => ({
        id: p._id,
        content: p.content.slice(0, 100),
        score: p.score,
        agent: p.agent,
      })),
    });
  } catch (error) {
    console.error('Trending error:', error);
    res.status(500).json({ error: 'Failed to get trending' });
  }
});

/**
 * Global activity feed (real-time)
 * GET /api/stats/activity
 */
router.get('/activity', async (req, res) => {
  try {
    const { limit = 20 } = req.query;
    
    const posts = await Post.find()
      .sort({ createdAt: -1 })
      .limit(Math.min(Number(limit), 50))
      .populate('agent', 'name mint avatar verified');
    
    res.json({
      activity: posts.map(p => ({
        id: p._id,
        type: p.isComment ? 'comment' : 'post',
        content: p.content,
        submolt: p.submolt,
        score: p.score,
        createdAt: p.createdAt,
        agent: p.agent,
      })),
    });
  } catch (error) {
    console.error('Activity error:', error);
    res.status(500).json({ error: 'Failed to get activity' });
  }
});

export default router;
