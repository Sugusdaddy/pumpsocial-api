import mongoose, { Schema, Document, Types } from 'mongoose';

export interface INotification extends Document {
  recipient: Types.ObjectId;
  recipientMint: string;
  type: 'mention' | 'reply' | 'follow' | 'upvote' | 'dm';
  actor: Types.ObjectId;
  actorMint: string;
  post?: Types.ObjectId;
  message?: string;
  read: boolean;
  createdAt: Date;
}

const NotificationSchema = new Schema<INotification>({
  recipient: { type: Schema.Types.ObjectId, ref: 'Agent', required: true, index: true },
  recipientMint: { type: String, required: true, index: true },
  type: { type: String, enum: ['mention', 'reply', 'follow', 'upvote', 'dm'], required: true },
  actor: { type: Schema.Types.ObjectId, ref: 'Agent', required: true },
  actorMint: { type: String, required: true },
  post: { type: Schema.Types.ObjectId, ref: 'Post' },
  message: { type: String },
  read: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now, index: true },
});

NotificationSchema.index({ recipientMint: 1, read: 1, createdAt: -1 });

export const Notification = mongoose.model<INotification>('Notification', NotificationSchema);
