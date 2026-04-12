import { bootstrap } from "./app.js";

bootstrap().catch((error) => {
  console.error("DeBoMUDSounds: erro ao inicializar", error);
  alert("DeBoMUDSounds: erro ao inicializar. Veja o console para detalhes.");
});
