'use strict';

const express  = require('express');
const multer   = require('multer');
const path     = require('path');
const crypto   = require('crypto');
const ctrl     = require('./documents.controller');
const { authenticate } = require('../../middleware/auth.middleware');
const { UPLOAD_DIR }   = require('./documents.service');

const router = express.Router();

// Multer storage — save to uploads/ with a unique name
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename:    (_req, file, cb) => {
    const unique = crypto.randomBytes(8).toString('hex');
    cb(null, `${unique}-${file.originalname}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
});

// GET  /documents/surgery/:surgeryId         → list documents for a surgery
router.get('/surgery/:surgeryId', authenticate, ctrl.listDocuments);

// POST /documents/surgery/:surgeryId/upload  → upload a document
router.post(
  '/surgery/:surgeryId/upload',
  authenticate,
  upload.single('file'),
  ctrl.uploadDocument
);

// GET  /documents/:documentId/download       → download a document
router.get('/:documentId/download', authenticate, ctrl.downloadDocument);

// DELETE /documents/:documentId              → delete a document
router.delete('/:documentId', authenticate, ctrl.deleteDocument);

module.exports = router;
