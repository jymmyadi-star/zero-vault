export default {
  expo: {
    name: "Zero Vault",
    slug: "zero-vault",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/icon.png",
    scheme: "zerovault",
    userInterfaceStyle: "dark",
    splash: {
      image: "./assets/splash-icon.png",
      backgroundColor: "#09090b",
      resizeMode: "contain",
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.zerovault.app",
      infoPlist: {
        NSFaceIDUsageDescription:
          "Zero Vault uses biometrics to unlock your vault quickly.",
      },
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#09090b",
      },
      package: "com.zerovault.app",
    },
    plugins: [
      "expo-router",
      "expo-secure-store",
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
