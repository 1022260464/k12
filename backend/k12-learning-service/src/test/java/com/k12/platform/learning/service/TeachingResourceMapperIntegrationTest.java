package com.k12.platform.learning.service;

import com.k12.platform.learning.mapper.TeachingResourceEventMapper;
import com.k12.platform.learning.mapper.TeachingResourceMapper;
import com.k12.platform.learning.model.TeachingResource;
import com.k12.platform.learning.model.TeachingResourceEvent;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.junit.jupiter.SpringJUnitConfig;

import java.time.Instant;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

@SpringJUnitConfig(CourseLearningIntegrationTest.Config.class)
class TeachingResourceMapperIntegrationTest {
    @Autowired TeachingResourceMapper resources;
    @Autowired TeachingResourceEventMapper events;

    @Test
    void searchFiltersStatusAndOwnerAndReadsHistory() {
        TeachingResource resource = new TeachingResource();
        resource.setTitle("AI 通识 " + UUID.randomUUID());
        resource.setDescription("教学材料");
        resource.setStageCode("JUNIOR_HIGH");
        resource.setSubject("人工智能");
        resource.setSourceNote("团队原创");
        resource.setCourseId(8L);
        resource.setChapterId(12L);
        resource.setChapterTitle("数据集划分");
        resource.setGrade("八年级");
        resource.setTextbook("AI 通识");
        resource.setKnowledgeCode("machine_learning.datasets");
        resource.setOriginalFilename("guide.pdf");
        resource.setMimeType("application/pdf");
        resource.setSizeBytes(100L);
        resource.setObjectKey("teaching-resources/" + UUID.randomUUID() + ".pdf");
        resource.setStatus("PUBLISHED");
        resource.setRagIndexStatus("NOT_INDEXED");
        resource.setCreatedBy(42L);
        resource.setCreatedTime(Instant.now());
        resource.setUpdatedTime(Instant.now());
        resources.insert(resource);

        assertThat(resources.search(42L, "PUBLISHED", "AI 通识", 21, 0L))
                .extracting(TeachingResource::getId).contains(resource.getId());
        assertThat(resources.search(43L, "PUBLISHED", null, 21, 0L)).isEmpty();
        assertThat(resources.selectForUpdate(resource.getId()).getRagIndexStatus()).isEqualTo("NOT_INDEXED");
        assertThat(resources.selectById(resource.getId()).getKnowledgeCode()).isEqualTo("machine_learning.datasets");

        TeachingResourceEvent event = new TeachingResourceEvent();
        event.setResourceId(resource.getId());
        event.setActorId(42L);
        event.setAction("PUBLISH");
        event.setFromStatus("APPROVED");
        event.setToStatus("PUBLISHED");
        event.setCreatedTime(Instant.now());
        events.insert(event);
        assertThat(events.recent(resource.getId())).extracting(TeachingResourceEvent::getAction)
                .contains("PUBLISH");
    }
}
