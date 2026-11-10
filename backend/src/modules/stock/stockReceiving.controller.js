'use strict';

const asyncHandler = require('../../utils/asyncHandler');
const fs = require('fs');
const ApiResponse = require('../../utils/ApiResponse');
const service = require('./stockReceiving.service');

exports.listItems = asyncHandler(async (req, res) => {
  const data = await service.listItems(req.query.search || '', req.query.locationId || null);
  return new ApiResponse(200, data, 'Stock items').send(res);
});
exports.listLocations = asyncHandler(async (_req, res) => {
  const data = await service.listLocations();
  return new ApiResponse(200, data, 'Stock locations').send(res);
});
exports.createReceipt = asyncHandler(async (req, res) => {
  const data = await service.createReceipt(req.body, req.user.userId);
  return new ApiResponse(data.idempotentReplay ? 200 : 201, data, data.idempotentReplay ? 'Existing receipt returned (idempotent retry)' : 'Stock receipt created').send(res);
});
exports.listReceipts = asyncHandler(async (req, res) => {
  const result = await service.listReceipts(req.query);
  return new ApiResponse(200, result.items, 'Stock receipts', result.meta).send(res);
});
exports.getReceipt = asyncHandler(async (req, res) => {
  const data = await service.getReceipt(req.params.id);
  return new ApiResponse(200, data, 'Stock receipt details').send(res);
});
exports.getBalances = asyncHandler(async (req, res) => {
  const result = await service.getBalances(req.query);
  return new ApiResponse(200, result.items, 'Stock balances', result.meta).send(res);
});

exports.recordPhysicalCount = asyncHandler(async (req, res) => {
  const data = await service.recordPhysicalCount(req.body, req.user.userId);
  return new ApiResponse(data.idempotentReplay ? 200 : 201, data, data.idempotentReplay ? 'Existing physical count adjustment returned' : 'Physical count recorded').send(res);
});

exports.uploadReceiptInvoice = asyncHandler(async (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, message: 'Choose a PDF or image file.' });
  try {
    const signature = Buffer.alloc(12);
    const descriptor = fs.openSync(req.file.path, 'r');
    try { fs.readSync(descriptor, signature, 0, signature.length, 0); } finally { fs.closeSync(descriptor); }
    const isPdf = req.file.mimetype === 'application/pdf' && signature.subarray(0, 5).toString() === '%PDF-';
    const isJpeg = req.file.mimetype === 'image/jpeg' && signature[0] === 0xff && signature[1] === 0xd8 && signature[2] === 0xff;
    const isPng = req.file.mimetype === 'image/png' && signature.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
    const isWebp = req.file.mimetype === 'image/webp' && signature.subarray(0, 4).toString() === 'RIFF' && signature.subarray(8, 12).toString() === 'WEBP';
    if (!isPdf && !isJpeg && !isPng && !isWebp) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ success: false, message: 'The selected file content is not a valid PDF, JPG, PNG or WebP file.' });
    }
    const data = await service.saveReceiptInvoice(req.params.id, {
      fileName: require('path').basename(req.file.originalname).slice(0, 260),
      filePath: req.file.path,
      fileSize: req.file.size,
      mimeType: req.file.mimetype,
    }, req.user.userId);
    if (data.alreadyUploaded) {
      try { fs.unlinkSync(req.file.path); } catch (_) { /* cleanup is best-effort */ }
    }
    return new ApiResponse(data.alreadyUploaded ? 200 : 201, data, 'Receipt invoice attached').send(res);
  } catch (error) {
    try { fs.unlinkSync(req.file.path); } catch (_) { /* cleanup is best-effort */ }
    throw error;
  }
});

exports.downloadReceiptInvoice = asyncHandler(async (req, res) => {
  const attachment = await service.getReceiptInvoice(req.params.id);
  if (!fs.existsSync(attachment.filePath)) return res.status(404).json({ success: false, message: 'Invoice file is missing from storage.' });
  return res.download(attachment.filePath, attachment.fileName);
});

exports.getBalanceSummary = asyncHandler(async (req, res) => {
  const data = await service.getBalanceSummary(req.query.locationId);
  return new ApiResponse(200, data, 'OT stock balance summary').send(res);
});
