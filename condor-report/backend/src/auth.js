"use strict"

const crypto = require("crypto")

const SESSION_TTL_MS = 8 * 60 * 60 * 1000
const sessions = new Map()

function parseCookies(header = "") {
  return Object.fromEntries(header.split(";").map(part => {
    const index = part.indexOf("=")
    if (index < 0) return ["", ""]
    const key = part.slice(0, index).trim()
    const rawValue = part.slice(index + 1).trim()
    try {
      return [key, decodeURIComponent(rawValue)]
    } catch {
      return [key, ""]
    }
  }).filter(([key]) => key))
}

function createSession() {
  const token = crypto.randomBytes(32).toString("base64url")
  const userId = crypto.randomUUID()
  sessions.set(token, { userId, expiresAt: Date.now() + SESSION_TTL_MS })
  return { token, userId }
}

function getSession(req) {
  const token = parseCookies(req.get("Cookie")).condor_session
  const session = token && sessions.get(token)
  if (!session) return null
  if (session.expiresAt <= Date.now()) {
    sessions.delete(token)
    return null
  }
  session.expiresAt = Date.now() + SESSION_TTL_MS
  return { token, ...session }
}

function requireAuth(req, res, next) {
  const session = getSession(req)
  if (session) {
    req.user = { id: session.userId, authType: "session" }
    return next()
  }

  const configuredKey = process.env.REPORT_API_KEY || ""
  const provided = req.get("X-API-Key") || req.get("Authorization")?.replace(/^Bearer\s+/i, "")
  if (configuredKey && provided) {
    const expected = Buffer.from(configuredKey)
    const received = Buffer.from(provided)
    if (received.length === expected.length && crypto.timingSafeEqual(received, expected)) {
      req.user = { id: "service", authType: "api-key" }
      return next()
    }
  }

  return res.status(401).json({ success: false, message: "Autenticación requerida" })
}

function login(req, res) {
  const password = process.env.REPORT_ADMIN_PASSWORD || ""
  if (!password) {
    return res.status(503).json({ success: false, message: "Autenticación no configurada" })
  }
  const provided = typeof req.body?.password === "string" ? req.body.password : ""
  const expected = Buffer.from(password)
  const received = Buffer.from(provided)
  if (received.length !== expected.length || !crypto.timingSafeEqual(received, expected)) {
    return res.status(401).json({ success: false, message: "Credenciales inválidas" })
  }

  const session = createSession()
  res.cookie("condor_session", session.token, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_TTL_MS,
    path: "/",
  })
  res.json({ success: true })
}

function currentUser(req, res) {
  const session = getSession(req)
  if (!session) return res.status(401).json({ success: false })
  res.json({ success: true })
}

function cleanupSessions() {
  const now = Date.now()
  for (const [token, session] of sessions) {
    if (session.expiresAt <= now) sessions.delete(token)
  }
}

const cleanupTimer = setInterval(cleanupSessions, 15 * 60 * 1000)
cleanupTimer.unref()

module.exports = { login, currentUser, requireAuth, getSession }
