const mongoose = require('mongoose');

const PhotoSchema = new mongoose.Schema({
  filename: { type: String, required: true },
  url: { type: String, required: true },
  hash: { type: String },
  size: { type: Number },
  createdAt: { type: Date, default: Date.now }
}, { _id: false });

const FamilyMemberSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true },
  relation: { type: String, default: '' },
  photos: { type: [PhotoSchema], default: [] },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.models.FamilyMember || mongoose.model('FamilyMember', FamilyMemberSchema);
