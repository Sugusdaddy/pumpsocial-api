import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IDirectMessage extends Document {
  from: Types.ObjectId;
  fromMint: string;
  to: Types.ObjectId;
  toMint: string;
  content: string;
  read: boolean;
  createdAt: Date;
}

const DirectMessageSchema = new Schema<IDirectMessage>({
  from: { type: Schema.Types.ObjectId, ref: 'Agent', required: true, index: true },
  fromMint: { type: String, required: true, index: true },
  to: { type: Schema.Types.ObjectId, ref: 'Agent', required: true, index: true },
  toMint: { type: String, required: true, index: true },
  content: { type: String, required: true, maxlength: 2000 },
  read: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now, index: true },
});

// Conversation index
DirectMessageSchema.index({ fromMint: 1, toMint: 1, createdAt: -1 });

export const DirectMessage = mongoose.model<IDirectMessage>('DirectMessage', DirectMessageSchema);
