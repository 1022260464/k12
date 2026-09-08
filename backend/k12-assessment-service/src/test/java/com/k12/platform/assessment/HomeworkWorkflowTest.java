package com.k12.platform.assessment;

import com.baomidou.mybatisplus.spring.MybatisSqlSessionFactoryBean;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.k12.platform.assessment.dto.*;
import com.k12.platform.assessment.mapper.*;
import com.k12.platform.assessment.service.HomeworkService;
import com.k12.platform.assessment.web.*;
import com.k12.platform.common.security.*;
import org.apache.ibatis.session.SqlSessionFactory;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.mybatis.spring.annotation.MapperScan;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.*;
import org.springframework.core.io.support.PathMatchingResourcePatternResolver;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.*;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.jwt.*;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.FilterChainProxy;
import org.springframework.test.context.junit.jupiter.SpringJUnitConfig;
import org.springframework.test.context.web.WebAppConfiguration;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.EnableTransactionManagement;
import org.springframework.web.context.WebApplicationContext;
import org.springframework.web.servlet.config.annotation.EnableWebMvc;
import org.springframework.web.server.ResponseStatusException;
import javax.sql.DataSource;
import java.math.BigDecimal;
import java.util.*;
import java.util.concurrent.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringJUnitConfig(HomeworkWorkflowTest.Config.class)
@WebAppConfiguration
@EnabledIfSystemProperty(named = "k12.test.mysql", matches = "true")
class HomeworkWorkflowTest {
    @Autowired HomeworkService service;
    @Autowired DataSource dataSource;
    @Autowired WebApplicationContext context;
    @Autowired FilterChainProxy security;
    JdbcTemplate jdbc;
    MockMvc mvc;

    static List<String> authorities(String token) {
        return token.startsWith("teacher")
                ? List.of("homework:read", "homework:create", "homework:update", "homework:delete", "homework:grade")
                : List.of("homework:read", "homework:submit");
    }
    static Jwt jwt(String token) {
        String userId = switch (token) {
            case "teacher" -> "11";
            case "teacher2" -> "12";
            case "student" -> "21";
            case "student2" -> "22";
            default -> throw new BadJwtException("Unknown test token");
        };
        return Jwt.withTokenValue(token).header("alg", "HS256").subject(token)
                .claim("userId", userId).claim("authorities", authorities(token)).build();
    }
    static void login(String token) {
        SecurityContextHolder.getContext().setAuthentication(new JwtAuthenticationToken(jwt(token),
                authorities(token).stream().map(SimpleGrantedAuthority::new).toList()));
    }
    @BeforeEach void before() {
        jdbc = new JdbcTemplate(dataSource);
        jdbc.update("DELETE FROM assessment_homework_grade_history WHERE id > 0");
        jdbc.update("DELETE FROM assessment_homework_submission WHERE id > 0");
        jdbc.update("DELETE FROM assessment_homework_recipient WHERE homework_id > 0");
        jdbc.update("DELETE FROM assessment_homework WHERE id > 0");
        mvc = MockMvcBuilders.webAppContextSetup(context).addFilters(security).build();
    }
    @AfterEach void after() { SecurityContextHolder.clearContext(); }
    Long published() {
        login("teacher");
        Long id = service.createHomework(new HomeworkRequest(1L, "Loops", "Explain a loop", "DRAFT")).id();
        service.setRecipients(id, new HomeworkRecipientsRequest(List.of(21L)));
        service.publish(id);
        SecurityContextHolder.clearContext();
        return id;
    }

    @Test void realHttpWorkflowAndFeedback() throws Exception {
        Long id = published();
        mvc.perform(post("/api/v1/assessments/homeworks/{id}/submit", id)
                .header("Authorization", "Bearer student").contentType("application/json")
                .content("{\"answerContent\":\"Check the loop boundary\"}"))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.data.studentUserId").value(21))
                .andExpect(jsonPath("$.data.status").value("SUBMITTED"));
        mvc.perform(post("/api/v1/assessments/homeworks/{id}/grade", id)
                .header("Authorization", "Bearer teacher").contentType("application/json")
                .content("{\"studentUserId\":21,\"score\":92.5,\"feedback\":\"Explain the stop condition\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.version").value(1));
        mvc.perform(get("/api/v1/assessments/homeworks/{id}/submissions/me", id)
                .header("Authorization", "Bearer student"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.score").value(92.5));
        mvc.perform(get("/api/v1/assessments/homeworks/learning-results/me")
                .header("Authorization", "Bearer student"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.total").value(1));
        assertEquals(1, jdbc.queryForObject("SELECT COUNT(*) FROM assessment_homework_grade_history", Integer.class));
    }

    @Test void rejectsAnonymousWrongRoleWrongOwnerAndOtherStudent() throws Exception {
        Long id = published();
        String path = "/api/v1/assessments/homeworks/" + id;
        mvc.perform(post(path + "/submit").contentType("application/json").content("{\"answerContent\":\"x\"}"))
                .andExpect(status().isUnauthorized());
        mvc.perform(post(path + "/submit").header("Authorization","Bearer student2")
                .contentType("application/json").content("{\"answerContent\":\"x\"}"))
                .andExpect(status().isNotFound());
        mvc.perform(get(path + "/submissions").header("Authorization","Bearer student"))
                .andExpect(status().isForbidden());
        mvc.perform(get(path + "/submissions").header("Authorization","Bearer teacher2"))
                .andExpect(status().isNotFound());
        mvc.perform(get(path).header("Authorization","Bearer student2")).andExpect(status().isNotFound());
    }

    @Test void stateValidationAndInputErrors() throws Exception {
        Long id = published();
        mvc.perform(post("/api/v1/assessments/homeworks/{id}/submit", id)
                .header("Authorization","Bearer student").contentType("application/json")
                .content("{\"answerContent\":\" \"}")).andExpect(status().isBadRequest());
        mvc.perform(post("/api/v1/assessments/homeworks/{id}/grade", id)
                .header("Authorization","Bearer teacher").contentType("application/json")
                .content("{\"studentUserId\":21,\"score\":101}")).andExpect(status().isBadRequest());
        login("teacher");
        assertEquals(409, assertThrows(ResponseStatusException.class, () -> service.updateHomework(id,
                new HomeworkRequest(1L, "Changed", "", "DRAFT"))).getStatusCode().value());
        service.close(id);
        login("student");
        assertEquals(409, assertThrows(ResponseStatusException.class, () -> service.submitHomework(id,
                new HomeworkSubmitRequest("answer"))).getStatusCode().value());
        assertThrows(ResponseStatusException.class, () -> service.myLearningResults(0, 101));
    }

    @Test void duplicateSubmissionsAreSerialized() throws Exception {
        Long id = published();
        ExecutorService executor = Executors.newFixedThreadPool(2);
        try {
            Callable<Integer> action = () -> {
                login("student");
                try { service.submitHomework(id, new HomeworkSubmitRequest("answer")); return 201; }
                catch (ResponseStatusException e) { return e.getStatusCode().value(); }
                finally { SecurityContextHolder.clearContext(); }
            };
            List<Future<Integer>> results = executor.invokeAll(List.of(action, action));
            List<Integer> statuses = new ArrayList<>();
            for (Future<Integer> result : results) statuses.add(result.get(10, TimeUnit.SECONDS));
            Collections.sort(statuses);
            assertEquals(List.of(201, 409), statuses);
            assertEquals(1, jdbc.queryForObject("SELECT COUNT(*) FROM assessment_homework_submission", Integer.class));
        } finally { executor.shutdownNow(); }
    }

    @Test void regradingNeedsCurrentVersionAndKeepsHistory() {
        Long id = published();
        login("student");
        service.submitHomework(id, new HomeworkSubmitRequest("answer"));
        login("teacher");
        service.gradeHomework(id, new HomeworkGradeRequest(21L, new BigDecimal("80"), "first", null));
        assertThrows(ResponseStatusException.class, () -> service.gradeHomework(id,
                new HomeworkGradeRequest(21L, new BigDecimal("90"), "stale", null)));
        var graded = service.gradeHomework(id, new HomeworkGradeRequest(21L, new BigDecimal("90"), "revised", 1));
        assertEquals(2, graded.version());
        assertEquals(2, service.gradeHistory(id, 21L).size());
        assertThrows(ResponseStatusException.class, () -> service.deleteHomework(id));
    }

    @Test void historyInsertFailureRollsBackScore() {
        Long id = published();
        login("student");
        Long submissionId = service.submitHomework(id, new HomeworkSubmitRequest("answer")).id();
        jdbc.update("INSERT INTO assessment_homework_grade_history(submission_id,version,score,graded_by) VALUES (?,1,50,11)", submissionId);
        login("teacher");
        assertThrows(org.springframework.dao.DuplicateKeyException.class, () -> service.gradeHomework(id,
                new HomeworkGradeRequest(21L, new BigDecimal("90"), "must roll back", null)));
        assertEquals("SUBMITTED", jdbc.queryForObject("SELECT status FROM assessment_homework_submission WHERE id = ?", String.class, submissionId));
        assertNull(jdbc.queryForObject("SELECT score FROM assessment_homework_submission WHERE id = ?", BigDecimal.class, submissionId));
    }

    @Configuration
    @EnableTransactionManagement
    @EnableMethodSecurity
    @EnableWebSecurity
    @EnableWebMvc
    @MapperScan("com.k12.platform.assessment.mapper")
    @Import({HomeworkService.class, HomeworkController.class, AssessmentExceptionHandler.class, K12MethodSecurityExceptionHandler.class})
    static class Config {
        @Bean DataSource dataSource() {
            DataSource ds = new DriverManagerDataSource("jdbc:mysql://127.0.0.1:33079/k12_business?useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=UTC", "root", "");
            String marker = new JdbcTemplate(ds).queryForObject("SELECT marker FROM codex_verification_guard WHERE id=1", String.class);
            if (!"isolated-01-07".equals(marker)) throw new IllegalStateException("Not an isolated verification database");
            return ds;
        }
        @Bean PlatformTransactionManager transactionManager(DataSource ds) { return new DataSourceTransactionManager(ds); }
        @Bean SqlSessionFactory sqlSessionFactory(DataSource ds) throws Exception {
            MybatisSqlSessionFactoryBean factory = new MybatisSqlSessionFactoryBean();
            factory.setDataSource(ds);
            factory.setMapperLocations(new PathMatchingResourcePatternResolver().getResources("classpath*:mapper/assessment/*.xml"));
            return factory.getObject();
        }
        @Bean ObjectMapper objectMapper() { return new ObjectMapper().findAndRegisterModules(); }
        @Bean JwtDecoder jwtDecoder() { return HomeworkWorkflowTest::jwt; }
        @Bean SecurityFilterChain securityFilterChain(HttpSecurity http, ObjectMapper mapper) throws Exception {
            return new K12ServletSecurityAutoConfiguration().securityFilterChain(http, new K12SecurityProperties(), mapper);
        }
    }
}
