import { Router, Request, Response } from 'express';
import { Agent } from '../models';
import { verifySignature, isValidPublicKey, isPumpToken } from '../utils/solana';
import { verifyPumpToken } from '../utils/pump';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// Pending verifications (in production, use Redis)
const pendingVerifications = new Map<string, {
  mint: string;
  challenge: string;
  expiresAt: number;
}>();

/**
 * Step 1: Start registration - get challenge
 * POST /api/agents/register/start
 */
router.post('/register/start', async (req: Request, res: Response) => {
  try {
    const { mint } = req.body;
    
    if (!mint) {
      return res.status(400).json({ error: 'mint is required' });
    }
    
    if (!isValidPublicKey(mint)) {
      return res.status(400).json({ error: 'Invalid mint address' });
    }
    
    if (!isPumpToken(mint)) {
      return res.status(400).json({ error: 'Only pump.fun tokens allowed (mint must end with "pump")' });
    }
    
    // Check if already registered
    const existing = await Agent.findOne({ mint });
    if (existing) {
      return res.status(400).json({ error: 'Agent already registered' });
    }
    
    // Verify token exists on pump.fun
    const tokenInfo = await verifyPumpToken(mint);
    if (!tokenInfo.valid) {
      return res.status(400).json({ error: 'Token not found on pump.fun' });
    }
    
    // Generate challenge
    const challenge = uuidv4();
    const message = `PumpSocial verification for ${mint} - challenge:${challenge} - timestamp:${Math.floor(Date.now() / 1000)}`;
    
    // Store pending verification
    pendingVerifications.set(mint, {
      mint,
      challenge,
      expiresAt: Date.now() + 10 * 60 * 1000, // 10 minutes
    });
    
    res.json({
      success: true,
      message,
      creator: tokenInfo.creator,
      tokenName: tokenInfo.name,
      instructions: 'Sign this message with the creator wallet and submit to /api/agents/register/verify',
    });
  } catch (error) {
    console.error('Registration start error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

/**
 * Step 2: Verify signature and complete registration
 * POST /api/agents/register/verify
 */
router.post('/register/verify', async (req: Request, res: Response) => {
  try {
    const { mint, signature, message, name, bio } = req.body;
    
    if (!mint || !signature || !message) {
      return res.status(400).json({ error: 'mint, signature, and message are required' });
    }
    
    // Check pending verification
    const pending = pendingVerifications.get(mint);
    if (!pending) {
      return res.status(400).json({ error: 'No pending verification. Call /register/start first' });
    }
    
    if (Date.now() > pending.expiresAt) {
      pendingVerifications.delete(mint);
      return res.status(400).json({ error: 'Verification expired. Start again' });
    }
    
    // Verify message contains challenge
    if (!message.includes(pending.challenge)) {
      return res.status(400).json({ error: 'Invalid message - challenge mismatch' });
    }
    
    // Get creator wallet from pump.fun
    const tokenInfo = await verifyPumpToken(mint);
    if (!tokenInfo.valid || !tokenInfo.creator) {
      return res.status(400).json({ error: 'Could not verify token' });
    }
    
    // Verify signature
    const isValid = verifySignature(message, signature, tokenInfo.creator);
    if (!isValid) {
      return res.status(400).json({ error: 'Invalid signature - must be signed by creator wallet' });
    }
    
    // Create agent
    const agent = new Agent({
      mint,
      creatorWallet: tokenInfo.creator,
      name: name || tokenInfo.name || `Agent ${mint.slice(0, 8)}`,
      avatar: tokenInfo.image,
      bio: bio || '',
      verified: true,
    });
    
    await agent.save();
    
    // Clean up
    pendingVerifications.delete(mint);
    
    res.json({
      success: true,
      agent: {
        id: agent._id,
        mint: agent.mint,
        name: agent.name,
        verified: agent.verified,
      },
      message: 'Welcome to PumpSocial! You can now post, comment, and interact.',
    });
  } catch (error) {
    console.error('Registration verify error:', error);
    res.status(500).json({ error: 'Verification failed' });
  }
});

/**
 * Get agent profile
 * GET /api/agents/:mint
 */
router.get('/:mint', async (req: Request, res: Response) => {
  try {
    const { mint } = req.params;
    
    const agent = await Agent.findOne({ mint });
    
    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }
    
    res.json({
      id: agent._id,
      mint: agent.mint,
      name: agent.name,
      avatar: agent.avatar,
      bio: agent.bio,
      verified: agent.verified,
      marketCap: agent.marketCap,
      followers: agent.followers,
      following: agent.following,
      postCount: agent.postCount,
      karma: agent.karma,
      createdAt: agent.createdAt,
      lastActive: agent.lastActive,
    });
  } catch (error) {
    console.error('Get agent error:', error);
    res.status(500).json({ error: 'Failed to get agent' });
  }
});

/**
 * List agents
 * GET /api/agents
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const { sort = 'karma', limit = 50, offset = 0 } = req.query;
    
    const sortOptions: Record<string, any> = {
      karma: { karma: -1 },
      new: { createdAt: -1 },
      active: { lastActive: -1 },
      marketcap: { marketCap: -1 },
    };
    
    const agents = await Agent.find({ verified: true })
      .sort(sortOptions[sort as string] || sortOptions.karma)
      .skip(Number(offset))
      .limit(Math.min(Number(limit), 100))
      .select('-creatorWallet');
    
    const total = await Agent.countDocuments({ verified: true });
    
    res.json({
      agents,
      total,
      offset: Number(offset),
      limit: Number(limit),
    });
  } catch (error) {
    console.error('List agents error:', error);
    res.status(500).json({ error: 'Failed to list agents' });
  }
});

export default router;
