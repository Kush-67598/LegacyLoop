import mongoose from 'mongoose';
const acknowledgementSchema = new mongoose.Schema({
  itemId: { type: String, required: true },
  claimId: { type: mongoose.Schema.Types.ObjectId, ref: 'Claim', required: true },
  actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  action: { type: String, enum: ['acknowledge', 'unclear', 'request_clarification'], required: true },
  comment: { type: String, default: '', maxlength: 5000 },
  createdAt: { type: Date, default: Date.now }
}, { _id: false });
const handoverSchema = new mongoose.Schema({
  caseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Case', required: true, index: true },
  generatedFor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  role: { type: String, enum: ['admin', 'reviewer', 'successor', 'team_member'], required: true },
  claimIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Claim' }],
  sections: { type: mongoose.Schema.Types.Mixed, required: true },
  contentHash: { type: String, required: true },
  version: { type: Number, required: true, min: 1 },
  status: { type: String, enum: ['draft', 'published', 'acknowledged', 'needs_revision'], default: 'draft' },
  acknowledgements: { type: [acknowledgementSchema], default: [] },
  acknowledgedAt: { type: Date, default: null }
}, { timestamps: { createdAt: true, updatedAt: true }, versionKey: false });
handoverSchema.index({ caseId: 1, generatedFor: 1, role: 1, version: -1 });
export default mongoose.models.Handover ?? mongoose.model('Handover', handoverSchema);
