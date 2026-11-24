// Run once:  npm run seed:admin
require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("./models/User");

(async () => {
  try {
    const { ADMIN_NAME, ADMIN_EMAIL, ADMIN_PASSWORD, MONGO_URI } = process.env;
    if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
      console.error("Set ADMIN_EMAIL and ADMIN_PASSWORD in .env first");
      process.exit(1);
    }
    await mongoose.connect(MONGO_URI);

    const exists = await User.findOne({ email: ADMIN_EMAIL.toLowerCase() });
    if (exists) {
      console.log("Admin already exists:", exists.email);
    } else {
      await User.create({
        name: ADMIN_NAME || "Admin",
        email: ADMIN_EMAIL,
        password: await bcrypt.hash(ADMIN_PASSWORD, 10),
        role: "admin",
      });
      console.log("Admin created:", ADMIN_EMAIL);
    }
    await mongoose.disconnect();
  } catch (err) {
    console.error("Seed failed:", err.message);
    process.exit(1);
  }
})();
