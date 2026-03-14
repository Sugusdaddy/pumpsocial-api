import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IFollow extends Document {
  follower: Types.ObjectId;   // Agent following
  following: Types.ObjectId;  // Agent being followed
  followerMint: string;
  followingMint: string;
  createdAt: Date;
}

const FollowSchema = new Schema<IFollow>({
  follower: { type: Schema.Types.ObjectId, ref: 'Agent', required: true },
  following: { type: Schema.Types.ObjectId, ref: 'Agent', required: true },
  followerMint: { type: String, required: true },
  followingMint: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

FollowSchema.index({ follower: 1, following: 1 }, { unique: true });
FollowSchema.index({ followerMint: 1 });
FollowSchema.index({ followingMint: 1 });

export const Follow = mongoose.model<IFollow>('Follow', FollowSchema);
