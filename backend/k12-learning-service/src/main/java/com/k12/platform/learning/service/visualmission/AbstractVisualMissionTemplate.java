package com.k12.platform.learning.service.visualmission;

import com.fasterxml.jackson.databind.JsonNode;
import com.k12.platform.learning.dto.VisualProgrammingEvaluationResponse;

import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;

/** 模板公共校验与 Blockly JSON 解析辅助。 */
abstract class AbstractVisualMissionTemplate implements VisualMissionTemplate {
    private static final Pattern SAFE_ID = Pattern.compile("^[a-z0-9-]{1,32}$");
    private static final Pattern SAFE_CATEGORY = Pattern.compile("^[a-z]{1,16}$");
    private static final Pattern SAFE_KEYWORD = Pattern.compile("^[^\\p{Cntrl}]{1,40}$");
    private static final Set<String> SHADOW_TYPES = Set.of("math_number");

    @Override
    public final Set<String> configFields() {
        return allowedConfigFields();
    }

    @Override
    public final void validateConfig(JsonNode config) {
        if (config == null || !config.isObject()) {
            throw new IllegalArgumentException("模板配置必须是 JSON 对象");
        }
        Set<String> allowed = allowedConfigFields();
        Iterator<String> names = config.fieldNames();
        while (names.hasNext()) {
            String name = names.next();
            if (!allowed.contains(name)) {
                throw new IllegalArgumentException("模板配置包含未声明字段: " + name);
            }
        }
        validateKnownConfig(config);
    }

    protected abstract Set<String> allowedConfigFields();

    protected abstract void validateKnownConfig(JsonNode config);

    protected void requireTextField(JsonNode config, String field, Pattern pattern, String label) {
        if (!config.has(field) || !config.get(field).isTextual()) {
            throw new IllegalArgumentException(label + "必须是字符串");
        }
        String value = config.get(field).asText();
        if (!pattern.matcher(value).matches()) {
            throw new IllegalArgumentException(label + "格式不正确");
        }
    }

    protected void requireIntRange(JsonNode config, String field, int min, int max, String label) {
        if (!config.has(field) || !config.get(field).canConvertToInt()) {
            throw new IllegalArgumentException(label + "必须是整数");
        }
        int value = config.get(field).asInt();
        if (value < min || value > max) {
            throw new IllegalArgumentException(label + "必须在 " + min + " 到 " + max + " 之间");
        }
    }

    protected void requireBoolean(JsonNode config, String field, String label) {
        if (!config.has(field) || !config.get(field).isBoolean()) {
            throw new IllegalArgumentException(label + "必须是布尔值");
        }
    }

    protected void requireImageId(JsonNode config) {
        requireTextField(config, "imageId", SAFE_ID, "图片 ID");
    }

    protected void requireCategory(JsonNode config, String field, String label) {
        requireTextField(config, field, SAFE_CATEGORY, label);
    }

    protected void requireKeyword(JsonNode config) {
        requireTextField(config, "messageKeyword", SAFE_KEYWORD, "消息关键词");
    }

    protected void requireStringArray(JsonNode config, String field, int minSize, int maxSize,
                                      Pattern itemPattern, String label) {
        JsonNode array = config.get(field);
        if (array == null || !array.isArray() || array.size() < minSize || array.size() > maxSize) {
            throw new IllegalArgumentException(label + "数量不合法");
        }
        for (JsonNode item : array) {
            if (!item.isTextual() || !itemPattern.matcher(item.asText()).matches()) {
                throw new IllegalArgumentException(label + "项格式不正确");
            }
        }
    }

    protected Map<String, Object> pick(JsonNode config, String... fields) {
        java.util.LinkedHashMap<String, Object> result = new java.util.LinkedHashMap<>();
        for (String field : fields) {
            if (!config.has(field)) continue;
            JsonNode value = config.get(field);
            if (value.isTextual()) result.put(field, value.asText());
            else if (value.isIntegralNumber()) result.put(field, value.asInt());
            else if (value.isBoolean()) result.put(field, value.asBoolean());
            else if (value.isArray() || value.isObject()) result.put(field, value);
        }
        return result;
    }

    protected List<JsonNode> connectedProgram(JsonNode workspace) {
        JsonNode blocks = workspace.path("blocks").path("blocks");
        if (!blocks.isArray()) return List.of();
        List<JsonNode> starts = new ArrayList<>();
        blocks.forEach(block -> {
            if (type(block).equals("k12_when_start")) starts.add(block);
        });
        if (starts.size() != 1) return List.of();
        JsonNode first = starts.get(0).path("next").path("block");
        return first.isMissingNode() ? List.of() : List.of(first);
    }

    protected List<JsonNode> flatten(List<JsonNode> roots) {
        List<JsonNode> result = new ArrayList<>();
        for (JsonNode root : roots) appendBlockTree(root, result);
        return result;
    }

    protected void appendBlockTree(JsonNode block, List<JsonNode> result) {
        if (block == null || block.isMissingNode() || block.isNull() || result.size() >= 100) return;
        result.add(block);
        JsonNode inputs = block.path("inputs");
        if (inputs.isObject()) {
            inputs.fields().forEachRemaining(entry -> appendBlockTree(inputBlock(block, entry.getKey()), result));
        }
        appendBlockTree(block.path("next").path("block"), result);
    }

    protected JsonNode inputBlock(JsonNode block, String inputName) {
        if (block == null) return null;
        JsonNode input = block.path("inputs").path(inputName);
        JsonNode child = input.path("block");
        if (!child.isMissingNode()) return child;
        JsonNode shadow = input.path("shadow");
        return shadow.isMissingNode() ? null : shadow;
    }

    protected int firstIndex(List<JsonNode> blocks, String expectedType) {
        for (int index = 0; index < blocks.size(); index++) {
            if (type(blocks.get(index)).equals(expectedType)) return index;
        }
        return -1;
    }

    protected String type(JsonNode block) {
        return block == null ? "" : block.path("type").asText("");
    }

    protected String field(JsonNode block, String name) {
        return block == null ? "" : block.path("fields").path(name).asText("");
    }

    protected int numberField(JsonNode block, String name, int fallback) {
        if (block == null) return fallback;
        return block.path("fields").path(name).asInt(fallback);
    }

    protected VisualProgrammingEvaluationResponse result(List<VisualProgrammingEvaluationResponse.Check> checks) {
        int stars = (int) checks.stream().filter(VisualProgrammingEvaluationResponse.Check::passed).count();
        return new VisualProgrammingEvaluationResponse(stars == checks.size(), Math.min(3, stars), checks);
    }

    protected VisualProgrammingEvaluationResponse.Check check(String id, String label, boolean passed) {
        return new VisualProgrammingEvaluationResponse.Check(id, label, passed);
    }

    /** 收集工作区全部 block type（含影子积木），用于白名单校验。 */
    @Override
    public Set<String> collectBlockTypes(JsonNode workspace) {
        java.util.HashSet<String> types = new java.util.HashSet<>();
        JsonNode blocks = workspace.path("blocks").path("blocks");
        if (!blocks.isArray()) return types;
        blocks.forEach(block -> collectTypes(block, types));
        return types;
    }

    private void collectTypes(JsonNode block, Set<String> types) {
        if (block == null || block.isMissingNode() || block.isNull()) return;
        String type = type(block);
        if (!type.isBlank()) types.add(type);
        JsonNode inputs = block.path("inputs");
        if (inputs.isObject()) {
            inputs.fields().forEachRemaining(entry -> {
                collectTypes(entry.getValue().path("block"), types);
                collectTypes(entry.getValue().path("shadow"), types);
            });
        }
        collectTypes(block.path("next").path("block"), types);
    }

    protected Set<String> withShadows(Set<String> types) {
        java.util.HashSet<String> result = new java.util.HashSet<>(types);
        result.addAll(SHADOW_TYPES);
        return Set.copyOf(result);
    }

    protected static Pattern safeId() {
        return SAFE_ID;
    }

    protected static Pattern safeCategory() {
        return SAFE_CATEGORY;
    }
}
