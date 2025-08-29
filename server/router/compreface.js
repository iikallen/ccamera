const express = require('express');
const multer = require('multer');
const controller = require('../controllers/compreface-controller');

const storage = multer.memoryStorage();
const upload = multer({ storage });

const router = express.Router();

module.exports = controller;
