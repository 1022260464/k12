package com.k12.platform.learning.service;

import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * 正文插图：库中保留稳定 objectKey（data-object-key），对外返回时再签短时 URL。
 * 解决把 15 分钟 MinIO 签名地址直接写进 HTML 导致回显失败。
 */
@Component
public class CourseContentMediaRewriter {
    private static final Pattern IMG_TAG = Pattern.compile("(?is)<img\\b([^>]*?)>");
    private static final Pattern ATTR = Pattern.compile("(?is)([a-zA-Z_:][-a-zA-Z0-9_:.]*)\\s*=\\s*(\"([^\"]*)\"|'([^']*)'|([^\\s>]+))");
    private static final Pattern OBJECT_KEY_IN_URL = Pattern.compile(
            "(?i)(?:^|[?&#/=])(course-assets/(?:content|covers)/[0-9]+/[a-z0-9._-]+\\.(?:png|jpe?g|webp))"
    );

    private final CourseMediaUrlResolver mediaUrlResolver;

    public CourseContentMediaRewriter(CourseMediaUrlResolver mediaUrlResolver) {
        this.mediaUrlResolver = mediaUrlResolver;
    }

    /** 保存前：尽量从现有 src 提取 objectKey 写入 data-object-key。 */
    public String stampObjectKeys(String html) {
        if (!StringUtils.hasText(html) || !html.toLowerCase().contains("<img")) {
            return html == null ? "" : html;
        }
        Matcher matcher = IMG_TAG.matcher(html);
        StringBuffer out = new StringBuffer();
        while (matcher.find()) {
            String attrs = matcher.group(1);
            AttrMap map = parseAttrs(attrs);
            String key = firstNonBlank(map.get("data-object-key"), extractObjectKey(map.get("src")));
            if (StringUtils.hasText(key) && CourseMediaUrlResolver.isAllowedObjectKey(key)) {
                map.put("data-object-key", key);
            }
            matcher.appendReplacement(out, Matcher.quoteReplacement("<img" + map.render() + ">"));
        }
        matcher.appendTail(out);
        return out.toString();
    }

    /** 读取时：按 data-object-key / 旧 URL 中的 objectKey 刷新可访问 src。 */
    public String refreshImageUrls(String html) {
        if (!StringUtils.hasText(html) || !html.toLowerCase().contains("<img")) {
            return html == null ? "" : html;
        }
        Matcher matcher = IMG_TAG.matcher(html);
        StringBuffer out = new StringBuffer();
        while (matcher.find()) {
            String attrs = matcher.group(1);
            AttrMap map = parseAttrs(attrs);
            String key = firstNonBlank(map.get("data-object-key"), extractObjectKey(map.get("src")));
            if (StringUtils.hasText(key) && CourseMediaUrlResolver.isAllowedObjectKey(key)) {
                map.put("data-object-key", key);
                String fresh = mediaUrlResolver.resolve(key);
                if (StringUtils.hasText(fresh)) {
                    map.put("src", fresh);
                }
            }
            matcher.appendReplacement(out, Matcher.quoteReplacement("<img" + map.render() + ">"));
        }
        matcher.appendTail(out);
        return out.toString();
    }

    static String extractObjectKey(String src) {
        if (!StringUtils.hasText(src)) return null;
        String decoded;
        try {
            decoded = URLDecoder.decode(src, StandardCharsets.UTF_8);
        } catch (IllegalArgumentException error) {
            decoded = src;
        }
        Matcher matcher = OBJECT_KEY_IN_URL.matcher(decoded);
        if (matcher.find()) {
            return matcher.group(1);
        }
        // 兼容未编码、query 前的路径片段
        int idx = decoded.indexOf("course-assets/");
        if (idx >= 0) {
            String tail = decoded.substring(idx);
            int end = tail.length();
            for (int i = 0; i < tail.length(); i++) {
                char c = tail.charAt(i);
                if (c == '?' || c == '#' || c == '&' || c == '"') {
                    end = i;
                    break;
                }
            }
            String candidate = tail.substring(0, end);
            if (CourseMediaUrlResolver.isAllowedObjectKey(candidate)) {
                return candidate;
            }
        }
        return null;
    }

    private static String firstNonBlank(String a, String b) {
        if (StringUtils.hasText(a)) return a.trim();
        if (StringUtils.hasText(b)) return b.trim();
        return null;
    }

    private static AttrMap parseAttrs(String raw) {
        AttrMap map = new AttrMap();
        if (raw == null) return map;
        Matcher matcher = ATTR.matcher(raw);
        while (matcher.find()) {
            String name = matcher.group(1);
            String value = matcher.group(3);
            if (value == null) value = matcher.group(4);
            if (value == null) value = matcher.group(5);
            map.put(name, value);
        }
        return map;
    }

    /** 保持属性插入顺序的简易 map。 */
    static final class AttrMap {
        private final java.util.LinkedHashMap<String, String> values = new java.util.LinkedHashMap<>();

        void put(String name, String value) {
            if (name != null) {
                values.put(name.toLowerCase(java.util.Locale.ROOT), value == null ? "" : value);
            }
        }

        String get(String name) {
            return values.get(name.toLowerCase(java.util.Locale.ROOT));
        }

        String render() {
            StringBuilder sb = new StringBuilder();
            for (var entry : values.entrySet()) {
                sb.append(' ').append(entry.getKey()).append("=\"")
                        .append(escapeAttr(entry.getValue())).append('"');
            }
            return sb.toString();
        }

        private static String escapeAttr(String value) {
            return value.replace("&", "&amp;").replace("\"", "&quot;");
        }
    }
}
