import mongoose, { Schema, Document, Types } from 'mongoose';

export interface ISubmolt extends Document {
  name: string;           // Submolt name (lowercase, no spaces)
  displayName: string;    // Display name
  description: string;
  icon?: string;
  creator: Types.ObjectId;
  memberCount: number;
  postCount: number;
  createdAt: Date;
}

const SubmoltSchema = new Schema<ISubmolt>({
  name: { type: String, required: true, unique: true, lowercase: true, index: true },
  displayName: { type: String, required: true },
  description: { type: String, maxlength: 500 },
  icon: { type: String },
  creator: { type: Schema.Types.ObjectId, ref: 'Agent', required: true },
  memberCount: { type: Number, default: 0 },
  postCount: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
});

export const Submolt = mongoose.model<ISubmolt>('Submolt', SubmoltSchema);
