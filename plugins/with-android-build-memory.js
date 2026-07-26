const { withGradleProperties } = require("@expo/config-plugins");

const BUILD_PROPERTIES = {
  "org.gradle.jvmargs":
    "-Xmx4096m -XX:MaxMetaspaceSize=1536m -Dfile.encoding=UTF-8",
  "org.gradle.workers.max": "2",
};

function upsertProperty(properties, key, value) {
  const existing = properties.find(
    (item) => item.type === "property" && item.key === key,
  );

  if (existing) {
    existing.value = value;
    return;
  }

  properties.push({ type: "property", key, value });
}

module.exports = function withAndroidBuildMemory(config) {
  return withGradleProperties(config, (gradleConfig) => {
    for (const [key, value] of Object.entries(BUILD_PROPERTIES)) {
      upsertProperty(gradleConfig.modResults, key, value);
    }

    return gradleConfig;
  });
};
