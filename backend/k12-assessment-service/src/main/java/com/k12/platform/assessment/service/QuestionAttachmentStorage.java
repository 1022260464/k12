package com.k12.platform.assessment.service;

import com.k12.platform.assessment.config.QuestionAttachmentProperties;
import io.minio.GetPresignedObjectUrlArgs;
import io.minio.MinioClient;
import io.minio.PutObjectArgs;
import io.minio.RemoveObjectArgs;
import io.minio.Http.Method;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.util.Arrays;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

@Component
public class QuestionAttachmentStorage {
    private static final Logger log = LoggerFactory.getLogger(QuestionAttachmentStorage.class);
    private static final long MAX_BYTES = 10L * 1024 * 1024;
    private static final Map<String, String> TYPES = Map.of(
            "pdf", "application/pdf", "png", "image/png",
            "jpg", "image/jpeg", "jpeg", "image/jpeg",
            "docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    private final QuestionAttachmentProperties properties;
    private final MinioClient client;

    public QuestionAttachmentStorage(QuestionAttachmentProperties properties) {
        this.properties = properties;
        this.client = properties.isEnabled() && StringUtils.hasText(properties.getAccessKey())
                && StringUtils.hasText(properties.getSecretKey())
                ? MinioClient.builder().endpoint(properties.getEndpoint())
                    .credentials(properties.getAccessKey(), properties.getSecretKey()).build()
                : null;
    }

    public Stored upload(MultipartFile file) {
        if (file == null || file.isEmpty() || file.getSize() > MAX_BYTES) {
            throw new IllegalArgumentException("附件必须是非空且不超过 10 MB");
        }
        String original = file.getOriginalFilename();
        if (!StringUtils.hasText(original)) throw new IllegalArgumentException("附件文件名不能为空");
        String filename = original.replace('\\', '/');
        filename = filename.substring(filename.lastIndexOf('/') + 1);
        if (filename.length() > 255 || filename.indexOf('\0') >= 0 || filename.isBlank()) {
            throw new IllegalArgumentException("附件文件名不合法");
        }
        int dot = filename.lastIndexOf('.');
        String extension = dot < 0 ? "" : filename.substring(dot + 1).toLowerCase(Locale.ROOT);
        String mime = TYPES.get(extension);
        if (mime == null) throw new IllegalArgumentException("附件仅支持 PDF、PNG、JPG、DOCX");
        try (var stream = file.getInputStream()) {
            byte[] header = stream.readNBytes(8);
            byte[] signature = switch (extension) {
                case "pdf" -> new byte[]{'%', 'P', 'D', 'F', '-'};
                case "png" -> new byte[]{(byte) 0x89, 'P', 'N', 'G'};
                case "jpg", "jpeg" -> new byte[]{(byte) 0xff, (byte) 0xd8, (byte) 0xff};
                default -> new byte[]{'P', 'K', 3, 4};
            };
            if (header.length < signature.length
                    || !Arrays.equals(Arrays.copyOf(header, signature.length), signature)) {
                throw new IllegalArgumentException("附件内容与扩展名不匹配");
            }
        } catch (IOException error) {
            throw new IllegalArgumentException("无法读取附件", error);
        }
        String objectKey = "question-attachments/" + UUID.randomUUID() + "." + extension;
        try {
            ensureBucket();
            client().putObject(PutObjectArgs.builder().bucket(properties.getBucket()).object(objectKey)
                    .stream(file.getInputStream(), file.getSize(), -1L).contentType(mime).build());
            return new Stored(objectKey, filename, mime, file.getSize());
        } catch (ResponseStatusException error) {
            throw error;
        } catch (Exception error) {
            log.error("题目附件上传 MinIO 失败", error);
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "题目附件存储暂不可用");
        }
    }

    private void ensureBucket() {
        try {
            String bucket = properties.getBucket();
            if (!client().bucketExists(io.minio.BucketExistsArgs.builder().bucket(bucket).build())) {
                client().makeBucket(io.minio.MakeBucketArgs.builder().bucket(bucket).build());
                log.info("已自动创建 MinIO 桶: {}", bucket);
            }
        } catch (ResponseStatusException error) {
            throw error;
        } catch (Exception error) {
            log.error("检查/创建 MinIO 桶失败: {}", properties.getBucket(), error);
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "题目附件存储桶不可用，请确认 MinIO 桶已创建");
        }
    }

    public String downloadUrl(String objectKey) {
        try {
            return client().getPresignedObjectUrl(GetPresignedObjectUrlArgs.builder()
                    .method(Method.GET).bucket(properties.getBucket()).object(objectKey)
                    .expiry(Math.toIntExact(properties.getUrlTtl().toSeconds())).build());
        } catch (ResponseStatusException error) {
            throw error;
        } catch (Exception error) {
            log.error("生成题目附件访问地址失败", error);
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "题目附件存储暂不可用");
        }
    }

    public void removeQuietly(String objectKey) {
        try {
            client().removeObject(RemoveObjectArgs.builder().bucket(properties.getBucket()).object(objectKey).build());
        } catch (Exception error) {
            log.warn("清理题目附件失败: {}", objectKey, error);
        }
    }

    private MinioClient client() {
        if (client == null) throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "题目附件存储未启用");
        return client;
    }

    public record Stored(String objectKey, String filename, String mimeType, long sizeBytes) { }
}
