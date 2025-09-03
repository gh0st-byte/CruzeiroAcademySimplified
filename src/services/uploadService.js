import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import db from '../config/database.js';
import logger from '../config/logger.js';

class UploadService {
  constructor() {
    this.s3Client = new S3Client({
      region: process.env.AWS_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
      }
    });

    this.bucket = process.env.S3_BUCKET_NAME;
    this.cloudFrontDomain = process.env.S3_CLOUDFRONT_DOMAIN;
    
    // Tipos de arquivo permitidos
    this.allowedMimeTypes = (process.env.ALLOWED_FILE_TYPES || 
      'image/jpeg,image/png,image/gif,image/webp,video/mp4,application/pdf')
      .split(',');
    
    this.maxFileSize = parseInt(process.env.MAX_FILE_SIZE || 10485760); // 10MB padrão
  }

  // Configuração do multer para upload em memória
  getMulterConfig() {
    const storage = multer.memoryStorage();
    
    const fileFilter = (req, file, cb) => {
      if (this.allowedMimeTypes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error(`File type ${file.mimetype} not allowed`), false);
      }
    };

    return multer({
      storage,
      fileFilter,
      limits: {
        fileSize: this.maxFileSize,
        files: 10 // máximo 10 arquivos por upload
      }
    });
  }

  // Gerar chave única para o arquivo no S3
  generateS3Key(tenantId, originalFilename, folder = 'uploads') {
    const ext = path.extname(originalFilename);
    const fileName = path.basename(originalFilename, ext);
    const timestamp = Date.now();
    const uuid = uuidv4().substring(0, 8);
    
    // Estrutura: tenant/folder/year/month/filename-timestamp-uuid.ext
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    
    return `${tenantId}/${folder}/${year}/${month}/${fileName}-${timestamp}-${uuid}${ext}`;
  }

  // Upload arquivo para S3
  async uploadToS3(file, s3Key, metadata = {}) {
    try {
      const command = new PutObjectCommand({
        Bucket: this.bucket,
        Key: s3Key,
        Body: file.buffer,
        ContentType: file.mimetype,
        ContentLength: file.size,
        Metadata: {
          originalName: file.originalname,
          uploadedAt: new Date().toISOString(),
          ...metadata
        }
      });

      await this.s3Client.send(command);
      
      // Construir URL do arquivo
      const fileUrl = this.cloudFrontDomain 
        ? `https://${this.cloudFrontDomain}/${s3Key}`
        : `https://${this.bucket}.s3.${process.env.AWS_REGION}.amazonaws.com/${s3Key}`;

      return {
        s3Key,
        fileUrl,
        size: file.size,
        mimeType: file.mimetype
      };
    } catch (error) {
      logger.error('S3 upload error:', error);
      throw new Error(`Failed to upload file to S3: ${error.message}`);
    }
  }

  // Deletar arquivo do S3
  async deleteFromS3(s3Key) {
    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: s3Key
      });

      await this.s3Client.send(command);
      return true;
    } catch (error) {
      logger.error('S3 delete error:', error);
      throw new Error(`Failed to delete file from S3: ${error.message}`);
    }
  }

  // Gerar URL assinada para upload direto
  async generatePresignedUploadUrl(tenantId, fileName, contentType, expiresIn = 300) {
    try {
      const s3Key = this.generateS3Key(tenantId, fileName, 'direct-uploads');
      
      const command = new PutObjectCommand({
        Bucket: this.bucket,
        Key: s3Key,
        ContentType: contentType
      });

      const signedUrl = await getSignedUrl(this.s3Client, command, { 
        expiresIn 
      });

      return {
        uploadUrl: signedUrl,
        s3Key,
        expiresIn
      };
    } catch (error) {
      logger.error('Error generating presigned upload URL:', error);
      throw new Error(`Failed to generate upload URL: ${error.message}`);
    }
  }

  // Gerar URL assinada para download
  async generatePresignedDownloadUrl(s3Key, expiresIn = 3600) {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: s3Key
      });

      const signedUrl = await getSignedUrl(this.s3Client, command, { 
        expiresIn 
      });

      return signedUrl;
    } catch (error) {
      logger.error('Error generating presigned download URL:', error);
      throw new Error(`Failed to generate download URL: ${error.message}`);
    }
  }

  // Processar upload de arquivo e salvar no banco
  async processFileUpload(file, tenantId, uploadedBy, folder = 'uploads', metadata = {}) {
    try {
      // Upload para S3
      const s3Key = this.generateS3Key(tenantId, file.originalname, folder);
      const uploadResult = await this.uploadToS3(file, s3Key, metadata);

      // Salvar informações no banco de dados
      const mediaRecord = await this.saveMediaRecord({
        tenantId,
        uploadedBy,
        originalFilename: file.originalname,
        filename: path.basename(s3Key),
        filePath: s3Key,
        fileUrl: uploadResult.fileUrl,
        mimeType: file.mimetype,
        fileSize: file.size,
        width: metadata.width || null,
        height: metadata.height || null,
        altText: metadata.altText || null,
        caption: metadata.caption || null
      });

      logger.audit('file_uploaded', 'media_files', uploadedBy, tenantId, {
        mediaId: mediaRecord.id,
        filename: file.originalname,
        size: file.size,
        mimeType: file.mimetype,
        s3Key
      });

      return mediaRecord;
    } catch (error) {
      logger.error('Error processing file upload:', error);
      throw error;
    }
  }

  // Salvar registro de mídia no banco
  async saveMediaRecord(data) {
    try {
      const result = await db.query(`
        INSERT INTO media_files (
          tenant_id, uploaded_by, filename, original_filename, file_path,
          file_url, mime_type, file_size, width, height, alt_text, caption
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING *
      `, [
        data.tenantId,
        data.uploadedBy,
        data.filename,
        data.originalFilename,
        data.filePath,
        data.fileUrl,
        data.mimeType,
        data.fileSize,
        data.width,
        data.height,
        data.altText,
        data.caption
      ]);

      return result.rows[0];
    } catch (error) {
      logger.error('Error saving media record:', error);
      throw new Error(`Failed to save media record: ${error.message}`);
    }
  }

  // Processar múltiplos uploads
  async processMultipleUploads(files, tenantId, uploadedBy, folder = 'uploads') {
    const results = [];
    const errors = [];

    for (const file of files) {
      try {
        const result = await this.processFileUpload(file, tenantId, uploadedBy, folder);
        results.push(result);
      } catch (error) {
        errors.push({
          filename: file.originalname,
          error: error.message
        });
      }
    }

    return { results, errors };
  }

  // Deletar arquivo (S3 + banco)
  async deleteMediaFile(mediaId, userId, tenantId) {
    try {
      // Buscar informações do arquivo
      const mediaResult = await db.query(`
        SELECT * FROM media_files 
        WHERE id = $1 AND tenant_id = $2 AND is_active = true
      `, [mediaId, tenantId]);

      if (mediaResult.rows.length === 0) {
        throw new Error('Media file not found');
      }

      const mediaFile = mediaResult.rows[0];

      // Deletar do S3
      await this.deleteFromS3(mediaFile.file_path);

      // Marcar como inativo no banco (soft delete)
      await db.query(`
        UPDATE media_files 
        SET is_active = false, updated_at = NOW()
        WHERE id = $1
      `, [mediaId]);

      logger.audit('file_deleted', 'media_files', userId, tenantId, {
        mediaId: mediaFile.id,
        filename: mediaFile.original_filename,
        s3Key: mediaFile.file_path
      });

      return true;
    } catch (error) {
      logger.error('Error deleting media file:', error);
      throw error;
    }
  }

  // Listar arquivos de mídia
  async getMediaFiles(tenantId, options = {}) {
    try {
      const {
        page = 1,
        limit = 20,
        mimeType,
        search,
        sortBy = 'created_at',
        sortOrder = 'DESC'
      } = options;

      const offset = (parseInt(page) - 1) * parseInt(limit);
      let whereClause = 'tenant_id = $1 AND is_active = true';
      const params = [tenantId];
      let paramIndex = 2;

      if (mimeType) {
        whereClause += ` AND mime_type LIKE $${paramIndex}`;
        params.push(`${mimeType}%`);
        paramIndex++;
      }

      if (search) {
        whereClause += ` AND (original_filename ILIKE $${paramIndex} OR alt_text ILIKE $${paramIndex})`;
        params.push(`%${search}%`);
        paramIndex++;
      }

      const query = `
        SELECT 
          mf.*,
          u.first_name || ' ' || u.last_name as uploaded_by_name
        FROM media_files mf
        JOIN cms_users u ON mf.uploaded_by = u.id
        WHERE ${whereClause}
        ORDER BY mf.${sortBy} ${sortOrder}
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;

      params.push(parseInt(limit), offset);
      
      const result = await db.query(query, params);

      // Count total
      const countResult = await db.query(`
        SELECT COUNT(*) as total
        FROM media_files
        WHERE ${whereClause}
      `, params.slice(0, -2));

      const total = parseInt(countResult.rows[0].total);

      return {
        files: result.rows,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      };
    } catch (error) {
      logger.error('Error fetching media files:', error);
      throw error;
    }
  }

  // Validar dimensões de imagem (helper)
  async getImageDimensions(buffer) {
    try {
      // Implementar usando sharp ou similar se necessário
      // Por agora, retornar null
      return { width: null, height: null };
    } catch (error) {
      return { width: null, height: null };
    }
  }
}

export default new UploadService();
