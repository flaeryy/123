

import { hashPassword, verifyPassword } from "./services/password.js";

async function testPassword() {
  const password = "TestLozinka123!";

  const hash = await hashPassword(password);

  console.log("Generirani hash:", hash);

  const correctPassword = await verifyPassword(hash, password);
  const wrongPassword = await verifyPassword(hash, "PogresnaLozinka");

  console.log("Ispravna lozinka:", correctPassword);
  console.log("Pogrešna lozinka:", wrongPassword);
}

testPassword();
