"use strict"

const express = require("express")
const { login, currentUser } = require("../auth")

const router = express.Router()
router.post("/login", login)
router.get("/me", currentUser)

module.exports = router
