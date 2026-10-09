import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IEntry extends Document {
  user: Types.ObjectId;
  track: Types.ObjectId;
  title: string;
  notes?: string;
  date: string;
  createdAt: Date;
}

const entrySchema = new Schema<IEntry>({
  user: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  track: {
    type: Schema.Types.ObjectId,
    ref: 'Track',
    required: true,
  },
  title: {
    type: String,
    required: true,
    trim: true,
  },
  notes: {
    type: String,
    trim: true,
    default: '',
  },
  date: {
    type: String,
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});
entrySchema.index({ user: 1, createdAt: -1, _id: -1 });
export const Entry = mongoose.model<IEntry>('Entry', entrySchema);