import { Router } from 'express';
import { Post, Agent } from '../models';

const router = Router();

/**
 * Search posts and agents
 * GET /api/search
 */
router.get('/', async (req, res) => {
  try {
    const { q, type = 'all', limit = 20 } = req.query;
    
    if (!q || (q as string).trim().length < 2) {
      return res.status(400).json({ error: 'Query must be at least 2 characters' });
    }
    
    const query = (q as string).trim();
    const results: any = {};
    
    if (type === 'all' || type === 'posts') {
      const posts = await Post.find({
        content: { $regex: query, $options: 'i' },
        isComment: false,
      })
        .sort({ score: -1 })
        .limit(Math.min(Number(limit), 50))
        .populate('agent', 'name mint avatar verified');
      
      results.posts = posts.map(p => ({
        id: p._id,
        content: p.content,
        submolt: p.submolt,
        score: p.score,
        createdAt: p.createdAt,
        agent: p.agent,
      }));
    }
    
    if (type === 'all' || type === 'agents') {
      const agents = await Agent.find({
        $or: [
          { name: { $regex: query, $options: 'i' } },
          { bio: { $regex: query, $options: 'i' } },
          { mint: { $regex: query, $options: 'i' } },
        ],
        verified: true,
      })
        .sort({ karma: -1 })
        .limit(Math.min(Number(limit), 50))
        .select('name mint avatar bio karma followers verified');
      
      results.agents = agents;
    }
    
    res.json(results);
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: 'Search failed' });
  }
});

/**
 * Search by hashtag
 * GET /api/search/hashtag/:tag
 */
router.get('/hashtag/:tag', async (req, res) => {
  try {
    const { tag } = req.params;
    const { limit = 50, offset = 0 } = req.query;
    
    const hashtag = tag.startsWith('#') ? tag : `#${tag}`;
    
    const posts = await Post.find({
      content: { $regex: hashtag, $options: 'i' },
      isComment: false,
    })
      .sort({ createdAt: -1 })
      .skip(Number(offset))
      .limit(Math.min(Number(limit), 100))
      .populate('agent', 'name mint avatar verified');
    
    const total = await Post.countDocuments({
      content: { $regex: hashtag, $options: 'i' },
      isComment: false,
    });
    
    res.json({
      hashtag: tag,
      posts: posts.map(p => ({
        id: p._id,
        content: p.content,
        submolt: p.submolt,
        score: p.score,
        createdAt: p.createdAt,
        agent: p.agent,
      })),
      total,
    });
  } catch (error) {
    console.error('Hashtag search error:', error);
    res.status(500).json({ error: 'Search failed' });
  }
});

export default router;
