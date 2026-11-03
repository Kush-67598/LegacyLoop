import mongoose from 'mongoose';
const evidenceSchema = new mongoose.Schema({
  caseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Case', required: true, index: true },
  sourceType: { type: String, required: true, enum: ['git_commit', 'pull_request', 'chat_message', 'task', 'markdown_document', 'csv_record', 'manual_entry'] },
  sourceName: { type: String, required: true, trim: true }, locator: { type: String, required: true, trim: true },
  text: { type: String, required: true }, originalData: { type: mongoose.Schema.Types.Mixed, select: false }, originalAccessLevel: { type: String, enum: ['restricted'], default: 'restricted', select: false }, redactionApplied: { type: Boolean, default: false }, redactionKinds: [{ type: String }], author: { type: String, default: null, trim: true },
  timestamp: { type: Date, default: null }, accessLevel: { type: String, enum: ['team', 'leads_only', 'restricted'], default: 'team' },
  hash: { type: String, required: true }, metadata: { type: mongoose.Schema.Types.Mixed, default: {} }
}, { timestamps: { createdAt: true, updatedAt: false }, versionKey: false });
evidenceSchema.index({ caseId: 1, hash: 1 }, { unique: true });
evidenceSchema.index({ sourceType: 1 }); evidenceSchema.index({ author: 1 }); evidenceSchema.index({ timestamp: 1 }); evidenceSchema.index({ hash: 1 });
const immutable = function () { throw new Error('Evidence is immutable; create a correction or replacement record instead'); };
evidenceSchema.pre('findOneAndUpdate', immutable); evidenceSchema.pre('updateOne', immutable); evidenceSchema.pre('updateMany', immutable);
evidenceSchema.pre('replaceOne', immutable); evidenceSchema.pre('findOneAndReplace', immutable);
evidenceSchema.pre('save', function () { if (!this.isNew) immutable(); });
export default mongoose.models.Evidence ?? mongoose.model('Evidence', evidenceSchema);
