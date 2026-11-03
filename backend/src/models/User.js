import mongoose from 'mongoose';
const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 200 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true, select: false },
  role: { type: String, required: true, enum: ['admin', 'reviewer', 'successor', 'team_member'], default: 'team_member' }
}, { timestamps: { createdAt: true, updatedAt: false }, versionKey: false });
export default mongoose.models.User ?? mongoose.model('User', userSchema);
