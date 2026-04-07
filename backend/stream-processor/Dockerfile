FROM eclipse-temurin:21-jre

WORKDIR /app

COPY app/build/libs/stream-processor.jar /app/stream-processor.jar

EXPOSE 8080

ENTRYPOINT ["java", "-jar", "/app/stream-processor.jar"]