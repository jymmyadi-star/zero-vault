export default {
  expo: {
    name: "Socler",
    slug: "socler",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/icon.png",
    scheme: "socler",
    userInterfaceStyle: "dark",
    splash: {
      image: "./assets/splash-icon.png",
      backgroundColor: "#09090b",
      resizeMode: "contain",
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.socler.app",
      infoPlist: {
        NSFaceIDUsageDescription:
          "Socler uses biometrics to unlock your vault quickly.",
      },
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#09090b",
      },
      package: "com.socler.app",
    },
    plugins: [
      "expo-router",
      "expo-secure-store",
      ["expo-sqlite", { "useSQLCipher": true }],
      "expo-local-authentication",
      ["expo-build-properties", { "android": { "newArchEnabled": false } }],
      [
        "expo-splash-screen",
        {
          image: "./assets/splash-icon.png",
          backgroundColor: "#09090b",
          dark: {
            backgroundColor: "#09090b",
          },
        },
      ],
    ],
  },
};
