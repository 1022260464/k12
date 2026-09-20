package com.k12.platform.learning.service;

import com.baomidou.mybatisplus.core.MybatisConfiguration;
import com.baomidou.mybatisplus.spring.MybatisSqlSessionFactoryBean;
import com.k12.platform.learning.dto.ChapterRequest;
import com.k12.platform.learning.dto.CourseRequest;
import com.k12.platform.learning.dto.SectionRequest;
import com.k12.platform.learning.config.LeaderboardProperties;
import com.k12.platform.learning.knowledgegraph.KnowledgeGraphService;
import org.apache.ibatis.session.SqlSessionFactory;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.mybatis.spring.annotation.MapperScan;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Import;
import org.springframework.core.io.ClassPathResource;
import org.springframework.core.io.support.PathMatchingResourcePatternResolver;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.jdbc.datasource.init.ResourceDatabasePopulator;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.test.context.junit.jupiter.SpringJUnitConfig;
import org.springframework.transaction.annotation.EnableTransactionManagement;
import org.springframework.web.server.ResponseStatusException;

import javax.sql.DataSource;
import java.util.Arrays;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.*;

/** 使用真实 Service 代理、MyBatis-Plus Mapper、XML SQL 和数据库事务，不依赖共享 MySQL。 */
@SpringJUnitConfig(CourseLearningIntegrationTest.Config.class)
class CourseLearningIntegrationTest {
    @Configuration
    @EnableTransactionManagement
    @EnableMethodSecurity
    @MapperScan("com.k12.platform.learning.mapper")
    @Import({CourseService.class, CourseAccessService.class, CourseChapterService.class, CourseSectionService.class,
            CoursePublicationService.class, CourseStudyService.class, LearningHistoryService.class, LearningLeaderboardService.class,
            LeaderboardProperties.class})
    static class Config {
        @Bean CourseMediaUrlResolver courseMediaUrlResolver() {
            return objectKey -> null;
        }

        @Bean KnowledgeGraphService knowledgeGraphService() {
            return Mockito.mock(KnowledgeGraphService.class);
        }

        @Bean DataSource dataSource() {
            var ds = new DriverManagerDataSource("jdbc:h2:mem:" + UUID.randomUUID() + ";MODE=MySQL;DB_CLOSE_DELAY=-1", "sa", "");
            new ResourceDatabasePopulator(new ClassPathResource("learning-schema.sql")).execute(ds);
            return ds;
        }
        @Bean SqlSessionFactory sqlSessionFactory(DataSource ds) throws Exception {
            var factory = new MybatisSqlSessionFactoryBean();
            factory.setDataSource(ds);
            var config = new MybatisConfiguration();
            config.setMapUnderscoreToCamelCase(true);
            factory.setConfiguration(config);
            factory.setMapperLocations(new PathMatchingResourcePatternResolver().getResources("classpath*:/mapper/**/*.xml"));
            return factory.getObject();
        }
        @Bean DataSourceTransactionManager transactionManager(DataSource ds) { return new DataSourceTransactionManager(ds); }
        @Bean JdbcTemplate jdbcTemplate(DataSource ds) { return new JdbcTemplate(ds); }
    }

    @Autowired CourseService courses;
    @Autowired CourseChapterService chapters;
    @Autowired CourseSectionService sections;
    @Autowired CoursePublicationService publication;
    @Autowired CourseStudyService study;
    @Autowired LearningHistoryService history;
    @Autowired LearningLeaderboardService leaderboard;
    @Autowired JdbcTemplate jdbc;
    private Long courseId;
    private Long chapterId;

    @BeforeEach
    void createCourse() {
        teacher(10L);
        courseId = courses.createCourse(new CourseRequest("数学 " + UUID.randomUUID(), "数学", "八年级", null)).id();
        chapterId = chapters.create(courseId, new ChapterRequest("第一章", "纯文本正文", 1)).id();
        publication.publish(courseId);
    }

    @AfterEach void clearIdentity() { SecurityContextHolder.clearContext(); }

    @Test
    @DisplayName("选课到进度闭环：重复选课幂等，乱序进度不倒退，退课后无法读正文")
    void enrollmentProgressAndWithdrawal() {
        student(20L);
        assertStatus(() -> chapters.list(courseId), HttpStatus.FORBIDDEN);
        study.enroll(courseId);
        study.enroll(courseId);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM learning_course_enrollment WHERE course_id=?", Integer.class, courseId)).isEqualTo(1);
        assertThat(chapters.list(courseId)).hasSize(1);
        assertThat(chapters.get(courseId, chapterId).content()).isEqualTo("纯文本正文");
        study.updateProgress(courseId, chapterId, 80);
        study.updateProgress(courseId, chapterId, 40);
        assertThat(study.progress(courseId).progressPercent()).isEqualTo(80);
        study.updateProgress(courseId, chapterId, 100);
        assertThat(study.progress(courseId).completedChapters()).isEqualTo(1);
        study.withdraw(courseId);
        study.withdraw(courseId);
        assertStatus(() -> study.progress(courseId), HttpStatus.FORBIDDEN);
        assertStatus(() -> chapters.list(courseId), HttpStatus.FORBIDDEN);
        study.enroll(courseId);
        assertThat(study.progress(courseId).progressPercent()).isEqualTo(100);
    }

    @Test
    @DisplayName("小节正文仅对课程教师和已报名学生可读，其他教师不能修改")
    void sectionAccessAndOwnership() {
        Long sectionId = sections.create(courseId, chapterId,
                new SectionRequest("第一节", "排序的基本概念", 1)).id();
        student(20L);
        assertStatus(() -> sections.list(courseId, chapterId), HttpStatus.FORBIDDEN);
        study.enroll(courseId);
        assertThat(sections.list(courseId, chapterId)).hasSize(1);
        assertThat(sections.get(courseId, chapterId, sectionId).content()).isEqualTo("排序的基本概念");
        teacher(11L);
        assertStatus(() -> sections.update(courseId, chapterId, sectionId,
                new SectionRequest("篡改", "内容", 1)), HttpStatus.FORBIDDEN);
        teacher(10L);
        sections.delete(courseId, chapterId, sectionId);
        assertThat(sections.list(courseId, chapterId)).isEmpty();
    }

    @Test
    @DisplayName("教师功能权限不等于数据权限，不能修改其他教师课程和章节")
    void teacherOwnershipEnforced() {
        teacher(11L);
        assertStatus(() -> courses.updateCourse(courseId, new CourseRequest("篡改", "数学", "八年级", null)), HttpStatus.FORBIDDEN);
        assertStatus(() -> courses.deleteCourse(courseId), HttpStatus.FORBIDDEN);
        assertStatus(() -> chapters.update(courseId, chapterId, new ChapterRequest("篡改", "正文", 1)), HttpStatus.FORBIDDEN);
        assertThat(courses.getCourse(courseId).orElseThrow().teacherId()).isEqualTo(10L);
        authenticate(99L, "ROLE_ADMIN");
        assertThat(chapters.list(courseId)).hasSize(1);
    }

    @Test
    @DisplayName("学生不能管理章节；章节编号不能跨课程伪造，失败事务不写进度")
    void permissionsAndCrossCourseChapter() {
        Long otherCourse = courses.createCourse(new CourseRequest("其他课程", "数学", "八年级", null)).id();
        // 旧数据允许已发布课程没有章节；本用例只验证跨课程章节隔离。
        jdbc.update("UPDATE learning_course SET status=1 WHERE id=?", otherCourse);
        student(20L);
        study.enroll(otherCourse);
        assertThatThrownBy(() -> chapters.create(courseId, new ChapterRequest("篡改", "正文", 1))).isInstanceOf(AccessDeniedException.class);
        assertStatus(() -> study.updateProgress(otherCourse, chapterId, 100), HttpStatus.NOT_FOUND);
        assertThat(study.progress(otherCourse).chapters()).isEmpty();
        assertThat(study.progress(otherCourse).progressPercent()).isZero();
        teacher(10L);
        assertStatus(() -> chapters.delete(otherCourse, chapterId), HttpStatus.NOT_FOUND);
    }

    @Test
    @DisplayName("不同学生的进度相互隔离；软删除章节不计入当前课程进度")
    void progressIsScopedAndDeletedChaptersExcluded() {
        student(20L);
        study.enroll(courseId);
        study.updateProgress(courseId, chapterId, 100);
        student(21L);
        study.enroll(courseId);
        assertThat(study.progress(courseId).progressPercent()).isZero();
        teacher(10L);
        chapters.delete(courseId, chapterId);
        student(20L);
        assertThat(study.progress(courseId).totalChapters()).isZero();
        assertStatus(() -> study.updateProgress(courseId, chapterId, 100), HttpStatus.NOT_FOUND);
    }

    @Test
    @DisplayName("分页参数绑定、教师范围和 SQL 注入文本按字面值检索")
    void searchUsesBoundParameters() {
        var result = courses.search(1, 1, null, "数学", "八年级", true);
        assertThat(result.items()).hasSize(1);
        assertThat(result.items().get(0).teacherId()).isEqualTo(10L);
        assertThat(courses.search(1, 10, "' OR 1=1 --", null, null, false).items()).isEmpty();
        teacher(11L);
        assertThat(courses.search(1, 10, null, null, null, true).items()).isEmpty();
        assertThatThrownBy(() -> courses.search(0, 10, null, null, null, false)).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    @DisplayName("课程逻辑删除后不能再选课或更新学习进度")
    void deletedCourseRejectsWrites() {
        courses.deleteCourse(courseId);
        student(20L);
        assertStatus(() -> study.enroll(courseId), HttpStatus.NOT_FOUND);
        assertStatus(() -> study.updateProgress(courseId, chapterId, 50), HttpStatus.NOT_FOUND);
    }

    @Test
    @DisplayName("更新课程可以清空简介且不改变教师归属")
    void clearDescriptionOnUpdate() {
        courses.updateCourse(courseId, new CourseRequest("更新课程", "数学", "八年级", "旧简介"));
        assertThat(courses.getCourse(courseId).orElseThrow().description()).isEqualTo("旧简介");
        var updated = courses.updateCourse(courseId, new CourseRequest("更新课程", "数学", "八年级", "  ")).orElseThrow();
        assertThat(updated.description()).isNull();
        assertThat(updated.teacherId()).isEqualTo(10L);
    }

    @Test
    @DisplayName("历史课程不自动认领，只有管理员可维护；新增章节重新计算总体进度")
    void legacyOwnershipAndCurrentChapterAggregate() {
        student(20L);
        study.enroll(courseId);
        study.updateProgress(courseId, chapterId, 100);
        jdbc.update("UPDATE learning_course SET teacher_id=NULL WHERE id=?", courseId);
        teacher(10L);
        assertStatus(() -> chapters.create(courseId, new ChapterRequest("第二章", "正文", 2)), HttpStatus.FORBIDDEN);
        assertStatus(() -> courses.deleteCourse(courseId), HttpStatus.FORBIDDEN);
        authenticate(99L, "ROLE_ADMIN");
        chapters.create(courseId, new ChapterRequest("第二章", "正文", 2));
        assertThat(courses.getCourse(courseId).orElseThrow().teacherId()).isNull();
        student(20L);
        assertThat(study.progress(courseId).progressPercent()).isEqualTo(50);
        assertThat(study.progress(courseId).totalChapters()).isEqualTo(2);
    }

    @Test
    @DisplayName("并发重复选课只有一条记录，并发乱序上报保留最大进度")
    void concurrentEnrollmentAndProgress() throws Exception {
        var executor = Executors.newFixedThreadPool(2);
        var ready = new CountDownLatch(2);
        var start = new CountDownLatch(1);
        try {
            var first = executor.submit(() -> concurrentStudy(ready, start, 30));
            var second = executor.submit(() -> concurrentStudy(ready, start, 90));
            assertThat(ready.await(5, TimeUnit.SECONDS)).isTrue();
            start.countDown();
            first.get(10, TimeUnit.SECONDS);
            second.get(10, TimeUnit.SECONDS);
            student(20L);
            assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM learning_course_enrollment WHERE course_id=?",
                    Integer.class, courseId)).isEqualTo(1);
            assertThat(study.progress(courseId).progressPercent()).isEqualTo(90);
        } finally {
            start.countDown();
            executor.shutdownNow();
            executor.awaitTermination(5, TimeUnit.SECONDS);
        }
    }

    @Test
    @DisplayName("学习排行榜从MySQL进度聚合，并标记当前用户")
    void leaderboardAggregatesChapterProgress() {
        student(920L);
        study.enroll(courseId);
        study.updateProgress(courseId, chapterId, 100);
        student(921L);
        study.enroll(courseId);
        study.updateProgress(courseId, chapterId, 60);

        student(920L);
        var result = leaderboard.leaderboard(100);
        var first = result.entries().stream()
                .filter(item -> item.userId().equals(920L))
                .findFirst()
                .orElseThrow();
        var second = result.entries().stream()
                .filter(item -> item.userId().equals(921L))
                .findFirst()
                .orElseThrow();

        assertThat(result.metric()).isEqualTo("chapter_progress_points");
        assertThat(first.learningPoints()).isEqualTo(100L);
        assertThat(first.currentUser()).isTrue();
        assertThat(second.learningPoints()).isEqualTo(60L);
        assertThat(first.rank()).isLessThan(second.rank());
    }

    @Test
    @DisplayName("学习历史使用单次聚合查询，并隔离用户、退课和软删除章节")
    void learningHistoryAggregatesCurrentUserProgress() {
        student(20L);
        study.enroll(courseId);
        study.updateProgress(courseId, chapterId, 80);

        student(21L);
        study.enroll(courseId);
        study.updateProgress(courseId, chapterId, 100);

        student(20L);
        var current = history.currentUserHistory(5);
        var currentCourse = current.items().stream()
                .filter(item -> item.courseId().equals(courseId))
                .findFirst()
                .orElseThrow();
        assertThat(currentCourse.progressPercent()).isEqualTo(80);
        assertThat(currentCourse.completedChapters()).isZero();
        assertThat(currentCourse.lastLearningTime()).isNotNull();

        study.withdraw(courseId);
        assertThat(history.currentUserHistory(20).items())
                .noneMatch(item -> item.courseId().equals(courseId));
        assertThatThrownBy(() -> history.currentUserHistory(21))
                .isInstanceOf(IllegalArgumentException.class);
    }

    private void concurrentStudy(CountDownLatch ready, CountDownLatch start, int percent) {
        student(20L);
        ready.countDown();
        try {
            if (!start.await(5, TimeUnit.SECONDS)) {
                throw new IllegalStateException("并发测试等待超时");
            }
            study.enroll(courseId);
            study.updateProgress(courseId, chapterId, percent);
        } catch (InterruptedException error) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException(error);
        } finally {
            SecurityContextHolder.clearContext();
        }
    }

    private void teacher(Long id) { authenticate(id, "ROLE_TEACHER", "course:read", "course:create", "course:update", "course:delete"); }
    private void student(Long id) { authenticate(id, "ROLE_STUDENT", "course:read"); }
    private void authenticate(Long id, String... authorities) {
        Jwt jwt = Jwt.withTokenValue("test").header("alg", "none").subject("user")
                .claim("userId", id.toString()).build();
        SecurityContextHolder.getContext().setAuthentication(new JwtAuthenticationToken(jwt,
                Arrays.stream(authorities).map(SimpleGrantedAuthority::new).toList()));
    }
    private void assertStatus(Runnable action, HttpStatus status) {
        assertThatThrownBy(action::run).isInstanceOfSatisfying(ResponseStatusException.class,
                error -> assertThat(error.getStatusCode()).isEqualTo(status));
    }
}
