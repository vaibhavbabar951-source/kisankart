const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
  {
    farmer: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    name: { type: String, required: true, trim: true },
    category: {
      type: String,
      enum: ["vegetables", "fruits", "grains", "pulses", "dairy", "other"],
      required: true,
    },
    description: String,
    price: { type: Number, required: true, min: 0 },
    unit: { type: String, enum: ["kg", "quintal", "dozen", "litre", "piece"], default: "kg" },
    quantity: { type: Number, required: true, min: 0 },
    image: { type: String, default: "" }, // e.g. /uploads/products/xxx.jpg
    isAvailable: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Product", productSchema);
