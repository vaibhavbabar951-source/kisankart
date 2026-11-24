const jwt = require("jsonwebtoken");
const User = require("../models/User");

// Login check: token valid + user still active
const protect = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ msg: "Not authorized, token missing" });
  }

  let decoded;
  try {
    decoded = jwt.verify(authHeader.split(" ")[1], process.env.JWT_SECRET);
  } catch (error) {
    return res.status(401).json({ msg: "Token invalid or expired" });
  }

  const user = await User.findById(decoded.id).select("role isActive");
  if (!user) return res.status(401).json({ msg: "User no longer exists" });
  if (!user.isActive) return res.status(403).json({ msg: "Your account is blocked" });

  req.user = { id: user._id.toString(), role: user.role };
  next();
};

// Role check: only allowed roles
const authorize = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({ msg: "Access denied for your role" });
  }
  next();
};

module.exports = { protect, authorize };
