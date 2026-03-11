module.exports = function requireAuth(req, res) {
  const token = process.env.ACCESS_SECRET;
  const provided =
    req.headers["x-auth-token"] ||
    req.headers["authorization"]?.replace("Bearer ", "");
  if (!token || provided !== token) {
    res.status(401).json({ error: "Não autorizado" });
    return false;
  }
  return true;
};
