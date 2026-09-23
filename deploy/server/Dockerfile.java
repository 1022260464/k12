# syntax=docker/dockerfile:1.7
ARG MAVEN_IMAGE=maven:3.9.9-eclipse-temurin-17
ARG JAVA_IMAGE=eclipse-temurin:17-jre-jammy

FROM ${MAVEN_IMAGE} AS builder
ARG SERVICE
WORKDIR /workspace

COPY backend/pom.xml ./pom.xml
COPY backend/k12-common/pom.xml ./k12-common/pom.xml
COPY backend/k12-gateway-service/pom.xml ./k12-gateway-service/pom.xml
COPY backend/k12-iam-service/pom.xml ./k12-iam-service/pom.xml
COPY backend/k12-learning-service/pom.xml ./k12-learning-service/pom.xml
COPY backend/k12-agent-service/pom.xml ./k12-agent-service/pom.xml
COPY backend/k12-assessment-service/pom.xml ./k12-assessment-service/pom.xml
RUN mvn -B -pl "${SERVICE}" -am dependency:go-offline

COPY backend/ ./
RUN mvn -B -pl "${SERVICE}" -am package -DskipTests \
    && cp "${SERVICE}"/target/"${SERVICE}"-*.jar /tmp/app.jar

FROM ${JAVA_IMAGE}
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --system k12 \
    && useradd --system --gid k12 --home-dir /app k12
WORKDIR /app
COPY --from=builder /tmp/app.jar /app/app.jar
USER k12
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
