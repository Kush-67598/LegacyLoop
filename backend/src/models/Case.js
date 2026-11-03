import mongoose from 'mongoose';
const caseSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, maxlength: 200 },
  description: { type: String, default: '', trim: true, maxlength: 5000 },
  projectName: { type: String, required: true, trim: true, maxlength: 200 },
  departingMember: { type: String, required: true, trim: true, maxlength: 200 },
  successor: { type: String, required: true, trim: true, maxlength: 200 },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  reviewerIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  status: { type: String, enum: ['created', 'uploading', 'processing', 'under_review', 'ready_for_handover', 'completed', 'failed'], default: 'created' },
  sourceTypes: [{ type: String, enum: ['git_commit', 'pull_request', 'chat_message', 'task', 'markdown_document', 'csv_record', 'manual_entry'] }],
  archivedAt: { type: Date, default: null }
}, { timestamps: true, versionKey: false });
caseSchema.index({ reviewerIds: 1 });
export default mongoose.models.Case ?? mongoose.model('Case', caseSchema);
