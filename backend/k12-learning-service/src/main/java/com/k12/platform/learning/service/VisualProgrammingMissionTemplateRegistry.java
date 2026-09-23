package com.k12.platform.learning.service;

import com.k12.platform.learning.service.visualmission.VisualMissionTemplate;
import com.k12.platform.learning.service.visualmission.VisualMissionTemplateCode;
import org.springframework.stereotype.Component;

import java.util.Collection;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;

/** 任务模板注册表：未知模板直接拒绝，不做宽松回退。 */
@Component
public class VisualProgrammingMissionTemplateRegistry {
    private final Map<VisualMissionTemplateCode, VisualMissionTemplate> templates;

    public VisualProgrammingMissionTemplateRegistry(List<VisualMissionTemplate> implementations) {
        Map<VisualMissionTemplateCode, VisualMissionTemplate> map = new EnumMap<>(VisualMissionTemplateCode.class);
        for (VisualMissionTemplate template : implementations) {
            VisualMissionTemplate previous = map.put(template.code(), template);
            if (previous != null) {
                throw new IllegalStateException("重复注册任务模板: " + template.code());
            }
        }
        for (VisualMissionTemplateCode code : VisualMissionTemplateCode.values()) {
            if (!map.containsKey(code)) {
                throw new IllegalStateException("缺少任务模板实现: " + code);
            }
        }
        this.templates = Map.copyOf(map);
    }

    public VisualMissionTemplate require(VisualMissionTemplateCode code) {
        VisualMissionTemplate template = templates.get(code);
        if (template == null) {
            throw new IllegalArgumentException("不支持的任务模板: " + code);
        }
        return template;
    }

    public VisualMissionTemplate require(String templateCode) {
        return require(VisualMissionTemplateCode.require(templateCode));
    }

    public Collection<VisualMissionTemplate> all() {
        return templates.values();
    }
}
