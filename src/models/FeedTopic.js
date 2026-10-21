import mongoose from 'mongoose';

const slideSchema = new mongoose.Schema(
  {
    title: String,
    content: { type: String, required: true },
    quote: String,
    readTime: String,
  },
  { _id: false },
);

const commentSchema = new mongoose.Schema(
  {
    id: Number,
    user: String,
    text: String,
    time: String,
  },
  { _id: false },
);

const feedTopicSchema = new mongoose.Schema(
  {
    category: { type: String, default: 'Insight' },
    categoryId: { type: String, default: 'any', index: true },
    cardTypeId: { type: String, default: 'educational' },
    bgGradient: String,
    accentColor: String,
    imageUrl: String,
    videoUrl: String,
    coverThumbUrl: String,
    coverMediaType: String,
    mediaProvider: String,
    imageCredit: String,
    imageCreditUrl: String,
    imageQuery: String,
    coverObjectFit: String,
    likes: { type: Number, default: 0 },
    slides: { type: [slideSchema], default: [] },
    comments: { type: [commentSchema], default: [] },
    authorUserId: { type: String, index: true },
    generationLanguage: String,
  },
  { timestamps: true },
);

feedTopicSchema.index({ createdAt: 1, _id: 1 });

export const FeedTopic = mongoose.model('FeedTopic', feedTopicSchema);
