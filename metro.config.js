const path = require("node:path");
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);
const escape = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const privateDirectories = ["server", ".local", ".git", ".claude"];
if (process.env.TAOTL_ADMIN_BUILD !== "1") privateDirectories.push("admin");
const existing = config.resolver.blockList ?? [];
config.resolver.blockList = [
  ...(Array.isArray(existing) ? existing : [existing]),
  ...privateDirectories.map((directory) => new RegExp(`^${escape(path.join(__dirname, directory))}[/\\\\].*`)),
  new RegExp(`^${escape(path.join(__dirname, ".env"))}(?:\\..*)?$`),
];
module.exports = config;
