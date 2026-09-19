package com.k12.platform.learning.service;

import com.k12.platform.learning.config.CourseMediaProperties;
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

import java.io.IOException;
import java.util.Arrays;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

/** 课程封面上传到 MinIO 的 course-assets/ 目录，数据库只存对象键。 */
@Component
public class CourseCoverStorage {
    private static final Logger log = LoggerFactory.getLogger(CourseCoverStorage.class);
    private static final long MAX_BYTES = 5L * 1024 * 1024;
    private static final Map<String, String> TYPES = Map.of(
            "png", "image/png", "jpg", "image/jpeg", "jpeg", "image/jpeg", "webp", "image/webp");

    private final CourseMediaProperties properties;
    private final MinioClient client;

    public CourseCoverStorage(CourseMediaProperties properties) {
        this.properties = properties;
        this.client = properties.isEnabled() && StringUtils.hasText(properties.getAccessKey())
                && StringUtils.hasText(properties.getSecretKey())
                ? MinioClient.builder().endpoint(properties.getEndpoint())
                    .credentials(properties.getAccessKey(), properties.getSecretKey()).build()
                : null;
    }

    public String upload(Long courseId, MultipartFile file) {
        if (file == null || file.isEmpty() || file.getSize() > MAX_BYTES) {
            throw new IllegalArgumentException("封面必须是非空且不超过 5 MB 的图片");
        }
        String original = file.getOriginalFilename();
        if (!StringUtils.hasText(original)) {
            throw new IllegalArgumentException("封面文件名不能为空");
        }
        String filename = original.replace('\\', '/');
        filename = filename.substring(filename.lastIndexOf('/') + 1);
        int dot = filename.lastIndexOf('.');
        String extension = dot < 0 ? "" : filename.substring(dot + 1).toLowerCase(Locale.ROOT);
        String mime = TYPES.get(extension);
        if (mime == null) {
            throw new IllegalArgumentException("封面仅支持 PNG、JPG、WEBP");
        }
        try (var stream = file.getInputStream()) {
            byte[] header = stream.readNBytes(12);
            if (!matches(extension, header)) {
                throw new IllegalArgumentException("封面内容与扩展名不匹配");
            }
        } catch (IOException error) {
            throw new IllegalArgumentException("无法读取封面文件", error);
        }
        String objectKey = CourseMediaUrlResolver.COURSE_ASSET_PREFIX + "covers/" + courseId + "/"
                + UUID.randomUUID() + "." + extension;
        return putImage(objectKey, file, mime, "课程封面");
    }

    /** 课程正文插图：写入 content/{courseId}/ 目录，返回对象键供解析为访问 URL。 */
    public String uploadContentImage(Long courseId, MultipartFile file) {
        if (file == null || file.isEmpty() || file.getSize() > MAX_BYTES) {
            throw new IllegalArgumentException("插图必须是非空且不超过 5 MB 的图片");
        }
        String original = file.getOriginalFilename();
        if (!StringUtils.hasText(original)) {
            throw new IllegalArgumentException("插图文件名不能为空");
        }
        String filename = original.replace('\\', '/');
        filename = filename.substring(filename.lastIndexOf('/') + 1);
        int dot = filename.lastIndexOf('.');
        String extension = dot < 0 ? "" : filename.substring(dot + 1).toLowerCase(Locale.ROOT);
        String mime = TYPES.get(extension);
        if (mime == null) {
            throw new IllegalArgumentException("插图仅支持 PNG、JPG、WEBP");
        }
        try (var stream = file.getInputStream()) {
            byte[] header = stream.readNBytes(12);
            if (!matches(extension, header)) {
                throw new IllegalArgumentException("插图内容与扩展名不匹配");
            }
        } catch (IOException error) {
            throw new IllegalArgumentException("无法读取插图文件", error);
        }
        String objectKey = CourseMediaUrlResolver.COURSE_ASSET_PREFIX + "content/" + courseId + "/"
                + UUID.randomUUID() + "." + extension;
        return putImage(objectKey, file, mime, "课程插图");
    }

    private String putImage(String objectKey, MultipartFile file, String mime, String label) {
        try {
            ensureBucket();
            client().putObject(PutObjectArgs.builder().bucket(properties.getBucket()).object(objectKey)
                    .stream(file.getInputStream(), file.getSize(), -1L).contentType(mime).build());
            return objectKey;
        } catch (ResponseStatusException error) {
            throw error;
        } catch (Exception error) {
            log.error("{}上传 MinIO 失败", label, error);
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, label + "存储暂不可用");
        }
    }

    private void ensureBucket() {
        try {
            String bucket = properties.getBucket();
            if (!client().bucketExists(io.minio.BucketExistsArgs.builder().bucket(bucket).build())) {
                client().makeBucket(io.minio.MakeBucketArgs.builder().bucket(bucket).build());
                log.info("已自动创建课程媒体 MinIO 桶: {}", bucket);
            }
        } catch (ResponseStatusException error) {
            throw error;
        } catch (Exception error) {
            log.error("检查/创建课程媒体 MinIO 桶失败: {}", properties.getBucket(), error);
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "课程封面存储桶不可用");
        }
    }

    public void removeQuietly(String objectKey) {
        if (!CourseMediaUrlResolver.isAllowedObjectKey(objectKey)) {
            return;
        }
        try {
            client().removeObject(RemoveObjectArgs.builder().bucket(properties.getBucket()).object(objectKey).build());
        } catch (Exception error) {
            log.warn("清理旧课程封面失败: {}", objectKey, error);
        }
    }

    private MinioClient client() {
        if (client == null) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "课程媒体存储未启用");
        }
        return client;
    }

    private static boolean matches(String extension, byte[] bytes) {
        return switch (extension) {
            case "png" -> startsWith(bytes, new byte[]{(byte) 0x89, 'P', 'N', 'G'});
            case "jpg", "jpeg" -> startsWith(bytes, new byte[]{(byte) 0xff, (byte) 0xd8, (byte) 0xff});
            case "webp" -> bytes.length >= 12
                    && startsWith(bytes, new byte[]{'R', 'I', 'F', 'F'})
                    && bytes[8] == 'W' && bytes[9] == 'E' && bytes[10] == 'B' && bytes[11] == 'P';
            default -> false;
        };
    }

    private static boolean startsWith(byte[] bytes, byte[] prefix) {
        if (bytes.length < prefix.length) return false;
        return Arrays.equals(Arrays.copyOf(bytes, prefix.length), prefix);
    }
}
