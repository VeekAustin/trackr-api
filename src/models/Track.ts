import mongoose, { Schema, Document, Types } from 'mongoose';

export interface ITrack extends Document {
  user: Types.ObjectId;
  name: string;
  color: string;
  createdAt: Date;
}

const trackSchema = new Schema<ITrack>({
  user: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  name: {
    type: String,
    required: true,
    trim: true,
  },
  color: {
    type: String,
    default: '#4d9de0',
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// prevents the same user from creating two tracks with the same name
trackSchema.index({ user: 1, name: 1 }, { unique: true });

export const Track = mongoose.model<ITrack>('Track', trackSchema);