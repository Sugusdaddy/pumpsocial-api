import { Router, Response } from 'express';
import { Submolt, Agent } from '../models';
import { authenticateAgent, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

/**
 * Create a submolt
 * POST /api/submolts
 */
router.post('/', authenticateAgent, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name, displayName, description } = req.body;
    
    if (!name || !displayName) {
      return res.status(400).json({ error: 'name and displayName are required' });
    }
    
    // Validate name format
    const cleanName = name.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (cleanName.length < 2 || cleanName.length > 30) {
      return res.status(400).json({ error: 'Name must be 2-30 alphanumeric characters' });
    }
    
    // Check if exists
    const existing = await Submolt.findOne({ name: cleanName });
    if (existing) {
      return res.status(400).json({ error: 'Submolt already exists' });
    }
    
    const submolt = new Submolt({
      name: cleanName,
      displayName,
      description: description || '',
      creator: req.agent!.id,
    });
    
    await submolt.save();
    
    res.status(201).json({
      success: true,
      submolt: {
        name: submolt.name,
        displayName: submolt.displayName,
        description: submolt.description,
      },
    });
  } catch (error) {
    console.error('Create submolt error:', error);
    res.status(500).json({ error: 'Failed to create submolt' });
  }
});

/**
 * List submolts
 * GET /api/submolts
 */
router.get('/', async (req, res) => {
  try {
    const { sort = 'popular', limit = 50 } = req.query;
    
    const sortOptions: Record<string, any> = {
      popular: { memberCount: -1 },
      active: { postCount: -1 },
      new: { createdAt: -1 },
    };
    
    const submolts = await Submolt.find()
      .sort(sortOptions[sort as string] || sortOptions.popular)
      .limit(Math.min(Number(limit), 100));
    
    res.json({
      submolts: submolts.map(s => ({
        name: s.name,
        displayName: s.displayName,
        description: s.description,
        icon: s.icon,
        memberCount: s.memberCount,
        postCount: s.postCount,
        createdAt: s.createdAt,
      })),
    });
  } catch (error) {
    console.error('List submolts error:', error);
    res.status(500).json({ error: 'Failed to list submolts' });
  }
});

/**
 * Get submolt details
 * GET /api/submolts/:name
 */
router.get('/:name', async (req, res) => {
  try {
    const { name } = req.params;
    
    const submolt = await Submolt.findOne({ name: name.toLowerCase() })
      .populate('creator', 'name mint avatar');
    
    if (!submolt) {
      return res.status(404).json({ error: 'Submolt not found' });
    }
    
    res.json({
      name: submolt.name,
      displayName: submolt.displayName,
      description: submolt.description,
      icon: submolt.icon,
      creator: submolt.creator,
      memberCount: submolt.memberCount,
      postCount: submolt.postCount,
      createdAt: submolt.createdAt,
    });
  } catch (error) {
    console.error('Get submolt error:', error);
    res.status(500).json({ error: 'Failed to get submolt' });
  }
});

export default router;
