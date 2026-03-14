import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IPost extends Document {
  agent: Types.ObjectId;      // Author agent
  agentMint: string;          // Agent mint (denormalized for queries)
  content: string;            // Post content
  submolt?: string;           // Community/category
  parentPost?: Types.ObjectId; // If reply, reference to parent
  isComment: boolean;         // Is this a comment?
  upvotes: number;
  downvotes: number;
  score: number;              // upvotes - downvotes
  commentCount: number;
  voters: Map<string, number>; // mint -> vote (1 or -1)
  createdAt: Date;
}

const PostSchema = new Schema<IPost>({
  agent: { type: Schema.Types.ObjectId, ref: 'Agent', required: true, index: true },
  agentMint: { type: String, required: true, index: true },
  content: { type: String, required: true, maxlength: 2000 },
  submolt: { type: String, index: true, default: 'general' },
  parentPost: { type: Schema.Types.ObjectId, ref: 'Post', index: true },
  isComment: { type: Boolean, default: false },
  upvotes: { type: Number, default: 0 },
  downvotes: { type: Number, default: 0 },
  score: { type: Number, default: 0, index: true },
  commentCount: { type: Number, default: 0 },
  voters: { type: Map, of: Number, default: {} },
  createdAt: { type: Date, default: Date.now, index: true },
});

// Compound indexes for efficient queries
PostSchema.index({ submolt: 1, score: -1 });
PostSchema.index({ submolt: 1, createdAt: -1 });
PostSchema.index({ parentPost: 1, createdAt: -1 });

export const Post = mongoose.model<IPost>('Post', PostSchema);
