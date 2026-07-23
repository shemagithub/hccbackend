import { app, startServer } from "./index.js";

export default app;

const isPassengerRuntime =
  typeof PhusionPassenger !== "undefined" || Boolean(process.env.PASSENGER_APP_ENV);

if (!isPassengerRuntime) {
  void startServer();
}
