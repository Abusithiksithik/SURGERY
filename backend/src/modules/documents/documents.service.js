'use strict';

const path  = require('path');
const fs    = require('fs');
const { query, queryOne, queryRows } = require('../../config/db');
const ApiError = require('../../utils/ApiError');

const UPLOAD_DIR = path.join(__dirname, '..', '..', '..', 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

function snakeToCamel(s) {
  return s.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}
function toObj(row) {
  if (!row) return null;
  const out = {};
  for (const [k, v] of Object.entries(row)) out[snakeToCamel(k)] = v;
  return out;
}

// ── List documents for a surgery ────────────────────────────────────────────

async function listDocuments(surgeryId) {
  const surgery = await queryOne('SELECT surgery_id FROM surgeries WHERE surgery_id = $1', [surgeryId]);
  if (!surgery) throw ApiError.notFound('Surgery not found');

  const rows = await queryRows(
    `SELECT d.document_id, d.surgery_id, d.document_type, d.file_name,
            d.file_size, d.mime_type, d.notes, d.uploaded_at,
            u.full_name AS uploaded_by_name
     FROM   surgery_documents d
     LEFT JOIN users u ON u.user_id = d.uploaded_by
     WHERE  d.surgery_id = $1
     ORDER  BY d.uploaded_at DESC`,
    [surgeryId]
  );
  return rows.map(toObj);
}

// ── Upload a document ────────────────────────────────────────────────────────

async function uploadDocument(surgeryId, { documentType, notes, fileName, filePath, fileSize, mimeType }, userId) {
  const surgery = await queryOne('SELECT surgery_id FROM surgeries WHERE surgery_id = $1', [surgeryId]);
  if (!surgery) throw ApiError.notFound('Surgery not found');

  const { rows: [doc] } = await query(
    `INSERT INTO surgery_documents
       (surgery_id, document_type, file_name, file_path, file_size, mime_type, notes, uploaded_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [surgeryId, documentType || 'OTHER', fileName, filePath, fileSize || null, mimeType || null, notes || null, userId || null]
  );
  return toObj(doc);
}

// ── Get a document by ID ─────────────────────────────────────────────────────

async function getDocumentById(documentId) {
  const row = await queryOne(
    `SELECT d.*, u.full_name AS uploaded_by_name
     FROM   surgery_documents d
     LEFT JOIN users u ON u.user_id = d.uploaded_by
     WHERE  d.document_id = $1`,
    [documentId]
  );
  if (!row) throw ApiError.notFound('Document not found');
  return toObj(row);
}

// ── Delete a document ────────────────────────────────────────────────────────

async function deleteDocument(documentId) {
  const doc = await getDocumentById(documentId);

  // Remove physical file
  try {
    if (doc.filePath && fs.existsSync(doc.filePath)) {
      fs.unlinkSync(doc.filePath);
    }
  } catch (_) { /* non-fatal */ }

  await query('DELETE FROM surgery_documents WHERE document_id = $1', [documentId]);
  return { deleted: true };
}

module.exports = { listDocuments, uploadDocument, getDocumentById, deleteDocument, UPLOAD_DIR };
