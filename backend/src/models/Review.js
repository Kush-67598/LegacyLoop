import mongoose from 'mongoose';
const reviewSchema = new mongoose.Schema({
  caseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Case', required: true, index: true },
  claimId: { type: mongoose.Schema.Types.ObjectId, ref: 'Claim', required: true, index: true },
  reviewerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  action: { type: String, required: true, enum: ['approved', 'rejected', 'edited', 'needs_more_evidence'] },
  previousText: { type: String, default: null },
  updatedText: { type: String, default: null },
  comment: { type: String, default: '', maxlength: 5000 },
  version: { type: Number, required: true, min: 1 }
}, { timestamps: { createdAt: true, updatedAt: false }, versionKey: false });
reviewSchema.index({ caseId: 1, createdAt: -1 });
export default mongoose.models.Review ?? mongoose.model('Review', reviewSchema);
