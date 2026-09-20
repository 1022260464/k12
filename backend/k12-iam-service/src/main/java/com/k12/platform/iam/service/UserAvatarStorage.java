package com.k12.platform.iam.service;

import com.k12.platform.iam.config.IamMediaProperties;
import io.minio.BucketExistsArgs;
import io.minio.GetPresignedObjectUrlArgs;
import io.minio.Http.Method;
import io.minio.MakeBucketArgs;
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
import java.util.concurrent.TimeUnit;

/** 用户头像上传到 MinIO 的 user-avatars/ 目录。 */
@Component
public class UserAvatarStorage {
    public static final String AVATAR_PREFIX = "user-avatars/";

    private static final Logger log = LoggerFactory.getLogger(UserAvatarStorage.class);
    private static final long MAX_BYTES = 2L * 1024 * 1024;
    private static final Map<String, String> TYPES = Map.of(
            "png", "image/png", "jpg", "image/jpeg", "jpeg", "image/jpeg", "webp", "image/webp");

    private final IamMediaProperties properties;
    private final MinioClient client;

    public UserAvatarStorage(IamMediaProperties properties) {
        this.properties = properties;
        this.client = properties.isEnabled() && StringUtils.hasText(properties.getAccessKey())
                && StringUtils.hasText(properties.getSecretKey())
                ? MinioClient.builder().endpoint(properties.getEndpoint())
                    .credentials(properties.getAccessKey(), properties.getSecretKey()).build()
                : null;
    }

    public String upload(Long userId, MultipartFile file) {
        if (file == null || file.isEmpty() || file.getSize() > MAX_BYTES) {
            throw new IllegalArgumentException("头像必须是非空且不超过 2 MB 的图片");
        }
        String original = file.getOriginalFilename();
        if (!StringUtils.hasText(original)) {
            throw new IllegalArgumentException("头像文件名不能为空");
        }
        String filename = original.replace('\\', '/');
        filename = filename.substring(filename.lastIndexOf('/') + 1);
        int dot = filename.lastIndexOf('.');
        String extension = dot < 0 ? "" : filename.substring(dot + 1).toLowerCase(Locale.ROOT);
        String mime = TYPES.get(extension);
        if (mime == null) {
            throw new IllegalArgumentException("头像仅支持 PNG、JPG、WEBP");
        }
        try (var stream = file.getInputStream()) {
            byte[] header = stream.readNBytes(12);
            if (!matches(extension, header)) {
                throw new IllegalArgumentException("头像内容与扩展名不匹配");
            }
        } catch (IOException error) {
            throw new IllegalArgumentException("无法读取头像文件", error);
        }
        String objectKey = AVATAR_PREFIX + userId + "/" + UUID.randomUUID() + "." + extension;
        try {
            ensureBucket();
            client().putObject(PutObjectArgs.builder().bucket(properties.getBucket()).object(objectKey)
                    .stream(file.getInputStream(), file.getSize(), -1L).contentType(mime).build());
            return objectKey;
        } catch (ResponseStatusException error) {
            throw error;
        } catch (Exception error) {
            log.error("用户头像上传 MinIO 失败", error);
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "头像暂时无法上传，请稍后再试");
        }
    }

    public String resolveUrl(String objectKey) {
        if (!isAllowedObjectKey(objectKey)) {
            return null;
        }
        try {
            String url = client().getPresignedObjectUrl(GetPresignedObjectUrlArgs.builder()
                    .method(Method.GET)
                    .bucket(properties.getBucket())
                    .object(objectKey)
                    .expiry((int) Math.max(60, properties.getUrlTtl().toSeconds()), TimeUnit.SECONDS)
                    .build());
            String publicEndpoint = properties.resolvePublicEndpoint();
            if (StringUtils.hasText(publicEndpoint) && !publicEndpoint.equals(properties.getEndpoint())) {
                return url.replace(properties.getEndpoint(), publicEndpoint);
            }
            return url;
        } catch (Exception error) {
            log.warn("生成头像访问地址失败: {}", objectKey, error);
            return null;
        }
    }

    public void removeQuietly(String objectKey) {
        if (!isAllowedObjectKey(objectKey)) {
            return;
        }
        try {
            client().removeObject(RemoveObjectArgs.builder().bucket(properties.getBucket()).object(objectKey).build());
        } catch (Exception error) {
            log.warn("清理旧头像失败: {}", objectKey, error);
        }
    }

    public static boolean isAllowedObjectKey(String objectKey) {
        return StringUtils.hasText(objectKey)
                && objectKey.startsWith(AVATAR_PREFIX)
                && !objectKey.startsWith("/")
                && !objectKey.contains("\\")
                && !objectKey.contains("../");
    }

    private void ensureBucket() {
        try {
            String bucket = properties.getBucket();
            if (!client().bucketExists(BucketExistsArgs.builder().bucket(bucket).build())) {
                client().makeBucket(MakeBucketArgs.builder().bucket(bucket).build());
                log.info("已自动创建用户头像 MinIO 桶: {}", bucket);
            }
        } catch (ResponseStatusException error) {
            throw error;
        } catch (Exception error) {
            log.error("检查/创建头像 MinIO 桶失败: {}", properties.getBucket(), error);
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "头像暂时无法上传，请稍后再试");
        }
    }

    private MinioClient client() {
        if (client == null) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "头像暂时无法上传，请稍后再试");
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
