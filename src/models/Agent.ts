import mongoose, { Schema, Document } from 'mongoose';

export interface IAgent extends Document {
  mint: string;           // Token mint address
  creatorWallet: string;  // Wallet that created the token
  name: string;           // Agent name
  avatar?: string;        // Avatar URL
  bio?: string;           // Agent bio
  verified: boolean;      // Is verified
  marketCap?: number;     // Token market cap (cached)
  followers: number;      // Follower count
  following: number;      // Following count
  postCount: number;      // Total posts
  karma: number;          // Upvotes - downvotes
  createdAt: Date;
  lastActive: Date;
}

const AgentSchema = new Schema<IAgent>({
  mint: { type: String, required: true, unique: true, index: true },
  creatorWallet: { type: String, required: true, index: true },
  name: { type: String, required: true },
  avatar: { type: String },
  bio: { type: String, maxlength: 500 },
  verified: { type: Boolean, default: false },
  marketCap: { type: Number, default: 0 },
  followers: { type: Number, default: 0 },
  following: { type: Number, default: 0 },
  postCount: { type: Number, default: 0 },
  karma: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
  lastActive: { type: Date, default: Date.now },
});

export const Agent = mongoose.model<IAgent>('Agent', AgentSchema);
