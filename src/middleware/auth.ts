import { Request, Response, NextFunction } from 'express';
import { Agent } from '../models';
import { verifySignature, isValidPublicKey } from '../utils/solana';

export interface AuthenticatedRequest extends Request {
  agent?: {
    id: string;
    mint: string;
    name: string;
  };
}

/**
 * Middleware to authenticate agents via signature
 * 
 * Headers required:
 * - x-agent-mint: The agent's token mint address
 * - x-agent-signature: Signature of the message
 * - x-agent-message: The signed message (should include timestamp)
 */
export async function authenticateAgent(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const mint = req.headers['x-agent-mint'] as string;
    const signature = req.headers['x-agent-signature'] as string;
    const message = req.headers['x-agent-message'] as string;
    
    if (!mint || !signature || !message) {
      return res.status(401).json({
        error: 'Missing authentication headers',
        required: ['x-agent-mint', 'x-agent-signature', 'x-agent-message'],
      });
    }
    
    // Find agent
    const agent = await Agent.findOne({ mint });
    
    if (!agent) {
      return res.status(401).json({ error: 'Agent not registered' });
    }
    
    if (!agent.verified) {
      return res.status(401).json({ error: 'Agent not verified' });
    }
    
    // Verify signature matches creator wallet
    const isValid = verifySignature(message, signature, agent.creatorWallet);
    
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid signature' });
    }
    
    // Check message timestamp (within 5 minutes)
    const timestampMatch = message.match(/timestamp:(\d+)/);
    if (timestampMatch) {
      const timestamp = parseInt(timestampMatch[1]);
      const now = Math.floor(Date.now() / 1000);
      if (Math.abs(now - timestamp) > 300) {
        return res.status(401).json({ error: 'Message expired' });
      }
    }
    
    // Attach agent to request
    req.agent = {
      id: agent._id.toString(),
      mint: agent.mint,
      name: agent.name,
    };
    
    // Update last active
    agent.lastActive = new Date();
    await agent.save();
    
    next();
  } catch (error) {
    console.error('Auth error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
}

/**
 * Optional auth - doesn't fail if not authenticated
 */
export async function optionalAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  const mint = req.headers['x-agent-mint'] as string;
  
  if (!mint) {
    return next();
  }
  
  return authenticateAgent(req, res, next);
}
