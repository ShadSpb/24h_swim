import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/about.tsx"),
  route("rules", "routes/rules.tsx"),
  route("login", "routes/logon.tsx"),
] satisfies RouteConfig;
