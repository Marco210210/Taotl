module.exports = ({ config }) => {
  if (process.env.TAOTL_WEB_BUILD === "1") {
    return {
      ...config,
      web: { ...config.web, bundler: "metro", output: "single" },
      plugins: config.plugins.map((plugin) =>
        plugin === "expo-router" ? ["expo-router", { sitemap: false }] : plugin
      ),
    };
  }
  if (process.env.TAOTL_ADMIN_BUILD === "1") {
    return {
      ...config,
      name: "Taotl Amministrazione",
      web: {
        ...config.web,
        name: "Taotl Admin",
        shortName: "Taotl Admin",
        description: "Taotl Admin: pannello di amministrazione.",
        favicon: "./admin/public/admin-icon-512.png",
        bundler: "metro",
        output: "single",
      },
      plugins: config.plugins.map((plugin) =>
        plugin === "expo-router" ? ["expo-router", { root: "./admin/app", sitemap: false }] : plugin
      ),
    };
  }
  if (process.env.TAOTL_EXPO_GO !== "1") {
    return config;
  }

  // Expo Go deve usare il runtime dell'SDK installato. Le impostazioni EAS
  // restano disponibili per build e aggiornamenti eseguiti senza questa flag.
  const { owner, runtimeVersion, updates, ...expoGoConfig } = config;
  const extra = { ...expoGoConfig.extra };
  delete extra.eas;

  return {
    ...expoGoConfig,
    // Nell'elenco di Expo Go può comparire anche il progetto EAS, che usa un
    // runtime nativo e non è avviabile dentro Expo Go. Un nome distinto evita
    // di aprire per errore quella voce invece del tunnel sempre aggiornato.
    name: "Taotl Live",
    extra,
  };
};
