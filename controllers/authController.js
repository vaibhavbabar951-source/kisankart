const User = require("../models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { deleteUploadedFile } = require("../utils/file");

const generateToken = (user) =>
  jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: "7d" });

const formatUser = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  phone: user.phone,
  role: user.role,
  profileImage: user.profileImage,
  address: user.address,
});

// POST /api/auth/signup  (JSON, or multipart/form-data with optional "image" file)
const signup = async (req, res) => {
  const uploaded = req.file ? `/uploads/profiles/${req.file.filename}` : "";
  const fail = (status, msg) => {
    deleteUploadedFile(uploaded);
    return res.status(status).json({ msg });
  };

  try {
    const { name, email, password, role, phone } = req.body || {};

    if (!name || !email || !password || !role) {
      return fail(400, "Please fill all required fields");
    }
    if (!["farmer", "buyer"].includes(role)) {
      return fail(400, "Role must be farmer or buyer");
    }
    if (password.length < 6) {
      return fail(400, "Password must be at least 6 characters");
    }
    if (await User.findOne({ email: email.toLowerCase() })) {
      return fail(409, "Email already registered");
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      role,
      phone,
      profileImage: uploaded,
    });

    res.status(201).json({ msg: "Signup successful", token: generateToken(user), user: formatUser(user) });
  } catch (err) {
    deleteUploadedFile(uploaded);
    throw err;
  }
};

// POST /api/auth/login
const login = async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ msg: "Email and password are required" });
  }

  const user = await User.findOne({ email: email.toLowerCase() }).select("+password");
  if (!user || !(await bcrypt.compare(password, user.password))) {
    return res.status(401).json({ msg: "Invalid email or password" });
  }
  if (!user.isActive) {
    return res.status(403).json({ msg: "Your account is blocked. Contact admin." });
  }

  res.json({ msg: "Login successful", token: generateToken(user), user: formatUser(user) });
};

// GET /api/auth/me
const getMe = async (req, res) => {
  const user = await User.findById(req.user.id);
  res.json({ user: formatUser(user) });
};

// PUT /api/auth/me   (name, phone, address)
const updateProfile = async (req, res) => {
  const { name, phone, address } = req.body || {};
  const user = await User.findById(req.user.id);

  if (name !== undefined) user.name = name;
  if (phone !== undefined) user.phone = phone;
  if (address && typeof address === "object") {
    ["village", "city", "state", "pincode"].forEach((f) => {
      if (address[f] !== undefined) user.address[f] = address[f];
    });
  }

  await user.save();
  res.json({ msg: "Profile updated", user: formatUser(user) });
};

// PUT /api/auth/me/image   (multipart, field name: image)
const uploadProfileImage = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ msg: "Please attach an image (field name: image)" });
  }
  const newPath = `/uploads/profiles/${req.file.filename}`;

  try {
    const user = await User.findById(req.user.id);
    const oldPath = user.profileImage;
    user.profileImage = newPath;
    await user.save();
    deleteUploadedFile(oldPath);
    res.json({ msg: "Profile image updated", profileImage: newPath });
  } catch (err) {
    deleteUploadedFile(newPath);
    throw err;
  }
};

// DELETE /api/auth/me/image
const removeProfileImage = async (req, res) => {
  const user = await User.findById(req.user.id);
  deleteUploadedFile(user.profileImage);
  user.profileImage = "";
  await user.save();
  res.json({ msg: "Profile image removed" });
};

// PUT /api/auth/me/password
const changePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ msg: "currentPassword and newPassword are required" });
  }
  if (newPassword.length < 6) {
    return res.status(400).json({ msg: "New password must be at least 6 characters" });
  }

  const user = await User.findById(req.user.id).select("+password");
  if (!(await bcrypt.compare(currentPassword, user.password))) {
    return res.status(401).json({ msg: "Current password is incorrect" });
  }

  user.password = await bcrypt.hash(newPassword, 10);
  await user.save();
  res.json({ msg: "Password changed" });
};

module.exports = {
  signup,
  login,
  getMe,
  updateProfile,
  uploadProfileImage,
  removeProfileImage,
  changePassword,
};
