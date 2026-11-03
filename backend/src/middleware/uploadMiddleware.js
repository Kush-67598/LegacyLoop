import multer from 'multer';
import { ApiError } from '../utils/ApiError.js';
const uploader = multer({ storage: multer.memoryStorage(), limits: { files: 10, fileSize: 10 * 1024 * 1024, fields: 20, parts: 30 } });
export function receiveUploads(req, res, next) {
  uploader.array('files', 10)(req, res, (error) => {
    if (!error) return next();
    const oversized = error.code === 'LIMIT_FILE_SIZE';
    const tooMany = error.code === 'LIMIT_FILE_COUNT' || error.code === 'LIMIT_UNEXPECTED_FILE';
    next(new ApiError(oversized || tooMany ? 413 : 400, oversized ? 'A file exceeds the 10 MB limit' : tooMany ? 'Upload is limited to 10 files in the files field' : 'Invalid multipart upload', oversized || tooMany ? 'UPLOAD_LIMIT_EXCEEDED' : 'INVALID_UPLOAD'));
  });
}
