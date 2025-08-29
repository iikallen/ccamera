const mongoose = require('mongoose');

const ImageSchema = new mongoose.Schema({
  filename: { type: String, required: true },
  url: { type: String, required: true }, 
  hash: { type: String, required: true }, 
  size: { type: Number },
  source: { type: String, default: 'compreface' },
  createdAt: { type: Date, default: Date.now }
}, { _id: false });

const SubjectSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  comprefaceId: { type: String },
  images: { type: [ImageSchema], default: [] },
  nextSeq: { type: Number, default: 0 }, 
  createdAt: { type: Date, default: Date.now }
});

SubjectSchema.index({ 'images.hash': 1 });

module.exports = mongoose.models.Subject || mongoose.model('Subject', SubjectSchema);
