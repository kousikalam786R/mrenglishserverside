const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },
  name: {
    type: String,
    required: true,
    trim: true,
  },
  password: {
    type: String,
    select: false,
  },
  // Profile information
  bio: {
    type: String,
    trim: true,
    maxlength: 500,
  },
  age: {
    type: Number,
    min: 13,
    max: 120,
  },
  gender: {
    type: String,
    enum: ['Male', 'Female', 'Other', 'Prefer not to say'],
  },
  country: {
    type: String,
    trim: true,
  },
  nativeLanguage: {
    type: String,
    trim: true,
  },
  englishLevel: {
    type: String,
    enum: ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'],
    default: 'A2',
  },
  interests: [{
    type: String,
    trim: true,
  }],
  profilePic: {
    type: String,
  },
  // Authentication fields
  googleId: {
    type: String,
    unique: true,
    sparse: true,
  },
  idToken: {
    type: String,
  },
  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now,
  },
  lastLoginAt: {
    type: Date,
    default: Date.now,
  },
});

// Pre-save middleware to hash passwords
userSchema.pre('save', async function(next) {
  // Only hash the password if it's modified or new
  if (!this.isModified('password') || !this.password) {
    return next();
  }
  
  try {
    // Generate salt and hash password
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Method to check if entered password is correct
userSchema.methods.matchPassword = async function(enteredPassword) {
  if (!this.password) return false;
  return await bcrypt.compare(enteredPassword, this.password);
};

const User = mongoose.model('User', userSchema);

module.exports = User; 