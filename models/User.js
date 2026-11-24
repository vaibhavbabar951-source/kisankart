const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, minlength: 6, select: false },
    phone: { type: String, trim: true },
    role: { type: String, enum: ["farmer", "buyer", "admin"], default: "buyer" },
    profileImage: { type: String, default: "" }, // e.g. /uploads/profiles/xxx.jpg
    isActive: { type: Boolean, default: true },
    address: {
      village: String,
      city: String,
      state: String,
      pincode: String,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);
