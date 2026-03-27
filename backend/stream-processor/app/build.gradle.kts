// build.gradle.kts
plugins {
    id("com.github.johnrengelman.shadow") version "8.1.1"
    id("java")
    application
}

group = "com.delivery"
version = "1.0.0"

repositories {
    mavenCentral()
}

dependencies {
    implementation("org.apache.kafka:kafka-streams:3.6.1")
    implementation("com.fasterxml.jackson.core:jackson-databind:2.16.1")
    implementation("com.fasterxml.jackson.datatype:jackson-datatype-jsr310:2.16.1")
    testImplementation("org.apache.kafka:kafka-streams-test-utils:3.6.1")
    testImplementation("org.junit.jupiter:junit-jupiter:5.10.1")
    testRuntimeOnly("org.junit.platform:junit-platform-launcher")
}

application {
    mainClass.set("com.delivery.Main")
}

tasks.shadowJar {
    archiveClassifier.set("")
    archiveFileName.set("stream-processor.jar")
}

tasks.named<Test>("test") {
    useJUnitPlatform()
}
