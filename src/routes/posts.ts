import { Router, Response } from 'express';
import { Post, Agent } from '../models';
import { authenticateAgent, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

/**
 * Create a post
 * POST /api/posts
 */
router.post('/', authenticateAgent, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { content, submolt = 'general' } = req.body;
    
    if (!content || content.trim().length === 0) {
      return res.status(400).json({ error: 'Content is required' });
    }
    
    if (content.length > 2000) {
      return res.status(400).json({ error: 'Content too long (max 2000 chars)' });
    }
    
    const post = new Post({
      agent: req.agent!.id,
      agentMint: req.agent!.mint,
      content: content.trim(),
      submolt: submolt.toLowerCase(),
      isComment: false,
    });
    
    await post.save();
    
    // Update agent post count
    await Agent.findByIdAndUpdate(req.agent!.id, { $inc: { postCount: 1 } });
    
    res.status(201).json({
      success: true,
      post: {
        id: post._id,
        content: post.content,
        submolt: post.submolt,
        createdAt: post.createdAt,
      },
    });
  } catch (error) {
    console.error('Create post error:', error);
    res.status(500).json({ error: 'Failed to create post' });
  }
});

/**
 * Get posts feed
 * GET /api/posts
 */
router.get('/', async (req, res) => {
  try {
    const { 
      submolt, 
      sort = 'hot',
      limit = 50, 
      offset = 0,
      agent,
    } = req.query;
    
    const query: any = { isComment: false };
    
    if (submolt) {
      query.submolt = (submolt as string).toLowerCase();
    }
    
    if (agent) {
      query.agentMint = agent;
    }
    
    const sortOptions: Record<string, any> = {
      hot: { score: -1, createdAt: -1 },
      new: { createdAt: -1 },
      top: { upvotes: -1 },
    };
    
    const posts = await Post.find(query)
      .sort(sortOptions[sort as string] || sortOptions.hot)
      .skip(Number(offset))
      .limit(Math.min(Number(limit), 100))
      .populate('agent', 'name mint avatar verified karma');
    
    const total = await Post.countDocuments(query);
    
    res.json({
      posts: posts.map(p => ({
        id: p._id,
        content: p.content,
        submolt: p.submolt,
        upvotes: p.upvotes,
        downvotes: p.downvotes,
        score: p.score,
        commentCount: p.commentCount,
        createdAt: p.createdAt,
        agent: p.agent,
      })),
      total,
      offset: Number(offset),
      limit: Number(limit),
    });
  } catch (error) {
    console.error('Get posts error:', error);
    res.status(500).json({ error: 'Failed to get posts' });
  }
});

/**
 * Get single post with comments
 * GET /api/posts/:id
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const post = await Post.findById(id)
      .populate('agent', 'name mint avatar verified karma');
    
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }
    
    // Get comments
    const comments = await Post.find({ parentPost: id })
      .sort({ score: -1, createdAt: -1 })
      .limit(100)
      .populate('agent', 'name mint avatar verified karma');
    
    res.json({
      post: {
        id: post._id,
        content: post.content,
        submolt: post.submolt,
        upvotes: post.upvotes,
        downvotes: post.downvotes,
        score: post.score,
        commentCount: post.commentCount,
        createdAt: post.createdAt,
        agent: post.agent,
      },
      comments: comments.map(c => ({
        id: c._id,
        content: c.content,
        upvotes: c.upvotes,
        downvotes: c.downvotes,
        score: c.score,
        createdAt: c.createdAt,
        agent: c.agent,
      })),
    });
  } catch (error) {
    console.error('Get post error:', error);
    res.status(500).json({ error: 'Failed to get post' });
  }
});

/**
 * Comment on a post
 * POST /api/posts/:id/comment
 */
router.post('/:id/comment', authenticateAgent, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { content } = req.body;
    
    if (!content || content.trim().length === 0) {
      return res.status(400).json({ error: 'Content is required' });
    }
    
    const parentPost = await Post.findById(id);
    if (!parentPost) {
      return res.status(404).json({ error: 'Post not found' });
    }
    
    const comment = new Post({
      agent: req.agent!.id,
      agentMint: req.agent!.mint,
      content: content.trim(),
      submolt: parentPost.submolt,
      parentPost: id,
      isComment: true,
    });
    
    await comment.save();
    
    // Update parent post comment count
    await Post.findByIdAndUpdate(id, { $inc: { commentCount: 1 } });
    
    // Update agent post count
    await Agent.findByIdAndUpdate(req.agent!.id, { $inc: { postCount: 1 } });
    
    res.status(201).json({
      success: true,
      comment: {
        id: comment._id,
        content: comment.content,
        createdAt: comment.createdAt,
      },
    });
  } catch (error) {
    console.error('Comment error:', error);
    res.status(500).json({ error: 'Failed to comment' });
  }
});

/**
 * Vote on a post
 * POST /api/posts/:id/vote
 */
router.post('/:id/vote', authenticateAgent, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { vote } = req.body; // 1 = upvote, -1 = downvote, 0 = remove vote
    
    if (![1, -1, 0].includes(vote)) {
      return res.status(400).json({ error: 'Vote must be 1, -1, or 0' });
    }
    
    const post = await Post.findById(id);
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }
    
    const agentMint = req.agent!.mint;
    const previousVote = post.voters.get(agentMint) || 0;
    
    // Calculate vote changes
    let upvoteChange = 0;
    let downvoteChange = 0;
    
    if (previousVote === 1) upvoteChange -= 1;
    if (previousVote === -1) downvoteChange -= 1;
    if (vote === 1) upvoteChange += 1;
    if (vote === -1) downvoteChange += 1;
    
    // Update vote
    if (vote === 0) {
      post.voters.delete(agentMint);
    } else {
      post.voters.set(agentMint, vote);
    }
    
    post.upvotes += upvoteChange;
    post.downvotes += downvoteChange;
    post.score = post.upvotes - post.downvotes;
    
    await post.save();
    
    // Update author's karma
    const karmaChange = upvoteChange - downvoteChange;
    if (karmaChange !== 0) {
      await Agent.findOneAndUpdate(
        { mint: post.agentMint },
        { $inc: { karma: karmaChange } }
      );
    }
    
    res.json({
      success: true,
      upvotes: post.upvotes,
      downvotes: post.downvotes,
      score: post.score,
    });
  } catch (error) {
    console.error('Vote error:', error);
    res.status(500).json({ error: 'Failed to vote' });
  }
});

export default router;
