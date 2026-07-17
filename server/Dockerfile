# DocPilot Server Dockerfile
# Stage 1: build with Maven
FROM maven:3.9-eclipse-temurin-17 AS builder
WORKDIR /build

# Copy pom first for layer caching
COPY pom.xml .
RUN mvn dependency:go-offline -B || true

# Copy source and build
COPY src ./src
RUN mvn clean package -DskipTests -B

# Stage 2: runtime
FROM eclipse-temurin:17-jre
WORKDIR /app

# Copy the built JAR
COPY --from=builder /build/target/docpilot-server-*.jar /app/app.jar

EXPOSE 8080

# Run with env from .env (if mounted) or environment variables
ENV JAVA_OPTS="-Xms256m -Xmx512m"
ENTRYPOINT ["sh", "-c", "java $JAVA_OPTS -jar /app/app.jar"]