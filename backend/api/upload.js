// backend/api/upload.js
// Fayl yuklash. data/uploads/<folder>/ ga saqlanadi.

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const UPLOAD_ROOT = path.join(__dirname, '..', '..', 'data', 'uploads');
const MAX_SIZE = 5 * 1024 * 1024; // 5 MB

const ALLOWED_EXT = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.ico',
  '.pdf', '.txt', '.md', '.json', '.csv'
]);

const ALLOWED_FOLDERS = new Set([
  'websites', 'badges', 'avatars', 'attachments', 'misc'
]);

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function send(res, status, body) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*'
  });
  res.end(JSON.stringify(body));
}

/**
 * Multipart/form-data ni oddiy qo'lda parse qilish.
 * Hojat: faqat bitta "file" va "folder" maydoni.
 */
function parseMultipart(req, boundary) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', c => {
      chunks.push(c);
      if (chunks.reduce((s, x) => s + x.length, 0) > MAX_SIZE * 2) {
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      const buf = Buffer.concat(chunks);
      const parts = [];
      const boundaryBuf = Buffer.from('--' + boundary);

      let start = buf.indexOf(boundaryBuf);
      if (start === -1) return resolve({ file: null, folder: 'misc' });

      start += boundaryBuf.length;
      while (start < buf.length) {
        // Har bir part shu bilan boshlanadi: \r\n
        if (buf[start] === 0x0d && buf[start + 1] === 0x0a) start += 2;

        const nextBoundary = buf.indexOf(boundaryBuf, start);
        if (nextBoundary === -1) break;

        const part = buf.slice(start, nextBoundary - 2); // trailing \r\n
        const headerEnd = part.indexOf('\r\n\r\n');
        if (headerEnd === -1) { start = nextBoundary + boundaryBuf.length; continue; }

        const headersRaw = part.slice(0, headerEnd).toString('utf8');
        const content = part.slice(headerEnd + 4);

        const nameMatch = headersRaw.match(/name="([^"]+)"/);
        const filenameMatch = headersRaw.match(/filename="([^"]+)"/);
        const contentTypeMatch = headersRaw.match(/Content-Type:\s*([^\r\n]+)/i);

        parts.push({
          name: nameMatch ? nameMatch[1] : null,
          filename: filenameMatch ? filenameMatch[1] : null,
          contentType: contentTypeMatch ? contentTypeMatch[1].trim() : null,
          content
        });

        start = nextBoundary + boundaryBuf.length;
      }

      let file = null;
      let folder = 'misc';
      for (const p of parts) {
        if (p.name === 'file' && p.filename) file = p;
        if (p.name === 'folder' && !p.filename) {
          folder = p.content.toString('utf8').trim();
        }
      }
      resolve({ file, folder });
    });
    req.on('error', reject);
  });
}

async function uploadFile(req, res) {
  try {
    const contentType = req.headers['content-type'] || '';
    const boundaryMatch = contentType.match(/boundary=(.+)$/);
    if (!boundaryMatch) {
      return send(res, 400, {
        success: false,
        message: 'Invalid content-type. Expected multipart/form-data.',
        code: 'INVALID_CONTENT_TYPE'
      });
    }

    const { file, folder: rawFolder } = await parseMultipart(req, boundaryMatch[1]);

    if (!file || !file.content) {
      return send(res, 400, {
        success: false,
        message: 'No file provided.',
        code: 'NO_FILE'
      });
    }

    const folder = ALLOWED_FOLDERS.has(rawFolder) ? rawFolder : 'misc';

    const ext = path.extname(file.filename).toLowerCase();
    if (!ALLOWED_EXT.has(ext)) {
      return send(res, 400, {
        success: false,
        message: `File type not allowed: ${ext}`,
        code: 'INVALID_EXT'
      });
    }

    if (file.content.length > MAX_SIZE) {
      return send(res, 400, {
        success: false,
        message: 'File too large (max 5MB).',
        code: 'TOO_LARGE'
      });
    }

    const dir = path.join(UPLOAD_ROOT, folder);
    ensureDir(dir);

    const filename = crypto.randomBytes(8).toString('hex') + ext;
    const filepath = path.join(dir, filename);
    fs.writeFileSync(filepath, file.content);

    const publicUrl = `/data/uploads/${folder}/${filename}`;

    send(res, 201, {
      success: true,
      data: {
        url: publicUrl,
        filename: file.filename,
        size: file.content.length,
        folder
      }
    });
  } catch (e) {
    console.error('[upload]', e.stack || e.message);
    send(res, 500, {
      success: false,
      message: 'Upload failed.',
      code: 'UPLOAD_ERROR'
    });
  }
}

module.exports = { uploadFile, UPLOAD_ROOT };