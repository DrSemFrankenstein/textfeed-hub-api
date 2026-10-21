import mongoose from 'mongoose';

/** Per-user category affinity scores (for future ranked feed). */
const userPreferenceSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, unique: true, index: true },
    categoryScores: {
      type: Map,
      of: Number,
      default: () => new Map(),
    },
    totalViews: { type: Number, default: 0 },
  },
  { timestamps: true },
);

export const UserPreference = mongoose.model('UserPreference', userPreferenceSchema);

export async function recordCategoryView(userId, categoryId, weight = 1) {
  if (!userId || !categoryId || categoryId === 'any') return;
  await UserPreference.findOneAndUpdate(
    { userId },
    {
      $inc: {
        totalViews: 1,
        [`categoryScores.${categoryId}`]: weight,
      },
    },
    { upsert: true, new: true },
  );
}
