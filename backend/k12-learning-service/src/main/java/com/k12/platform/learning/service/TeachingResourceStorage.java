package com.k12.platform.learning.service;

import com.k12.platform.learning.config.CourseMediaProperties;
import io.minio.GetPresignedObjectUrlArgs;
import io.minio.Http.Method;
import io.minio.MinioClient;
import io.minio.PutObjectArgs;
import io.minio.RemoveObjectArgs;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.util.Map;
import java.util.UUID;
import java.util.Arrays;

@Component
public class TeachingResourceStorage {
    private static final Logger log = LoggerFactory.getLogger(TeachingResourceStorage.class);
    private static final long MAX_BYTES = 50L * 1024 * 1024;
    private static final Map<String, String> TYPES = Map.of(
            "pdf", "application/pdf", "docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "pptx", "application/vnd.openxmlformats-officedocument.presentationml.presentation",
            "png", "image/png", "jpg", "image/jpeg", "jpeg", "image/jpeg", "mp4", "video/mp4");

    private final CourseMediaProperties properties;
    private final MinioClient minioClient;

    public TeachingResourceStorage(CourseMediaProperties properties) {
        this.properties = properties;
        this.minioClient = properties.isEnabled() && StringUtils.hasText(properties.getAccessKey())
                && StringUtils.hasText(properties.getSecretKey())
                ? MinioClient.builder().endpoint(properties.getEndpoint())
                        .credentials(properties.getAccessKey(), properties.getSecretKey()).build()
                : null;
    }

    public StoredFile upload(MultipartFile file) {
        if (file == null || file.isEmpty() || file.getSize() > MAX_BYTES) {
            throw new IllegalArgumentException("请选择不超过 50 MB 的文件");
        }
        String filename = file.getOriginalFilename();
        if (!StringUtils.hasText(filename)) {
            throw new IllegalArgumentException("文件名不能为空");
        }
        filename = filename.replace('\\', '/');
        filename = filename.substring(filename.lastIndexOf('/') + 1);
        if (filename.length() > 255 || filename.indexOf('\0') >= 0 || filename.isBlank()) {
            throw new IllegalArgumentException("文件名不合法");
        }
        int dot = filename.lastIndexOf('.');
        String extension = dot < 0 ? "" : filename.substring(dot + 1).toLowerCase(java.util.Locale.ROOT);
        String mime = TYPES.get(extension);
        if (mime == null) {
            throw new IllegalArgumentException("仅支持 PDF、DOCX、PPTX、PNG、JPG、MP4 文件");
        }
        try {
            byte[] header;
            try (var stream = file.getInputStream()) {
                header = stream.readNBytes(12);
            }
            if (!matchesSignature(extension, header)) {
                throw new IllegalArgumentException("文件内容与扩展名不匹配");
            }
        } catch (java.io.IOException error) {
            throw new IllegalArgumentException("无法读取上传文件", error);
        }
        String key = "teaching-resources/" + UUID.randomUUID() + "." + extension;
        try {
            client().putObject(PutObjectArgs.builder().bucket(properties.getBucket()).object(key)
                    .stream(file.getInputStream(), file.getSize(), -1L).contentType(mime).build());
            return new StoredFile(key, filename, mime, file.getSize());
        } catch (ResponseStatusException error) {
            throw error;
        } catch (Exception error) {
            log.error("教学资料上传 MinIO 失败", error);
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "资料存储暂不可用");
        }
    }

    public String downloadUrl(String objectKey) {
        try {
            return client().getPresignedObjectUrl(GetPresignedObjectUrlArgs.builder().method(Method.GET)
                    .bucket(properties.getBucket()).object(objectKey)
                    .expiry(Math.toIntExact(properties.getUrlTtl().toSeconds())).build());
        } catch (ResponseStatusException error) {
            throw error;
        } catch (Exception error) {
            log.error("生成教学资料下载地址失败", error);
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "资料存储暂不可用");
        }
    }

    public void removeQuietly(String objectKey) {
        try {
            client().removeObject(RemoveObjectArgs.builder().bucket(properties.getBucket()).object(objectKey).build());
        } catch (Exception error) {
            log.warn("清理未登记的教学资料对象失败：{}", objectKey, error);
        }
    }

    private MinioClient client() {
        if (minioClient == null) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "教学资料存储未启用或未配置密钥");
        }
        return minioClient;
    }

    private boolean matchesSignature(String extension, byte[] bytes) {
        if ("pdf".equals(extension)) return startsWith(bytes, new byte[]{'%', 'P', 'D', 'F', '-'});
        if ("png".equals(extension)) return startsWith(bytes, new byte[]{(byte) 0x89, 'P', 'N', 'G'});
        if ("jpg".equals(extension) || "jpeg".equals(extension)) {
            return startsWith(bytes, new byte[]{(byte) 0xff, (byte) 0xd8, (byte) 0xff});
        }
        if ("docx".equals(extension) || "pptx".equals(extension)) {
            return startsWith(bytes, new byte[]{'P', 'K', 3, 4});
        }
        return "mp4".equals(extension) && bytes.length >= 8
                && Arrays.equals(Arrays.copyOfRange(bytes, 4, 8), new byte[]{'f', 't', 'y', 'p'});
    }

    private boolean startsWith(byte[] bytes, byte[] signature) {
        return bytes.length >= signature.length
                && Arrays.equals(Arrays.copyOf(bytes, signature.length), signature);
    }

    public record StoredFile(String objectKey, String filename, String mimeType, long sizeBytes) {
    }
}
