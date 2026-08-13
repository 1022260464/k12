# Java Data Object Guide

这份笔记用于统一 K12 后端项目里数据对象的写法，重点说明 `record`、Lombok `@Getter/@Setter`、`@Data` 该怎么选。

## 总结规则

当前项目采用以下约定：

```text
请求 DTO        用 record
响应 DTO        用 record
数据库实体       用 class + @Getter/@Setter
MyBatis 查询模型 用 class + @Getter/@Setter
配置属性类       用 class + @Getter/@Setter
不要默认使用     @Data
```

一句话：

```text
只传数据、不需要 setter 的对象，用 record。
需要框架反射赋值、数据库映射、配置绑定的对象，用 class + @Getter/@Setter。
```

## record

`record` 是 Java 原生的数据类语法，适合表达不可变的数据传输对象。

示例：

```java
public record UserCreateRequest(
        String username,
        String password,
        String nickname,
        String email,
        String roleCode
) {
}
```

Java 会自动生成：

```text
构造方法
字段
username()
password()
nickname()
email()
roleCode()
equals()
hashCode()
toString()
```

注意：record 的 getter 不是 `getUsername()`，而是：

```
request.username();
```

### 适合用 record 的场景

```text
Controller 请求入参
Controller 响应结果
服务之间传输的简单数据
不需要修改字段的临时数据
```

项目示例：

```text
UserCreateRequest
UserUpdateRequest
UserResponse
CourseRequest
CourseResponse
```

推荐写法：

```java
public record CourseResponse(
        Long id,
        String title,
        String subject,
        String gradeLevel
) {
}
```

### 不适合用 record 的场景

```text
MyBatis-Plus 数据库实体
MyBatis XML 查询结果模型
Spring @ConfigurationProperties 配置绑定类
需要 setter 的对象
需要框架回填字段的对象
```

原因是这些框架通常更适合 JavaBean：

```text
无参构造
getter
setter
```

## @Getter / @Setter

`@Getter` 和 `@Setter` 是 Lombok 注解，用来生成 getter 和 setter。

示例：

```java
@Getter
@Setter
@TableName("sys_user")
public class SysUser {

    @TableId(type = IdType.AUTO)
    private Long id;

    private String username;
    private String passwordHash;
}
```

等价于手写：

```java
public Long getId() {
    return id;
}

public void setId(Long id) {
    this.id = id;
}
```

### 适合用 @Getter/@Setter 的场景

```text
MyBatis-Plus Entity
MyBatis XML resultMap 查询模型
Spring @ConfigurationProperties 配置类
需要框架反射赋值的 JavaBean
```

项目示例：

```text
SysUser
AuthUser
UserAccount
Course
TeachingAgent
Homework
K12SecurityProperties
```

### 为什么数据库实体用 class + @Getter/@Setter

以 `SysUser` 为例：

```java
@Getter
@Setter
@TableName("sys_user")
public class SysUser {
    @TableId(type = IdType.AUTO)
    private Long id;
    private String username;
    private String passwordHash;
}
```

原因：

```text
MyBatis-Plus 插入数据后要回填 id
MyBatis 查询结果要 set 字段
逻辑删除字段 deleted 需要框架处理
数据库实体可能会被逐步赋值
```

这些都更适合可变 JavaBean。

## @Data

`@Data` 也是 Lombok 注解，但它是一个全家桶。

它会自动生成：

```text
getter
setter
toString
equals
hashCode
requiredArgsConstructor
```

示例：

```java
@Data
public class SysUser {
    private Long id;
    private String username;
    private String passwordHash;
}
```

当前项目不推荐默认使用 `@Data`。

### 为什么不默认用 @Data

#### 1. 可能把敏感字段打印到日志

`@Data` 会生成 `toString()`。

如果实体里有：

```java
private String passwordHash;
```

日志里可能出现：

```text
SysUser(id=1, username=admin, passwordHash=$2a$10$...)
```

密码哈希虽然不是明文，但也不应该随便打印。

#### 2. equals/hashCode 可能不符合数据库实体语义

`@Data` 生成的 `equals()` 和 `hashCode()` 默认会把所有字段算进去。

数据库实体经常会变化：

```text
插入前 id = null
插入后 id = 1
```

如果对象已经放进 `HashSet` 或作为 `HashMap` key，`id` 改变可能导致查找异常。

#### 3. 关联对象可能递归

如果后续出现双向关系：

```java
class User {
    private List<Role> roles;
}

class Role {
    private List<User> users;
}
```

`toString()`、`equals()` 可能互相调用，导致递归。

### 什么时候可以用 @Data

只有在对象非常简单，并且你确认需要 `toString/equals/hashCode` 时再考虑。

当前项目默认不要用。

更推荐：

```
@Getter
@Setter
```

如果确实需要 `toString()`，可以显式写：

```java
@Getter
@Setter
@ToString(exclude = "passwordHash")
public class SysUser {
    private String passwordHash;
}
```

## DTO / VO / Entity / Query

### DTO

DTO 是数据传输对象，主要用于接口请求和响应。

推荐用 `record`。

```java
public record UserUpdateRequest(
        String username,
        String nickname,
        String email,
        String roleCode
) {
}
```

命名建议：

```text
XxxCreateRequest
XxxUpdateRequest
XxxResponse
XxxQueryRequest
```

### VO

VO 是视图对象，偏向页面展示。

早期项目可以先不单独建 `vo` 包，直接用 `XxxResponse`。

例如：

```text
UserResponse
CourseResponse
HomeworkResponse
```

等页面展示逻辑复杂后，再考虑拆：

```text
vo/UserPageVO
vo/CourseDetailVO
```

### Entity / Model

Entity 或 Model 对应数据库表或数据库查询模型。

推荐用 `class + @Getter/@Setter`。

```java
@Getter
@Setter
@TableName("learning_course")
public class Course {
    @TableId(type = IdType.AUTO)
    private Long id;
    private String title;
}
```

### Query

Query 用于复杂查询条件。

简单查询可以先用 `record`。

```java
public record UserQueryRequest(
        String keyword,
        String roleCode,
        Integer pageNo,
        Integer pageSize
) {
}
```

## 项目推荐写法

### 创建请求

```java
public record UserCreateRequest(
        @NotBlank String username,
        @NotBlank @Size(min = 8, max = 72) String password,
        @NotBlank String nickname,
        @Email String email,
        @NotBlank String roleCode
) {
}
```

原因：

```text
请求参数只读
Controller 接收后交给 Service
不需要 setter
```

### 响应对象

```java
public record UserResponse(
        Long id,
        String username,
        String nickname,
        String email,
        String roleCode,
        String status
) {
}
```

原因：

```text
响应对象只是包装返回数据
不需要后续修改字段
```

### 数据库实体

```java
@Getter
@Setter
@TableName("sys_user")
public class SysUser {

    @TableId(type = IdType.AUTO)
    private Long id;

    private String username;
    private String passwordHash;
    private String nickname;
    private String email;
}
```

原因：

```text
MyBatis-Plus 需要回填 id
MyBatis 查询需要 setter
实体字段可能被逐步设置
```

### MyBatis 查询模型

```java
@Getter
@Setter
public class UserAccount {
    private Long id;
    private String username;
    private String roleCode;
}
```

原因：

```text
XML resultMap 会通过 setter 填充字段
不是接口请求 DTO
不是数据库单表实体
```

## 判断口诀

看到一个新对象，按这个顺序判断：

```text
1. 是接口请求或响应吗？
   是：优先 record

2. 是数据库表实体吗？
   是：class + @Getter/@Setter

3. 是 MyBatis XML 查询结果吗？
   是：class + @Getter/@Setter

4. 是 Spring 配置绑定类吗？
   是：class + @Getter/@Setter

5. 只是 Service 内部临时传数据吗？
   简单不可变：record
   复杂可变：class + @Getter/@Setter
```

## 当前项目约定

```text
dto 包：
  record

model 包里的数据库实体：
  class + @Getter/@Setter

model 包里的 MyBatis 查询模型：
  class + @Getter/@Setter

common security 配置属性：
  class + @Getter/@Setter

默认不使用：
  @Data
```
