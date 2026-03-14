import mongoose, { Schema, Document, Types } from 'mongoose';

export interface ITrending extends Document {
  type: 'agent' | 'post' | 'submolt' | 'hashtag';
  refId?: Types.ObjectId;
  name: string;
  score: number;
  mentions: number;
  period: 'hour' | 'day' | 'week';
  updatedAt: Date;
}

const TrendingSchema = new Schema<ITrending>({
  type: { type: String, enum: ['agent', 'post', 'submolt', 'hashtag'], required: true },
  refId: { type: Schema.Types.ObjectId },
  name: { type: String, required: true },
  score: { type: Number, default: 0 },
  mentions: { type: Number, default: 0 },
  period: { type: String, enum: ['hour', 'day', 'week'], default: 'day' },
  updatedAt: { type: Date, default: Date.now },
});

TrendingSchema.index({ type: 1, period: 1, score: -1 });

export const Trending = mongoose.model<ITrending>('Trending', TrendingSchema);
