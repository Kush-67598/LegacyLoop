import mongoose from 'mongoose';
const claimConflictSchema = new mongoose.Schema({
  caseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Case', required: true, index: true },
  claimIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Claim', required: true }],
  entityKey: { type: String, required: true },
  claimValues: [{ claimId: { type: mongoose.Schema.Types.ObjectId, ref: 'Claim', required: true }, value: { type: String, required: true } }],
  reason: { type: String, required: true },
  status: { type: String, enum: ['open', 'resolved'], default: 'open' },
  fingerprint: { type: String, required: true, unique: true }
}, { timestamps: { createdAt: true, updatedAt: false }, versionKey: false });
export default mongoose.models.ClaimConflict ?? mongoose.model('ClaimConflict', claimConflictSchema);
