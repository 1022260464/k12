package com.k12.platform.iam.service;

import com.baomidou.mybatisplus.spring.MybatisSqlSessionFactoryBean;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.k12.platform.common.security.*;
import com.k12.platform.iam.dto.*;
import com.k12.platform.iam.web.*;
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
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.jwt.*;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.security.web.*;
import org.springframework.test.context.junit.jupiter.SpringJUnitConfig;
import org.springframework.test.context.web.WebAppConfiguration;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.EnableTransactionManagement;
import org.springframework.web.context.WebApplicationContext;
import org.springframework.web.servlet.config.annotation.EnableWebMvc;
import javax.sql.DataSource;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringJUnitConfig(LearningProfileWorkflowTest.Config.class)
@WebAppConfiguration
@EnabledIfSystemProperty(named = "k12.test.mysql", matches = "true")
class LearningProfileWorkflowTest {
    @Autowired LearningProfileService profiles;
    @Autowired UserService users;
    @Autowired DataSource dataSource;
    @Autowired WebApplicationContext context;
    @Autowired FilterChainProxy security;
    JdbcTemplate jdbc;
    MockMvc mvc;
    static List<String> authorities(String token) {
        return token.equals("admin") ? List.of("ROLE_ADMIN") : List.of("learning-profile:read", "learning-profile:update");
    }
    static Jwt jwt(String token) {
        String id = switch (token) {
            case "admin" -> "90001";
            case "student" -> "90021";
            case "student2" -> "90022";
            default -> throw new BadJwtException("Unknown test token");
        };
        return Jwt.withTokenValue(token).header("alg","HS256").subject(token)
                .claim("userId",id).claim("authorities", authorities(token)).build();
    }
    static void login(String token) {
        SecurityContextHolder.getContext().setAuthentication(new JwtAuthenticationToken(jwt(token),
                authorities(token).stream().map(SimpleGrantedAuthority::new).toList()));
    }
    @BeforeEach void before() {
        jdbc = new JdbcTemplate(dataSource);
        jdbc.update("DELETE FROM sys_learning_profile WHERE user_id >= 90000");
        jdbc.update("DELETE FROM sys_user_role WHERE user_id >= 90000");
        jdbc.update("DELETE FROM sys_user WHERE id >= 90000");
        jdbc.update("INSERT INTO sys_user(id,username,password_hash,status,deleted) VALUES (90001,'test-admin','unused',1,0),(90021,'test-student','unused',1,0),(90022,'test-student2','unused',1,0)");
        mvc = MockMvcBuilders.webAppContextSetup(context).addFilters(security).build();
    }
    @AfterEach void after() { SecurityContextHolder.clearContext(); }

    @Test void profileUpsertUsesJwtIdentityAndAcceptsChinese() throws Exception {
        String path = "/api/v1/iam/users/me/learning-profile";
        mvc.perform(put(path).header("Authorization","Bearer student").contentType("application/json")
                .content("{\"schoolStage\":\"PRIMARY_LOWER\",\"grade\":2,\"textbook\":\"人工智能\",\"interests\":[\"编程\",\"绘本\"],\"userId\":90022}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.userId").value(90021))
                .andExpect(jsonPath("$.data.interests[0]").value("编程"));
        mvc.perform(get(path).header("Authorization","Bearer student2")).andExpect(status().isNotFound());
        login("student");
        profiles.updateMine(new LearningProfileRequest("JUNIOR_HIGH", 8, null, List.of("code")));
        assertEquals(8, profiles.getMine().grade());
        assertEquals(1, jdbc.queryForObject("SELECT COUNT(*) FROM sys_learning_profile WHERE user_id=90021",Integer.class));
    }

    @Test void rejectsInconsistentStageAndAnonymous() throws Exception {
        String path = "/api/v1/iam/users/me/learning-profile";
        mvc.perform(get(path)).andExpect(status().isUnauthorized());
        mvc.perform(put(path).header("Authorization","Bearer student").contentType("application/json")
                .content("{\"schoolStage\":\"PRIMARY_LOWER\",\"grade\":10,\"interests\":[]}"))
                .andExpect(status().isBadRequest());
        mvc.perform(put(path).header("Authorization","Bearer student").contentType("application/json")
                .content("{\"schoolStage\":\"UNKNOWN\",\"grade\":2,\"interests\":[]}"))
                .andExpect(status().isBadRequest());
        assertEquals(0,jdbc.queryForObject("SELECT COUNT(*) FROM sys_learning_profile",Integer.class));
    }

    @Test void userCrudAndPublicRegistrationStayStudentOnly() {
        var registered = users.registerStudent(new RegisterRequest("test-register", "test-pass-123", "Student", "test-register@example.com"));
        assertEquals("ROLE_STUDENT", registered.roleCode());
        String hash = jdbc.queryForObject("SELECT password_hash FROM sys_user WHERE id = ?",String.class,registered.id());
        assertTrue(new BCryptPasswordEncoder().matches("test-pass-123",hash));
        login("admin");
        assertTrue(users.getUser(registered.id()).isPresent());
        users.updateUser(registered.id(), new UserUpdateRequest("test-register", "Updated", "test-register@example.com", "ROLE_STUDENT"));
        assertEquals("Updated",users.getUser(registered.id()).orElseThrow().nickname());
        assertTrue(users.deleteUser(registered.id()));
        assertTrue(users.getUser(registered.id()).isEmpty());
    }

    @Test void failedRoleAssignmentRollsBackUserAndStudentCannotCreateAdmin() {
        login("admin");
        assertThrows(IllegalArgumentException.class, () -> users.createUser(
                new UserCreateRequest("test-invalid","test-pass-123","x",null,"ROLE_MISSING")));
        assertEquals(0,jdbc.queryForObject("SELECT COUNT(*) FROM sys_user WHERE username='test-invalid'",Integer.class));
        login("student");
        assertThrows(org.springframework.security.access.AccessDeniedException.class, () -> users.createUser(
                new UserCreateRequest("test-admin-bad","test-pass-123","x",null,"ROLE_ADMIN")));
    }

    @Configuration
    @EnableTransactionManagement
    @EnableMethodSecurity
    @EnableWebSecurity
    @EnableWebMvc
    @MapperScan("com.k12.platform.iam.mapper")
    @Import({LearningProfileService.class, UserService.class, LearningProfileController.class,
            UserController.class, IamExceptionHandler.class, K12MethodSecurityExceptionHandler.class})
    static class Config {
        @Bean DataSource dataSource() {
            DataSource ds = new DriverManagerDataSource("jdbc:mysql://127.0.0.1:33079/k12_auth?useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=UTC","root","");
            String marker = new JdbcTemplate(ds).queryForObject("SELECT marker FROM codex_verification_guard WHERE id=1", String.class);
            if (!"isolated-01-07".equals(marker)) throw new IllegalStateException("Not an isolated verification database");
            return ds;
        }
        @Bean PlatformTransactionManager transactionManager(DataSource ds) { return new DataSourceTransactionManager(ds); }
        @Bean SqlSessionFactory sqlSessionFactory(DataSource ds) throws Exception {
            MybatisSqlSessionFactoryBean factory = new MybatisSqlSessionFactoryBean();
            factory.setDataSource(ds);
            factory.setMapperLocations(new PathMatchingResourcePatternResolver().getResources("classpath*:mapper/iam/*.xml"));
            return factory.getObject();
        }
        @Bean ObjectMapper objectMapper() { return new ObjectMapper().findAndRegisterModules(); }
        @Bean PasswordEncoder passwordEncoder() { return new BCryptPasswordEncoder(); }
        @Bean JwtDecoder jwtDecoder() { return LearningProfileWorkflowTest::jwt; }
        @Bean SecurityFilterChain securityFilterChain(HttpSecurity http, ObjectMapper mapper) throws Exception {
            return new K12ServletSecurityAutoConfiguration().securityFilterChain(http,new K12SecurityProperties(),mapper);
        }
    }
}
