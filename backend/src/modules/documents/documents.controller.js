'use strict';

const path          = require('path');
const asyncHandler  = require('../../utils/asyncHandler');
const ApiResponse   = require('../../utils/ApiResponse');
const service       = require('./documents.service');

const listDocuments = asyncHandler(async (req, res) => {
  const data = await service.listDocuments(req.params.surgeryId);
  return new ApiResponse(200, data).send(res);
});

const uploadDocument = asyncHandler(async (req, res) => {
  const userId = req.user?.userId || null;

  if (!req.file) {
    return res.status(400).json({ success: false, message: 'No file uploaded' });
  }

  const { documentType, notes } = req.body;
  const data = await service.uploadDocument(req.params.surgeryId, {
    documentType,
    notes,
    fileName:  req.file.originalname,
    filePath:  req.file.path,
    fileSize:  req.file.size,
    mimeType:  req.file.mimetype,
  }, userId);

  return new ApiResponse(201, data, 'Document uploaded').send(res);
});

const downloadDocument = asyncHandler(async (req, res) => {
  const doc = await service.getDocumentById(req.params.documentId);
  const absPath = path.isAbsolute(doc.filePath) ? doc.filePath : path.join(service.UPLOAD_DIR, doc.filePath);

  res.download(absPath, doc.fileName, (err) => {
    if (err && !res.headersSent) {
      res.status(404).json({ success: false, message: 'File not found on disk' });
    }
  });
});

const deleteDocument = asyncHandler(async (req, res) => {
  const data = await service.deleteDocument(req.params.documentId);
  return new ApiResponse(200, data, 'Document deleted').send(res);
});

module.exports = { listDocuments, uploadDocument, downloadDocument, deleteDocument };
