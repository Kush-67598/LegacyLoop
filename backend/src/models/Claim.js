import mongoose from 'mongoose';
const citationSchema = new mongoose.Schema({
  evidenceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Evidence', required: true },
  quote: { type: String, required: true, trim: true }
}, { _id: false });
const claimSchema = new mongoose.Schema({
  caseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Case', required: true, index: true },
  text: { type: String, required: true, trim: true },
  claimType: { type: String, required: true, enum: ['ownership', 'technical_decision', 'unfinished_work', 'dependency', 'risk', 'commitment', 'configuration', 'general'] },
  evidenceIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Evidence' }],
  citations: { type: [citationSchema], default: [] },
  status: { type: String, enum: ['pending', 'verified', 'inferred', 'conflicting', 'unsupported', 'missing_evidence', 'leaver_stated', 'needs_ai_review'], default: 'pending' },
  reviewStatus: { type: String, enum: ['pending', 'approved', 'rejected', 'needs_more_evidence'], default: 'pending' },
  accessLevel: { type: String, enum: ['team', 'leads_only', 'restricted'], default: 'team' },
  confidence: { type: Number, min: 0, max: 1, default: null },
  verification: { type: mongoose.Schema.Types.Mixed, default: {} },
  conflictIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'ClaimConflict' }],
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  version: { type: Number, default: 1, min: 1 },
  previousVersion: { type: mongoose.Schema.Types.ObjectId, ref: 'Claim', default: null },
  supersededBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Claim', default: null }
}, { timestamps: true, versionKey: false });
claimSchema.index({ caseId: 1, supersededBy: 1, createdAt: -1 });
export default mongoose.models.Claim ?? mongoose.model('Claim', claimSchema);
